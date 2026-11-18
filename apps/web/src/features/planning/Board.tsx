import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BOARD_COLUMN_LABELS,
  BOARD_COLUMNS,
  BOARD_LEVEL_LABELS,
  BOARD_LEVELS,
  canTransition,
  columnTargetState,
  PRIORITIES,
  PRIORITY_LABELS,
  STATE_CATEGORY,
  WORK_ITEM_STATE_LABELS,
  WORK_ITEM_TYPE_LABELS,
  type BoardColumn,
  type BoardData,
  type BoardLevel,
  type ProjectDetail,
  type UpdateWorkItemBody,
  type WorkItemSummary,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Avatar, Card, Spinner } from '@/components/ui/misc';
import { CreateWorkItemDialog } from '@/features/workitems/CreateWorkItemDialog';
import { PriorityBadge } from '@/features/projects/badges';
import { TypeIcon, TYPE_META } from '@/features/workitems/meta';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { boardKey, useBoard, useIterations, type BoardFilters } from './api';

type Swimlane = 'none' | 'assignee' | 'priority' | 'parent';
const SWIMLANE_LABELS: Record<Swimlane, string> = {
  none: 'No swimlanes',
  assignee: 'By assignee',
  priority: 'By priority',
  parent: 'By parent',
};

interface Lane {
  key: string;
  title: string;
}

const colOf = (w: WorkItemSummary) => STATE_CATEGORY[w.state] as BoardColumn;

// ---- card -------------------------------------------------------------------------------

function CardBody({ item, dragging }: { item: WorkItemSummary; dragging?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-2.5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900',
        dragging && 'rotate-1 shadow-lg ring-2 ring-brand-500',
      )}
    >
      <div
        className={cn('-mt-2.5 -mx-2.5 mb-2 h-1 rounded-t-lg', TYPE_META[item.type].bar)}
        aria-hidden
      />
      <div className="flex items-start gap-1.5">
        <TypeIcon type={item.type} className="mt-0.5" />
        <Link
          to={`/items/${item.key}`}
          className="line-clamp-3 min-w-0 flex-1 font-medium hover:text-brand-700 dark:hover:text-brand-100"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {item.title}
        </Link>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="font-mono">{item.key}</span>
        <span className="flex items-center gap-1.5">
          {item.type === 'TASK'
            ? item.remainingWork !== null && (
                <span title="Remaining hours">{item.remainingWork}h</span>
              )
            : item.storyPoints !== null && (
                <span
                  title="Story points"
                  className="rounded bg-slate-100 px-1.5 dark:bg-slate-800"
                >
                  {item.storyPoints}
                </span>
              )}
          {item.priority !== 'MEDIUM' && <PriorityBadge value={item.priority} />}
          {item.assignee ? (
            <Avatar name={item.assignee.name} src={item.assignee.avatarUrl} size="sm" />
          ) : (
            <span
              className="h-7 w-7 rounded-full border border-dashed border-slate-300 dark:border-slate-600"
              title="Unassigned"
            />
          )}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{WORK_ITEM_STATE_LABELS[item.state]}</p>
    </div>
  );
}

function BoardCard({
  item,
  lane,
  column,
  disabled,
}: {
  item: WorkItemSummary;
  lane: string;
  column: BoardColumn;
  disabled: boolean;
}) {
  const drag = useDraggable({ id: item.id, data: { item }, disabled });
  const drop = useDroppable({ id: `card:${item.id}`, data: { lane, column, before: item } });
  return (
    <li
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      style={{ transform: CSS.Translate.toString(drag.transform) }}
      className={cn(
        'relative list-none',
        drag.isDragging && 'opacity-30',
        !disabled && 'cursor-grab active:cursor-grabbing',
        drop.isOver &&
          'before:absolute before:-top-1.5 before:inset-x-0 before:h-0.5 before:rounded before:bg-brand-500',
      )}
      {...drag.attributes}
      {...drag.listeners}
      aria-roledescription="Draggable work item"
      aria-label={`${item.key} ${item.title}, ${WORK_ITEM_STATE_LABELS[item.state]}`}
    >
      <CardBody item={item} />
    </li>
  );
}

function Cell({
  lane,
  column,
  items,
  canDrop,
  children,
}: {
  lane: string;
  column: BoardColumn;
  items: WorkItemSummary[];
  canDrop: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${lane}::${column}`,
    data: { lane, column, items },
  });
  return (
    <ul
      ref={setNodeRef}
      className={cn(
        'min-h-16 space-y-2 rounded-lg p-1.5 transition-colors',
        isOver && (canDrop ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-red-50 dark:bg-red-500/10'),
      )}
    >
      {children}
    </ul>
  );
}

// ---- WIP limits dialog ------------------------------------------------------------------

function WipDialog({
  open,
  onClose,
  projectId,
  data,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  data: BoardData;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const current = (c: BoardColumn) =>
    values[c] ?? (data.wipLimits[c] ? String(data.wipLimits[c]) : '');

  const save = async () => {
    setSaving(true);
    try {
      const wipLimits = Object.fromEntries(
        BOARD_COLUMNS.map((c) => [c, current(c) ? Number(current(c)) : null]),
      );
      await api.put(`/projects/${projectId}/board-settings`, { wipLimits });
      await qc.invalidateQueries({ queryKey: ['board', projectId] });
      toast.success('WIP limits saved');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Work-in-progress limits"
      description="Soft limits: the column turns red when it holds more items. Leave empty for no limit."
    >
      <div className="grid grid-cols-2 gap-4">
        {BOARD_COLUMNS.map((c) => (
          <Field key={c} label={BOARD_COLUMN_LABELS[c]}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={999}
                value={current(c)}
                onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))}
                placeholder="No limit"
              />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={save}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}

// ---- board ------------------------------------------------------------------------------

interface BoardProps {
  project: ProjectDetail;
  /** taskboard mode: fixed level + sprint, lanes by parent */
  fixed?: { level: BoardLevel; iteration: string; swimlane?: Swimlane };
}

export function Board({ project, fixed }: BoardProps) {
  const qc = useQueryClient();
  const sprints = useIterations(project.id);
  const activeSprint = sprints.data?.find((s) => s.state === 'ACTIVE');
  const [level, setLevel] = useState<BoardLevel>(fixed?.level ?? 'requirements');
  const [iteration, setIteration] = useState<string | undefined>(undefined); // undefined = active sprint if any
  const [swimlane, setSwimlane] = useState<Swimlane>(fixed?.swimlane ?? 'none');
  const [assignee, setAssignee] = useState('');
  const [wipOpen, setWipOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragging, setDragging] = useState<WorkItemSummary | null>(null);

  const effectiveIteration =
    fixed?.iteration ?? (iteration === undefined ? (activeSprint?.id ?? '') : iteration);
  const filters: BoardFilters = {
    level: fixed?.level ?? level,
    iteration: effectiveIteration || undefined,
    assignee: assignee || undefined,
  };
  const { data, isLoading } = useBoard(project.id, filters);
  // parent titles for "by parent" lanes come from the requirement-level board of the same scope
  const parents = useBoard(project.id, { ...filters, level: 'requirements', assignee: undefined });

  const columns = BOARD_COLUMNS.filter((c) => filters.level !== 'tasks' || c !== 'resolved');
  const items = useMemo(() => data?.items ?? [], [data]);

  const lanes: Lane[] = useMemo(() => {
    if (swimlane === 'none') return [{ key: 'all', title: '' }];
    if (swimlane === 'priority')
      return PRIORITIES.map((p) => ({ key: p, title: PRIORITY_LABELS[p] }));
    if (swimlane === 'assignee') {
      const seen = new Map<string, string>();
      for (const m of project.members) if (m.role !== 'VIEWER') seen.set(m.user.id, m.user.name);
      for (const i of items) if (i.assignee) seen.set(i.assignee.id, i.assignee.name);
      return [
        ...[...seen].map(([key, title]) => ({ key, title })),
        { key: 'unassigned', title: 'Unassigned' },
      ];
    }
    const titles = new Map((parents.data?.items ?? []).map((p) => [p.id, `${p.key} · ${p.title}`]));
    const keys = [...new Set(items.map((i) => i.parentId ?? 'none'))];
    return keys
      .map((k) => ({
        key: k,
        title: k === 'none' ? 'No parent' : (titles.get(k) ?? 'Parent outside this view'),
      }))
      .sort((a, b) =>
        a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.title.localeCompare(b.title),
      );
  }, [swimlane, items, project.members, parents.data]);

  const laneOf = (w: WorkItemSummary) =>
    swimlane === 'none'
      ? 'all'
      : swimlane === 'priority'
        ? w.priority
        : swimlane === 'assignee'
          ? (w.assignee?.id ?? 'unassigned')
          : (w.parentId ?? 'none');

  const cellItems = (lane: string, column: BoardColumn) =>
    items
      .filter((i) => laneOf(i) === lane && colOf(i) === column)
      .sort((a, b) => a.rank - b.rank || a.number - b.number);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const canEdit = !!data?.canEdit;

  /** Can this item enter that column? (null = yes, otherwise the reason) */
  const blockReason = (item: WorkItemSummary, column: BoardColumn) => {
    if (colOf(item) === column) return null;
    const target = columnTargetState(item.type, column);
    if (!target)
      return `${WORK_ITEM_TYPE_LABELS[item.type]}s have no ${BOARD_COLUMN_LABELS[column]} state`;
    if (!canTransition(item.type, item.state, target)) {
      return `A ${WORK_ITEM_TYPE_LABELS[item.type]} cannot go from ${WORK_ITEM_STATE_LABELS[item.state]} to ${WORK_ITEM_STATE_LABELS[target]}`;
    }
    return null;
  };

  const onDragStart = (e: DragStartEvent) =>
    setDragging((e.active.data.current?.item as WorkItemSummary) ?? null);

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const item = e.active.data.current?.item as WorkItemSummary | undefined;
    const over = e.over?.data.current as
      { lane: string; column: BoardColumn; before?: WorkItemSummary } | undefined;
    if (!item || !over || over.before?.id === item.id) return;

    const reason = blockReason(item, over.column);
    if (reason) return toast.error(reason);

    const patch: UpdateWorkItemBody = {};
    if (colOf(item) !== over.column) patch.state = columnTargetState(item.type, over.column)!;
    if (over.lane !== laneOf(item)) {
      if (swimlane === 'assignee') patch.assigneeId = over.lane === 'unassigned' ? null : over.lane;
      else if (swimlane === 'priority') patch.priority = over.lane as WorkItemSummary['priority'];
      else if (swimlane === 'parent') return toast.error('Change the parent on the work item page');
    }
    // rank: before the card it was dropped on, else at the end of the cell
    const target = cellItems(over.lane, over.column).filter((i) => i.id !== item.id);
    if (over.before) {
      const idx = target.findIndex((i) => i.id === over.before!.id);
      const prev = target[idx - 1];
      patch.rank = prev ? (prev.rank + over.before.rank) / 2 : over.before.rank - 1;
    } else {
      patch.rank = (target.at(-1)?.rank ?? 0) + 1;
    }

    const limit = data?.wipLimits[over.column];
    if (patch.state && limit && items.filter((i) => colOf(i) === over.column).length >= limit) {
      toast.warning(`${BOARD_COLUMN_LABELS[over.column]} is over its WIP limit of ${limit}`);
    }

    // optimistic update
    const key = boardKey(project.id, filters);
    const prev = qc.getQueryData<BoardData>(key);
    qc.setQueryData<BoardData>(
      key,
      (d) =>
        d && {
          ...d,
          items: d.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  state: patch.state ?? i.state,
                  rank: patch.rank ?? i.rank,
                  priority: patch.priority ?? i.priority,
                  assignee:
                    patch.assigneeId === undefined
                      ? i.assignee
                      : patch.assigneeId === null
                        ? null
                        : (project.members.find((m) => m.user.id === patch.assigneeId)?.user ??
                          i.assignee),
                }
              : i,
          ),
        },
    );
    try {
      await api.patch(`/work-items/${item.id}`, patch);
      void qc.invalidateQueries({ queryKey: ['work-items'] });
      void qc.invalidateQueries({ queryKey: ['sprint'] });
    } catch (err) {
      qc.setQueryData(key, prev);
      toast.error(getErrorMessage(err));
    } finally {
      void qc.invalidateQueries({ queryKey: ['board', project.id] });
    }
  };

  const openSprints = (sprints.data ?? []).filter((s) => s.state !== 'COMPLETED');

  return (
    <Card>
      {!fixed && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          <Select
            value={level}
            onChange={(e) => setLevel(e.target.value as BoardLevel)}
            aria-label="Board level"
            className="h-9 w-40"
          >
            {BOARD_LEVELS.map((l) => (
              <option key={l} value={l}>
                {BOARD_LEVEL_LABELS[l]}
              </option>
            ))}
          </Select>
          <Select
            value={effectiveIteration}
            onChange={(e) => setIteration(e.target.value)}
            aria-label="Sprint"
            className="h-9 w-48"
          >
            <option value="">All sprints &amp; backlog</option>
            <option value="none">Backlog (no sprint)</option>
            {openSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.state === 'ACTIVE' ? ' (active)' : ''}
              </option>
            ))}
          </Select>
          <Select
            value={swimlane}
            onChange={(e) => setSwimlane(e.target.value as Swimlane)}
            aria-label="Swimlanes"
            className="h-9 w-40"
          >
            {(Object.keys(SWIMLANE_LABELS) as Swimlane[]).map((s) => (
              <option key={s} value={s}>
                {SWIMLANE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="Assigned to"
            className="h-9 w-36"
          >
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="none">Unassigned</option>
          </Select>
          <div className="ml-auto flex gap-2">
            {data?.canManage && (
              <Button size="sm" variant="outline" onClick={() => setWipOpen(true)}>
                <Settings2 className="h-4 w-4" /> WIP limits
              </Button>
            )}
            {project.workItemAccess.canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <div className="overflow-x-auto p-3">
            <div
              className="grid min-w-fit gap-3"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }}
            >
              {columns.map((c) => {
                const count = items.filter((i) => colOf(i) === c).length;
                const limit = data?.wipLimits[c];
                const over = !!limit && count > limit;
                return (
                  <div
                    key={c}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold',
                      over
                        ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                        : 'bg-slate-100 dark:bg-slate-800',
                    )}
                  >
                    <span>{BOARD_COLUMN_LABELS[c]}</span>
                    <span
                      className="text-xs font-medium tabular-nums"
                      title={limit ? `WIP limit ${limit}` : undefined}
                    >
                      {count}
                      {limit ? ` / ${limit}` : ''}
                    </span>
                  </div>
                );
              })}
              {lanes.map((lane) => (
                <LaneRow
                  key={lane.key}
                  lane={lane}
                  show={swimlane !== 'none'}
                  columns={columns}
                  count={items.filter((i) => laneOf(i) === lane.key).length}
                >
                  {columns.map((c) => {
                    const cell = cellItems(lane.key, c);
                    return (
                      <Cell
                        key={c}
                        lane={lane.key}
                        column={c}
                        items={cell}
                        canDrop={!dragging || !blockReason(dragging, c)}
                      >
                        {cell.map((i) => (
                          <BoardCard
                            key={i.id}
                            item={i}
                            lane={lane.key}
                            column={c}
                            disabled={!canEdit}
                          />
                        ))}
                      </Cell>
                    );
                  })}
                </LaneRow>
              ))}
            </div>
            {!items.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No {BOARD_LEVEL_LABELS[filters.level].toLowerCase()} here yet.
              </p>
            )}
            {data?.truncated && (
              <p className="p-2 text-center text-xs text-amber-600">
                Showing the first 1000 items.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Done shows items closed in the last 30 days.
              {canEdit ? ' Drag cards to change state, assignee or priority.' : ''}
            </p>
          </div>
          <DragOverlay>
            {dragging && (
              <div className="w-60">
                <CardBody item={dragging} dragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {data && (
        <WipDialog
          open={wipOpen}
          onClose={() => setWipOpen(false)}
          projectId={project.id}
          data={data}
        />
      )}
      <CreateWorkItemDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={project.id}
        iterationId={
          effectiveIteration && effectiveIteration !== 'none' ? effectiveIteration : undefined
        }
        defaultType={filters.level === 'tasks' ? 'TASK' : 'STORY'}
        stay
      />
    </Card>
  );
}

function LaneRow({
  lane,
  show,
  columns,
  count,
  children,
}: {
  lane: Lane;
  show: boolean;
  columns: BoardColumn[];
  count: number;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (!show) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mt-2 flex cursor-pointer items-center gap-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200"
        style={{ gridColumn: `1 / span ${columns.length}` }}
        aria-expanded={!collapsed}
      >
        <span className="text-slate-400">{collapsed ? '▸' : '▾'}</span>
        <span className="truncate">{lane.title}</span>
        <span className="text-xs font-normal text-slate-400">{count}</span>
      </button>
      {!collapsed && children}
    </>
  );
}
