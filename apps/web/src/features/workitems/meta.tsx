import { BookOpen, Bug, CheckSquare, Crown, Trophy, type LucideIcon } from 'lucide-react';
import {
  SEVERITY_LABELS,
  STATE_CATEGORY,
  WORK_ITEM_STATE_LABELS,
  WORK_ITEM_TYPE_LABELS,
  type Severity,
  type StateCategory,
  type WorkItemState,
  type WorkItemType,
} from '@tracker/shared';
import { cn } from '@/lib/utils';

/** ADO-like colours: Epic orange, Feature purple, Story blue, Bug red, Task yellow. */
export const TYPE_META: Record<
  WorkItemType,
  { icon: LucideIcon; text: string; bar: string; border: string }
> = {
  EPIC: {
    icon: Crown,
    text: 'text-orange-600 dark:text-orange-400',
    bar: 'bg-orange-500',
    border: 'border-orange-500',
  },
  FEATURE: {
    icon: Trophy,
    text: 'text-violet-600 dark:text-violet-400',
    bar: 'bg-violet-500',
    border: 'border-violet-500',
  },
  STORY: {
    icon: BookOpen,
    text: 'text-sky-600 dark:text-sky-400',
    bar: 'bg-sky-500',
    border: 'border-sky-500',
  },
  BUG: {
    icon: Bug,
    text: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
    border: 'border-red-500',
  },
  TASK: {
    icon: CheckSquare,
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-400',
    border: 'border-amber-400',
  },
};

/** Type suggested when adding a child item ("Add child" on a story creates a task). */
export const DEFAULT_CHILD_TYPE: Partial<Record<WorkItemType, WorkItemType>> = {
  EPIC: 'FEATURE',
  FEATURE: 'STORY',
  STORY: 'TASK',
  BUG: 'TASK',
};

export function TypeIcon({ type, className }: { type: WorkItemType; className?: string }) {
  const { icon: Icon, text } = TYPE_META[type];
  return (
    <span title={WORK_ITEM_TYPE_LABELS[type]} className="inline-flex shrink-0">
      <Icon className={cn('h-4 w-4', text, className)} aria-label={WORK_ITEM_TYPE_LABELS[type]} />
    </span>
  );
}

const CATEGORY_DOT: Record<StateCategory, string> = {
  proposed: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  resolved: 'bg-emerald-400',
  completed: 'bg-emerald-600',
  removed: 'bg-slate-300 dark:bg-slate-600',
};

export function StateLabel({ state, className }: { state: WorkItemState; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs whitespace-nowrap', className)}>
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[STATE_CATEGORY[state]])}
        aria-hidden
      />
      {WORK_ITEM_STATE_LABELS[state]}
    </span>
  );
}

const SEVERITY_TONE: Record<Severity, string> = {
  S1_CRITICAL: 'bg-red-600 text-white',
  S2_HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  S3_MEDIUM: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  S4_LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function SeverityBadge({ value }: { value: Severity | null }) {
  if (!value) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        SEVERITY_TONE[value],
      )}
    >
      {SEVERITY_LABELS[value]}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {t}
        </span>
      ))}
    </span>
  );
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
