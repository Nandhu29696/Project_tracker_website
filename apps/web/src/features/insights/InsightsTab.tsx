import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { HEALTH_LABELS, SEVERITY_LABELS, type ProjectDetail } from '@tracker/shared';
import { BarChart } from '@/components/charts/BarChart';
import { Button } from '@/components/ui/button';
import { Avatar, Card, CardHeader, Spinner } from '@/components/ui/misc';
import { Can } from '@/features/auth/guards';
import { downloadFile } from '@/features/projects/api';
import { formatDay } from '@/features/projects/badges';
import { StateLabel, TypeIcon } from '@/features/workitems/meta';
import { getErrorMessage } from '@/lib/api';
import { useInsights } from './api';
import { HealthBadge } from './HealthBadge';

const STATE_COLUMN_LABEL = {
  proposed: 'New',
  in_progress: 'Active',
  resolved: 'Resolved',
  completed: 'Done',
} as const;
const weekLabel = (d: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${d}T00:00:00Z`),
  );

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-red-600 dark:text-red-400' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

export function InsightsTab({ project }: { project: ProjectDetail }) {
  const { data, isLoading } = useInsights(project.id);
  const [exporting, setExporting] = useState(false);
  if (isLoading || !data)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );

  const exportReport = async () => {
    setExporting(true);
    try {
      await downloadFile(`/projects/${project.id}/report.xlsx`, {}, `${project.key}-report.xlsx`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Project health
            </p>
            <div className="mt-2">
              <HealthBadge health={data.health} />
            </div>
            {data.health.reasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {data.health.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {data.health.state === 'DONE'
                  ? 'This project is closed.'
                  : `${HEALTH_LABELS.ON_TRACK}: no overdue work, critical bugs or sprint slippage.`}
              </p>
            )}
          </div>
          <Can permission="data:export">
            <Button size="sm" variant="outline" loading={exporting} onClick={exportReport}>
              <Download className="h-4 w-4" /> Excel report
            </Button>
          </Can>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Open items" value={data.counts.open} />
          <Kpi
            label="Overdue"
            value={data.counts.overdue}
            tone={data.counts.overdue ? 'warn' : undefined}
          />
          <Kpi label="Done" value={data.counts.done} />
          <Kpi
            label="Active sprint"
            value={
              data.activeSprint
                ? `${data.activeSprint.completedPoints}/${data.activeSprint.totalPoints} pts`
                : '—'
            }
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Work items by state</h3>
          <BarChart
            title="Work items by state"
            series={[{ key: 'count', label: 'Items' }]}
            data={data.byState.map((s) => ({
              label: STATE_COLUMN_LABEL[s.category],
              values: { count: s.count },
            }))}
          />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Open bugs by severity</h3>
          <BarChart
            title="Open bugs by severity"
            series={[{ key: 'count', label: 'Open bugs' }]}
            data={data.bugsBySeverity.map((b) => ({
              label: SEVERITY_LABELS[b.severity].replace(/^\d - /, ''),
              values: { count: b.count },
            }))}
          />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Created vs closed (last 8 weeks)</h3>
          <BarChart
            title="Work items created and closed per week"
            series={[
              { key: 'created', label: 'Created' },
              { key: 'closed', label: 'Closed' },
            ]}
            data={data.flow.map((f) => ({
              label: weekLabel(f.weekStart),
              values: { created: f.created, closed: f.closed },
            }))}
          />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Velocity (story points per sprint)</h3>
          {data.velocity.length ? (
            <BarChart
              title="Committed versus completed story points per sprint"
              series={[
                { key: 'committed', label: 'Committed' },
                { key: 'completed', label: 'Completed' },
              ]}
              data={data.velocity.map((v) => ({
                label: v.sprint,
                values: { committed: v.committed, completed: v.completed },
              }))}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Velocity appears after the first completed sprint.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workload" description="Open items and remaining hours per person" />
          {!data.workload.length ? (
            <p className="p-5 text-sm text-slate-500">No open work.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.workload.map((w) => {
                const max = Math.max(...data.workload.map((x) => x.openItems));
                return (
                  <li
                    key={w.user?.id ?? 'none'}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm"
                  >
                    {w.user ? (
                      <Avatar name={w.user.name} src={w.user.avatarUrl} size="sm" />
                    ) : (
                      <span className="h-7 w-7 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
                    )}
                    <span className="w-32 truncate">{w.user?.name ?? 'Unassigned'}</span>
                    <span
                      className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(w.openItems / max) * 100}%`,
                          background: 'var(--chart-1)',
                        }}
                      />
                    </span>
                    <span className="w-28 text-right text-xs text-slate-500 tabular-nums">
                      {w.openItems} items · {Math.round(w.remainingHours * 10) / 10}h
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Overdue"
            description={
              data.overdue.length
                ? `${data.overdue.length} open item(s) past their due date`
                : undefined
            }
          />
          {!data.overdue.length ? (
            <p className="p-5 text-sm text-slate-500">Nothing overdue.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.overdue.map((w) => (
                <li key={w.id} className="flex items-center gap-2 px-5 py-2 text-sm">
                  <TypeIcon type={w.type} />
                  <Link
                    to={`/items/${w.key}`}
                    className="min-w-0 flex-1 truncate hover:text-brand-700"
                  >
                    <span className="font-mono text-xs text-slate-500">{w.key}</span> {w.title}
                  </Link>
                  <StateLabel state={w.state} className="hidden sm:inline-flex" />
                  <span className="w-24 text-right text-xs font-medium text-red-600 dark:text-red-400">
                    {formatDay(w.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
