import {
  computeHealth,
  OPEN_STATES,
  SEVERITIES,
  STATE_CATEGORY,
  type Health,
  type Insights,
  type PortfolioRow,
  type ProjectStatus,
  type Severity,
} from '@tracker/shared';
import { fromDbDate } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { computeStats } from '../iterations/snapshots';
import { computeAccess, loadProjectAccess, visibleProjectsWhere } from '../projects/access';
import { projectSummaryInclude, toProjectSummary, userRefSelect } from '../projects/project.mapper';
import { summaryInclude, toSummary } from '../workitems/mapper';

const todayStr = () => new Date().toISOString().slice(0, 10);

// ---- sprint burn ratio ------------------------------------------------------------------

/**
 * Remaining work divided by where the ideal line says it should be today
 * (1 = on the line, >1 = behind). Uses hours if the sprint is estimated in hours.
 */
async function burnRatios(projectIds: string[]) {
  const sprints = await prisma.iteration.findMany({
    where: { projectId: { in: projectIds }, state: 'ACTIVE' },
    include: { snapshots: { orderBy: { date: 'desc' }, take: 1 } },
  });
  const stats = await computeStats(sprints.map((s) => s.id));
  const today = Date.parse(`${todayStr()}T00:00:00Z`);
  const out = new Map<
    string,
    { ratio: number | null; sprint: (typeof sprints)[number]; stats: ReturnType<typeof stats.get> }
  >();
  for (const s of sprints) {
    const st = stats.get(s.id)!;
    const useHours = (s.baselineWork ?? st.remainingWork) > 0;
    const start = useHours
      ? (s.baselineWork ?? st.remainingWork)
      : (s.baselinePoints ?? st.totalPoints);
    const now = useHours ? st.remainingWork : st.totalPoints - st.completedPoints;
    const span = Math.max(1, (s.endDate.getTime() - s.startDate.getTime()) / 86_400_000);
    const elapsed = Math.min(span, Math.max(0, (today - s.startDate.getTime()) / 86_400_000));
    const ideal = start * (1 - elapsed / span);
    const ratio = start <= 0 ? null : ideal > 0.01 ? now / ideal : now > 0 ? 2 : 1;
    out.set(s.projectId, { ratio, sprint: s, stats: st });
  }
  return out;
}

// ---- project insights -------------------------------------------------------------------

const weekStart = (d: Date) => {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day))
    .toISOString()
    .slice(0, 10);
};

export async function getProjectInsights(
  user: Express.AuthUser,
  projectId: string,
): Promise<Insights> {
  await loadProjectAccess(user, projectId);
  const today = todayStr();
  const todayDate = new Date(`${today}T00:00:00Z`);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { status: true, targetDate: true },
  });

  const items = await prisma.workItem.findMany({
    where: { projectId },
    select: {
      type: true,
      state: true,
      severity: true,
      assigneeId: true,
      remainingWork: true,
      dueDate: true,
      createdAt: true,
      closedAt: true,
    },
  });
  const live = items.filter((i) => i.state !== 'REMOVED');
  const open = live.filter((i) => OPEN_STATES.includes(i.state));
  const overdue = open.filter((i) => i.dueDate && i.dueDate < todayDate);
  const openBugs = open.filter((i) => i.type === 'BUG');

  const byState = (['proposed', 'in_progress', 'resolved', 'completed'] as const).map(
    (category) => ({
      category,
      count: live.filter((i) => STATE_CATEGORY[i.state] === category).length,
    }),
  );
  const bugsBySeverity = SEVERITIES.map((severity) => ({
    severity,
    count: openBugs.filter((b) => (b.severity ?? 'S3_MEDIUM') === severity).length,
  }));

  // workload: open items + remaining hours per assignee (unassigned last)
  const load = new Map<string | null, { openItems: number; remainingHours: number }>();
  for (const i of open) {
    const e = load.get(i.assigneeId) ?? { openItems: 0, remainingHours: 0 };
    e.openItems++;
    e.remainingHours += i.remainingWork ?? 0;
    load.set(i.assigneeId, e);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...load.keys()].filter((k): k is string => !!k) } },
    select: userRefSelect,
  });
  const workload = [...load.entries()]
    .map(([id, v]) => ({ user: users.find((u) => u.id === id) ?? null, ...v }))
    .sort((a, b) => (a.user ? 0 : 1) - (b.user ? 0 : 1) || b.openItems - a.openItems);

  // velocity: last 6 completed sprints - committed = points at start, completed = points done
  const done = await prisma.iteration.findMany({
    where: { projectId, state: 'COMPLETED' },
    orderBy: { endDate: 'desc' },
    take: 6,
    include: { snapshots: { orderBy: { date: 'asc' }, take: 1 } },
  });
  const doneStats = await computeStats(done.map((d) => d.id));
  const velocity = done.reverse().map((d) => ({
    sprint: d.name,
    committed: d.snapshots[0]?.totalPoints ?? doneStats.get(d.id)!.totalPoints,
    completed: doneStats.get(d.id)!.completedPoints,
  }));

  // flow: created vs closed per week, last 8 weeks
  const weeks: string[] = [];
  for (let w = 7; w >= 0; w--)
    weeks.push(weekStart(new Date(todayDate.getTime() - w * 7 * 86_400_000)));
  const flow = weeks.map((ws) => ({
    weekStart: ws,
    created: items.filter((i) => weekStart(i.createdAt) === ws).length,
    closed: items.filter((i) => i.closedAt && weekStart(i.closedAt) === ws).length,
  }));

  const overdueRows = await prisma.workItem.findMany({
    where: { projectId, state: { in: OPEN_STATES }, dueDate: { lt: todayDate } },
    include: summaryInclude,
    orderBy: { dueDate: 'asc' },
    take: 20,
  });

  const burn = (await burnRatios([projectId])).get(projectId);
  const health = computeHealth({
    status: project.status,
    targetDate: fromDbDate(project.targetDate),
    today,
    openItems: open.length,
    overdueItems: overdue.length,
    openCriticalBugs: openBugs.filter((b) => b.severity === 'S1_CRITICAL').length,
    openHighBugs: openBugs.filter((b) => b.severity === 'S2_HIGH').length,
    sprintBurnRatio: burn?.ratio ?? null,
  });

  return {
    health,
    counts: {
      open: open.length,
      overdue: overdue.length,
      done: live.length - open.length,
      total: live.length,
    },
    byState,
    bugsBySeverity,
    workload,
    velocity,
    flow,
    overdue: overdueRows.map(toSummary),
    activeSprint: burn
      ? {
          id: burn.sprint.id,
          name: burn.sprint.name,
          endDate: fromDbDate(burn.sprint.endDate)!,
          completedPoints: burn.stats!.completedPoints,
          totalPoints: burn.stats!.totalPoints,
        }
      : null,
  };
}

// ---- portfolio --------------------------------------------------------------------------

const HEALTH_ORDER: Record<Health['state'], number> = {
  OFF_TRACK: 0,
  AT_RISK: 1,
  ON_TRACK: 2,
  DONE: 3,
};

/** One row per visible project - the replacement for the Excel tracker. */
export async function getPortfolio(
  user: Express.AuthUser,
  includeArchived = false,
): Promise<PortfolioRow[]> {
  const projects = await prisma.project.findMany({
    where: { ...visibleProjectsWhere(user), ...(includeArchived ? {} : { archivedAt: null }) },
    include: projectSummaryInclude(user.id),
    orderBy: { name: 'asc' },
  });
  const ids = projects.map((p) => p.id);
  const todayDate = new Date(`${todayStr()}T00:00:00Z`);
  const [items, burns] = await Promise.all([
    prisma.workItem.findMany({
      where: { projectId: { in: ids }, state: { not: 'REMOVED' } },
      select: {
        projectId: true,
        type: true,
        state: true,
        severity: true,
        dueDate: true,
        updatedAt: true,
      },
    }),
    burnRatios(ids),
  ]);

  const rows = projects.map((p): PortfolioRow => {
    const mine = items.filter((i) => i.projectId === p.id);
    const open = mine.filter((i) => OPEN_STATES.includes(i.state));
    const bugs = open.filter((i) => i.type === 'BUG');
    const sev = (s: Severity) => bugs.filter((b) => b.severity === s).length;
    const overdue = open.filter((i) => i.dueDate && i.dueDate < todayDate).length;
    const burn = burns.get(p.id);
    const lastActivity = mine.reduce((d, i) => (i.updatedAt > d ? i.updatedAt : d), p.updatedAt);
    return {
      project: toProjectSummary(p, computeAccess(user, p.members[0]?.role ?? null)),
      health: computeHealth({
        status: p.status as ProjectStatus,
        targetDate: fromDbDate(p.targetDate),
        today: todayStr(),
        openItems: open.length,
        overdueItems: overdue,
        openCriticalBugs: sev('S1_CRITICAL'),
        openHighBugs: sev('S2_HIGH'),
        sprintBurnRatio: burn?.ratio ?? null,
      }),
      openItems: open.length,
      overdueItems: overdue,
      openBugs: bugs.length,
      openCriticalBugs: sev('S1_CRITICAL'),
      activeSprint: burn
        ? {
            name: burn.sprint.name,
            completedPoints: burn.stats!.completedPoints,
            totalPoints: burn.stats!.totalPoints,
            endDate: fromDbDate(burn.sprint.endDate)!,
          }
        : null,
      lastActivity: lastActivity.toISOString(),
    };
  });
  return rows.sort(
    (a, b) =>
      HEALTH_ORDER[a.health.state] - HEALTH_ORDER[b.health.state] ||
      a.project.name.localeCompare(b.project.name),
  );
}
