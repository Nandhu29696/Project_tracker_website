import { Link } from 'react-router-dom';
import { CalendarRange, Timer } from 'lucide-react';
import { ITERATION_STATE_LABELS } from '@tracker/shared';
import { Badge, Card, Spinner } from '@/components/ui/misc';
import { useMyIterations } from '@/features/planning/api';
import { formatDay, ProjectKey } from '@/features/projects/badges';

/** Active and upcoming sprints across every project the user can see. */
export function SprintsPage() {
  const { data, isLoading } = useMyIterations();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sprints</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Active and planned sprints in your projects. Open one to see its taskboard, capacity and
          burndown.
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : !data?.length ? (
        <Card className="flex flex-col items-center p-12 text-center">
          <Timer className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium">No active or planned sprints</p>
          <p className="mt-1 text-sm text-slate-500">
            Project managers plan sprints from a project's Sprints tab.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => {
            const pct = s.stats.totalPoints
              ? Math.round((s.stats.completedPoints / s.stats.totalPoints) * 100)
              : 0;
            const daysLeft = Math.max(
              0,
              Math.ceil((Date.parse(s.endDate) - Date.parse(today)) / 86_400_000) + 1,
            );
            return (
              <Link
                key={s.id}
                to={`/projects/${s.project.id}?tab=sprints`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectKey value={s.project.key} />
                    <span className="truncate font-semibold">{s.name}</span>
                  </span>
                  <Badge tone={s.state === 'ACTIVE' ? 'blue' : 'slate'}>
                    {ITERATION_STATE_LABELS[s.state]}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{s.project.name}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarRange className="h-3.5 w-3.5" />
                  {formatDay(s.startDate)} – {formatDay(s.endDate)}
                  {s.state === 'ACTIVE' && ` · ${daysLeft} days left`}
                </p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      {s.stats.completedPoints}/{s.stats.totalPoints} points
                    </span>
                    <span>
                      {s.stats.openItems} open · {s.stats.remainingWork}h left
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    role="meter"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Points completed"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
