import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarRange, CheckCircle2, Pencil, Play, Plus, Timer, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createIterationSchema,
  ITERATION_STATE_LABELS,
  type IterationDto,
  type ProjectDetail,
  type SprintDetail,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Avatar, Badge, Card, CardHeader, Spinner } from '@/components/ui/misc';
import { formatDay, PriorityBadge } from '@/features/projects/badges';
import { useWorkItems } from '@/features/workitems/api';
import { StateLabel, TypeIcon } from '@/features/workitems/meta';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useIterations, useSprint } from './api';
import { Board } from './Board';
import { Burndown } from './Burndown';

const stateTone = { PLANNED: 'slate', ACTIVE: 'blue', COMPLETED: 'green' } as const;
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function useRefreshPlanning() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['iterations'] }),
      qc.invalidateQueries({ queryKey: ['sprint'] }),
      qc.invalidateQueries({ queryKey: ['work-items'] }),
      qc.invalidateQueries({ queryKey: ['board'] }),
    ]);
}

// ---- dialogs ----------------------------------------------------------------------------

function SprintDialog(props: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  sprint?: IterationDto;
  suggested: { name: string; start: string };
}) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.sprint ? `Edit ${props.sprint.name}` : 'New sprint'}
    >
      {props.open && <SprintForm {...props} />}
    </Dialog>
  );
}

function SprintForm({
  onClose,
  projectId,
  sprint,
  suggested,
}: {
  onClose: () => void;
  projectId: string;
  sprint?: IterationDto;
  suggested: { name: string; start: string };
}) {
  const refresh = useRefreshPlanning();
  const [name, setName] = useState(sprint?.name ?? suggested.name);
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [start, setStart] = useState(sprint?.startDate ?? suggested.start);
  const [end, setEnd] = useState(sprint?.endDate ?? addDays(suggested.start, 13)); // two weeks by default
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = createIterationSchema.safeParse({ name, goal, startDate: start, endDate: end });
    if (!parsed.success)
      return setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
    setSaving(true);
    try {
      if (sprint) await api.patch(`/iterations/${sprint.id}`, parsed.data);
      else await api.post(`/projects/${projectId}/iterations`, parsed.data);
      toast.success(sprint ? 'Sprint updated' : 'Sprint created');
      await refresh();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Name" error={errors.name}>
        {(id) => (
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start" error={errors.startDate}>
          {(id) => (
            <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          )}
        </Field>
        <Field label="End" error={errors.endDate}>
          {(id) => (
            <Input id={id} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          )}
        </Field>
      </div>
      <Field label="Sprint goal">
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What should this sprint achieve?"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={save}>
          {sprint ? 'Save' : 'Create sprint'}
        </Button>
      </div>
    </div>
  );
}

function CompleteDialog({
  open,
  onClose,
  sprint,
  planned,
}: {
  open: boolean;
  onClose: () => void;
  sprint: SprintDetail;
  planned: IterationDto[];
}) {
  const refresh = useRefreshPlanning();
  const [moveTo, setMoveTo] = useState('backlog');
  const [busy, setBusy] = useState(false);
  const unfinished = sprint.stats.openItems;
  const complete = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ data: { moved: number } }>(`/iterations/${sprint.id}/complete`, {
        moveTo,
      });
      toast.success(
        `${sprint.name} completed${res.data.data.moved ? ` - ${res.data.data.moved} unfinished item(s) moved` : ''}`,
      );
      await refresh();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Complete ${sprint.name}`}
      description={
        unfinished ? `${unfinished} item(s) are not finished.` : 'Everything is finished. Nice!'
      }
    >
      {unfinished > 0 && (
        <Field label="Move unfinished items to">
          {(id) => (
            <Select id={id} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="backlog">Backlog</option>
              {planned.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatDay(p.startDate)})
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={complete}>
          <CheckCircle2 className="h-4 w-4" /> Complete sprint
        </Button>
      </div>
    </Dialog>
  );
}

// ---- sprint panels ----------------------------------------------------------------------

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SprintItems({ project, sprint }: { project: ProjectDetail; sprint: SprintDetail }) {
  const refresh = useRefreshPlanning();
  const inSprint = useWorkItems({
    projectId: project.id,
    iteration: sprint.id,
    status: 'all',
    sort: 'priority',
    order: 'asc',
    pageSize: '200',
  });
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const backlog = useWorkItems(
    {
      projectId: project.id,
      iteration: 'none',
      status: 'open',
      type: 'STORY,BUG,TASK',
      q: q || undefined,
      sort: 'priority',
      order: 'asc',
      pageSize: '50',
    },
    picking,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const canPlan = project.workItemAccess.canCreate && sprint.state !== 'COMPLETED';

  const move = async (ids: string[], iterationId: string | null) => {
    setBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) => api.patch(`/work-items/${id}`, { iterationId })),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length)
      toast.error(
        `${failed.length} item(s) could not be moved: ${getErrorMessage((failed[0] as PromiseRejectedResult).reason)}`,
      );
    else
      toast.success(
        iterationId ? `${ids.length} item(s) added to ${sprint.name}` : 'Moved to backlog',
      );
    setSelected(new Set());
    await refresh();
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader
        title="Sprint backlog"
        description={`${sprint.stats.items} items · ${sprint.stats.completedPoints}/${sprint.stats.totalPoints} points done`}
        action={
          canPlan && (
            <Button
              size="sm"
              variant={picking ? 'secondary' : 'outline'}
              onClick={() => setPicking((p) => !p)}
            >
              {picking ? (
                'Close backlog'
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add from backlog
                </>
              )}
            </Button>
          )
        }
      />
      {picking && (
        <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
          <div className="mb-2 flex flex-wrap gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the backlog"
              className="h-9 max-w-xs"
              aria-label="Search backlog"
            />
            <Button
              size="sm"
              disabled={!selected.size}
              loading={busy}
              onClick={() => move([...selected], sprint.id)}
            >
              Add {selected.size || ''} to sprint
            </Button>
          </div>
          {backlog.isLoading ? (
            <Spinner />
          ) : !backlog.data?.data.length ? (
            <p className="text-sm text-slate-500">No open items outside a sprint.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {backlog.data.data.map((w) => (
                <li key={w.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={selected.has(w.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(w.id);
                          else n.delete(w.id);
                          return n;
                        })
                      }
                    />
                    <TypeIcon type={w.type} />
                    <span className="font-mono text-xs text-slate-500">{w.key}</span>
                    <span className="min-w-0 flex-1 truncate">{w.title}</span>
                    {w.storyPoints !== null && (
                      <span className="text-xs text-slate-500">{w.storyPoints} pts</span>
                    )}
                    {w.remainingWork !== null && (
                      <span className="text-xs text-slate-500">{w.remainingWork}h</span>
                    )}
                    <PriorityBadge value={w.priority} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {inSprint.isLoading ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : !inSprint.data?.data.length ? (
        <p className="p-8 text-center text-sm text-slate-500">
          No items planned yet.{canPlan ? ' Use "Add from backlog".' : ''}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {inSprint.data.data.map((w) => (
            <li key={w.id} className="flex items-center gap-2 px-5 py-2 text-sm">
              <TypeIcon type={w.type} />
              <Link to={`/items/${w.key}`} className="min-w-0 flex-1 truncate hover:text-brand-700">
                <span className="font-mono text-xs text-slate-500">{w.key}</span> {w.title}
              </Link>
              <span className="hidden w-16 text-right text-xs text-slate-500 sm:block">
                {w.type === 'TASK'
                  ? w.remainingWork !== null
                    ? `${w.remainingWork}h`
                    : ''
                  : w.storyPoints !== null
                    ? `${w.storyPoints} pts`
                    : ''}
              </span>
              <span className="hidden w-28 md:block">
                <StateLabel state={w.state} />
              </span>
              <span className="w-7">
                {w.assignee && (
                  <Avatar name={w.assignee.name} src={w.assignee.avatarUrl} size="sm" />
                )}
              </span>
              {canPlan && (
                <button
                  type="button"
                  onClick={() => move([w.id], null)}
                  disabled={busy}
                  className="cursor-pointer rounded p-1 text-slate-400 hover:text-red-600"
                  aria-label={`Move ${w.key} back to the backlog`}
                  title="Back to backlog"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CapacityPanel({ sprint }: { sprint: SprintDetail }) {
  const refresh = useRefreshPlanning();
  const [rows, setRows] = useState(
    sprint.capacity.map((c) => ({
      userId: c.user.id,
      hoursPerDay: String(c.hoursPerDay),
      daysOff: String(c.daysOff),
    })),
  );
  const [saving, setSaving] = useState(false);
  const editable = sprint.canManage && sprint.state !== 'COMPLETED';
  const totalCap = sprint.capacity.reduce((s, c) => s + c.capacityHours, 0);
  const totalAssigned =
    sprint.capacity.reduce((s, c) => s + c.assignedHours, 0) + sprint.unassignedHours;

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/iterations/${sprint.id}/capacity`, {
        entries: rows.map((r) => ({
          userId: r.userId,
          hoursPerDay: Number(r.hoursPerDay) || 0,
          daysOff: Math.round(Number(r.daysOff) || 0),
        })),
      });
      toast.success('Capacity saved');
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Capacity"
        description={`${sprint.workingDays} working days · ${totalAssigned}h of work for ${Math.round(totalCap * 10) / 10}h capacity`}
        action={
          editable && (
            <Button size="sm" loading={saving} onClick={save}>
              Save capacity
            </Button>
          )
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Hours / day</th>
              <th className="px-4 py-2">Days off</th>
              <th className="px-4 py-2">Capacity</th>
              <th className="min-w-48 px-4 py-2">Assigned work</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sprint.capacity.map((c, i) => {
              const pct = c.capacityHours
                ? Math.min(100, (c.assignedHours / c.capacityHours) * 100)
                : c.assignedHours
                  ? 100
                  : 0;
              const over = c.assignedHours > c.capacityHours;
              return (
                <tr key={c.user.id}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={c.user.name} src={c.user.avatarUrl} size="sm" />
                      {c.user.name}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        value={rows[i]?.hoursPerDay ?? ''}
                        onChange={(e) =>
                          setRows((r) =>
                            r.map((x, j) => (j === i ? { ...x, hoursPerDay: e.target.value } : x)),
                          )
                        }
                        className="h-8 w-20"
                        aria-label={`Hours per day for ${c.user.name}`}
                      />
                    ) : (
                      c.hoursPerDay
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editable ? (
                      <Input
                        type="number"
                        min={0}
                        max={sprint.workingDays}
                        value={rows[i]?.daysOff ?? ''}
                        onChange={(e) =>
                          setRows((r) =>
                            r.map((x, j) => (j === i ? { ...x, daysOff: e.target.value } : x)),
                          )
                        }
                        className="h-8 w-20"
                        aria-label={`Days off for ${c.user.name}`}
                      />
                    ) : (
                      c.daysOff
                    )}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{c.capacityHours}h</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                        role="meter"
                        aria-valuenow={c.assignedHours}
                        aria-valuemax={c.capacityHours}
                        aria-label={`${c.user.name} load`}
                      >
                        <div
                          className={cn(
                            'h-full rounded-full',
                            over ? 'bg-red-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          'w-20 text-right text-xs tabular-nums',
                          over ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500',
                        )}
                      >
                        {c.assignedHours}h{over ? ' · over' : ''}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sprint.unassignedHours > 0 && (
        <p className="px-5 py-3 text-xs text-amber-700 dark:text-amber-400">
          {sprint.unassignedHours}h of remaining work is not assigned to anyone.
        </p>
      )}
      <p className="px-5 pb-4 text-xs text-slate-400">
        Assigned work = remaining hours of unfinished tasks and bugs in this sprint.
      </p>
    </Card>
  );
}

function SprintView({
  project,
  sprintId,
  all,
}: {
  project: ProjectDetail;
  sprintId: string;
  all: IterationDto[];
}) {
  const { data: sprint, isLoading } = useSprint(sprintId);
  const refresh = useRefreshPlanning();
  const [view, setView] = useState<'overview' | 'taskboard' | 'capacity'>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading || !sprint)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  const hasActive = all.some((s) => s.state === 'ACTIVE');
  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = Math.max(
    0,
    Math.ceil((Date.parse(sprint.endDate) - Date.parse(today)) / 86_400_000) + 1,
  );
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{sprint.name}</h2>
              <Badge tone={stateTone[sprint.state]}>{ITERATION_STATE_LABELS[sprint.state]}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <CalendarRange className="h-4 w-4" />
              {formatDay(sprint.startDate)} – {formatDay(sprint.endDate)} · {sprint.workingDays}{' '}
              working days
            </p>
            {sprint.goal && (
              <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Goal:</span> {sprint.goal}
              </p>
            )}
          </div>
          {sprint.canManage && (
            <div className="flex flex-wrap gap-2">
              {sprint.state !== 'COMPLETED' && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              {sprint.state === 'PLANNED' && (
                <Button
                  size="sm"
                  disabled={hasActive}
                  title={hasActive ? 'Complete the active sprint first' : undefined}
                  loading={busy}
                  onClick={() =>
                    run(() => api.post(`/iterations/${sprint.id}/start`), `${sprint.name} started`)
                  }
                >
                  <Play className="h-4 w-4" /> Start sprint
                </Button>
              )}
              {sprint.state === 'ACTIVE' && (
                <Button size="sm" onClick={() => setCompleteOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Complete sprint
                </Button>
              )}
              {sprint.state !== 'ACTIVE' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  loading={busy}
                  onClick={() =>
                    confirm(`Delete ${sprint.name}? Its items go back to the backlog.`) &&
                    run(() => api.delete(`/iterations/${sprint.id}`), 'Sprint deleted')
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Story points done"
            value={`${sprint.stats.completedPoints} / ${sprint.stats.totalPoints}`}
          />
          <Stat label="Remaining work" value={`${sprint.stats.remainingWork}h`} />
          <Stat
            label="Open items"
            value={sprint.stats.openItems}
            sub={`of ${sprint.stats.items}`}
          />
          <Stat
            label={sprint.state === 'COMPLETED' ? 'Finished' : 'Days left'}
            value={sprint.state === 'COMPLETED' ? '✓' : daysLeft}
            sub={sprint.state === 'PLANNED' ? 'not started' : undefined}
          />
        </div>
      </Card>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex gap-6" aria-label="Sprint views">
          {(['overview', 'taskboard', 'capacity'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-current={view === v ? 'page' : undefined}
              className={cn(
                'cursor-pointer border-b-2 pb-2 text-sm font-medium capitalize',
                view === v
                  ? 'border-brand-600 text-brand-700 dark:text-brand-100'
                  : 'border-transparent text-slate-500',
              )}
            >
              {v}
            </button>
          ))}
        </nav>
      </div>

      {view === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="p-5 xl:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Burndown</h3>
            {sprint.state === 'PLANNED' ? (
              <p className="text-sm text-slate-500">The burndown starts when the sprint starts.</p>
            ) : (
              <Burndown points={sprint.burndown} unit={sprint.burndownUnit} />
            )}
          </Card>
          <div className="xl:col-span-3">
            <SprintItems project={project} sprint={sprint} />
          </div>
        </div>
      )}
      {view === 'taskboard' && (
        <Board
          project={project}
          fixed={{ level: 'tasks', iteration: sprint.id, swimlane: 'parent' }}
        />
      )}
      {view === 'capacity' && (
        // re-key so the form resets whenever the saved capacity changes
        <CapacityPanel
          key={sprint.capacity.map((c) => `${c.user.id}:${c.hoursPerDay}:${c.daysOff}`).join('|')}
          sprint={sprint}
        />
      )}

      <SprintDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        projectId={project.id}
        sprint={sprint}
        suggested={{ name: sprint.name, start: sprint.startDate }}
      />
      <CompleteDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        sprint={sprint}
        planned={all.filter((s) => s.state === 'PLANNED')}
      />
    </div>
  );
}

export function SprintsTab({ project }: { project: ProjectDetail }) {
  const { data, isLoading } = useIterations(project.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const canManage = project.access.canManage && !project.archivedAt;
  const sprints = data ?? [];
  const current =
    selected && sprints.some((s) => s.id === selected)
      ? selected
      : (
          sprints.find((s) => s.state === 'ACTIVE') ??
          sprints.find((s) => s.state === 'PLANNED') ??
          sprints[0]
        )?.id;
  const last = [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const today = new Date().toISOString().slice(0, 10);
  const suggested = {
    name: `Sprint ${sprints.length + 1}`,
    start: last && last.endDate >= today ? addDays(last.endDate, 1) : today,
  };

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Card className="h-fit">
        <CardHeader
          title="Sprints"
          action={
            canManage && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New
              </Button>
            )
          }
        />
        {!sprints.length ? (
          <div className="flex flex-col items-center p-6 text-center">
            <Timer className="h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              {canManage ? 'Plan your first sprint.' : 'No sprints yet.'}
            </p>
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto p-2">
            {sprints.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  aria-current={s.id === current ? 'true' : undefined}
                  className={cn(
                    'w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm',
                    s.id === current
                      ? 'bg-brand-50 dark:bg-brand-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    <Badge tone={stateTone[s.state]}>{ITERATION_STATE_LABELS[s.state]}</Badge>
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDay(s.startDate)} – {formatDay(s.endDate)} · {s.stats.items} items
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="min-w-0">
        {current ? (
          <SprintView project={project} sprintId={current} all={sprints} />
        ) : (
          <Alert tone="info" title="Sprints">
            Sprints are time-boxed plans (usually 2 weeks). Create one, add stories, bugs and tasks
            from the backlog, set team capacity, then start it to track the burndown.
          </Alert>
        )}
      </div>
      <SprintDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={project.id}
        suggested={suggested}
      />
    </div>
  );
}
