import { CheckCircle2, CircleSlash, OctagonAlert, TriangleAlert } from 'lucide-react';
import { HEALTH_LABELS, type Health } from '@tracker/shared';
import { cn } from '@/lib/utils';

/** Status = colour + icon + label, never colour alone. */
const STYLE: Record<Health['state'], { cls: string; Icon: typeof CheckCircle2 }> = {
  ON_TRACK: {
    cls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  AT_RISK: {
    cls: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300',
    Icon: TriangleAlert,
  },
  OFF_TRACK: {
    cls: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300',
    Icon: OctagonAlert,
  },
  DONE: {
    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    Icon: CircleSlash,
  },
};

export function HealthBadge({ health, showReasons }: { health: Health; showReasons?: boolean }) {
  const { cls, Icon } = STYLE[health.state];
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
          cls,
        )}
        title={health.reasons.join('\n') || undefined}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {HEALTH_LABELS[health.state]}
      </span>
      {showReasons && health.reasons.length > 0 && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {health.reasons.join(' · ')}
        </span>
      )}
    </span>
  );
}
