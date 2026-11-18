import { Router } from 'express';
import { z } from 'zod';
import { listNotificationsQuerySchema, notificationPrefsSchema } from '@tracker/shared';
import { authenticate } from '../../middleware/auth';
import * as notifications from './notifications.service';

/** Mounted at /api/v1/notifications - always the signed-in user's own notifications. */
export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', async (req, res) => {
  res.json(
    await notifications.listNotifications(
      req.user!.id,
      listNotificationsQuerySchema.parse(req.query),
    ),
  );
});

notificationsRouter.get('/unread-count', async (req, res) => {
  res.json({ data: { count: await notifications.unreadCount(req.user!.id) } });
});

notificationsRouter.post('/read', async (req, res) => {
  const { ids } = z
    .object({ ids: z.union([z.literal('all'), z.array(z.string().uuid()).max(200)]) })
    .parse(req.body);
  res.json({ data: { updated: await notifications.markRead(req.user!.id, ids) } });
});

notificationsRouter.get('/preferences', async (req, res) => {
  res.json({ data: await notifications.getPrefs(req.user!.id) });
});

notificationsRouter.put('/preferences', async (req, res) => {
  res.json({
    data: await notifications.setPrefs(req.user!.id, notificationPrefsSchema.parse(req.body)),
  });
});
