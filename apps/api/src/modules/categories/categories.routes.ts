import { Router } from 'express';
import { z } from 'zod';
import { categorySchema, hasPermission, updateCategorySchema } from '@tracker/shared';
import { audit } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, authorize } from '../../middleware/auth';

const idParam = z.object({ id: z.string().uuid('Invalid category id') });

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

/** Everyone signed in can read active categories; admins also see inactive ones. */
categoriesRouter.get('/', async (req, res) => {
  const includeInactive =
    req.query.includeInactive === 'true' && hasPermission(req.user!.role, 'settings:manage');
  const rows = await prisma.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { projects: true } } },
  });
  res.json({
    data: rows.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isActive: c.isActive,
      projectCount: c._count.projects,
    })),
  });
});

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  if (clash) throw conflict(`Category "${name}" already exists`, 'CATEGORY_EXISTS');
}

categoriesRouter.post('/', authorize('settings:manage'), async (req, res) => {
  const input = categorySchema.parse(req.body);
  await assertNameFree(input.name);
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.category.create({
    data: { ...input, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  audit({
    actorId: req.user!.id,
    action: 'category.created',
    entity: 'category',
    entityId: category.id,
  });
  res.status(201).json({ data: { ...category, projectCount: 0 } });
});

categoriesRouter.patch('/:id', authorize('settings:manage'), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const input = updateCategorySchema.parse(req.body);
  if (input.name) await assertNameFree(input.name, id);
  const category = await prisma.category.update({ where: { id }, data: input });
  audit({
    actorId: req.user!.id,
    action: 'category.updated',
    entity: 'category',
    entityId: id,
    metadata: input,
  });
  res.json({ data: category });
});

categoriesRouter.delete('/:id', authorize('settings:manage'), async (req, res) => {
  const { id } = idParam.parse(req.params);
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });
  if (!category) throw notFound('Category not found');
  if (category._count.projects > 0) {
    throw badRequest(
      'This category is used by projects. Deactivate it instead.',
      'CATEGORY_IN_USE',
    );
  }
  await prisma.category.delete({ where: { id } });
  audit({ actorId: req.user!.id, action: 'category.deleted', entity: 'category', entityId: id });
  res.status(204).end();
});
