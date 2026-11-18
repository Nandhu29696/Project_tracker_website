import { OPEN_STATES } from '@tracker/shared';
import { logger } from '../../lib/logger';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { workItemKey } from '../workitems/access';
import { itemUrl } from '../workitems/workitems.service';
import { notify } from './notifications.service';

const dayStart = (offsetDays: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
};

/**
 * Sends one "due tomorrow" reminder per item and due date. The claim is an atomic
 * UPDATE ... WHERE due_reminder_for IS DISTINCT FROM due_date, so restarts or
 * several API instances can never send the same reminder twice.
 */
export async function sendDueReminders(): Promise<number> {
  const tomorrow = dayStart(1);
  const due = await prisma.workItem.findMany({
    where: {
      dueDate: tomorrow,
      assigneeId: { not: null },
      state: { in: OPEN_STATES },
      OR: [{ dueReminderFor: null }, { dueReminderFor: { not: tomorrow } }],
      project: { archivedAt: null },
    },
    select: {
      id: true,
      number: true,
      title: true,
      assigneeId: true,
      projectId: true,
      project: { select: { key: true } },
    },
    take: 500,
  });

  let sent = 0;
  for (const item of due) {
    const { count } = await prisma.workItem.updateMany({
      where: { id: item.id, OR: [{ dueReminderFor: null }, { dueReminderFor: { not: tomorrow } }] },
      data: { dueReminderFor: tomorrow },
    });
    if (!count) continue; // someone else claimed it
    const key = workItemKey(item.project.key, item.number);
    await notify({
      type: 'DUE_SOON',
      userIds: [item.assigneeId],
      title: `${key} is due tomorrow`,
      body: item.title,
      link: `/items/${key}`,
      projectId: item.projectId,
      workItemId: item.id,
      email: (r) =>
        templates.workItemActivity(
          'due-soon',
          r.name,
          'Due tomorrow',
          { key, title: item.title },
          null,
          itemUrl(key),
        ),
    });
    sent++;
  }
  return sent;
}

export function startReminderScheduler(intervalMs = 60 * 60 * 1000) {
  const run = () =>
    sendDueReminders()
      .then((n) => n && logger.info(`sent ${n} due-tomorrow reminder(s)`))
      .catch((err) => logger.error({ err }, 'due reminder job failed'));
  const first = setTimeout(run, 10_000);
  const timer = setInterval(run, intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
