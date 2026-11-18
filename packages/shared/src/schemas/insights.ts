import { z } from 'zod';
import type { ProjectStatus } from './project';

// ---- notifications ----------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'ASSIGNED',
  'MENTIONED',
  'STATE_CHANGED',
  'COMMENTED',
  'DUE_SOON',
  'ADDED_TO_PROJECT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; hint: string }> = {
  ASSIGNED: { label: 'Assigned to me', hint: 'Someone assigns a work item to you' },
  MENTIONED: { label: 'Mentions', hint: 'Someone @mentions you in a comment' },
  STATE_CHANGED: { label: 'State changes', hint: 'An item you created or own changes state' },
  COMMENTED: { label: 'Comments', hint: 'New comments on items you created or own' },
  DUE_SOON: { label: 'Due tomorrow', hint: 'Reminder the day before your item is due' },
  ADDED_TO_PROJECT: { label: 'Added to a project', hint: 'You are added to a project' },
};

/** Per-type email switch. Missing = on. In-app notifications are always on. */
export const notificationPrefsSchema = z.object({
  email: z.partialRecord(z.enum(NOTIFICATION_TYPES), z.boolean()).default({}),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const listNotificationsQuerySchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- search -----------------------------------------------------------------------------

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

// ---- project health ---------------------------------------------------------------------

export const HEALTH_STATES = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'DONE'] as const;
export type HealthState = (typeof HEALTH_STATES)[number];
export const HEALTH_LABELS: Record<HealthState, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  OFF_TRACK: 'Off track',
  DONE: 'Closed',
};

export interface HealthInput {
  status: ProjectStatus;
  targetDate: string | null;
  today: string;
  openItems: number;
  overdueItems: number;
  openCriticalBugs: number;
  openHighBugs: number;
  /** remaining / ideal remaining of the active sprint today (null = no active sprint) */
  sprintBurnRatio: number | null;
}

export interface Health {
  state: HealthState;
  reasons: string[];
}

/**
 * Explainable rule-based health. Each rule adds a reason; the worst rule wins.
 * Kept deliberately simple so a manager can see *why* a project is flagged.
 */
export function computeHealth(h: HealthInput): Health {
  if (h.status === 'COMPLETED' || h.status === 'CANCELLED') return { state: 'DONE', reasons: [] };
  const off: string[] = [];
  const risk: string[] = [];

  if (h.targetDate && h.targetDate < h.today) off.push('Target date has passed');
  if (h.openCriticalBugs >= 2) off.push(`${h.openCriticalBugs} open critical bugs`);
  else if (h.openCriticalBugs === 1) risk.push('1 open critical bug');
  if (h.openHighBugs >= 3) risk.push(`${h.openHighBugs} open high-severity bugs`);

  const overdueShare = h.openItems ? h.overdueItems / h.openItems : 0;
  // off track needs both a real share and a real number (1 of 3 is a risk, not a crisis)
  if (h.overdueItems >= 3 && overdueShare > 0.2)
    off.push(`${h.overdueItems} of ${h.openItems} open items are overdue`);
  else if (h.overdueItems)
    risk.push(`${h.overdueItems} overdue item${h.overdueItems === 1 ? '' : 's'}`);

  if (h.sprintBurnRatio !== null && h.sprintBurnRatio > 1.5)
    off.push('Active sprint is far behind its burndown');
  else if (h.sprintBurnRatio !== null && h.sprintBurnRatio > 1.2)
    risk.push('Active sprint is behind its burndown');

  if (h.status === 'ON_HOLD') risk.push('Project is on hold');
  if (h.status === 'CLIENT_NO_RESPONSE') risk.push('Waiting for the client');

  if (off.length) return { state: 'OFF_TRACK', reasons: [...off, ...risk] };
  if (risk.length) return { state: 'AT_RISK', reasons: risk };
  return { state: 'ON_TRACK', reasons: [] };
}
