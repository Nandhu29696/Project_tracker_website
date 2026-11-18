import { z } from 'zod';

// ---- enums (mirror prisma/schema.prisma) -------------------------------------------

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PROJECT_STATUSES = [
  'ACTIVE',
  'ON_HOLD',
  'CLIENT_NO_RESPONSE',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  CLIENT_NO_RESPONSE: 'Client no response',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const DEV_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type DevStatus = (typeof DEV_STATUSES)[number];
export const DEV_STATUS_LABELS: Record<DevStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export const PROJECT_ROLES = ['MANAGER', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  MANAGER: 'Project manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ENVIRONMENT_TYPES = ['DEV', 'QA', 'UAT', 'STAGING', 'PROD'] as const;
export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number];
export const ENVIRONMENT_TYPE_LABELS: Record<EnvironmentType, string> = {
  DEV: 'Development',
  QA: 'QA / Test',
  UAT: 'UAT',
  STAGING: 'Staging',
  PROD: 'Production',
};

export const DEPLOYMENT_STATUSES = ['NOT_DEPLOYED', 'DEPLOYED', 'LIVE', 'DOWN'] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];
export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  NOT_DEPLOYED: 'Not deployed',
  DEPLOYED: 'Deployed',
  LIVE: 'Live',
  DOWN: 'Down',
};

// ---- field helpers ------------------------------------------------------------------

/** Calendar date as YYYY-MM-DD (no time zone surprises). */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Invalid date');

const optionalDate = z
  .union([dateOnlySchema, z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Key: 2-10 letters/digits, starting with a letter (e.g. BCM)');

const uuidOrNull = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v));

export const datesInOrder = (start?: string | null, end?: string | null) =>
  !start || !end || start <= end;
const DATE_ORDER_MSG = { path: ['targetDate'], message: 'End date must be on or after start date' };

// ---- projects -----------------------------------------------------------------------

const projectFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: optionalText(5000),
  categoryId: uuidOrNull,
  priority: z.enum(PRIORITIES),
  status: z.enum(PROJECT_STATUSES),
  devStatus: z.enum(DEV_STATUSES),
  startDate: optionalDate,
  targetDate: optionalDate,
};

export const createProjectSchema = z
  .object({
    ...projectFields,
    key: z
      .union([projectKeySchema, z.literal('')])
      .optional()
      .transform((v) => v || undefined),
    priority: projectFields.priority.default('MEDIUM'),
    status: projectFields.status.default('ACTIVE'),
    devStatus: projectFields.devStatus.default('NOT_STARTED'),
  })
  .refine((v) => datesInOrder(v.startDate, v.targetDate), DATE_ORDER_MSG);
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: projectFields.name.optional(),
    description: projectFields.description,
    categoryId: projectFields.categoryId,
    priority: projectFields.priority.optional(),
    status: projectFields.status.optional(),
    devStatus: projectFields.devStatus.optional(),
    startDate: projectFields.startDate,
    targetDate: projectFields.targetDate,
  })
  .refine((v) => datesInOrder(v.startDate, v.targetDate), DATE_ORDER_MSG);
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const PROJECT_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'name',
  'key',
  'priority',
  'startDate',
  'targetDate',
] as const;

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  devStatus: z.enum(DEV_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  categoryId: z.string().uuid().optional(),
  archived: z.enum(['false', 'true', 'all']).default('false'),
  mine: z.enum(['true', 'false']).optional(),
  sort: z.enum(PROJECT_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

// ---- members ------------------------------------------------------------------------

export const addMemberSchema = z.object({
  userId: z.string().uuid('Select a user'),
  role: z.enum(PROJECT_ROLES).default('MEMBER'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.object({ role: z.enum(PROJECT_ROLES) });

// ---- environments -------------------------------------------------------------------

const urlOrNull = z
  .union([
    z.string().trim().url('Enter a full URL, e.g. https://app.example.com').max(500),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((v) => (v === '' ? null : v));

export const environmentSchema = z.object({
  type: z.enum(ENVIRONMENT_TYPES),
  displayName: optionalText(150),
  url: urlOrNull,
  status: z.enum(DEPLOYMENT_STATUSES).default('NOT_DEPLOYED'),
  deployedAt: optionalDate,
  notes: optionalText(1000),
});
export type EnvironmentInput = z.infer<typeof environmentSchema>;

export const updateEnvironmentSchema = environmentSchema.partial();

// ---- categories ---------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #2563eb')
    .default('#64748b'),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;
export const updateCategorySchema = categorySchema.partial();
