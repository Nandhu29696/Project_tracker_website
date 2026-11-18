import {
  hasPermission,
  type ProjectAccess,
  type ProjectRole,
  type ProjectWorkItemAccess,
} from '@tracker/shared';
import type { Prisma } from '../../generated/prisma/client';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/**
 * Project-level authorisation, layered on top of the global role permissions:
 *  - ADMIN sees and manages every project.
 *  - Everyone else only sees projects they are a member of.
 *  - Managing (edit, members, environments, archive) needs project role MANAGER
 *    plus the global `project:update` permission.
 *  - Deleting needs the global `project:delete` permission (ADMIN).
 */
export function computeAccess(
  user: Express.AuthUser,
  projectRole: ProjectRole | null,
): ProjectAccess {
  const isAdmin = user.role === 'ADMIN';
  return {
    projectRole,
    canManage: isAdmin || (projectRole === 'MANAGER' && hasPermission(user.role, 'project:update')),
    canDelete: hasPermission(user.role, 'project:delete'),
  };
}

/**
 * Work item rights inside a project:
 *  - Writers = Admin, project Manager or project Member (Viewers are read-only).
 *  - Creating Epics/Features needs `workitem:create-epic` (global Admin / Manager).
 *  - Assigning to other people needs `workitem:assign`; others may only assign themselves.
 *  - Archived projects are read-only for everyone.
 */
export function projectWorkItemAccess(
  user: Express.AuthUser,
  projectRole: ProjectRole | null,
  archived: boolean,
): ProjectWorkItemAccess {
  const writer =
    !archived && (user.role === 'ADMIN' || projectRole === 'MANAGER' || projectRole === 'MEMBER');
  return {
    canCreate: writer && hasPermission(user.role, 'workitem:create'),
    canCreatePlanning: writer && hasPermission(user.role, 'workitem:create-epic'),
    canAssignOthers: writer && hasPermission(user.role, 'workitem:assign'),
  };
}

/** Prisma filter: projects the user may see. */
export function visibleProjectsWhere(user: Express.AuthUser): Prisma.ProjectWhereInput {
  return user.role === 'ADMIN' ? {} : { members: { some: { userId: user.id } } };
}

export async function loadProjectAccess(user: Express.AuthUser, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      key: true,
      name: true,
      ownerId: true,
      archivedAt: true,
      startDate: true,
      targetDate: true,
      members: { where: { userId: user.id }, select: { role: true } },
    },
  });
  const projectRole = project?.members[0]?.role ?? null;
  // Non-members get 404, not 403, so project existence is not leaked.
  if (!project || (user.role !== 'ADMIN' && !projectRole)) throw notFound('Project not found');
  return { project, access: computeAccess(user, projectRole) };
}

/** Loads the project and requires manage rights; optionally rejects archived projects. */
export async function requireManage(
  user: Express.AuthUser,
  projectId: string,
  { allowArchived = false } = {},
) {
  const result = await loadProjectAccess(user, projectId);
  if (!result.access.canManage) throw forbidden('Only project managers can change this project');
  if (!allowArchived && result.project.archivedAt) {
    throw badRequest(
      'This project is archived. Restore it before making changes.',
      'PROJECT_ARCHIVED',
    );
  }
  return result;
}
