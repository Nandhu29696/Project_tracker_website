import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  Circle,
  ListChecks,
  Flame,
  FolderKanban,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABELS, ROLE_PERMISSIONS, type WorkItemFilterParams } from '@tracker/shared';
import { Badge, Card, CardHeader, Spinner } from '@/components/ui/misc';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProjects, type ProjectFilters } from '@/features/projects/api';
import { useWorkItems } from '@/features/workitems/api';
import { TypeIcon } from '@/features/workitems/meta';
import { cn } from '@/lib/utils';
import {
  formatDay,
  PriorityBadge,
  ProjectKey,
  ProjectStatusBadge,
} from '@/features/projects/badges';

const roadmap = [
  { phase: 'Phase 1', title: 'Foundation, auth, Google sign-in, roles, email', done: true },
  { phase: 'Phase 2', title: 'Projects, members, environments, Excel import', done: true },
  { phase: 'Phase 3', title: 'Work items, tasks, bugs, assignees, backlog', done: true },
  { phase: 'Phase 4', title: 'Boards, sprints, capacity, credentials vault', done: true },
  { phase: 'Phase 5', title: 'Dashboards, notifications, search, reports', done: true },
  { phase: 'Phase 6', title: 'Testing, hardening, production deployment', done: false },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function StatCard({
  label,
  icon: Icon,
  tone,
  to,
  count,
}: {
  label: string;
  icon: LucideIcon;
  tone: string;
  to: string;
  count: { isLoading: boolean; total: number | undefined };
}) {
  return (
    <Link to={to}>
      <Card className="h-full p-4 transition hover:border-brand-500/40 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', tone)}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-3 text-2xl font-semibold">
          {count.isLoading ? <Spinner className="h-5 w-5" /> : (count.total ?? '—')}
        </div>
      </Card>
    </Link>
  );
}

// pageSize 1: only meta.total is needed
function ProjectStat(
  props: Omit<Parameters<typeof StatCard>[0], 'count'> & { filters?: ProjectFilters },
) {
  const q = useProjects({ ...props.filters, pageSize: 1 });
  return <StatCard {...props} count={{ isLoading: q.isLoading, total: q.data?.meta.total }} />;
}

function WorkItemStat(
  props: Omit<Parameters<typeof StatCard>[0], 'count'> & { filters: WorkItemFilterParams },
) {
  const q = useWorkItems({ ...props.filters, pageSize: '1' });
  return <StatCard {...props} count={{ isLoading: q.isLoading, total: q.data?.meta.total }} />;
}

/** My open items that are overdue or due within 7 days. */
function DueSoon() {
  const { data, isLoading } = useWorkItems({
    assignee: 'me',
    status: 'open',
    sort: 'dueDate',
    order: 'asc',
    pageSize: '50',
  });
  // captured once per mount: keeps render pure
  const [{ today, horizon }] = useState(() => ({
    today: new Date().toISOString().slice(0, 10),
    horizon: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  }));
  const items = (data?.data ?? []).filter((w) => w.dueDate && w.dueDate <= horizon).slice(0, 8);
  return (
    <Card>
      <CardHeader title="Due soon" description="Your open items due in the next 7 days" />
      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      ) : !items.length ? (
        <p className="p-5 text-sm text-slate-500">Nothing due this week.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((w) => (
            <li key={w.id}>
              <Link
                to={`/items/${w.key}`}
                className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <TypeIcon type={w.type} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-mono text-xs text-slate-500">{w.key}</span> {w.title}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    w.dueDate! < today
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-slate-500',
                  )}
                >
                  {w.dueDate! < today ? 'Overdue · ' : ''}
                  {formatDay(w.dueDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentProjects() {
  const { data, isLoading } = useProjects({ sort: 'updatedAt', order: 'desc', pageSize: 6 });
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Recently updated projects"
        action={
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-500"
          >
            All projects <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : !data?.data.length ? (
        <p className="p-8 text-center text-sm text-slate-500">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.data.map((p) => (
            <li key={p.id}>
              <Link
                to={`/projects/${p.id}`}
                className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <ProjectKey value={p.key} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <ProjectStatusBadge value={p.status} />
                <PriorityBadge value={p.priority} />
                <span className="hidden w-28 text-right text-xs text-slate-500 sm:block">
                  {formatDay(p.targetDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { user, can } = useAuth();
  if (!user) return null;
  const permissions = ROLE_PERMISSIONS[user.role];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Here&apos;s an overview of your workspace.
        </p>
      </div>

      {can('project:read') && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <ProjectStat
            label="Active projects"
            icon={FolderKanban}
            tone="text-brand-600 bg-brand-50 dark:bg-brand-500/10"
            to="/projects"
          />
          <ProjectStat
            label="High priority projects"
            icon={Flame}
            tone="text-orange-600 bg-orange-50 dark:bg-orange-500/10"
            filters={{ priority: 'HIGH' }}
            to="/projects?priority=HIGH"
          />
          <WorkItemStat
            label="My open items"
            icon={ListChecks}
            tone="text-amber-600 bg-amber-50 dark:bg-amber-500/10"
            filters={{ assignee: 'me', status: 'open' }}
            to="/my-work"
          />
          <WorkItemStat
            label="Open bugs"
            icon={Bug}
            tone="text-red-600 bg-red-50 dark:bg-red-500/10"
            filters={{ type: 'BUG', status: 'open' }}
            to="/bugs"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <DueSoon />
        </div>
        {can('project:read') && <RecentProjects />}
        <Card>
          <CardHeader title="Roadmap" description="Delivery phases from PROJECT_PLAN.md" />
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {roadmap.map((r) => (
              <li key={r.phase} className="flex items-start gap-3 px-5 py-3">
                {r.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                <div>
                  <p className="text-sm font-medium">{r.phase}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.title}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Your access
            </span>
          }
          description={`Role: ${ROLE_LABELS[user.role]} · ${permissions.length} permissions`}
        />
        <div className="flex flex-wrap gap-1.5 p-5">
          {permissions.map((p) => (
            <Badge key={p} tone="slate" className="font-mono text-[11px]">
              {p}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
