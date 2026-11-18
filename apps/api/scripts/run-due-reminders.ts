/**
 * Runs the "due tomorrow" reminder job once and prints how many were sent.
 * The API also runs it hourly; this is for testing and for cron-style setups.
 *   npm run reminders -w @tracker/api
 */
import { sendDueReminders } from '../src/modules/notifications/reminders';
import { prisma } from '../src/lib/prisma';

sendDueReminders()
  .then((n) => console.log(`due reminders sent: ${n}`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => prisma.$disconnect().then(() => process.exit()), 1500));
