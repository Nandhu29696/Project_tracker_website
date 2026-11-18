import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ListTree,
  Plus,
} from 'lucide-react';
import {
  STATE_CATEGORY,
  WORK_ITEM_TYPES,
  type ProjectDetail,
  type WorkItemSummary,
  type WorkItemType,
} from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Avatar, Card, Spinner } from '@/components/ui/misc';
import { PriorityBadge } from '@/features/projects/badges';
import { cn } from '@/lib/utils';
import { useBacklog } from './api';
import { CreateWorkItemDialog } from './CreateWorkItemDialog';
import { DEFAULT_CHILD_TYPE, StateLabel, TypeIcon } from './meta';

interface Node {
  item: WorkItemSummary;
  children: Node[];
  /** sum of story points in the subtree (stories/bugs) */
  points: number;
  /** done / total leaf items */
  done: number;
  total: number;
}

/** Builds the hierarchy; items whose parent is not loaded become roots. */
function buildTree(items: WorkItemSummary[]): Node[] {
  const byId = new Map(
    items.map((i) => [i.id, { item: i, children: [] as Node[], points: 0, done: 0, total: 0 }]),
  );
  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.item.parentId ? byId.get(node.item.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const order = (a: Node, b: Node) =>
    WORK_ITEM_TYPES.indexOf(a.item.type) - WORK_ITEM_TYPES.indexOf(b.item.type) ||
    a.item.number - b.item.number;
  const roll = (n: Node) => {
    n.children.sort(order);
    n.children.forEach(roll);
    const isDone = ['resolved', 'completed'].includes(STATE_CATEGORY[n.item.state]);
    n.points =
      (n.item.storyPoints ?? 0) * (n.children.length ? 0 : 1) +
      n.children.reduce((s, c) => s + c.points, 0);
    if (!n.children.length) {
      n.total = 1;
      n.done = isDone ? 1 : 0;
    } else {
      n.total = n.children.reduce((s, c) => s + c.total, 0);
      n.done = n.children.reduce((s, c) => s + c.done, 0);
    }
  };
  roots.sort(order).forEach(roll);
  return roots;
}

export function Backlog({ project }: { project: ProjectDetail }) {
  const [includeDone, setIncludeDone] = useState(false);
  const { data, isLoading } = useBacklog(project.id, includeDone);
  const tree = useMemo(() => buildTree(data?.data ?? []), [data]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [create, setCreate] = useState<{
    open: boolean;
    parent?: WorkItemSummary;
    type?: WorkItemType;
  }>({ open: false });
  const canCreate = project.workItemAccess.canCreate;

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allParents = (data?.data ?? []).filter((i) => i.childCount > 0).map((i) => i.id);

  const renderNode = (node: Node, depth: number): ReactNode => {
    const { item } = node;
    const isCollapsed = collapsed.has(item.id);
    const hasChildren = node.children.length > 0;
    const childType = DEFAULT_CHILD_TYPE[item.type];
    return (
      <div key={item.id}>
        <div
          className="group flex items-center gap-2 border-b border-slate-100 py-1.5 pr-3 text-sm hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(item.id)}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400',
              hasChildren
                ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700'
                : 'invisible',
            )}
            aria-label={isCollapsed ? `Expand ${item.key}` : `Collapse ${item.key}`}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <TypeIcon type={item.type} />
          <span className="hidden font-mono text-xs text-slate-500 sm:inline">{item.key}</span>
          <Link
            to={`/items/${item.key}`}
            className={cn(
              'min-w-0 flex-1 truncate hover:text-brand-700 dark:hover:text-brand-100',
              ['EPIC', 'FEATURE'].includes(item.type) && 'font-medium',
              STATE_CATEGORY[item.state] === 'completed' && 'text-slate-500',
            )}
          >
            {item.title}
          </Link>
          {hasChildren && (
            <span
              className="hidden w-24 items-center gap-1.5 lg:flex"
              title={`${node.done} of ${node.total} done`}
            >
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <span
                  className="block h-full bg-emerald-500"
                  style={{ width: `${(node.done / node.total) * 100}%` }}
                />
              </span>
              <span className="text-[11px] text-slate-500">
                {node.done}/{node.total}
              </span>
            </span>
          )}
          <span className="hidden w-28 md:block">
            <StateLabel state={item.state} />
          </span>
          <span
            className="hidden w-10 text-right text-xs text-slate-500 md:block"
            title="Story points"
          >
            {node.points || ''}
          </span>
          <span className="hidden w-20 xl:block">
            <PriorityBadge value={item.priority} />
          </span>
          <span className="w-7 shrink-0">
            {item.assignee && (
              <Avatar name={item.assignee.name} src={item.assignee.avatarUrl} size="sm" />
            )}
          </span>
          {canCreate && childType && (
            <button
              type="button"
              onClick={() => setCreate({ open: true, parent: item, type: childType })}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 opacity-100 hover:bg-slate-200 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-slate-700"
              aria-label={`Add child to ${item.key}`}
              title="Add child item"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {!(canCreate && childType) && <span className="w-6 shrink-0" />}
        </div>
        {!isCollapsed && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold">Backlog</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.data.length} items` : ' '}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Show completed
          </label>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCollapsed(new Set(allParents))}
            aria-label="Collapse all"
            title="Collapse all"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCollapsed(new Set())}
            aria-label="Expand all"
            title="Expand all"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() =>
                setCreate({
                  open: true,
                  type: project.workItemAccess.canCreatePlanning ? 'EPIC' : 'STORY',
                })
              }
            >
              <Plus className="h-4 w-4" /> New item
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : !tree.length ? (
        <div className="flex flex-col items-center p-12 text-center">
          <ListTree className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium">The backlog is empty</p>
          <p className="mt-1 text-sm text-slate-500">
            {canCreate
              ? 'Start with an Epic or a User Story and break it down into tasks.'
              : 'Nothing has been planned yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto py-1">{tree.map((n) => renderNode(n, 0))}</div>
      )}
      {data?.meta.truncated && (
        <p className="p-3 text-center text-xs text-amber-600">Showing the first 3000 items.</p>
      )}
      <CreateWorkItemDialog
        open={create.open}
        onClose={() => setCreate({ open: false })}
        projectId={project.id}
        defaultType={create.type}
        parent={create.parent}
        stay
      />
    </Card>
  );
}
