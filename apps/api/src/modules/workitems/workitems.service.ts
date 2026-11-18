import {
  ALLOWED_PARENTS,
  BOARD_LEVEL_TYPES,
  canTransition,
  DONE_STATES,
  OPEN_STATES,
  PLANNING_TYPES,
  PRIORITY_LABELS,
  RESOLUTION_LABELS,
  SEVERITY_LABELS,
  STATE_CATEGORY,
  statesForType,
  WORK_ITEM_STATE_LABELS,
  WORK_ITEM_TYPE_LABELS,
  WORKFLOWS,
  type BoardData,
  type BoardQuery,
  type BoardSettings,
  type CreateWorkItemInput,
  type HistoryEntryDto,
  type ListWorkItemsQuery,
  type Paginated,
  type UpdateWorkItemInput,
  type WorkItemDetail,
  type WorkItemState,
  type WorkItemSummary,
  type WorkItemType,
} from '@tracker/shared';
import type { Prisma } from '../../generated/prisma/client';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { fromDbDate, toDbDate } from '../../lib/dates';
import { badRequest, forbidden } from '../../lib/errors';
import { notifyLater } from '../notifications/notifications.service';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { loadProjectAccess, projectWorkItemAccess, visibleProjectsWhere } from '../projects/access';
import { userRefSelect } from '../projects/project.mapper';
import { loadWorkItem, requireEdit, workItemKey } from './access';
import { notifyProject } from '../../lib/realtime';
import { recordSnapshotsLater } from '../iterations/snapshots';
import { removeStoredFiles } from './files';
import { detailInclude, summaryInclude, toDetail, toSummary } from './mapper';

export const itemUrl = (key: string) => `${env.APP_URL}/items/${key}`;

// ---- queries ----------------------------------------------------------------------------

export function buildWorkItemWhere(
  user: Express.AuthUser,
  q: ListWorkItemsQuery,
): Prisma.WorkItemWhereInput {
  const and: Prisma.WorkItemWhereInput[] = [{ project: visibleProjectsWhere(user) }];
  if (q.projectId) and.push({ projectId: q.projectId });
  if (q.type?.length) and.push({ type: { in: q.type } });
  if (q.state?.length) and.push({ state: { in: q.state } });
  if (q.status === 'open') and.push({ state: { in: OPEN_STATES } });
  if (q.status === 'done') and.push({ state: { in: DONE_STATES } });
  if (q.status === 'all') and.push({ state: { not: 'REMOVED' } });
  if (q.status === 'removed') and.push({ state: 'REMOVED' });
  if (q.priority?.length) and.push({ priority: { in: q.priority } });
  if (q.severity?.length) and.push({ severity: { in: q.severity } });
  if (q.assignee === 'me') and.push({ assigneeId: user.id });
  else if (q.assignee === 'none') and.push({ assigneeId: null });
  else if (q.assignee) and.push({ assigneeId: q.assignee });
  if (q.createdBy) and.push({ createdById: q.createdBy === 'me' ? user.id : q.createdBy });
  if (q.parentId) and.push({ parentId: q.parentId });
  if (q.iteration) and.push({ iterationId: q.iteration === 'none' ? null : q.iteration });
  if (q.tag) and.push({ tags: { has: q.tag } });
  if (q.q) {
    const key = q.q.toUpperCase().match(/^([A-Z][A-Z0-9]{1,9})-(\d{1,7})$/);
    const or: Prisma.WorkItemWhereInput[] = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { description: { contains: q.q, mode: 'insensitive' } },
    ];
    if (key) or.push({ number: Number(key[2]), project: { key: key[1] } });
    else if (/^\d{1,7}$/.test(q.q)) or.push({ number: Number(q.q) });
    and.push({ OR: or });
  }
  return { AND: and };
}

function buildOrder(q: ListWorkItemsQuery): Prisma.WorkItemOrderByWithRelationInput[] {
  const primary: Prisma.WorkItemOrderByWithRelationInput =
    q.sort === 'severity' || q.sort === 'dueDate'
      ? { [q.sort]: { sort: q.order, nulls: 'last' } }
      : { [q.sort]: q.order };
  return [primary, { updatedAt: 'desc' }, { number: 'desc' }];
}

export async function listWorkItems(
  user: Express.AuthUser,
  q: ListWorkItemsQuery,
): Promise<Paginated<WorkItemSummary>> {
  const where = buildWorkItemWhere(user, q);
  const [total, rows] = await prisma.$transaction([
    prisma.workItem.count({ where }),
    prisma.workItem.findMany({
      where,
      include: summaryInclude,
      orderBy: buildOrder(q),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { data: rows.map(toSummary), meta: { page: q.page, pageSize: q.pageSize, total } };
}

const BACKLOG_LIMIT = 3000;

/** Every (non-removed) item of a project; the client builds the tree from parentId. */
export async function projectBacklog(
  user: Express.AuthUser,
  projectId: string,
  includeDone: boolean,
) {
  await loadProjectAccess(user, projectId);
  const rows = await prisma.workItem.findMany({
    where: {
      projectId,
      state: includeDone ? { not: 'REMOVED' } : { in: OPEN_STATES },
    },
    include: summaryInclude,
    orderBy: [{ rank: 'asc' }, { number: 'asc' }],
    take: BACKLOG_LIMIT,
  });
  return { data: rows.map(toSummary), meta: { truncated: rows.length === BACKLOG_LIMIT } };
}

export async function getWorkItem(user: Express.AuthUser, id: string): Promise<WorkItemDetail> {
  const { access, canManageProject } = await loadWorkItem(user, id);
  const row = await prisma.workItem.findUniqueOrThrow({ where: { id }, include: detailInclude });
  return toDetail(row, access, { userId: user.id, canManageProject });
}

// ---- validation helpers -----------------------------------------------------------------

async function assertAssignee(
  projectId: string,
  assigneeId: string | null | undefined,
  user: Express.AuthUser,
  canAssignOthers: boolean,
) {
  if (!assigneeId) return null;
  if (assigneeId !== user.id && !canAssignOthers) {
    throw forbidden('You can only assign work items to yourself', 'ASSIGN_SELF_ONLY');
  }
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    include: { user: { select: { ...userRefSelect, isActive: true } } },
  });
  if (!member) throw badRequest('The assignee must be a member of this project', 'NOT_A_MEMBER');
  if (!member.user.isActive) throw badRequest('The assignee is deactivated', 'USER_INACTIVE');
  return member.user;
}

async function assertParent(
  projectId: string,
  type: WorkItemType,
  parentId: string | null | undefined,
) {
  if (!parentId) return null;
  const parent = await prisma.workItem.findUnique({
    where: { id: parentId },
    include: { project: { select: { key: true } } },
  });
  if (!parent || parent.projectId !== projectId) {
    throw badRequest('The parent must be a work item in the same project', 'INVALID_PARENT');
  }
  if (!ALLOWED_PARENTS[type].includes(parent.type)) {
    const allowed = ALLOWED_PARENTS[type].map((t) => WORK_ITEM_TYPE_LABELS[t]).join(' or ');
    throw badRequest(
      allowed
        ? `A ${WORK_ITEM_TYPE_LABELS[type]} can only be a child of a ${allowed}`
        : `A ${WORK_ITEM_TYPE_LABELS[type]} cannot have a parent`,
      'INVALID_PARENT',
    );
  }
  return parent;
}

/** Bug-only fields are cleared for other types. */
function bugFields(type: WorkItemType, input: Partial<CreateWorkItemInput>) {
  if (type === 'BUG') {
    return {
      severity: input.severity,
      environment: input.environment,
      reproSteps: input.reproSteps,
      expectedResult: input.expectedResult,
      actualResult: input.actualResult,
    };
  }
  return {};
}

/** A sprint of the same project that is still open for planning. */
async function assertIteration(projectId: string, iterationId: string | null | undefined) {
  if (!iterationId) return null;
  const it = await prisma.iteration.findUnique({ where: { id: iterationId } });
  if (!it || it.projectId !== projectId) {
    throw badRequest('The sprint must belong to the same project', 'INVALID_SPRINT');
  }
  if (it.state === 'COMPLETED')
    throw badRequest('That sprint is already completed', 'SPRINT_COMPLETED');
  return it;
}

/** Live update for open boards + burndown snapshot for affected sprints. */
function afterChange(projectId: string, iterationIds: (string | null | undefined)[]) {
  notifyProject(projectId, 'workitems');
  recordSnapshotsLater(iterationIds);
}

// ---- board ------------------------------------------------------------------------------

const BOARD_LIMIT = 1000;

export async function getBoard(
  user: Express.AuthUser,
  projectId: string,
  q: BoardQuery,
): Promise<BoardData> {
  const { project, access } = await loadProjectAccess(user, projectId);
  const settings = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { boardSettings: true },
  });
  const doneSince = new Date(Date.now() - q.doneDays * 86_400_000);
  const where: Prisma.WorkItemWhereInput = {
    projectId,
    type: { in: BOARD_LEVEL_TYPES[q.level] },
    state: { not: 'REMOVED' },
    // keep the Done column short: only recently closed items
    OR: [{ closedAt: null }, { closedAt: { gte: doneSince } }],
    ...(q.iteration ? { iterationId: q.iteration === 'none' ? null : q.iteration } : {}),
    ...(q.assignee === 'me'
      ? { assigneeId: user.id }
      : q.assignee === 'none'
        ? { assigneeId: null }
        : q.assignee
          ? { assigneeId: q.assignee }
          : {}),
  };
  const rows = await prisma.workItem.findMany({
    where,
    include: summaryInclude,
    orderBy: [{ rank: 'asc' }, { number: 'asc' }],
    take: BOARD_LIMIT,
  });
  const pw = projectWorkItemAccess(user, access.projectRole, !!project.archivedAt);
  return {
    items: rows.map(toSummary),
    wipLimits: (settings.boardSettings as BoardSettings | null)?.wipLimits ?? {},
    canManage: access.canManage && !project.archivedAt,
    canEdit: pw.canCreate,
    truncated: rows.length === BOARD_LIMIT,
  };
}

export async function updateBoardSettings(
  user: Express.AuthUser,
  projectId: string,
  settings: BoardSettings,
) {
  const { project, access } = await loadProjectAccess(user, projectId);
  if (!access.canManage) throw forbidden('Only project managers can change board settings');
  if (project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  const clean = Object.fromEntries(
    Object.entries(settings.wipLimits).filter(([, v]) => typeof v === 'number'),
  );
  await prisma.project.update({
    where: { id: projectId },
    data: { boardSettings: { wipLimits: clean } },
  });
  notifyProject(projectId, 'board');
  return { wipLimits: clean };
}

// ---- create -----------------------------------------------------------------------------

export async function createWorkItem(
  user: Express.AuthUser,
  projectId: string,
  input: CreateWorkItemInput,
): Promise<WorkItemDetail> {
  const { project, access } = await loadProjectAccess(user, projectId);
  const pw = projectWorkItemAccess(user, access.projectRole, !!project.archivedAt);
  if (project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  if (!pw.canCreate) throw forbidden('Viewers cannot create work items');
  if (PLANNING_TYPES.includes(input.type) && !pw.canCreatePlanning) {
    throw forbidden('Only Admins and Managers can create Epics and Features');
  }
  const assignee = await assertAssignee(projectId, input.assigneeId, user, pw.canAssignOthers);
  await assertParent(projectId, input.type, input.parentId);
  const iteration = await assertIteration(projectId, input.iterationId);

  const created = await prisma.$transaction(async (tx) => {
    const { workItemSeq } = await tx.project.update({
      where: { id: projectId },
      data: { workItemSeq: { increment: 1 } },
      select: { workItemSeq: true },
    });
    const item = await tx.workItem.create({
      data: {
        projectId,
        number: workItemSeq,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        state: WORKFLOWS[input.type].initial,
        priority: input.priority,
        ...bugFields(input.type, input),
        severity: input.type === 'BUG' ? (input.severity ?? 'S3_MEDIUM') : null,
        assigneeId: assignee?.id ?? null,
        parentId: input.parentId ?? null,
        iterationId: iteration?.id ?? null,
        storyPoints: input.storyPoints ?? null,
        originalEstimate: input.originalEstimate ?? null,
        remainingWork: input.remainingWork ?? input.originalEstimate ?? null,
        completedWork: input.completedWork ?? null,
        startDate: toDbDate(input.startDate),
        dueDate: toDbDate(input.dueDate),
        tags: input.tags ?? [],
        createdById: user.id,
        rank: workItemSeq,
      },
    });
    await tx.workItemHistory.create({
      data: {
        workItemId: item.id,
        actorId: user.id,
        field: 'created',
        newValue: WORK_ITEM_TYPE_LABELS[input.type],
      },
    });
    return item;
  });

  const key = workItemKey(project.key, created.number);
  audit({
    actorId: user.id,
    action: 'workitem.created',
    entity: 'work_item',
    entityId: created.id,
    metadata: { key },
  });
  if (assignee)
    notifyAssigned(user, assignee.id, {
      id: created.id,
      projectId,
      key,
      title: created.title,
      type: created.type,
      priority: created.priority,
    });
  afterChange(projectId, [created.iterationId]);
  return getWorkItem(user, created.id);
}

// ---- update -----------------------------------------------------------------------------

type HistoryRow = { field: string; oldValue: string | null; newValue: string | null };

const num = (v: number | null | undefined) => (v === null || v === undefined ? null : String(v));

export async function updateWorkItem(
  user: Express.AuthUser,
  id: string,
  input: UpdateWorkItemInput,
): Promise<WorkItemDetail> {
  const { item, access } = await loadWorkItem(user, id);
  requireEdit(access, !!item.project.archivedAt);

  const data: Prisma.WorkItemUncheckedUpdateInput = {};
  const history: HistoryRow[] = [];
  const track = (field: string, oldValue: string | null, newValue: string | null) => {
    if (oldValue !== newValue) history.push({ field, oldValue, newValue });
  };
  const isBug = item.type === 'BUG';
  let newAssigneeId: string | null | undefined; // undefined = assignee unchanged

  if (input.title !== undefined && input.title !== item.title) {
    data.title = input.title;
    track('Title', item.title, input.title);
  }
  if (input.description !== undefined && input.description !== item.description) {
    data.description = input.description;
    history.push({ field: 'Description', oldValue: null, newValue: 'edited' });
  }
  if (input.priority && input.priority !== item.priority) {
    data.priority = input.priority;
    track('Priority', PRIORITY_LABELS[item.priority], PRIORITY_LABELS[input.priority]);
  }

  // state + workflow
  if (input.state && input.state !== item.state) {
    if (
      !statesForType(item.type).includes(input.state) ||
      !canTransition(item.type, item.state, input.state)
    ) {
      throw badRequest(
        `A ${WORK_ITEM_TYPE_LABELS[item.type]} cannot move from ${WORK_ITEM_STATE_LABELS[item.state]} to ${WORK_ITEM_STATE_LABELS[input.state]}`,
        'INVALID_TRANSITION',
      );
    }
    data.state = input.state;
    data.stateChangedAt = new Date();
    const cat = STATE_CATEGORY[input.state];
    data.closedAt = cat === 'completed' ? new Date() : null;
    track('State', WORK_ITEM_STATE_LABELS[item.state], WORK_ITEM_STATE_LABELS[input.state]);

    if (isBug) {
      if (cat === 'resolved' || cat === 'completed') {
        const resolution = input.resolution ?? item.resolution ?? 'FIXED';
        if (resolution !== item.resolution) {
          data.resolution = resolution;
          track(
            'Resolution',
            item.resolution && RESOLUTION_LABELS[item.resolution],
            RESOLUTION_LABELS[resolution],
          );
        }
      } else if (item.resolution) {
        data.resolution = null; // re-opened
        track('Resolution', RESOLUTION_LABELS[item.resolution], null);
      }
    }
    if (item.type === 'TASK' && input.state === 'DONE' && item.remainingWork) {
      data.remainingWork = 0;
      track('Remaining work', num(item.remainingWork), '0');
    }
  } else if (input.resolution !== undefined && isBug && input.resolution !== item.resolution) {
    data.resolution = input.resolution;
    track(
      'Resolution',
      item.resolution && RESOLUTION_LABELS[item.resolution],
      input.resolution && RESOLUTION_LABELS[input.resolution],
    );
  }

  // assignee
  if (input.assigneeId !== undefined && input.assigneeId !== item.assigneeId) {
    if (!access.canAssignOthers && item.assigneeId && item.assigneeId !== user.id) {
      throw forbidden(
        'Only Admins and Managers can reassign work from someone else',
        'ASSIGN_SELF_ONLY',
      );
    }
    const assignee = await assertAssignee(
      item.projectId,
      input.assigneeId,
      user,
      access.canAssignOthers,
    );
    const previous = item.assigneeId
      ? await prisma.user.findUnique({ where: { id: item.assigneeId }, select: { name: true } })
      : null;
    data.assigneeId = assignee?.id ?? null;
    track('Assigned to', previous?.name ?? null, assignee?.name ?? null);
    newAssigneeId = assignee?.id ?? null; // notified after the save succeeds
  }

  // parent
  if (input.parentId !== undefined && input.parentId !== item.parentId) {
    if (input.parentId === item.id)
      throw badRequest('An item cannot be its own parent', 'INVALID_PARENT');
    const parent = await assertParent(item.projectId, item.type, input.parentId);
    const oldParent = item.parentId
      ? await prisma.workItem.findUnique({ where: { id: item.parentId }, select: { number: true } })
      : null;
    data.parentId = parent?.id ?? null;
    track(
      'Parent',
      oldParent ? workItemKey(item.project.key, oldParent.number) : null,
      parent ? workItemKey(item.project.key, parent.number) : null,
    );
  }

  // numbers
  const numeric = [
    ['storyPoints', 'Story points'],
    ['originalEstimate', 'Original estimate'],
    ['remainingWork', 'Remaining work'],
    ['completedWork', 'Completed work'],
  ] as const;
  for (const [field, label] of numeric) {
    const value = input[field];
    if (value !== undefined && value !== item[field] && data[field] === undefined) {
      data[field] = value;
      track(label, num(item[field]), num(value));
    }
  }

  // dates (validate against stored values when only one side changes)
  const start = input.startDate !== undefined ? input.startDate : fromDbDate(item.startDate);
  const due = input.dueDate !== undefined ? input.dueDate : fromDbDate(item.dueDate);
  if (start && due && start > due)
    throw badRequest('Due date must be on or after start date', 'INVALID_DATES');
  if (input.startDate !== undefined && input.startDate !== fromDbDate(item.startDate)) {
    data.startDate = toDbDate(input.startDate);
    track('Start date', fromDbDate(item.startDate), input.startDate);
  }
  if (input.dueDate !== undefined && input.dueDate !== fromDbDate(item.dueDate)) {
    data.dueDate = toDbDate(input.dueDate);
    track('Due date', fromDbDate(item.dueDate), input.dueDate);
  }

  if (input.tags !== undefined && input.tags.join(',') !== item.tags.join(',')) {
    data.tags = input.tags;
    track('Tags', item.tags.join(', ') || null, input.tags.join(', ') || null);
  }

  // bug-only fields
  if (isBug) {
    if (input.severity !== undefined && input.severity !== item.severity) {
      data.severity = input.severity;
      track(
        'Severity',
        item.severity && SEVERITY_LABELS[item.severity],
        input.severity && SEVERITY_LABELS[input.severity],
      );
    }
    if (input.environment !== undefined && input.environment !== item.environment) {
      data.environment = input.environment;
      track('Found in', item.environment, input.environment);
    }
    const texts = [
      ['reproSteps', 'Repro steps'],
      ['expectedResult', 'Expected result'],
      ['actualResult', 'Actual result'],
    ] as const;
    for (const [field, label] of texts) {
      const value = input[field];
      if (value !== undefined && value !== item[field]) {
        data[field] = value;
        history.push({ field: label, oldValue: null, newValue: 'edited' });
      }
    }
  }

  // sprint (planning / board) - completed sprints are closed for changes
  if (input.iterationId !== undefined && input.iterationId !== item.iterationId) {
    const target = await assertIteration(item.projectId, input.iterationId);
    const previous = item.iterationId
      ? await prisma.iteration.findUnique({
          where: { id: item.iterationId },
          select: { name: true },
        })
      : null;
    data.iterationId = target?.id ?? null;
    track('Sprint', previous?.name ?? null, target?.name ?? null);
  }
  // board / backlog ordering - not worth a history entry
  if (input.rank !== undefined && input.rank !== item.rank) data.rank = input.rank;

  if (Object.keys(data).length) {
    await prisma.$transaction([
      prisma.workItem.update({ where: { id }, data }),
      prisma.workItemHistory.createMany({
        data: history.map((h) => ({ ...h, workItemId: id, actorId: user.id })),
      }),
    ]);
    afterChange(item.projectId, [item.iterationId, data.iterationId as string | null | undefined]);

    // notifications only after the change is saved
    const key = workItemKey(item.project.key, item.number);
    const ref = {
      id,
      projectId: item.projectId,
      key,
      title: (data.title as string | undefined) ?? item.title,
      type: item.type,
      priority: input.priority ?? item.priority,
    };
    if (newAssigneeId) notifyAssigned(user, newAssigneeId, ref);
    if (data.state) {
      const to = WORK_ITEM_STATE_LABELS[data.state as WorkItemState];
      const from = WORK_ITEM_STATE_LABELS[item.state];
      notifyLater({
        type: 'STATE_CHANGED',
        // the people who care: whoever created it and whoever owns it now
        userIds: [item.createdById, newAssigneeId === undefined ? item.assigneeId : newAssigneeId],
        actorId: user.id,
        title: `${key} moved to ${to}`,
        body: `${user.name}: ${from} → ${to} · ${ref.title}`,
        link: `/items/${key}`,
        projectId: item.projectId,
        workItemId: id,
        email: (r) =>
          templates.workItemActivity(
            'state-changed',
            r.name,
            `${user.name} moved it to ${to}`,
            { key, title: ref.title },
            `${from} → ${to}`,
            itemUrl(key),
          ),
      });
    }
  }
  return getWorkItem(user, id);
}

function notifyAssigned(
  actor: Express.AuthUser,
  assigneeId: string,
  item: {
    id: string;
    projectId: string;
    key: string;
    title: string;
    type: WorkItemType;
    priority: WorkItemSummary['priority'];
  },
) {
  notifyLater({
    type: 'ASSIGNED',
    userIds: [assigneeId],
    actorId: actor.id,
    title: `${actor.name} assigned ${item.key} to you`,
    body: item.title,
    link: `/items/${item.key}`,
    projectId: item.projectId,
    workItemId: item.id,
    email: (r) =>
      templates.workItemAssigned(
        r.name,
        actor.name,
        {
          key: item.key,
          title: item.title,
          typeLabel: WORK_ITEM_TYPE_LABELS[item.type],
          priorityLabel: PRIORITY_LABELS[item.priority],
        },
        itemUrl(item.key),
      ),
  });
}

export async function deleteWorkItem(user: Express.AuthUser, id: string) {
  const { item, access, key } = await loadWorkItem(user, id);
  if (item.project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  if (!access.canDelete) {
    throw forbidden(
      'Only project managers can delete work items. Set the state to Removed instead.',
    );
  }
  const files = await prisma.attachment.findMany({
    where: { workItemId: id },
    select: { storageKey: true },
  });
  await prisma.workItem.delete({ where: { id } });
  await removeStoredFiles(files.map((f) => f.storageKey));
  afterChange(item.projectId, [item.iterationId]);
  audit({
    actorId: user.id,
    action: 'workitem.deleted',
    entity: 'work_item',
    entityId: id,
    metadata: { key, title: item.title },
  });
}

export async function getHistory(user: Express.AuthUser, id: string): Promise<HistoryEntryDto[]> {
  await loadWorkItem(user, id);
  const rows = await prisma.workItemHistory.findMany({
    where: { workItemId: id },
    include: { actor: { select: userRefSelect } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  return rows.map((h) => ({
    id: h.id,
    field: h.field,
    oldValue: h.oldValue,
    newValue: h.newValue,
    actor: h.actor,
    createdAt: h.createdAt.toISOString(),
  }));
}
