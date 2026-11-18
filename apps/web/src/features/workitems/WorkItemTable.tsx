import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { OPEN_STATES, type WorkItemSummary } from '@tracker/shared';
import { Avatar } from '@/components/ui/misc';
import { formatDay, PriorityBadge, ProjectKey } from '@/features/projects/badges';
import { cn } from '@/lib/utils';
import { SeverityBadge, StateLabel, TagList, timeAgo, TypeIcon } from './meta';

interface Props {
  items: WorkItemSummary[];
  showProject?: boolean;
  showSeverity?: boolean;
  dim?: boolean;
}

function Assignee({ w }: { w: WorkItemSummary }) {
  return w.assignee ? (
    <span className="flex items-center gap-2 text-xs whitespace-nowrap">
      <Avatar name={w.assignee.name} src={w.assignee.avatarUrl} size="sm" />
      <span className="max-w-28 truncate">{w.assignee.name}</span>
    </span>
  ) : (
    <span className="text-xs text-slate-400">Unassigned</span>
  );
}

export function WorkItemTable({ items, showProject = true, showSeverity, dim }: Props) {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Item</th>
              {showProject && <th className="px-4 py-3">Project</th>}
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">{showSeverity ? 'Severity' : 'Priority'}</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody
            className={cn('divide-y divide-slate-200 dark:divide-slate-800', dim && 'opacity-60')}
          >
            {items.map((w) => (
              <tr
                key={w.id}
                onClick={() => navigate(`/items/${w.key}`)}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="max-w-md px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <TypeIcon type={w.type} />
                    <span className="font-mono text-xs text-slate-500">{w.key}</span>
                    <Link
                      to={`/items/${w.key}`}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'truncate font-medium hover:text-brand-700 dark:hover:text-brand-100',
                        w.state === 'REMOVED' && 'line-through',
                      )}
                    >
                      {w.title}
                    </Link>
                    {w.commentCount > 0 && (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 text-xs text-slate-400"
                        title={`${w.commentCount} comments`}
                      >
                        <MessageSquare className="h-3 w-3" /> {w.commentCount}
                      </span>
                    )}
                  </div>
                  {w.tags.length > 0 && (
                    <div className="mt-1 pl-6">
                      <TagList tags={w.tags} />
                    </div>
                  )}
                </td>
                {showProject && (
                  <td className="px-4 py-2.5">
                    <ProjectKey value={w.project.key} />
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <StateLabel state={w.state} />
                </td>
                <td className="px-4 py-2.5">
                  <Assignee w={w} />
                </td>
                <td className="px-4 py-2.5">
                  {showSeverity ? (
                    <SeverityBadge value={w.severity} />
                  ) : (
                    <PriorityBadge value={w.priority} />
                  )}
                </td>
                <td
                  className={cn(
                    'px-4 py-2.5 text-xs whitespace-nowrap',
                    w.dueDate && w.dueDate < today && OPEN_STATES.includes(w.state)
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-slate-500',
                  )}
                >
                  {formatDay(w.dueDate)}
                </td>
                <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">
                  {timeAgo(w.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul
        className={cn(
          'divide-y divide-slate-200 md:hidden dark:divide-slate-800',
          dim && 'opacity-60',
        )}
      >
        {items.map((w) => (
          <li key={w.id}>
            <Link
              to={`/items/${w.key}`}
              className="block space-y-2 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <div className="flex items-start gap-2">
                <TypeIcon type={w.type} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{w.title}</p>
                  <p className="font-mono text-xs text-slate-500">{w.key}</p>
                </div>
                {showSeverity ? (
                  <SeverityBadge value={w.severity} />
                ) : (
                  <PriorityBadge value={w.priority} />
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
                <StateLabel state={w.state} />
                <Assignee w={w} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
