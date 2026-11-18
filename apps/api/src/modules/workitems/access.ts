import { hasPermission, type WorkItemAccess } from '@tracker/shared';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { loadProjectAccess, projectWorkItemAccess } from '../projects/access';

export const workItemKey = (projectKey: string, number: number) => `${projectKey}-${number}`;

/**
 * Item-level rights (on top of projectWorkItemAccess):
 *  - edit: people who may assign others (Admin / Manager roles), or the item's assignee / creator
 *  - comment: any writer (Admin, project Manager, project Member)
 *  - delete: project managers with `workitem:delete`
 */
export function computeItemAccess(
  user: Express.AuthUser,
  ctx: {
    projectRole: Parameters<typeof projectWorkItemAccess>[1];
    canManageProject: boolean;
    archived: boolean;
  },
  item: { assigneeId: string | null; createdById: string | null },
): WorkItemAccess {
  const pw = projectWorkItemAccess(user, ctx.projectRole, ctx.archived);
  const writer = pw.canCreate;
  const own = item.assigneeId === user.id || item.createdById === user.id;
  return {
    canEdit: writer && hasPermission(user.role, 'workitem:update') && (pw.canAssignOthers || own),
    canAssignOthers: pw.canAssignOthers,
    canComment: writer && hasPermission(user.role, 'comment:create'),
    canDelete: writer && ctx.canManageProject && hasPermission(user.role, 'workitem:delete'),
  };
}

/** Loads an item the user may see (404 otherwise) plus the user's rights on it. */
export async function loadWorkItem(user: Express.AuthUser, id: string) {
  const item = await prisma.workItem.findUnique({
    where: { id },
    include: { project: { select: { id: true, key: true, name: true, archivedAt: true } } },
  });
  if (!item) throw notFound('Work item not found');
  let projectAccess;
  try {
    projectAccess = await loadProjectAccess(user, item.projectId);
  } catch {
    throw notFound('Work item not found');
  }
  const access = computeItemAccess(
    user,
    {
      projectRole: projectAccess.access.projectRole,
      canManageProject: projectAccess.access.canManage,
      archived: !!item.project.archivedAt,
    },
    item,
  );
  return {
    item,
    access,
    key: workItemKey(item.project.key, item.number),
    canManageProject: projectAccess.access.canManage,
  };
}

export async function findIdByKey(key: string): Promise<string> {
  const m = key.toUpperCase().match(/^([A-Z][A-Z0-9]{1,9})-(\d{1,7})$/);
  if (!m) throw badRequest('Invalid work item key');
  const item = await prisma.workItem.findFirst({
    where: { number: Number(m[2]), project: { key: m[1] } },
    select: { id: true },
  });
  if (!item) throw notFound('Work item not found');
  return item.id;
}

export function requireEdit(access: WorkItemAccess, archived: boolean) {
  if (archived) throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  if (!access.canEdit) {
    throw forbidden('You can only change work items assigned to you or created by you');
  }
}
