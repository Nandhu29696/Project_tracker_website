import type {
  BoardSettings,
  CategoryDto,
  EnvironmentDto,
  ProjectAccess,
  ProjectDetail,
  ProjectMemberDto,
  ProjectSummary,
  ProjectWorkItemAccess,
  UserRef,
} from '@tracker/shared';
import type { Prisma } from '../../generated/prisma/client';
import { fromDbDate } from '../../lib/dates';

export const userRefSelect = { id: true, name: true, email: true, avatarUrl: true } as const;

export const projectSummaryInclude = (userId: string) =>
  ({
    category: true,
    owner: { select: userRefSelect },
    environments: {
      select: { type: true, status: true, url: true, displayName: true },
      orderBy: { type: 'asc' },
    },
    members: { where: { userId }, select: { role: true } },
    _count: { select: { members: true } },
  }) satisfies Prisma.ProjectInclude;

export const projectDetailInclude = {
  category: true,
  owner: { select: userRefSelect },
  createdBy: { select: userRefSelect },
  environments: { orderBy: { type: 'asc' } },
  members: {
    include: { user: { select: { ...userRefSelect, role: true, isActive: true } } },
    orderBy: [{ role: 'asc' }, { addedAt: 'asc' }],
  },
  _count: { select: { members: true } },
} satisfies Prisma.ProjectInclude;

type SummaryRow = Prisma.ProjectGetPayload<{ include: ReturnType<typeof projectSummaryInclude> }>;
type DetailRow = Prisma.ProjectGetPayload<{ include: typeof projectDetailInclude }>;

export function toCategoryDto(c: {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}): CategoryDto {
  return { id: c.id, name: c.name, color: c.color, isActive: c.isActive };
}

const toUserRef = (u: UserRef | null): UserRef | null =>
  u ? { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl } : null;

function base(p: SummaryRow | DetailRow, access: ProjectAccess) {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    category: p.category ? toCategoryDto(p.category) : null,
    priority: p.priority,
    status: p.status,
    devStatus: p.devStatus,
    startDate: fromDbDate(p.startDate),
    targetDate: fromDbDate(p.targetDate),
    owner: toUserRef(p.owner),
    memberCount: p._count.members,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    access,
  };
}

export function toProjectSummary(p: SummaryRow, access: ProjectAccess): ProjectSummary {
  return {
    ...base(p, access),
    environments: p.environments.map((e) => ({
      type: e.type,
      status: e.status,
      url: e.url,
      displayName: e.displayName,
    })),
  };
}

export function toEnvironmentDto(e: DetailRow['environments'][number]): EnvironmentDto {
  return {
    id: e.id,
    type: e.type,
    displayName: e.displayName,
    url: e.url,
    status: e.status,
    deployedAt: fromDbDate(e.deployedAt),
    notes: e.notes,
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function toProjectDetail(
  p: DetailRow,
  access: ProjectAccess,
  workItemAccess: ProjectWorkItemAccess,
  extra: { boardSettings: BoardSettings; canUseVault: boolean },
): ProjectDetail {
  const members: ProjectMemberDto[] = p.members.map((m) => ({
    role: m.role,
    addedAt: m.addedAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.user.role,
      isActive: m.user.isActive,
    },
  }));
  return {
    ...base(p, access),
    environments: p.environments.map(toEnvironmentDto),
    members,
    createdBy: toUserRef(p.createdBy),
    workItemAccess,
    boardSettings: { wipLimits: extra.boardSettings?.wipLimits ?? {} },
    canUseVault: extra.canUseVault,
  };
}
