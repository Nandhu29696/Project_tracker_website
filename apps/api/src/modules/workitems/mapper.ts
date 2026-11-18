import type {
  AttachmentDto,
  CommentDto,
  UserRef,
  WorkItemAccess,
  WorkItemDetail,
  WorkItemLinkDto,
  WorkItemRef,
  WorkItemSummary,
} from '@tracker/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDbDate } from '../../lib/dates';
import { userRefSelect } from '../projects/project.mapper';
import { workItemKey } from './access';

export const refSelect = {
  id: true,
  number: true,
  type: true,
  title: true,
  state: true,
  project: { select: { key: true } },
} as const;

export const summaryInclude = {
  project: { select: { id: true, key: true, name: true } },
  assignee: { select: userRefSelect },
  iteration: { select: { id: true, name: true } },
  _count: { select: { comments: true, children: true } },
} satisfies Prisma.WorkItemInclude;

export const detailInclude = {
  ...summaryInclude,
  project: { select: { id: true, key: true, name: true, archivedAt: true } },
  createdBy: { select: userRefSelect },
  parent: { select: refSelect },
  children: {
    select: { ...refSelect, assignee: { select: userRefSelect } },
    orderBy: [{ rank: 'asc' }, { number: 'asc' }],
  },
  outgoingLinks: { include: { target: { select: refSelect } } },
  incomingLinks: { include: { source: { select: refSelect } } },
  attachments: {
    include: { uploadedBy: { select: userRefSelect } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.WorkItemInclude;

type RefRow = Prisma.WorkItemGetPayload<{ select: typeof refSelect }>;
type SummaryRow = Prisma.WorkItemGetPayload<{ include: typeof summaryInclude }>;
type DetailRow = Prisma.WorkItemGetPayload<{ include: typeof detailInclude }>;

const userRef = (u: UserRef | null): UserRef | null =>
  u ? { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl } : null;

export function toRef(r: RefRow): WorkItemRef {
  return {
    id: r.id,
    key: workItemKey(r.project.key, r.number),
    type: r.type,
    title: r.title,
    state: r.state,
  };
}

export function toSummary(w: SummaryRow): WorkItemSummary {
  return {
    id: w.id,
    key: workItemKey(w.project.key, w.number),
    number: w.number,
    iteration: w.iteration,
    rank: w.rank,
    type: w.type,
    title: w.title,
    state: w.state,
    project: { id: w.project.id, key: w.project.key, name: w.project.name },
    priority: w.priority,
    severity: w.severity,
    assignee: userRef(w.assignee),
    parentId: w.parentId,
    tags: w.tags,
    storyPoints: w.storyPoints,
    remainingWork: w.remainingWork,
    dueDate: fromDbDate(w.dueDate),
    commentCount: w._count.comments,
    childCount: w._count.children,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function toAttachmentDto(
  a: DetailRow['attachments'][number],
  canDelete: boolean,
): AttachmentDto {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    size: a.size,
    uploadedBy: userRef(a.uploadedBy),
    createdAt: a.createdAt.toISOString(),
    canDelete,
  };
}

export function toDetail(
  w: DetailRow,
  access: WorkItemAccess,
  opts: { userId: string; canManageProject: boolean },
): WorkItemDetail {
  const links: WorkItemLinkDto[] = [
    ...w.outgoingLinks.map((l) => ({
      id: l.id,
      type: l.type,
      direction: 'outgoing' as const,
      item: toRef(l.target),
    })),
    ...w.incomingLinks.map((l) => ({
      id: l.id,
      type: l.type,
      direction: 'incoming' as const,
      item: toRef(l.source),
    })),
  ];
  return {
    ...toSummary(w),
    description: w.description,
    resolution: w.resolution,
    originalEstimate: w.originalEstimate,
    completedWork: w.completedWork,
    startDate: fromDbDate(w.startDate),
    environment: w.environment,
    reproSteps: w.reproSteps,
    expectedResult: w.expectedResult,
    actualResult: w.actualResult,
    createdBy: userRef(w.createdBy),
    stateChangedAt: w.stateChangedAt.toISOString(),
    closedAt: w.closedAt?.toISOString() ?? null,
    parent: w.parent ? toRef(w.parent) : null,
    children: w.children.map((c) => ({ ...toRef(c), assignee: userRef(c.assignee) })),
    links,
    attachments: w.attachments.map((a) =>
      toAttachmentDto(
        a,
        access.canComment && (a.uploadedById === opts.userId || opts.canManageProject),
      ),
    ),
    access,
    projectArchived: !!w.project.archivedAt,
  };
}

export const commentInclude = {
  author: { select: userRefSelect },
} satisfies Prisma.CommentInclude;
type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export function toCommentDto(
  c: CommentRow,
  mentionUsers: Map<string, UserRef>,
  opts: { userId: string; canComment: boolean; canManageProject: boolean },
): CommentDto {
  const isAuthor = c.authorId === opts.userId;
  return {
    id: c.id,
    body: c.body,
    author: userRef(c.author),
    mentions: c.mentions.map((id) => mentionUsers.get(id)).filter((u): u is UserRef => !!u),
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    canEdit: opts.canComment && isAuthor,
    canDelete: opts.canComment && (isAuthor || opts.canManageProject),
  };
}
