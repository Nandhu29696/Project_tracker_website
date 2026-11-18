import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  WORK_ITEM_TYPE_LABELS,
  WORK_ITEM_TYPES,
  type WorkItemFilterParams,
  type WorkItemType,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Card, Spinner } from '@/components/ui/misc';
import { useProjects } from '@/features/projects/api';
import { useSavedQueries, useWorkItems } from '@/features/workitems/api';
import { CreateWorkItemDialog } from '@/features/workitems/CreateWorkItemDialog';
import { WorkItemTable } from '@/features/workitems/WorkItemTable';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
const FILTER_KEYS = [
  'projectId',
  'type',
  'status',
  'priority',
  'severity',
  'assignee',
  'tag',
  'q',
  'sort',
  'order',
] as const;
const SORTS = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'priority:asc', label: 'Priority' },
  { value: 'severity:asc', label: 'Severity' },
  { value: 'dueDate:asc', label: 'Due date' },
  { value: 'state:asc', label: 'State' },
];

interface Props {
  title: string;
  description: string;
  /** Filters that are always applied and hidden from the UI (e.g. type=BUG). */
  preset?: WorkItemFilterParams;
  newType?: WorkItemType;
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function WorkItemQueryPage({ title, description, preset = {}, newType }: Props) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const search = useDebounced(q);
  const [createOpen, setCreateOpen] = useState(false);
  const projects = useProjects({ pageSize: 100, sort: 'name', order: 'asc', archived: 'all' });
  const saved = useSavedQueries();

  const get = (k: string) => params.get(k) ?? '';
  const sortValue = get('sort') ? `${get('sort')}:${get('order') || 'desc'}` : 'updatedAt:desc';
  const page = Number(get('page')) || 1;
  const filters: WorkItemFilterParams = {
    ...Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k) || undefined])),
    status: get('status') || 'open',
    q: search || undefined,
    ...preset,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  };
  const { data, isLoading, isFetching, error } = useWorkItems(filters);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const currentFilters = () =>
    Object.fromEntries(
      FILTER_KEYS.map((k) => [k, k === 'q' ? search : get(k)]).filter(([, v]) => v),
    ) as Record<string, string>;

  /** Puts a saved query's filters into the URL (preset keys are already fixed by this page). */
  const applySaved = (f: Record<string, string>) => {
    setQ(f.q ?? '');
    const entries = Object.entries(f).filter(([k, v]) => v && !(k in preset));
    setParams(new URLSearchParams(entries), { replace: true });
  };

  const saveCurrent = async () => {
    const name = prompt('Name this query (e.g. "My open bugs")')?.trim();
    if (!name) return;
    try {
      await api.post('/saved-queries', {
        name,
        filters: { status: 'open', ...currentFilters(), ...preset },
      });
      toast.success(`Saved "${name}"`);
      await qc.invalidateQueries({ queryKey: ['saved-queries'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const removeSaved = async (id: string, name: string) => {
    if (!confirm(`Delete saved query "${name}"?`)) return;
    try {
      await api.delete(`/saved-queries/${id}`);
      await qc.invalidateQueries({ queryKey: ['saved-queries'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const total = data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showSeverity = preset.type === 'BUG';
  const relevantSaved = (saved.data ?? []).filter(
    (s) => !preset.type || s.filters.type === preset.type,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={saveCurrent}>
            <BookmarkPlus className="h-4 w-4" /> Save query
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New{' '}
            {newType ? WORK_ITEM_TYPE_LABELS[newType].toLowerCase() : 'item'}
          </Button>
        </div>
      </div>

      {relevantSaved.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Bookmark className="h-4 w-4 text-slate-400" aria-hidden />
          {relevantSaved.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center rounded-full border border-slate-300 bg-white text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => applySaved(s.filters)}
                className="cursor-pointer py-1 pr-1 pl-3 font-medium hover:text-brand-700"
              >
                {s.name}
              </button>
              <button
                type="button"
                onClick={() => removeSaved(s.id, s.name)}
                aria-label={`Delete ${s.name}`}
                className="cursor-pointer rounded-full p-1 text-slate-400 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Card>
        <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setParam('page', '');
                }}
                placeholder="Search title, description or key (e.g. BCM-12)"
                className="pl-9"
                aria-label="Search work items"
              />
            </div>
            <Select
              value={sortValue}
              onChange={(e) => {
                const [s, o] = e.target.value.split(':');
                const next = new URLSearchParams(params);
                next.set('sort', s!);
                next.set('order', o!);
                setParams(next, { replace: true });
              }}
              aria-label="Sort"
              className="sm:w-48"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <Select
              value={get('projectId')}
              onChange={(e) => setParam('projectId', e.target.value)}
              aria-label="Project"
            >
              <option value="">All projects</option>
              {(projects.data?.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </Select>
            {!preset.type && (
              <Select
                value={get('type')}
                onChange={(e) => setParam('type', e.target.value)}
                aria-label="Type"
              >
                <option value="">All types</option>
                {WORK_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORK_ITEM_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            )}
            <Select
              value={get('status') || 'open'}
              onChange={(e) => setParam('status', e.target.value === 'open' ? '' : e.target.value)}
              aria-label="Status"
            >
              <option value="open">Open</option>
              <option value="done">Resolved / done</option>
              <option value="all">All (except removed)</option>
              <option value="removed">Removed</option>
            </Select>
            <Select
              value={get('assignee')}
              onChange={(e) => setParam('assignee', e.target.value)}
              aria-label="Assigned to"
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
            </Select>
            {showSeverity ? (
              <Select
                value={get('severity')}
                onChange={(e) => setParam('severity', e.target.value)}
                aria-label="Severity"
              >
                <option value="">Any severity</option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={get('priority')}
                onChange={(e) => setParam('priority', e.target.value)}
                aria-label="Priority"
              >
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            )}
            <Input
              value={get('tag')}
              onChange={(e) => setParam('tag', e.target.value.toLowerCase())}
              placeholder="Tag"
              aria-label="Tag"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{getErrorMessage(error)}</p>
        ) : !data?.data.length ? (
          <div className="flex flex-col items-center p-12 text-center">
            <ListChecks className="h-10 w-10 text-slate-300" />
            <p className="mt-3 font-medium">No work items match</p>
            <p className="mt-1 text-sm text-slate-500">Change the filters or create a new item.</p>
          </div>
        ) : (
          <WorkItemTable items={data.data} showSeverity={showSeverity} dim={isFetching} />
        )}

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {total} item{total === 1 ? '' : 's'}
          </span>
          <div className={cn('flex items-center gap-2', pages <= 1 && 'invisible')}>
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

      <CreateWorkItemDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={get('projectId') || undefined}
        defaultType={newType}
      />
    </div>
  );
}

export const WorkItemsPage = () => (
  <WorkItemQueryPage
    title="Work items"
    description="Epics, features, stories, tasks and bugs across your projects."
  />
);

export const BugsPage = () => (
  <WorkItemQueryPage
    title="Bugs"
    description="Track defects by severity, state and owner."
    preset={{ type: 'BUG' }}
    newType="BUG"
  />
);
