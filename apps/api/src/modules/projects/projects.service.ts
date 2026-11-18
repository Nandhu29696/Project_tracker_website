import {
  datesInOrder,
  PROJECT_ROLE_LABELS,
  hasPermission,
  type AddMemberInput,
  type BoardSettings,
  type CreateProjectInput,
  type EnvironmentInput,
  type ListProjectsQuery,
  type Paginated,
  type ProjectDetail,
  type ProjectRole,
  type ProjectSummary,
  type UpdateProjectInput,
} from '@tracker/shared';
import type { Prisma } from '../../generated/prisma/client';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { fromDbDate, toDbDate } from '../../lib/dates';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { notifyLater } from '../notifications/notifications.service';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import {
  computeAccess,
  loadProjectAccess,
  projectWorkItemAccess,
  requireManage,
  visibleProjectsWhere,
} from './access';
import { removeStoredFiles } from '../workitems/files';
import { generateUniqueKey } from './keys';
import {
  projectDetailInclude,
  projectSummaryInclude,
  toEnvironmentDto,
  toProjectDetail,
  toProjectSummary,
} from './project.mapper';

// ---- queries ----------------------------------------------------------------------------

export function buildProjectWhere(
  user: Express.AuthUser,
  q: ListProjectsQuery,
): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [visibleProjectsWhere(user)];
  if (q.archived === 'false') and.push({ archivedAt: null });
  if (q.archived === 'true') and.push({ archivedAt: { not: null } });
  if (q.status) and.push({ status: q.status });
  if (q.devStatus) and.push({ devStatus: q.devStatus });
  if (q.priority) and.push({ priority: q.priority });
  if (q.categoryId) and.push({ categoryId: q.categoryId });
  if (q.mine === 'true') and.push({ members: { some: { userId: user.id } } });
  if (q.q) {
    and.push({
      OR: [
        { name: { contains: q.q, mode: 'insensitive' } },
        { key: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
}

export function buildProjectOrder(q: ListProjectsQuery): Prisma.ProjectOrderByWithRelationInput[] {
  const nullable = q.sort === 'startDate' || q.sort === 'targetDate';
  const primary = nullable ? { [q.sort]: { sort: q.order, nulls: 'last' } } : { [q.sort]: q.order };
  return [primary as Prisma.ProjectOrderByWithRelationInput, { name: 'asc' }];
}

export async function listProjects(
  user: Express.AuthUser,
  q: ListProjectsQuery,
): Promise<Paginated<ProjectSummary>> {
  const where = buildProjectWhere(user, q);
  const [total, rows] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: projectSummaryInclude(user.id),
      orderBy: buildProjectOrder(q),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    data: rows.map((p) => toProjectSummary(p, computeAccess(user, p.members[0]?.role ?? null))),
    meta: { page: q.page, pageSize: q.pageSize, total },
  };
}

export async function getProject(user: Express.AuthUser, id: string): Promise<ProjectDetail> {
  const { access } = await loadProjectAccess(user, id);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: projectDetailInclude,
  });
  return toProjectDetail(
    project,
    access,
    projectWorkItemAccess(user, access.projectRole, !!project.archivedAt),
    {
      boardSettings: project.boardSettings as BoardSettings,
      // vault: admins and project managers (needs vault:reveal)
      canUseVault: access.canManage && hasPermission(user.role, 'vault:reveal'),
    },
  );
}

// ---- commands ---------------------------------------------------------------------------

async function assertCategory(categoryId: string | null | undefined) {
  if (!categoryId) return;
  const exists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!exists) throw badRequest('Selected category does not exist', 'CATEGORY_NOT_FOUND');
}

export async function createProject(user: Express.AuthUser, input: CreateProjectInput) {
  await assertCategory(input.categoryId);
  let key = input.key;
  if (key) {
    const taken = await prisma.project.findUnique({ where: { key }, select: { id: true } });
    if (taken) throw conflict(`Project key ${key} is already in use`, 'KEY_TAKEN');
  } else {
    key = await generateUniqueKey(input.name);
  }

  const project = await prisma.project.create({
    data: {
      key,
      name: input.name,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      priority: input.priority,
      status: input.status,
      devStatus: input.devStatus,
      startDate: toDbDate(input.startDate),
      targetDate: toDbDate(input.targetDate),
      ownerId: user.id,
      createdById: user.id,
      members: { create: { userId: user.id, role: 'MANAGER' } },
    },
  });
  audit({
    actorId: user.id,
    action: 'project.created',
    entity: 'project',
    entityId: project.id,
    metadata: { key },
  });
  return getProject(user, project.id);
}

export async function updateProject(user: Express.AuthUser, id: string, input: UpdateProjectInput) {
  const { project } = await requireManage(user, id);
  await assertCategory(input.categoryId);

  // validate date order against stored values when only one side changes
  const start = input.startDate !== undefined ? input.startDate : fromDbDate(project.startDate);
  const end = input.targetDate !== undefined ? input.targetDate : fromDbDate(project.targetDate);
  if (!datesInOrder(start, end)) {
    throw badRequest('End date must be on or after start date', 'INVALID_DATES');
  }

  await prisma.project.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      priority: input.priority,
      status: input.status,
      devStatus: input.devStatus,
      startDate: toDbDate(input.startDate),
      targetDate: toDbDate(input.targetDate),
    },
  });
  audit({
    actorId: user.id,
    action: 'project.updated',
    entity: 'project',
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });
  return getProject(user, id);
}

export async function setArchived(user: Express.AuthUser, id: string, archived: boolean) {
  await requireManage(user, id, { allowArchived: true });
  await prisma.project.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
  audit({
    actorId: user.id,
    action: archived ? 'project.archived' : 'project.restored',
    entity: 'project',
    entityId: id,
  });
  return getProject(user, id);
}

export async function deleteProject(user: Express.AuthUser, id: string) {
  const { project, access } = await loadProjectAccess(user, id);
  if (!access.canDelete) throw forbidden('Only administrators can delete projects');
  if (!project.archivedAt) {
    throw badRequest('Archive the project before deleting it', 'NOT_ARCHIVED');
  }
  const files = await prisma.attachment.findMany({
    where: { workItem: { projectId: id } },
    select: { storageKey: true },
  });
  await prisma.project.delete({ where: { id } }); // cascades work items, comments, attachments
  await removeStoredFiles(files.map((f) => f.storageKey));
  audit({
    actorId: user.id,
    action: 'project.deleted',
    entity: 'project',
    entityId: id,
    metadata: { key: project.key, name: project.name },
  });
}

// ---- members ----------------------------------------------------------------------------

const projectUrl = (id: string) => `${env.APP_URL}/projects/${id}`;

async function assertCanBeProjectRole(userId: string, role: ProjectRole) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound('User not found');
  if (!target.isActive) throw badRequest('This user is deactivated', 'USER_INACTIVE');
  if (role === 'MANAGER' && target.role === 'EMPLOYEE') {
    throw badRequest(
      'Only users with the Admin or Manager role can be project managers',
      'ROLE_NOT_ALLOWED',
    );
  }
  return target;
}

async function assertKeepsAManager(projectId: string, userId: string) {
  const managers = await prisma.projectMember.count({
    where: { projectId, role: 'MANAGER', userId: { not: userId } },
  });
  if (managers === 0)
    throw badRequest('A project needs at least one project manager', 'LAST_MANAGER');
}

export async function addMember(user: Express.AuthUser, projectId: string, input: AddMemberInput) {
  const { project } = await requireManage(user, projectId);
  const target = await assertCanBeProjectRole(input.userId, input.role);
  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: input.userId } },
  });
  if (existing)
    throw conflict(`${target.name} is already a member of this project`, 'ALREADY_MEMBER');

  await prisma.projectMember.create({
    data: { projectId, userId: input.userId, role: input.role },
  });
  audit({
    actorId: user.id,
    action: 'project.member_added',
    entity: 'project',
    entityId: projectId,
    metadata: { userId: input.userId, role: input.role },
  });
  notifyLater({
    type: 'ADDED_TO_PROJECT',
    userIds: [target.id],
    actorId: user.id,
    title: `${user.name} added you to ${project.key} · ${project.name}`,
    body: `Role: ${PROJECT_ROLE_LABELS[input.role]}`,
    link: `/projects/${projectId}`,
    projectId,
    email: (r) =>
      templates.projectMemberAdded(
        r.name,
        user.name,
        project.name,
        project.key,
        PROJECT_ROLE_LABELS[input.role],
        projectUrl(projectId),
      ),
  });
  return getProject(user, projectId);
}

export async function updateMemberRole(
  user: Express.AuthUser,
  projectId: string,
  userId: string,
  role: ProjectRole,
) {
  await requireManage(user, projectId);
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw notFound('Member not found');
  await assertCanBeProjectRole(userId, role);
  if (member.role === 'MANAGER' && role !== 'MANAGER') await assertKeepsAManager(projectId, userId);

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
  });
  audit({
    actorId: user.id,
    action: 'project.member_role_changed',
    entity: 'project',
    entityId: projectId,
    metadata: { userId, from: member.role, to: role },
  });
  return getProject(user, projectId);
}

export async function removeMember(user: Express.AuthUser, projectId: string, userId: string) {
  const { project } = await requireManage(user, projectId);
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw notFound('Member not found');
  if (project.ownerId === userId) {
    throw badRequest('The project owner cannot be removed', 'OWNER_REMOVAL');
  }
  if (member.role === 'MANAGER') await assertKeepsAManager(projectId, userId);

  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  audit({
    actorId: user.id,
    action: 'project.member_removed',
    entity: 'project',
    entityId: projectId,
    metadata: { userId },
  });
  return getProject(user, projectId);
}

// ---- environments -----------------------------------------------------------------------

export async function addEnvironment(
  user: Express.AuthUser,
  projectId: string,
  input: EnvironmentInput,
) {
  await requireManage(user, projectId);
  const exists = await prisma.environment.findUnique({
    where: { projectId_type: { projectId, type: input.type } },
  });
  if (exists) throw conflict(`This project already has a ${input.type} environment`, 'ENV_EXISTS');
  const created = await prisma.environment.create({
    data: { ...input, deployedAt: toDbDate(input.deployedAt), projectId },
  });
  audit({
    actorId: user.id,
    action: 'project.environment_added',
    entity: 'project',
    entityId: projectId,
    metadata: { type: input.type },
  });
  return toEnvironmentDto(created);
}

async function loadEnvironment(user: Express.AuthUser, envId: string) {
  const environment = await prisma.environment.findUnique({ where: { id: envId } });
  if (!environment) throw notFound('Environment not found');
  await requireManage(user, environment.projectId);
  return environment;
}

export async function updateEnvironment(
  user: Express.AuthUser,
  envId: string,
  input: Partial<EnvironmentInput>,
) {
  const current = await loadEnvironment(user, envId);
  if (input.type && input.type !== current.type) {
    const clash = await prisma.environment.findUnique({
      where: { projectId_type: { projectId: current.projectId, type: input.type } },
    });
    if (clash) throw conflict(`This project already has a ${input.type} environment`, 'ENV_EXISTS');
  }
  const updated = await prisma.environment.update({
    where: { id: envId },
    data: { ...input, deployedAt: toDbDate(input.deployedAt) },
  });
  await prisma.project.update({
    where: { id: current.projectId },
    data: { updatedAt: new Date() },
  });
  audit({
    actorId: user.id,
    action: 'project.environment_updated',
    entity: 'project',
    entityId: current.projectId,
    metadata: { type: updated.type },
  });
  return toEnvironmentDto(updated);
}

export async function deleteEnvironment(user: Express.AuthUser, envId: string) {
  const current = await loadEnvironment(user, envId);
  await prisma.environment.delete({ where: { id: envId } });
  audit({
    actorId: user.id,
    action: 'project.environment_removed',
    entity: 'project',
    entityId: current.projectId,
    metadata: { type: current.type },
  });
}
