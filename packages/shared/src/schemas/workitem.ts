import { z } from 'zod';
import { dateOnlySchema, ENVIRONMENT_TYPES, PRIORITIES } from './project';

// ---- types ----------------------------------------------------------------------------

export const WORK_ITEM_TYPES = ['EPIC', 'FEATURE', 'STORY', 'BUG', 'TASK'] as const;
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];
export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  EPIC: 'Epic',
  FEATURE: 'Feature',
  STORY: 'User Story',
  BUG: 'Bug',
  TASK: 'Task',
};

/** Allowed parent types. Levels strictly decrease (Epic > Feature > Story > Bug > Task), so cycles are impossible. */
export const ALLOWED_PARENTS: Record<WorkItemType, WorkItemType[]> = {
  EPIC: [],
  FEATURE: ['EPIC'],
  STORY: ['FEATURE', 'EPIC'],
  BUG: ['STORY', 'FEATURE'],
  TASK: ['STORY', 'BUG'],
};

/** Types only project managers (global Admin / Manager) may create. */
export const PLANNING_TYPES: WorkItemType[] = ['EPIC', 'FEATURE'];

// ---- states & workflow ------------------------------------------------------------------

export const WORK_ITEM_STATES = [
  'NEW',
  'TRIAGED',
  'TODO',
  'ACTIVE',
  'IN_PROGRESS',
  'RESOLVED',
  'VERIFIED',
  'DONE',
  'CLOSED',
  'REMOVED',
] as const;
export type WorkItemState = (typeof WORK_ITEM_STATES)[number];
export const WORK_ITEM_STATE_LABELS: Record<WorkItemState, string> = {
  NEW: 'New',
  TRIAGED: 'Triaged',
  TODO: 'To Do',
  ACTIVE: 'Active',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  DONE: 'Done',
  CLOSED: 'Closed',
  REMOVED: 'Removed',
};

export type StateCategory = 'proposed' | 'in_progress' | 'resolved' | 'completed' | 'removed';
export const STATE_CATEGORY: Record<WorkItemState, StateCategory> = {
  NEW: 'proposed',
  TRIAGED: 'proposed',
  TODO: 'proposed',
  ACTIVE: 'in_progress',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  VERIFIED: 'resolved',
  DONE: 'completed',
  CLOSED: 'completed',
  REMOVED: 'removed',
};
/** "Open" = still needs work (proposed or in progress). */
export const OPEN_STATES = WORK_ITEM_STATES.filter((s) =>
  ['proposed', 'in_progress'].includes(STATE_CATEGORY[s]),
);
export const DONE_STATES = WORK_ITEM_STATES.filter((s) =>
  ['resolved', 'completed'].includes(STATE_CATEGORY[s]),
);

type Workflow = {
  initial: WorkItemState;
  transitions: Partial<Record<WorkItemState, WorkItemState[]>>;
};

const planningWorkflow: Workflow = {
  initial: 'NEW',
  transitions: {
    NEW: ['ACTIVE', 'RESOLVED', 'CLOSED', 'REMOVED'],
    ACTIVE: ['NEW', 'RESOLVED', 'CLOSED', 'REMOVED'],
    RESOLVED: ['ACTIVE', 'CLOSED'],
    CLOSED: ['ACTIVE'],
    REMOVED: ['NEW'],
  },
};

export const WORKFLOWS: Record<WorkItemType, Workflow> = {
  EPIC: planningWorkflow,
  FEATURE: planningWorkflow,
  STORY: planningWorkflow,
  TASK: {
    initial: 'TODO',
    transitions: {
      TODO: ['IN_PROGRESS', 'DONE', 'REMOVED'],
      IN_PROGRESS: ['TODO', 'DONE', 'REMOVED'],
      DONE: ['IN_PROGRESS', 'TODO'],
      REMOVED: ['TODO'],
    },
  },
  BUG: {
    initial: 'NEW',
    transitions: {
      NEW: ['TRIAGED', 'ACTIVE', 'RESOLVED', 'CLOSED', 'REMOVED'],
      TRIAGED: ['ACTIVE', 'RESOLVED', 'CLOSED', 'REMOVED'],
      ACTIVE: ['TRIAGED', 'RESOLVED', 'REMOVED'],
      RESOLVED: ['VERIFIED', 'ACTIVE', 'CLOSED'],
      VERIFIED: ['CLOSED', 'ACTIVE'],
      CLOSED: ['ACTIVE'],
      REMOVED: ['NEW'],
    },
  },
};

/** All states a type can be in, in workflow order. */
export function statesForType(type: WorkItemType): WorkItemState[] {
  const wf = WORKFLOWS[type];
  return WORK_ITEM_STATES.filter((s) => s === wf.initial || s in wf.transitions);
}

export function nextStates(type: WorkItemType, from: WorkItemState): WorkItemState[] {
  return WORKFLOWS[type].transitions[from] ?? [];
}

export function canTransition(type: WorkItemType, from: WorkItemState, to: WorkItemState) {
  return from === to || nextStates(type, from).includes(to);
}

// ---- bug fields -------------------------------------------------------------------------

export const SEVERITIES = ['S1_CRITICAL', 'S2_HIGH', 'S3_MEDIUM', 'S4_LOW'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABELS: Record<Severity, string> = {
  S1_CRITICAL: '1 - Critical',
  S2_HIGH: '2 - High',
  S3_MEDIUM: '3 - Medium',
  S4_LOW: '4 - Low',
};

export const RESOLUTIONS = [
  'FIXED',
  'WONT_FIX',
  'DUPLICATE',
  'CANNOT_REPRODUCE',
  'BY_DESIGN',
] as const;
export type Resolution = (typeof RESOLUTIONS)[number];
export const RESOLUTION_LABELS: Record<Resolution, string> = {
  FIXED: 'Fixed',
  WONT_FIX: "Won't fix",
  DUPLICATE: 'Duplicate',
  CANNOT_REPRODUCE: 'Cannot reproduce',
  BY_DESIGN: 'As designed',
};

// ---- links ------------------------------------------------------------------------------

export const LINK_TYPES = ['RELATES', 'BLOCKS', 'DUPLICATES'] as const;
export type LinkType = (typeof LINK_TYPES)[number];
/** Label as seen from the source item / from the target item. */
export const LINK_LABELS: Record<LinkType, { outgoing: string; incoming: string }> = {
  RELATES: { outgoing: 'Related to', incoming: 'Related to' },
  BLOCKS: { outgoing: 'Blocks', incoming: 'Blocked by' },
  DUPLICATES: { outgoing: 'Duplicate of', incoming: 'Duplicated by' },
};

// ---- schemas ----------------------------------------------------------------------------

export const workItemKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}-\d{1,7}$/, 'Use a work item key like BCM-12');

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.trim() ? v : null));

const nullableNumber = (max: number) =>
  z
    .union([z.number().min(0).max(max), z.null(), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? null : v));

const nullableDate = z
  .union([dateOnlySchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const nullableUuid = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

export const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[^,]+$/, 'Tags cannot contain commas'),
  )
  .max(20, 'At most 20 tags')
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]);

const editableFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(255),
  description: nullableText(20_000),
  priority: z.enum(PRIORITIES),
  severity: z.enum(SEVERITIES).nullable().optional(),
  assigneeId: nullableUuid,
  parentId: nullableUuid,
  iterationId: nullableUuid,
  storyPoints: nullableNumber(1000),
  originalEstimate: nullableNumber(10_000),
  remainingWork: nullableNumber(10_000),
  completedWork: nullableNumber(10_000),
  startDate: nullableDate,
  dueDate: nullableDate,
  tags: tagsSchema.optional(),
  environment: z.enum(ENVIRONMENT_TYPES).nullable().optional(),
  reproSteps: nullableText(20_000),
  expectedResult: nullableText(5000),
  actualResult: nullableText(5000),
};

const dueAfterStart = (v: { startDate?: string | null; dueDate?: string | null }) =>
  !v.startDate || !v.dueDate || v.startDate <= v.dueDate;
const DUE_MSG = { path: ['dueDate'], message: 'Due date must be on or after start date' };

export const createWorkItemSchema = z
  .object({
    type: z.enum(WORK_ITEM_TYPES),
    ...editableFields,
    priority: editableFields.priority.default('MEDIUM'),
  })
  .refine(dueAfterStart, DUE_MSG);
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;

export const updateWorkItemSchema = z
  .object({
    ...editableFields,
    title: editableFields.title.optional(),
    priority: editableFields.priority.optional(),
    state: z.enum(WORK_ITEM_STATES).optional(),
    rank: z.number().finite().optional(),
    resolution: z.enum(RESOLUTIONS).nullable().optional(),
  })
  .refine(dueAfterStart, DUE_MSG)
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;
/** Request body shape (before parsing) - what clients send to PATCH /work-items/:id. */
export type UpdateWorkItemBody = z.input<typeof updateWorkItemSchema>;

export const WORK_ITEM_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'priority',
  'severity',
  'dueDate',
  'number',
  'title',
  'state',
] as const;

const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.array(z.enum(values)), z.string()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return undefined;
      const list = Array.isArray(v) ? v : String(v).split(',');
      for (const item of list) {
        if (!(values as readonly string[]).includes(item)) {
          ctx.addIssue({ code: 'custom', message: `Invalid value "${item}"` });
          return z.NEVER;
        }
      }
      return list as T[number][];
    });

export const listWorkItemsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  type: csvEnum(WORK_ITEM_TYPES),
  state: csvEnum(WORK_ITEM_STATES),
  /** open = proposed + in progress, done = resolved + completed, all = everything except removed */
  status: z.enum(['open', 'done', 'all', 'removed']).default('all'),
  priority: csvEnum(PRIORITIES),
  severity: csvEnum(SEVERITIES),
  /** 'me', 'none' or a user id */
  assignee: z.union([z.literal('me'), z.literal('none'), z.string().uuid()]).optional(),
  createdBy: z.union([z.literal('me'), z.string().uuid()]).optional(),
  parentId: z.string().uuid().optional(),
  /** sprint id or 'none' (not in a sprint) */
  iteration: z.union([z.literal('none'), z.string().uuid()]).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(WORK_ITEM_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListWorkItemsQuery = z.infer<typeof listWorkItemsQuerySchema>;
/** Filters as the UI keeps them (strings, before parsing). */
export type WorkItemFilterParams = Partial<Record<keyof ListWorkItemsQuery, string>>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(10_000),
  mentions: z.array(z.string().uuid()).max(20).default([]),
});
export type CommentInput = z.infer<typeof commentSchema>;
export const updateCommentSchema = commentSchema;

export const createLinkSchema = z.object({
  type: z.enum(LINK_TYPES),
  targetKey: workItemKeySchema,
});
export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export const savedQuerySchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: z.record(z.string(), z.string().max(200)),
});
export type SavedQueryInput = z.infer<typeof savedQuerySchema>;

// ---- attachments ------------------------------------------------------------------------

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Allowed upload extensions -> served content type. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const isImageType = (mime: string) => mime.startsWith('image/');
