import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { HEALTH_LABELS, HEALTH_STATES, type HealthState } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Card, Spinner } from '@/components/ui/misc';
import { Can } from '@/features/auth/guards';
import { HealthBadge } from '@/features/insights/HealthBadge';
import { usePortfolio } from '@/features/insights/api';
import { downloadFile } from '@/features/projects/api';
import {
  CategoryTag,
  DevStatusLabel,
  EnvChips,
  formatDay,
  PriorityBadge,
  ProjectKey,
  ProjectStatusBadge,
} from '@/features/projects/badges';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Portfolio report: every project at a glance - the replacement for the Excel tracker. */
export function ReportsPage() {
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<HealthState | 'ALL'>('ALL');
  const [exporting, setExporting] = useState(false);
  const { data, isLoading } = usePortfolio(archived);
  const rows = (data ?? []).filter((r) => filter === 'ALL' || r.health.state === filter);
  const count = (s: HealthState) => (data ?? []).filter((r) => r.health.state === s).length;

  const exportXlsx = async () => {
    setExporting(true);
    try {
      await downloadFile('/reports/portfolio.xlsx', {}, 'portfolio.xlsx');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio report</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every project you can see, with health, open work and sprint progress. Generated{' '}
            {new Date().toLocaleString()}.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          <Can permission="data:export">
            <Button size="sm" loading={exporting} onClick={exportXlsx}>
              <Download className="h-4 w-4" /> Excel
            </Button>
          </Can>
        </div>
      </div>

      <div
        className="no-print flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter by health"
      >
        {(['ALL', ...HEALTH_STATES] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1 text-sm',
              filter === s
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-100'
                : 'border-slate-300 dark:border-slate-700',
            )}
          >
            {s === 'ALL' ? `All (${data?.length ?? 0})` : `${HEALTH_LABELS[s]} (${count(s)})`}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />{' '}
          Include archived
        </label>
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : !rows.length ? (
          <p className="p-12 text-center text-sm text-slate-500">No projects match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Open</th>
                  <th className="px-4 py-3 text-right">Overdue</th>
                  <th className="px-4 py-3 text-right">Bugs</th>
                  <th className="px-4 py-3">Sprint</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Deployment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.project.id} className="align-top break-inside-avoid">
                    <td className="max-w-xs px-4 py-3">
                      <Link
                        to={`/projects/${r.project.id}?tab=insights`}
                        className="flex items-center gap-2 font-medium hover:text-brand-700"
                      >
                        <ProjectKey value={r.project.key} />{' '}
                        <span className="truncate">{r.project.name}</span>
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <CategoryTag category={r.project.category} />
                        <PriorityBadge value={r.project.priority} />
                      </div>
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <HealthBadge health={r.health} showReasons />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <ProjectStatusBadge value={r.project.status} />
                        <DevStatusLabel value={r.project.devStatus} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.openItems}</td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right tabular-nums',
                        r.overdueItems > 0 && 'font-medium text-red-600 dark:text-red-400',
                      )}
                    >
                      {r.overdueItems}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.openBugs}
                      {r.openCriticalBugs > 0 && (
                        <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                          ({r.openCriticalBugs} critical)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.activeSprint ? (
                        <>
                          <p className="font-medium">{r.activeSprint.name}</p>
                          <p className="text-slate-500">
                            {r.activeSprint.completedPoints}/{r.activeSprint.totalPoints} pts · ends{' '}
                            {formatDay(r.activeSprint.endDate)}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatDay(r.project.targetDate)}
                    </td>
                    <td className="px-4 py-3">
                      <EnvChips environments={r.project.environments} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-400">
        Health rules: off track = target date passed, 2+ critical bugs, 3+ overdue items (over 20%
        of open work) or the active sprint far behind its burndown. At risk = 1 critical bug, 3+
        high-severity bugs, any overdue item, a sprint behind its burndown, on hold or waiting for
        the client.
      </p>
    </div>
  );
}
