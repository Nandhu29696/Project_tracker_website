import { z } from 'zod';
import { dateOnlySchema, ENVIRONMENT_TYPES } from './project';
import type { WorkItemState, WorkItemType } from './workitem';

// ---- sprints (iterations) ---------------------------------------------------------------

export const ITERATION_STATES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const;
export type IterationState = (typeof ITERATION_STATES)[number];
export const ITERATION_STATE_LABELS: Record<IterationState, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

const sprintDates = (v: { startDate?: string; endDate?: string }) =>
  !v.startDate || !v.endDate || v.startDate <= v.endDate;
const SPRINT_DATE_MSG = { path: ['endDate'], message: 'End date must be on or after start date' };

export const createIterationSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    goal: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => v || null),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
  })
  .refine(sprintDates, SPRINT_DATE_MSG);
export type CreateIterationInput = z.infer<typeof createIterationSchema>;

export const updateIterationSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    goal: z.string().trim().max(1000).nullable().optional(),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
  })
  .refine(sprintDates, SPRINT_DATE_MSG);
export type UpdateIterationInput = z.infer<typeof updateIterationSchema>;

/** Where unfinished items go when a sprint is completed. */
export const completeIterationSchema = z.object({
  moveTo: z.union([z.literal('backlog'), z.string().uuid()]).default('backlog'),
});

export const capacitySchema = z.object({
  entries: z
    .array(
      z.object({
        userId: z.string().uuid(),
        hoursPerDay: z.number().min(0).max(24),
        daysOff: z.number().int().min(0).max(366),
      }),
    )
    .max(200),
});
export type CapacityInput = z.infer<typeof capacitySchema>;

/** Monday-Friday days between two YYYY-MM-DD dates, inclusive. */
export function workingDays(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  let n = 0;
  for (let t = s; t <= e; t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

// ---- board ------------------------------------------------------------------------------

/** Board columns are state categories, so one board can hold several work item types. */
export const BOARD_COLUMNS = ['proposed', 'in_progress', 'resolved', 'completed'] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];
export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  proposed: 'New',
  in_progress: 'Active',
  resolved: 'Resolved',
  completed: 'Done',
};

/** Which state an item enters when dropped into a column (null = not allowed for this type). */
export function columnTargetState(type: WorkItemType, column: BoardColumn): WorkItemState | null {
  if (type === 'TASK') {
    return { proposed: 'TODO', in_progress: 'IN_PROGRESS', resolved: null, completed: 'DONE' }[
      column
    ] as WorkItemState | null;
  }
  return { proposed: 'NEW', in_progress: 'ACTIVE', resolved: 'RESOLVED', completed: 'CLOSED' }[
    column
  ] as WorkItemState;
}

export const BOARD_LEVELS = ['requirements', 'tasks', 'features', 'epics'] as const;
export type BoardLevel = (typeof BOARD_LEVELS)[number];
export const BOARD_LEVEL_TYPES: Record<BoardLevel, WorkItemType[]> = {
  requirements: ['STORY', 'BUG'],
  tasks: ['TASK'],
  features: ['FEATURE'],
  epics: ['EPIC'],
};
export const BOARD_LEVEL_LABELS: Record<BoardLevel, string> = {
  requirements: 'Stories & bugs',
  tasks: 'Tasks',
  features: 'Features',
  epics: 'Epics',
};

const wipLimit = z.number().int().min(1).max(999).nullable().optional();
export const boardSettingsSchema = z.object({
  wipLimits: z
    .object({ proposed: wipLimit, in_progress: wipLimit, resolved: wipLimit, completed: wipLimit })
    .partial(),
});
export type BoardSettings = { wipLimits: Partial<Record<BoardColumn, number | null>> };

export const boardQuerySchema = z.object({
  level: z.enum(BOARD_LEVELS).default('requirements'),
  /** sprint id, 'none' = items not in a sprint, omitted = all */
  iteration: z.union([z.literal('none'), z.string().uuid()]).optional(),
  assignee: z.union([z.literal('me'), z.literal('none'), z.string().uuid()]).optional(),
  /** hide items completed more than this many days ago (keeps the Done column short) */
  doneDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type BoardQuery = z.infer<typeof boardQuerySchema>;

// ---- credentials vault ------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

export const createCredentialSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100),
  username: optionalText(200),
  secret: z.string().min(1, 'Secret is required').max(4000),
  url: z
    .union([z.string().trim().url('Enter a full URL').max(500), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  environment: z.enum(ENVIRONMENT_TYPES).nullable().optional(),
  notes: optionalText(2000),
});
export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;

export const updateCredentialSchema = createCredentialSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;

/** Column index -> project id chosen in the import preview ('' = skip that section). */
export const credentialImportMapSchema = z.record(z.string().regex(/^\d+$/), z.string());
