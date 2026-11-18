import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { verifyMailConnection } from './lib/mail/mailer';
import { prisma } from './lib/prisma';
import { closeRealtime, initRealtime } from './lib/realtime';
import { startSnapshotScheduler } from './modules/iterations/snapshots';
import { startReminderScheduler } from './modules/notifications/reminders';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  logger.info(`Google OAuth: ${env.googleEnabled ? 'enabled' : 'disabled (set GOOGLE_* in .env)'}`);
  logger.info(
    `Credentials vault: ${env.vaultEnabled ? 'enabled' : 'disabled (set VAULT_ENCRYPTION_KEY)'}`,
  );
  void verifyMailConnection();
});
initRealtime(server);
const stopSnapshots = startSnapshotScheduler();
const stopReminders = startReminderScheduler();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  stopSnapshots();
  stopReminders();
  await closeRealtime();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
