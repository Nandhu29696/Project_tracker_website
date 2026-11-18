import {
  hasPermission,
  STATE_CATEGORY,
  workingDays,
  type BurndownPoint,
  type CapacityInput,
  type CreateIterationInput,
  type IterationDto,
  type IterationState,
  type SprintDetail,
  type UpdateIterationInput,
} from '@tracker/shared';
import type { Iteration } from '../../generated/prisma/client';
import { audit } from '../../lib/audit';
import { fromDbDate, toDbDate } from '../../lib/dates';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { notifyProject } from '../../lib/realtime';
import { loadProjectAccess, visibleProjectsWhere } from '../projects/access';
import { userRefSelect } from '../projects/project.mapper';
import { computeStats, recordSnapshots, type IterationStats } from './snapshots';

function toDto(it: Iteration, stats: IterationStats): IterationDto {
  return {
    id: it.id,
    projectId: it.projectId,
    name: it.name,
    goal: it.goal,
    startDate: fromDbDate(it.startDate)!,
    endDate: fromDbDate(it.endDate)!,
    state: it.state,
    stats,
  };
}

async function requireSprintManager(user: Express.AuthUser, projectId: string) {
  const ctx = await loadProjectAccess(user, projectId);
  if (!ctx.access.canManage || !hasPermission(user.role, 'iteration:manage')) {
    throw forbidden('Only project managers can plan sprints');
  }
  if (ctx.project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  return ctx;
}

async function loadIteration(user: Express.AuthUser, id: string) {
  const it = await prisma.iteration.findUnique({ where: { id } });
  if (!it) throw notFound('Sprint not found');
  const ctx = await loadProjectAccess(user, it.projectId).catch(() => {
    throw notFound('Sprint not found');
  });
  return { it, ctx };
}

const stateOrder: Record<IterationState, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2 };

export async function listProjectIterations(
  user: Express.AuthUser,
  projectId: string,
): Promise<IterationDto[]> {
  await loadProjectAccess(user, projectId);
  const rows = await prisma.iteration.findMany({
    where: { projectId },
    orderBy: { startDate: 'asc' },
  });
  const stats = await computeStats(rows.map((r) => r.id));
  return rows
    .sort(
      (a, b) =>
        stateOrder[a.state] - stateOrder[b.state] ||
        (a.state === 'COMPLETED' ? b.startDate.getTime() - a.startDate.getTime() : 0),
    )
    .map((r) => toDto(r, stats.get(r.id)!));
}

/** Sprints across all projects the user can see (for the global Sprints page). */
export async function listMyIterations(user: Express.AuthUser, states: IterationState[]) {
  const rows = await prisma.iteration.findMany({
    where: { state: { in: states }, project: { ...visibleProjectsWhere(user), archivedAt: null } },
    include: { project: { select: { id: true, key: true, name: true } } },
    orderBy: [{ state: 'asc' }, { endDate: 'asc' }],
    take: 200,
  });
  const stats = await computeStats(rows.map((r) => r.id));
  return rows.map((r) => ({ ...toDto(r, stats.get(r.id)!), project: r.project }));
}

export async function createIteration(
  user: Express.AuthUser,
  projectId: string,
  input: CreateIterationInput,
) {
  await requireSprintManager(user, projectId);
  const it = await prisma.iteration.create({
    data: {
      projectId,
      name: input.name,
      goal: input.goal,
      startDate: toDbDate(input.startDate)!,
      endDate: toDbDate(input.endDate)!,
    },
  });
  audit({
    actorId: user.id,
    action: 'sprint.created',
    entity: 'project',
    entityId: projectId,
    metadata: { sprint: it.name },
  });
  notifyProject(projectId, 'iterations');
  return toDto(it, (await computeStats([it.id])).get(it.id)!);
}

export async function updateIteration(
  user: Express.AuthUser,
  id: string,
  input: UpdateIterationInput,
) {
  const { it } = await loadIteration(user, id);
  await requireSprintManager(user, it.projectId);
  if (it.state === 'COMPLETED')
    throw badRequest('Completed sprints cannot be changed', 'SPRINT_COMPLETED');
  const start = input.startDate ?? fromDbDate(it.startDate)!;
  const end = input.endDate ?? fromDbDate(it.endDate)!;
  if (start > end) throw badRequest('End date must be on or after start date', 'INVALID_DATES');
  const updated = await prisma.iteration.update({
    where: { id },
    data: {
      name: input.name,
      goal: input.goal === undefined ? undefined : input.goal || null,
      startDate: input.startDate ? toDbDate(input.startDate)! : undefined,
      endDate: input.endDate ? toDbDate(input.endDate)! : undefined,
    },
  });
  notifyProject(it.projectId, 'iterations');
  return toDto(updated, (await computeStats([id])).get(id)!);
}

export async function deleteIteration(user: Express.AuthUser, id: string) {
  const { it } = await loadIteration(user, id);
  await requireSprintManager(user, it.projectId);
  if (it.state === 'ACTIVE')
    throw badRequest('Complete the sprint before deleting it', 'SPRINT_ACTIVE');
  await prisma.iteration.delete({ where: { id } }); // items fall back to the backlog (SET NULL)
  audit({
    actorId: user.id,
    action: 'sprint.deleted',
    entity: 'project',
    entityId: it.projectId,
    metadata: { sprint: it.name },
  });
  notifyProject(it.projectId, 'iterations');
  notifyProject(it.projectId, 'workitems');
}

export async function startIteration(user: Express.AuthUser, id: string) {
  const { it } = await loadIteration(user, id);
  await requireSprintManager(user, it.projectId);
  if (it.state !== 'PLANNED')
    throw badRequest('Only planned sprints can be started', 'INVALID_SPRINT_STATE');
  const active = await prisma.iteration.findFirst({
    where: { projectId: it.projectId, state: 'ACTIVE' },
  });
  if (active)
    throw conflict(
      `Sprint "${active.name}" is still active. Complete it first.`,
      'SPRINT_ALREADY_ACTIVE',
    );
  // freeze the starting point of the burndown's ideal line
  const s = (await computeStats([id])).get(id)!;
  await prisma.iteration.update({
    where: { id },
    data: {
      state: 'ACTIVE',
      startedAt: new Date(),
      baselineWork: s.remainingWork,
      baselinePoints: s.totalPoints - s.completedPoints,
    },
  });
  await recordSnapshots([id]);
  audit({
    actorId: user.id,
    action: 'sprint.started',
    entity: 'project',
    entityId: it.projectId,
    metadata: { sprint: it.name },
  });
  notifyProject(it.projectId, 'iterations');
  return getSprint(user, id);
}

/** Completes a sprint; unfinished items move to the backlog or to another sprint. */
export async function completeIteration(user: Express.AuthUser, id: string, moveTo: string) {
  const { it } = await loadIteration(user, id);
  await requireSprintManager(user, it.projectId);
  if (it.state !== 'ACTIVE')
    throw badRequest('Only the active sprint can be completed', 'INVALID_SPRINT_STATE');

  let targetId: string | null = null;
  if (moveTo !== 'backlog') {
    const target = await prisma.iteration.findUnique({ where: { id: moveTo } });
    if (
      !target ||
      target.projectId !== it.projectId ||
      target.state === 'COMPLETED' ||
      target.id === id
    ) {
      throw badRequest('Choose a planned sprint of this project', 'INVALID_TARGET_SPRINT');
    }
    targetId = target.id;
  }

  await recordSnapshots([id]); // final data point
  const unfinished = await prisma.workItem.findMany({
    where: { iterationId: id, state: { not: 'REMOVED' } },
    select: { id: true, state: true },
  });
  // resolved counts as done for the sprint (same rule as the sprint stats / velocity)
  const toMove = unfinished
    .filter((w) => !['resolved', 'completed'].includes(STATE_CATEGORY[w.state]))
    .map((w) => w.id);
  await prisma.$transaction([
    prisma.workItem.updateMany({ where: { id: { in: toMove } }, data: { iterationId: targetId } }),
    prisma.workItemHistory.createMany({
      data: toMove.map((workItemId) => ({
        workItemId,
        actorId: user.id,
        field: 'Sprint',
        oldValue: it.name,
        newValue: targetId ? '(next sprint)' : null,
      })),
    }),
    prisma.iteration.update({
      where: { id },
      data: { state: 'COMPLETED', completedAt: new Date() },
    }),
  ]);
  audit({
    actorId: user.id,
    action: 'sprint.completed',
    entity: 'project',
    entityId: it.projectId,
    metadata: { sprint: it.name, moved: toMove.length },
  });
  notifyProject(it.projectId, 'iterations');
  notifyProject(it.projectId, 'workitems');
  return { moved: toMove.length };
}

// ---- capacity & sprint detail -----------------------------------------------------------

export async function setCapacity(user: Express.AuthUser, id: string, input: CapacityInput) {
  const { it } = await loadIteration(user, id);
  await requireSprintManager(user, it.projectId);
  const members = await prisma.projectMember.findMany({
    where: { projectId: it.projectId },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((m) => m.userId));
  const bad = input.entries.find((e) => !memberIds.has(e.userId));
  if (bad) throw badRequest('Capacity can only be set for project members', 'NOT_A_MEMBER');
  await prisma.$transaction(
    input.entries.map((e) =>
      prisma.iterationCapacity.upsert({
        where: { iterationId_userId: { iterationId: id, userId: e.userId } },
        create: {
          iterationId: id,
          userId: e.userId,
          hoursPerDay: e.hoursPerDay,
          daysOff: e.daysOff,
        },
        update: { hoursPerDay: e.hoursPerDay, daysOff: e.daysOff },
      }),
    ),
  );
  notifyProject(it.projectId, 'iterations');
  return getSprint(user, id);
}

const dayList = (start: string, end: string) => {
  const out: string[] = [];
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= Date.parse(`${end}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

export async function getSprint(user: Express.AuthUser, id: string): Promise<SprintDetail> {
  const { it, ctx } = await loadIteration(user, id);
  const [stats, members, capacity, assigned, snapshots] = await Promise.all([
    computeStats([id]),
    prisma.projectMember.findMany({
      where: { projectId: it.projectId, role: { not: 'VIEWER' }, user: { isActive: true } },
      include: { user: { select: userRefSelect } },
      orderBy: { addedAt: 'asc' },
    }),
    prisma.iterationCapacity.findMany({ where: { iterationId: id } }),
    prisma.workItem.groupBy({
      by: ['assigneeId'],
      where: { iterationId: id, state: { notIn: ['REMOVED', 'DONE', 'CLOSED'] } },
      _sum: { remainingWork: true },
    }),
    prisma.iterationSnapshot.findMany({ where: { iterationId: id }, orderBy: { date: 'asc' } }),
  ]);

  const start = fromDbDate(it.startDate)!;
  const end = fromDbDate(it.endDate)!;
  const days = workingDays(start, end);
  const capByUser = new Map(capacity.map((c) => [c.userId, c]));
  const hoursByUser = new Map(assigned.map((a) => [a.assigneeId, a._sum.remainingWork ?? 0]));

  const rows = members.map((m) => {
    const c = capByUser.get(m.userId);
    const hoursPerDay = c?.hoursPerDay ?? 0;
    const daysOff = c?.daysOff ?? 0;
    return {
      user: m.user,
      hoursPerDay,
      daysOff,
      capacityHours: Math.round(hoursPerDay * Math.max(0, days - daysOff) * 10) / 10,
      assignedHours: hoursByUser.get(m.userId) ?? 0,
    };
  });

  // burndown: one point per calendar day; gaps carry the previous value forward
  const byDate = new Map(snapshots.map((s) => [fromDbDate(s.date)!, s]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastActual =
    it.state === 'COMPLETED' ? fromDbDate(it.completedAt ?? it.endDate)! : todayStr;
  const allDays = dayList(start, end);
  // ideal line starts from the remaining work frozen when the sprint started
  // (planned sprints: from what is planned right now)
  const now = stats.get(id)!;
  const baseWork = it.baselineWork ?? now.remainingWork;
  const basePoints = it.baselinePoints ?? now.totalPoints - now.completedPoints;
  const useHours = baseWork > 0;
  const startValue = useHours ? baseWork : basePoints;

  let carry: (typeof snapshots)[number] | undefined;
  const burndown: BurndownPoint[] = allDays.map((date, i) => {
    const snap = byDate.get(date);
    if (snap) carry = snap;
    const known = date <= lastActual && carry;
    return {
      date,
      remainingWork: known ? carry!.remainingWork : null,
      remainingPoints: known ? carry!.remainingPoints : null,
      ideal:
        allDays.length > 1 ? Math.round(startValue * (1 - i / (allDays.length - 1)) * 10) / 10 : 0,
    };
  });

  return {
    ...toDto(it, stats.get(id)!),
    workingDays: days,
    capacity: rows,
    unassignedHours: hoursByUser.get(null) ?? 0,
    burndown,
    burndownUnit: useHours ? 'hours' : 'points',
    canManage:
      ctx.access.canManage &&
      hasPermission(user.role, 'iteration:manage') &&
      !ctx.project.archivedAt,
  };
}
