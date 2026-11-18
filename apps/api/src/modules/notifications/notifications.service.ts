import type {
  NotificationDto,
  NotificationPrefs,
  NotificationType,
  Paginated,
} from '@tracker/shared';
import { notificationPrefsSchema } from '@tracker/shared';
import { logger } from '../../lib/logger';
import { sendEmail } from '../../lib/mail/mailer';
import type { EmailContent } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { notifyUser } from '../../lib/realtime';
import { userRefSelect } from '../projects/project.mapper';

export interface NotifyInput {
  type: NotificationType;
  /** recipients; the actor and inactive users are removed automatically */
  userIds: (string | null | undefined)[];
  actorId?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  projectId?: string | null;
  workItemId?: string | null;
  /** builds the email for one recipient (null = in-app only) */
  email?: ((recipient: { name: string; email: string }) => EmailContent) | null;
}

const prefsOf = (raw: unknown): NotificationPrefs => {
  const parsed = notificationPrefsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { email: {} };
};

/**
 * Creates in-app notifications, pushes them live, and emails recipients who
 * have not switched that type off. Never throws: a notification problem must
 * not fail the user's actual request.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const ids = [...new Set(input.userIds.filter((x): x is string => !!x && x !== input.actorId))];
    if (!ids.length) return;
    const recipients = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true, email: true, notificationPrefs: true },
    });
    if (!recipients.length) return;

    const created = await prisma.notification.createManyAndReturn({
      data: recipients.map((r) => ({
        userId: r.id,
        type: input.type,
        title: input.title.slice(0, 255),
        body: input.body?.slice(0, 1000) ?? null,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
        projectId: input.projectId ?? null,
        workItemId: input.workItemId ?? null,
      })),
      select: { id: true, userId: true },
    });

    for (const r of recipients) notifyUser(r.id, 'notification:new', { type: input.type });

    if (!input.email) return;
    for (const r of recipients) {
      if (prefsOf(r.notificationPrefs).email[input.type] === false) continue;
      const sent = await sendEmail(r.email, input.email({ name: r.name, email: r.email }));
      const row = created.find((c) => c.userId === r.id);
      if (sent && row) {
        await prisma.notification.update({
          where: { id: row.id },
          data: { emailedAt: new Date() },
        });
      }
    }
  } catch (err) {
    logger.error({ err, type: input.type }, 'notify failed');
  }
}

/** Fire-and-forget wrapper used from request handlers. */
export function notifyLater(input: NotifyInput) {
  void notify(input);
}

// ---- reading ----------------------------------------------------------------------------

export async function listNotifications(
  userId: string,
  q: { unread?: 'true' | 'false'; page: number; pageSize: number },
): Promise<Paginated<NotificationDto> & { unread: number }> {
  const where = { userId, ...(q.unread === 'true' ? { readAt: null } : {}) };
  const [total, unread, rows] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where,
      include: { actor: { select: userRefSelect } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    data: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      actor: n.actor,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    meta: { page: q.page, pageSize: q.pageSize, total },
    unread,
  };
}

export const unreadCount = (userId: string) =>
  prisma.notification.count({ where: { userId, readAt: null } });

export async function markRead(userId: string, ids: string[] | 'all') {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  notifyUser(userId, 'notification:read');
  return count;
}

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  return prefsOf(u.notificationPrefs);
}

export async function setPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<NotificationPrefs> {
  await prisma.user.update({ where: { id: userId }, data: { notificationPrefs: prefs } });
  return prefs;
}
