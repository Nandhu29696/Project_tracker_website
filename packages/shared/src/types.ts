import type { Role } from './roles';
import type {
  DeploymentStatus,
  DevStatus,
  EnvironmentType,
  Priority,
  ProjectRole,
  ProjectStatus,
} from './schemas/project';
import type {
  LinkType,
  Resolution,
  Severity,
  WorkItemState,
  WorkItemType,
} from './schemas/workitem';
import type { BoardColumn, BoardSettings, IterationState } from './schemas/planning';

/** User shape returned by the API (never contains secrets). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  projectCount?: number;
}

export interface EnvironmentDto {
  id: string;
  type: EnvironmentType;
  displayName: string | null;
  url: string | null;
  status: DeploymentStatus;
  deployedAt: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface ProjectMemberDto {
  user: UserRef & { role: Role; isActive: boolean };
  role: ProjectRole;
  addedAt: string;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: CategoryDto | null;
  priority: Priority;
  status: ProjectStatus;
  devStatus: DevStatus;
  startDate: string | null;
  targetDate: string | null;
  owner: UserRef | null;
  memberCount: number;
  environments: Pick<EnvironmentDto, 'type' | 'status' | 'url' | 'displayName'>[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** What the current user may do with this project. */
  access: ProjectAccess;
}

export interface ProjectAccess {
  projectRole: ProjectRole | null;
  canManage: boolean;
  canDelete: boolean;
}

export interface ProjectDetail extends ProjectSummary {
  workItemAccess: ProjectWorkItemAccess;
  boardSettings: BoardSettings;
  /** Admin or project manager: may see / reveal the credentials vault. */
  canUseVault: boolean;
  members: ProjectMemberDto[];
  environments: EnvironmentDto[];
  createdBy: UserRef | null;
}

export type ImportRowAction = 'create' | 'skip' | 'error';

export interface ImportRowResult {
  row: number;
  name: string | null;
  key: string | null;
  action: ImportRowAction;
  messages: string[];
}

export interface ImportResult {
  dryRun: boolean;
  sheet: string;
  totals: { rows: number; create: number; skip: number; error: number };
  rows: ImportRowResult[];
}

// ---- work items -------------------------------------------------------------------------

export interface WorkItemAccess {
  canEdit: boolean;
  canAssignOthers: boolean;
  canComment: boolean;
  canDelete: boolean;
}

export interface ProjectRef {
  id: string;
  key: string;
  name: string;
}

export interface WorkItemRef {
  id: string;
  key: string;
  type: WorkItemType;
  title: string;
  state: WorkItemState;
}

export interface WorkItemSummary extends WorkItemRef {
  number: number;
  iteration: { id: string; name: string } | null;
  rank: number;
  project: ProjectRef;
  priority: Priority;
  severity: Severity | null;
  assignee: UserRef | null;
  parentId: string | null;
  tags: string[];
  storyPoints: number | null;
  remainingWork: number | null;
  dueDate: string | null;
  commentCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemLinkDto {
  id: string;
  type: LinkType;
  direction: 'outgoing' | 'incoming';
  item: WorkItemRef;
}

export interface AttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: UserRef | null;
  createdAt: string;
  canDelete: boolean;
}

export interface WorkItemDetail extends WorkItemSummary {
  description: string | null;
  resolution: Resolution | null;
  originalEstimate: number | null;
  completedWork: number | null;
  startDate: string | null;
  environment: EnvironmentType | null;
  reproSteps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  createdBy: UserRef | null;
  stateChangedAt: string;
  closedAt: string | null;
  parent: WorkItemRef | null;
  children: (WorkItemRef & { assignee: UserRef | null })[];
  links: WorkItemLinkDto[];
  attachments: AttachmentDto[];
  access: WorkItemAccess;
  projectArchived: boolean;
}

export interface CommentDto {
  id: string;
  body: string;
  author: UserRef | null;
  mentions: UserRef[];
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface HistoryEntryDto {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actor: UserRef | null;
  createdAt: string;
}

export interface SavedQueryDto {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

/** Project-level work item rights for the current user. */
export interface ProjectWorkItemAccess {
  canCreate: boolean;
  canCreatePlanning: boolean;
  canAssignOthers: boolean;
}

// ---- sprints, board, vault (Phase 4) ------------------------------------------------------

export interface IterationDto {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  state: IterationState;
  stats: {
    items: number;
    openItems: number;
    totalPoints: number;
    completedPoints: number;
    remainingWork: number;
  };
}

export interface CapacityRow {
  user: UserRef;
  hoursPerDay: number;
  daysOff: number;
  /** hoursPerDay x (working days - days off) */
  capacityHours: number;
  /** remaining work of items in the sprint assigned to this user */
  assignedHours: number;
}

export interface BurndownPoint {
  date: string;
  remainingWork: number | null;
  remainingPoints: number | null;
  ideal: number;
}

export interface SprintDetail extends IterationDto {
  workingDays: number;
  capacity: CapacityRow[];
  unassignedHours: number;
  burndown: BurndownPoint[];
  /** what the ideal line is measured in: remaining hours if tasks are estimated, else story points */
  burndownUnit: 'hours' | 'points';
  canManage: boolean;
}

export interface BoardData {
  items: WorkItemSummary[];
  wipLimits: Partial<Record<BoardColumn, number | null>>;
  canManage: boolean;
  canEdit: boolean;
  truncated: boolean;
}

export interface CredentialDto {
  id: string;
  projectId: string;
  label: string;
  username: string | null;
  url: string | null;
  environment: EnvironmentType | null;
  notes: string | null;
  createdBy: UserRef | null;
  updatedAt: string;
  lastRotatedAt: string;
  lastRevealedAt: string | null;
}

export interface CredentialAccessEntry {
  action: string;
  actor: UserRef | null;
  ip: string | null;
  createdAt: string;
}

export interface CredentialImportSection {
  index: number;
  title: string;
  suggestedProjectId: string | null;
  entries: { label: string; username: string | null; secretPreview: string; duplicate: boolean }[];
}

export interface CredentialImportResult {
  dryRun: boolean;
  sections: CredentialImportSection[];
  created: number;
  skipped: number;
}

export interface AuthProviders {
  password: boolean;
  google: boolean;
  selfRegistration: boolean;
}
