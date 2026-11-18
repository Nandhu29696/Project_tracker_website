import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DEV_STATUS_LABELS,
  DEV_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectSummary,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Avatar, Badge, Card, Spinner } from '@/components/ui/misc';
import { Can } from '@/features/auth/guards';
import {
  downloadFile,
  useCategories,
  useProjects,
  type ProjectFilters,
} from '@/features/projects/api';
import {
  CategoryTag,
  DevStatusLabel,
  EnvChips,
  formatDay,
  isOverdue,
  PriorityBadge,
  ProjectKey,
  ProjectStatusBadge,
} from '@/features/projects/badges';
import { ProjectFormDialog } from '@/features/projects/ProjectFormDialog';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
const SORTS = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'priority:asc', label: 'Priority (highest first)' },
  { value: 'targetDate:asc', label: 'Target date (soonest)' },
  { value: 'startDate:desc', label: 'Start date (newest)' },
  { value: 'createdAt:desc', label: 'Newest' },
] as const;

type View = 'table' | 'cards';
const readView = (): View => {
  try {
    return localStorage.getItem('projects.view') === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function DateRange({ p }: { p: ProjectSummary }) {
  const overdue = isOverdue(p.targetDate, p.status);
  return (
    <div className="text-xs whitespace-nowrap">
      <span className="text-slate-500 dark:text-slate-400">{formatDay(p.startDate)}</span>
      <span className="mx-1 text-slate-300">→</span>
      <span
        className={
          overdue
            ? 'font-medium text-red-600 dark:text-red-400'
            : 'text-slate-700 dark:text-slate-200'
        }
      >
        {formatDay(p.targetDate)}
      </span>
    </div>
  );
}

function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link
      to={`/projects/${p.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <ProjectKey value={p.key} />
          <h3 className="mt-1.5 truncate font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-100">
            {p.name}
          </h3>
        </div>
        <PriorityBadge value={p.priority} />
      </div>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500 dark:text-slate-400">
        {p.description ?? 'No description'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ProjectStatusBadge value={p.status} />
        <DevStatusLabel value={p.devStatus} />
        {p.archivedAt && <Badge>Archived</Badge>}
      </div>
      <div className="mt-3">
        <EnvChips environments={p.environments} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <CategoryTag category={p.category} />
        <DateRange p={p} />
      </div>
    </Link>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(readView);
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [q, setQ] = useState(params.get('q') ?? '');
  const search = useDebounced(q);
  const categories = useCategories();

  // filters live in the URL so they survive reloads and can be shared
  const get = (k: string) => params.get(k) ?? '';
  const sortValue = get('sort') || 'updatedAt:desc';
  const [sort, order] = sortValue.split(':') as [ProjectFilters['sort'], ProjectFilters['order']];
  const page = Number(get('page')) || 1;

  const filters: ProjectFilters = {
    q: search || undefined,
    status: (get('status') || undefined) as ProjectFilters['status'],
    devStatus: (get('devStatus') || undefined) as ProjectFilters['devStatus'],
    priority: (get('priority') || undefined) as ProjectFilters['priority'],
    categoryId: get('categoryId') || undefined,
    archived: (get('archived') || 'false') as ProjectFilters['archived'],
    mine: get('mine') === 'true' ? 'true' : undefined,
    sort,
    order,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error } = useProjects(filters);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const onSearch = (value: string) => {
    setQ(value);
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  };

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('projects.view', v);
    } catch {
      /* ignore */
    }
  };

  const doExport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    try {
      const { page: _p, pageSize: _s, ...rest } = filters;
      await downloadFile('/projects/export', { ...rest, format }, `projects.${format}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const activeFilters =
    ['status', 'devStatus', 'priority', 'categoryId', 'mine'].filter((k) => get(k)).length +
    (get('archived') && get('archived') !== 'false' ? 1 : 0);
  const total = data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            All projects you have access to, with status, deployments and timelines.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="data:export">
            <Button
              variant="outline"
              size="sm"
              loading={exporting === 'xlsx'}
              onClick={() => doExport('xlsx')}
            >
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={exporting === 'csv'}
              onClick={() => doExport('csv')}
              className="hidden sm:inline-flex"
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
          </Can>
          <Can permission="data:import">
            <Button variant="outline" size="sm" onClick={() => navigate('/projects/import')}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          </Can>
          <Can permission="project:create">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </Can>
        </div>
      </div>

      <Card>
        <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search name, key or description"
                className="pl-9"
                aria-label="Search projects"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={sortValue}
                onChange={(e) =>
                  setParam('sort', e.target.value === 'updatedAt:desc' ? '' : e.target.value)
                }
                aria-label="Sort"
                className="sm:w-56"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <div
                className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700"
                role="group"
                aria-label="View"
              >
                {(['table', 'cards'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => changeView(v)}
                    aria-pressed={view === v}
                    aria-label={v === 'table' ? 'Table view' : 'Card view'}
                    className={cn(
                      'flex h-8 w-9 cursor-pointer items-center justify-center rounded-md text-slate-500',
                      view === v && 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white',
                    )}
                  >
                    {v === 'table' ? (
                      <List className="h-4 w-4" />
                    ) : (
                      <LayoutGrid className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <Select
              value={get('status')}
              onChange={(e) => setParam('status', e.target.value)}
              aria-label="Status"
            >
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select
              value={get('priority')}
              onChange={(e) => setParam('priority', e.target.value)}
              aria-label="Priority"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
            <Select
              value={get('devStatus')}
              onChange={(e) => setParam('devStatus', e.target.value)}
              aria-label="Development status"
            >
              <option value="">Any dev status</option>
              {DEV_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DEV_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Select
              value={get('categoryId')}
              onChange={(e) => setParam('categoryId', e.target.value)}
              aria-label="Category"
            >
              <option value="">All categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              value={get('archived') || 'false'}
              onChange={(e) =>
                setParam('archived', e.target.value === 'false' ? '' : e.target.value)
              }
              aria-label="Archived"
            >
              <option value="false">Active projects</option>
              <option value="true">Archived only</option>
              <option value="all">Active + archived</option>
            </Select>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                checked={get('mine') === 'true'}
                onChange={(e) => setParam('mine', e.target.checked ? 'true' : '')}
                className="h-4 w-4 accent-brand-600"
              />
              My projects
            </label>
          </div>
          {activeFilters > 0 && (
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-brand-600 hover:underline"
              onClick={() => {
                setQ('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Clear filters ({activeFilters})
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{getErrorMessage(error)}</p>
        ) : !data?.data.length ? (
          <div className="flex flex-col items-center p-12 text-center">
            <FolderKanban className="h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium">No projects found</p>
            <p className="mt-1 text-sm text-slate-500">
              {activeFilters || search
                ? 'Try different filters.'
                : 'Create a project or import your spreadsheet to get started.'}
            </p>
          </div>
        ) : view === 'cards' ? (
          <div
            className={cn(
              'grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3',
              isFetching && 'opacity-60',
            )}
          >
            {data.data.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Deployment</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3">Team</th>
                  </tr>
                </thead>
                <tbody
                  className={cn(
                    'divide-y divide-slate-200 dark:divide-slate-800',
                    isFetching && 'opacity-60',
                  )}
                >
                  {data.data.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="max-w-sm px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ProjectKey value={p.key} />
                          <Link
                            to={`/projects/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate font-medium hover:text-brand-700 dark:hover:text-brand-100"
                          >
                            {p.name}
                          </Link>
                          {p.archivedAt && <Badge>Archived</Badge>}
                        </div>
                        {p.description && (
                          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            {p.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryTag category={p.category} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge value={p.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <ProjectStatusBadge value={p.status} />
                          <DevStatusLabel value={p.devStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <EnvChips environments={p.environments} />
                      </td>
                      <td className="px-4 py-3">
                        <DateRange p={p} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {p.owner && (
                            <Avatar name={p.owner.name} src={p.owner.avatarUrl} size="sm" />
                          )}
                          <span className="inline-flex items-center gap-1" title="Members">
                            <Users className="h-3.5 w-3.5" />
                            {p.memberCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* below lg the table becomes compact rows */}
            <ul
              className={cn(
                'divide-y divide-slate-200 lg:hidden dark:divide-slate-800',
                isFetching && 'opacity-60',
              )}
            >
              {data.data.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="block space-y-2 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <ProjectKey value={p.key} />
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                      <PriorityBadge value={p.priority} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ProjectStatusBadge value={p.status} />
                      <DevStatusLabel value={p.devStatus} />
                      <CategoryTag category={p.category} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <EnvChips environments={p.environments} />
                      <DateRange p={p} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {total} project{total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-slate-600 dark:text-slate-300">
              {page} / {pages}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setParam('page', String(page + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <ProjectFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
