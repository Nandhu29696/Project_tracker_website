import { ArrowDown, ArrowUp, ChevronsUp, Equal, ExternalLink } from 'lucide-react';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEV_STATUS_LABELS,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type CategoryDto,
  type DeploymentStatus,
  type DevStatus,
  type EnvironmentType,
  type Priority,
  type ProjectStatus,
} from '@tracker/shared';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

const priorityStyle: Record<
  Priority,
  { tone: 'red' | 'amber' | 'blue' | 'slate'; Icon: typeof ArrowUp }
> = {
  CRITICAL: { tone: 'red', Icon: ChevronsUp },
  HIGH: { tone: 'amber', Icon: ArrowUp },
  MEDIUM: { tone: 'blue', Icon: Equal },
  LOW: { tone: 'slate', Icon: ArrowDown },
};

export function PriorityBadge({ value }: { value: Priority }) {
  const { tone, Icon } = priorityStyle[value];
  return (
    <Badge tone={tone}>
      <Icon className="h-3 w-3" aria-hidden />
      {PRIORITY_LABELS[value]}
    </Badge>
  );
}

const statusTone: Record<ProjectStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  ACTIVE: 'blue',
  ON_HOLD: 'amber',
  CLIENT_NO_RESPONSE: 'red',
  COMPLETED: 'green',
  CANCELLED: 'slate',
};

export function ProjectStatusBadge({ value }: { value: ProjectStatus }) {
  return <Badge tone={statusTone[value]}>{PROJECT_STATUS_LABELS[value]}</Badge>;
}

const devDot: Record<DevStatus, string> = {
  NOT_STARTED: 'bg-slate-400',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
};

export function DevStatusLabel({ value }: { value: DevStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
      <span className={cn('h-2 w-2 rounded-full', devDot[value])} aria-hidden />
      {DEV_STATUS_LABELS[value]}
    </span>
  );
}

const deployTone: Record<DeploymentStatus, 'slate' | 'blue' | 'green' | 'red'> = {
  NOT_DEPLOYED: 'slate',
  DEPLOYED: 'blue',
  LIVE: 'green',
  DOWN: 'red',
};

export function DeploymentBadge({ value }: { value: DeploymentStatus }) {
  return <Badge tone={deployTone[value]}>{DEPLOYMENT_STATUS_LABELS[value]}</Badge>;
}

/** Compact environment chips for list rows, e.g. "DEV ● PROD ●". */
export function EnvChips({
  environments,
}: {
  environments: { type: EnvironmentType; status: DeploymentStatus; url: string | null }[];
}) {
  if (!environments.length) return <span className="text-xs text-slate-400">—</span>;
  const dot: Record<DeploymentStatus, string> = {
    NOT_DEPLOYED: 'bg-slate-300 dark:bg-slate-600',
    DEPLOYED: 'bg-blue-500',
    LIVE: 'bg-emerald-500',
    DOWN: 'bg-red-500',
  };
  return (
    <div className="flex flex-wrap gap-1">
      {environments.map((e) => {
        const chip = (
          <span
            className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            title={`${e.type}: ${DEPLOYMENT_STATUS_LABELS[e.status]}`}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', dot[e.status])} aria-hidden />
            {e.type}
            {e.url && <ExternalLink className="h-2.5 w-2.5" aria-hidden />}
          </span>
        );
        return e.url ? (
          <a
            key={e.type}
            href={e.url}
            target="_blank"
            rel="noreferrer"
            onClick={(ev) => ev.stopPropagation()}
          >
            {chip}
          </a>
        ) : (
          <span key={e.type}>{chip}</span>
        );
      })}
    </div>
  );
}

export function CategoryTag({ category }: { category: CategoryDto | null }) {
  if (!category) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      {category.name}
    </span>
  );
}

export function ProjectKey({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        className,
      )}
    >
      {value}
    </span>
  );
}

/** "Jun 14, 2026" from "2026-06-14" without time-zone shifts. */
export function formatDay(value: string | null) {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

export function isOverdue(target: string | null, status: ProjectStatus) {
  if (!target || status === 'COMPLETED' || status === 'CANCELLED') return false;
  return target < new Date().toISOString().slice(0, 10);
}
