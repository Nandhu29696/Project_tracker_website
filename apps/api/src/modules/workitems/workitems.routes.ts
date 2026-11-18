import express, { Router } from 'express';
import { z } from 'zod';
import {
  commentSchema,
  createLinkSchema,
  createWorkItemSchema,
  isImageType,
  boardQuerySchema,
  boardSettingsSchema,
  listWorkItemsQuerySchema,
  MAX_ATTACHMENT_BYTES,
  savedQuerySchema,
  updateCommentSchema,
  updateWorkItemSchema,
  workItemKeySchema,
  type SavedQueryDto,
} from '@tracker/shared';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, authorize } from '../../middleware/auth';
import { findIdByKey } from './access';
import * as collab from './collab.service';
import * as items from './workitems.service';

const uuid = (name: string) => z.object({ [name]: z.string().uuid('Invalid id') });
const param = (req: express.Request, name: string) => uuid(name).parse(req.params)[name] as string;

/** Mounted at /api/v1 - every route authenticates itself. */
export const workItemsRouter = Router();
const read = [authenticate, authorize('workitem:read')];

// ---- project scoped -------------------------------------------------------------------

workItemsRouter.get('/projects/:projectId/board', ...read, async (req, res) => {
  res.json({
    data: await items.getBoard(
      req.user!,
      param(req, 'projectId'),
      boardQuerySchema.parse(req.query),
    ),
  });
});

workItemsRouter.put(
  '/projects/:projectId/board-settings',
  authenticate,
  authorize('project:update'),
  async (req, res) => {
    const settings = boardSettingsSchema.parse(req.body);
    res.json({
      data: await items.updateBoardSettings(req.user!, param(req, 'projectId'), settings),
    });
  },
);

workItemsRouter.get('/projects/:projectId/backlog', ...read, async (req, res) => {
  const includeDone = req.query.includeDone !== 'false';
  res.json(await items.projectBacklog(req.user!, param(req, 'projectId'), includeDone));
});

workItemsRouter.post(
  '/projects/:projectId/work-items',
  authenticate,
  authorize('workitem:create'),
  async (req, res) => {
    const item = await items.createWorkItem(
      req.user!,
      param(req, 'projectId'),
      createWorkItemSchema.parse(req.body),
    );
    res.status(201).json({ data: item });
  },
);

// ---- work items -----------------------------------------------------------------------

workItemsRouter.get('/work-items', ...read, async (req, res) => {
  res.json(await items.listWorkItems(req.user!, listWorkItemsQuerySchema.parse(req.query)));
});

workItemsRouter.get('/work-items/key/:key', ...read, async (req, res) => {
  const id = await findIdByKey(workItemKeySchema.parse(req.params.key));
  res.json({ data: await items.getWorkItem(req.user!, id) });
});

workItemsRouter.get('/work-items/:id', ...read, async (req, res) => {
  res.json({ data: await items.getWorkItem(req.user!, param(req, 'id')) });
});

workItemsRouter.patch(
  '/work-items/:id',
  authenticate,
  authorize('workitem:update'),
  async (req, res) => {
    res.json({
      data: await items.updateWorkItem(
        req.user!,
        param(req, 'id'),
        updateWorkItemSchema.parse(req.body),
      ),
    });
  },
);

workItemsRouter.delete(
  '/work-items/:id',
  authenticate,
  authorize('workitem:delete'),
  async (req, res) => {
    await items.deleteWorkItem(req.user!, param(req, 'id'));
    res.status(204).end();
  },
);

workItemsRouter.get('/work-items/:id/history', ...read, async (req, res) => {
  res.json({ data: await items.getHistory(req.user!, param(req, 'id')) });
});

// ---- comments -------------------------------------------------------------------------

workItemsRouter.get('/work-items/:id/comments', ...read, async (req, res) => {
  res.json({ data: await collab.listComments(req.user!, param(req, 'id')) });
});

workItemsRouter.post(
  '/work-items/:id/comments',
  authenticate,
  authorize('comment:create'),
  async (req, res) => {
    res.status(201).json({
      data: await collab.addComment(req.user!, param(req, 'id'), commentSchema.parse(req.body)),
    });
  },
);

workItemsRouter.patch(
  '/comments/:id',
  authenticate,
  authorize('comment:create'),
  async (req, res) => {
    res.json({
      data: await collab.updateComment(
        req.user!,
        param(req, 'id'),
        updateCommentSchema.parse(req.body),
      ),
    });
  },
);

workItemsRouter.delete(
  '/comments/:id',
  authenticate,
  authorize('comment:create'),
  async (req, res) => {
    await collab.deleteComment(req.user!, param(req, 'id'));
    res.status(204).end();
  },
);

// ---- links ----------------------------------------------------------------------------

workItemsRouter.post(
  '/work-items/:id/links',
  authenticate,
  authorize('workitem:update'),
  async (req, res) => {
    const id = param(req, 'id');
    await collab.addLink(req.user!, id, createLinkSchema.parse(req.body));
    res.status(201).json({ data: await items.getWorkItem(req.user!, id) });
  },
);

workItemsRouter.delete(
  '/work-item-links/:id',
  authenticate,
  authorize('workitem:update'),
  async (req, res) => {
    await collab.deleteLink(req.user!, param(req, 'id'));
    res.status(204).end();
  },
);

// ---- attachments ----------------------------------------------------------------------

/** Body = raw file bytes; file name in the X-File-Name header (URI encoded). */
workItemsRouter.post(
  '/work-items/:id/attachments',
  authenticate,
  authorize('comment:create'),
  express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES + 1024 }),
  async (req, res) => {
    const header = req.headers['x-file-name'];
    if (typeof header !== 'string' || !header) throw badRequest('Missing X-File-Name header');
    let name: string;
    try {
      name = decodeURIComponent(header);
    } catch {
      throw badRequest('Invalid X-File-Name header');
    }
    if (!Buffer.isBuffer(req.body)) throw badRequest('Send the file bytes as the request body');
    res
      .status(201)
      .json({ data: await collab.addAttachment(req.user!, param(req, 'id'), name, req.body) });
  },
);

workItemsRouter.get('/attachments/:id', ...read, async (req, res) => {
  const { attachment, size, stream } = await collab.openAttachment(req.user!, param(req, 'id'));
  const inline = isImageType(attachment.mimeType) && req.query.download !== '1';
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Length', String(size));
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
  );
  // uploaded content must never run as a page in our origin
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  stream().pipe(res);
});

workItemsRouter.delete(
  '/attachments/:id',
  authenticate,
  authorize('comment:create'),
  async (req, res) => {
    await collab.deleteAttachment(req.user!, param(req, 'id'));
    res.status(204).end();
  },
);

// ---- saved queries (personal) ---------------------------------------------------------

const toSavedQuery = (q: {
  id: string;
  name: string;
  filters: unknown;
  createdAt: Date;
}): SavedQueryDto => ({
  id: q.id,
  name: q.name,
  filters: q.filters as Record<string, string>,
  createdAt: q.createdAt.toISOString(),
});

workItemsRouter.get('/saved-queries', ...read, async (req, res) => {
  const rows = await prisma.savedQuery.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { name: 'asc' },
  });
  res.json({ data: rows.map(toSavedQuery) });
});

workItemsRouter.post('/saved-queries', ...read, async (req, res) => {
  const input = savedQuerySchema.parse(req.body);
  listWorkItemsQuerySchema.parse(input.filters); // reject filters the list endpoint would not accept
  const count = await prisma.savedQuery.count({ where: { ownerId: req.user!.id } });
  if (count >= 50) throw badRequest('You can keep at most 50 saved queries');
  const exists = await prisma.savedQuery.findUnique({
    where: { ownerId_name: { ownerId: req.user!.id, name: input.name } },
  });
  if (exists) throw conflict(`You already have a query named "${input.name}"`, 'QUERY_EXISTS');
  const row = await prisma.savedQuery.create({
    data: { ownerId: req.user!.id, name: input.name, filters: input.filters },
  });
  res.status(201).json({ data: toSavedQuery(row) });
});

workItemsRouter.delete('/saved-queries/:id', ...read, async (req, res) => {
  const { count } = await prisma.savedQuery.deleteMany({
    where: { id: param(req, 'id'), ownerId: req.user!.id },
  });
  if (!count) throw notFound('Saved query not found');
  res.status(204).end();
});
