import { OPEN_STATES, STATE_CATEGORY, type IterationDto } from '@tracker/shared';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export type IterationStats = IterationDto['stats'];

const emptyStats = (): IterationStats => ({
  items: 0,
  openItems: 0,
  totalPoints: 0,
  completedPoints: 0,
  remainingWork: 0,
});

/** Aggregates the (non-removed) items of each sprint. */
export async function computeStats(iterationIds: string[]): Promise<Map<string, IterationStats>> {
  const result = new Map(iterationIds.map((id) => [id, emptyStats()]));
  if (!iterationIds.length) return result;
  const items = await prisma.workItem.findMany({
    where: { iterationId: { in: iterationIds }, state: { not: 'REMOVED' } },
    select: { iterationId: true, type: true, state: true, storyPoints: true, remainingWork: true },
  });
  for (const i of items) {
    const s = result.get(i.iterationId!)!;
    const done = ['resolved', 'completed'].includes(STATE_CATEGORY[i.state]);
    s.items++;
    if (OPEN_STATES.includes(i.state)) s.openItems++;
    if (i.type !== 'TASK' && i.storyPoints) {
      s.totalPoints += i.storyPoints;
      if (done) s.completedPoints += i.storyPoints;
    }
    if (i.remainingWork && STATE_CATEGORY[i.state] !== 'completed')
      s.remainingWork += i.remainingWork;
  }
  return result;
}

const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

/** Upserts today's burndown row for each ACTIVE sprint in the list. */
export async function recordSnapshots(iterationIds: (string | null | undefined)[]) {
  const ids = [...new Set(iterationIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  const active = await prisma.iteration.findMany({
    where: { id: { in: ids }, state: 'ACTIVE' },
    select: { id: true },
  });
  if (!active.length) return;
  const stats = await computeStats(active.map((a) => a.id));
  const date = today();
  await Promise.all(
    active.map(({ id }) => {
      const s = stats.get(id)!;
      const data = {
        remainingWork: s.remainingWork,
        remainingPoints: s.totalPoints - s.completedPoints,
        totalPoints: s.totalPoints,
        openItems: s.openItems,
      };
      return prisma.iterationSnapshot.upsert({
        where: { iterationId_date: { iterationId: id, date } },
        create: { iterationId: id, date, ...data },
        update: data,
      });
    }),
  );
}

/** Best-effort wrapper: snapshot failures must never break a user request. */
export function recordSnapshotsLater(iterationIds: (string | null | undefined)[]) {
  recordSnapshots(iterationIds).catch((err) => logger.error({ err }, 'snapshot failed'));
}

/** Makes sure every active sprint gets a snapshot each day, even without activity. */
export function startSnapshotScheduler(intervalMs = 60 * 60 * 1000) {
  const run = async () => {
    try {
      const active = await prisma.iteration.findMany({
        where: { state: 'ACTIVE' },
        select: { id: true },
      });
      await recordSnapshots(active.map((a) => a.id));
    } catch (err) {
      logger.error({ err }, 'snapshot scheduler failed');
    }
  };
  const first = setTimeout(run, 5_000);
  const timer = setInterval(run, intervalMs);
  timer.unref();
  first.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
