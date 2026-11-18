import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Pencil,
  Plus,
  Server,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ENVIRONMENT_TYPE_LABELS,
  PROJECT_ROLE_LABELS,
  PROJECT_ROLES,
  ROLE_LABELS,
  type EnvironmentDto,
  type ProjectDetail,
  type ProjectRole,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Alert, Avatar, Badge, Card, CardHeader, FullPageSpinner } from '@/components/ui/misc';
import { AddMemberDialog } from '@/features/projects/AddMemberDialog';
import { projectKeys, useProject } from '@/features/projects/api';
import {
  CategoryTag,
  DeploymentBadge,
  DevStatusLabel,
  formatDay,
  isOverdue,
  PriorityBadge,
  ProjectKey,
  ProjectStatusBadge,
} from '@/features/projects/badges';
import { EnvironmentDialog } from '@/features/projects/EnvironmentDialog';
import { InsightsTab } from '@/features/insights/InsightsTab';
import { Board } from '@/features/planning/Board';
import { SprintsTab } from '@/features/planning/SprintsTab';
import { VaultTab } from '@/features/vault/VaultTab';
import { Backlog } from '@/features/workitems/Backlog';
import { useProjectLive } from '@/lib/realtime';
import { ProjectFormDialog } from '@/features/projects/ProjectFormDialog';
import { useAuth } from '@/features/auth/AuthProvider';
import { NotFoundPage } from '@/pages/ErrorPages';
import { api, getErrorMessage } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';

const TABS = [
  'overview',
  'insights',
  'work-items',
  'board',
  'sprints',
  'environments',
  'members',
  'vault',
] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  insights: 'Insights',
  'work-items': 'Backlog',
  board: 'Board',
  sprints: 'Sprints',
  environments: 'Environments',
  members: 'Members',
  vault: 'Vault',
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Timeline({ p }: { p: ProjectDetail }) {
  // captured once per mount: keeps render pure, and day-level precision is enough
  const [mountedAt] = useState(() => Date.now());
  if (!p.startDate || !p.targetDate) {
    return (
      <p className="text-sm text-slate-500">Add a start and target date to see the timeline.</p>
    );
  }
  if (p.startDate > p.targetDate) {
    return (
      <Alert tone="warning" title="Dates need attention">
        Start date ({formatDay(p.startDate)}) is after the target date ({formatDay(p.targetDate)}).
        Edit the project to correct them.
      </Alert>
    );
  }
  const start = Date.parse(p.startDate);
  const end = Date.parse(p.targetDate);
  const now = mountedAt;
  const pct = Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
  const days = Math.round((end - start) / 86_400_000);
  const left = Math.ceil((end - now) / 86_400_000);
  const overdue = isOverdue(p.targetDate, p.status);
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{formatDay(p.startDate)}</span>
        <span>{formatDay(p.targetDate)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn('h-full rounded-full', overdue ? 'bg-red-500' : 'bg-brand-600')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        className={cn(
          'mt-2 text-xs',
          overdue
            ? 'font-medium text-red-600 dark:text-red-400'
            : 'text-slate-500 dark:text-slate-400',
        )}
      >
        {days} days planned ·{' '}
        {p.status === 'COMPLETED'
          ? 'completed'
          : overdue
            ? `${Math.abs(left)} days overdue`
            : now < start
              ? `starts in ${Math.ceil((start - now) / 86_400_000)} days`
              : `${left} days left`}
      </p>
    </div>
  );
}

function OverviewTab({ p }: { p: ProjectDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="About" />
        <div className="space-y-6 p-5">
          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
            {p.description || <span className="text-slate-400">No description yet.</span>}
          </p>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-slate-400" /> Timeline
            </h3>
            <Timeline p={p} />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Details" />
        <dl className="grid grid-cols-2 gap-4 p-5">
          <Detail label="Status">
            <ProjectStatusBadge value={p.status} />
          </Detail>
          <Detail label="Priority">
            <PriorityBadge value={p.priority} />
          </Detail>
          <Detail label="Development">
            <DevStatusLabel value={p.devStatus} />
          </Detail>
          <Detail label="Category">
            <CategoryTag category={p.category} />
          </Detail>
          <Detail label="Start">{formatDay(p.startDate)}</Detail>
          <Detail label="Target">{formatDay(p.targetDate)}</Detail>
          <Detail label="Owner">
            {p.owner ? (
              <span className="flex items-center gap-2">
                <Avatar name={p.owner.name} src={p.owner.avatarUrl} size="sm" />
                {p.owner.name}
              </span>
            ) : (
              '—'
            )}
          </Detail>
          <Detail label="Your role">
            {p.access.projectRole ? PROJECT_ROLE_LABELS[p.access.projectRole] : 'Admin'}
          </Detail>
          <Detail label="Created">{formatDateTime(p.createdAt)}</Detail>
          <Detail label="Updated">{formatDateTime(p.updatedAt)}</Detail>
        </dl>
      </Card>
    </div>
  );
}

function EnvironmentsTab({ p }: { p: ProjectDetail }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EnvironmentDto | undefined>();
  const [open, setOpen] = useState(false);
  const canEdit = p.access.canManage && !p.archivedAt;

  const remove = async (e: EnvironmentDto) => {
    if (!confirm(`Remove the ${ENVIRONMENT_TYPE_LABELS[e.type]} environment?`)) return;
    try {
      await api.delete(`/environments/${e.id}`);
      toast.success('Environment removed');
      await qc.invalidateQueries({ queryKey: projectKeys.all });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Environments"
        description="Where this project is deployed."
        action={
          canEdit &&
          p.environments.length < 5 && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add environment
            </Button>
          )
        }
      />
      {!p.environments.length ? (
        <div className="flex flex-col items-center p-10 text-center">
          <Server className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No environments recorded yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {p.environments.map((e) => (
            <li key={e.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold">{e.type}</p>
                <p className="text-xs text-slate-500">{ENVIRONMENT_TYPE_LABELS[e.type]}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DeploymentBadge value={e.status} />
                  {e.displayName && <span className="text-sm">{e.displayName}</span>}
                </div>
                {e.url && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-sm text-brand-600 hover:underline dark:text-brand-500"
                  >
                    {e.url} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                )}
                {e.notes && <p className="text-xs text-slate-500">{e.notes}</p>}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {e.deployedAt && <span>Deployed {formatDay(e.deployedAt)}</span>}
                {canEdit && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(e);
                        setOpen(true);
                      }}
                      aria-label={`Edit ${e.type}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(e)}
                      aria-label={`Remove ${e.type}`}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <EnvironmentDialog
        open={open}
        onClose={() => setOpen(false)}
        projectId={p.id}
        environment={editing}
        usedTypes={p.environments.map((e) => e.type)}
      />
    </Card>
  );
}

function MembersTab({ p }: { p: ProjectDetail }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const canEdit = p.access.canManage && !p.archivedAt;

  const run = async (userId: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(userId);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: projectKeys.all });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Members"
        description={`${p.members.length} ${p.members.length === 1 ? 'person' : 'people'} on this project`}
        action={
          canEdit && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add member
            </Button>
          )
        }
      />
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {p.members.map((m) => (
          <li key={m.user.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
            <Avatar name={m.user.name} src={m.user.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {m.user.name}
                {m.user.id === user?.id && <span className="text-xs text-slate-400">(you)</span>}
                {m.user.id === p.owner?.id && <Badge tone="purple">Owner</Badge>}
                {!m.user.isActive && <Badge tone="red">Inactive</Badge>}
              </p>
              <p className="truncate text-xs text-slate-500">
                {m.user.email} · {ROLE_LABELS[m.user.role]}
              </p>
            </div>
            {canEdit ? (
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Project role for ${m.user.name}`}
                  value={m.role}
                  disabled={busy === m.user.id}
                  onChange={(e) =>
                    run(
                      m.user.id,
                      () =>
                        api.patch(`/projects/${p.id}/members/${m.user.id}`, {
                          role: e.target.value as ProjectRole,
                        }),
                      'Role updated',
                    )
                  }
                  className="h-8 w-40 text-xs"
                >
                  {PROJECT_ROLES.map((r) => (
                    <option
                      key={r}
                      value={r}
                      disabled={r === 'MANAGER' && m.user.role === 'EMPLOYEE'}
                    >
                      {PROJECT_ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
                {m.user.id !== p.owner?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-600"
                    aria-label={`Remove ${m.user.name}`}
                    loading={busy === m.user.id}
                    onClick={() =>
                      confirm(`Remove ${m.user.name} from ${p.key}?`) &&
                      run(
                        m.user.id,
                        () => api.delete(`/projects/${p.id}/members/${m.user.id}`),
                        'Member removed',
                      )
                    }
                  >
                    {busy !== m.user.id && <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            ) : (
              <Badge tone={m.role === 'MANAGER' ? 'blue' : 'slate'}>
                {PROJECT_ROLE_LABELS[m.role]}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <AddMemberDialog
        open={open}
        onClose={() => setOpen(false)}
        projectId={p.id}
        memberIds={p.members.map((m) => m.user.id)}
      />
    </Card>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requested = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'overview';
  const { data: p, isLoading, error } = useProject(id);
  const [editOpen, setEditOpen] = useState(false);
  const [working, setWorking] = useState(false);
  useProjectLive(p?.id); // boards, backlog and sprints refresh when others change things

  if (isLoading) return <FullPageSpinner />;
  if (error || !p) return <NotFoundPage />;
  const visibleTabs = TABS.filter((t) => t !== 'vault' || p.canUseVault);
  const tab = visibleTabs.includes(requested) ? requested : 'overview';

  const action = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setWorking(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: projectKeys.all });
      after?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectKey value={p.key} className="text-xs" />
            <ProjectStatusBadge value={p.status} />
            <PriorityBadge value={p.priority} />
            {p.archivedAt && <Badge>Archived {formatDay(p.archivedAt.slice(0, 10))}</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight wrap-break-word">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <CategoryTag category={p.category} />
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" />
              {p.memberCount} members
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.access.canManage && !p.archivedAt && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {p.access.canManage &&
            (p.archivedAt ? (
              <Button
                variant="outline"
                size="sm"
                loading={working}
                onClick={() =>
                  action(() => api.post(`/projects/${p.id}/restore`), 'Project restored')
                }
              >
                <ArchiveRestore className="h-4 w-4" /> Restore
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={working}
                onClick={() =>
                  confirm(
                    `Archive ${p.key}? It becomes read-only and is hidden from the default list.`,
                  ) && action(() => api.post(`/projects/${p.id}/archive`), 'Project archived')
                }
              >
                <Archive className="h-4 w-4" /> Archive
              </Button>
            ))}
          {p.access.canDelete && p.archivedAt && (
            <Button
              variant="danger"
              size="sm"
              loading={working}
              onClick={() =>
                prompt(
                  `This permanently deletes ${p.key} and everything in it. Type ${p.key} to confirm.`,
                ) === p.key &&
                action(
                  () => api.delete(`/projects/${p.id}`),
                  'Project deleted',
                  () => navigate('/projects', { replace: true }),
                )
              }
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      {p.archivedAt && (
        <Alert tone="info">
          This project is archived and read-only. Restore it to make changes.
        </Alert>
      )}

      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Project sections">
          {visibleTabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })}
              aria-current={tab === t ? 'page' : undefined}
              className={cn(
                'cursor-pointer border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
                tab === t
                  ? 'border-brand-600 text-brand-700 dark:text-brand-100'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              {TAB_LABELS[t]}
              {t === 'environments' && (
                <span className="ml-1.5 text-xs text-slate-400">{p.environments.length}</span>
              )}
              {t === 'members' && (
                <span className="ml-1.5 text-xs text-slate-400">{p.members.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && <OverviewTab p={p} />}
      {tab === 'environments' && <EnvironmentsTab p={p} />}
      {tab === 'members' && <MembersTab p={p} />}
      {tab === 'work-items' && <Backlog project={p} />}
      {tab === 'insights' && <InsightsTab project={p} />}
      {tab === 'board' && <Board project={p} />}
      {tab === 'sprints' && <SprintsTab project={p} />}
      {tab === 'vault' && <VaultTab project={p} />}

      <ProjectFormDialog open={editOpen} onClose={() => setEditOpen(false)} project={p} />
    </div>
  );
}
