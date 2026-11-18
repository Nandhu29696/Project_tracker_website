import { useState } from 'react';
import { Inbox, Plus } from 'lucide-react';
import { STATE_CATEGORY, type WorkItemFilterParams, type WorkItemSummary } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Spinner } from '@/components/ui/misc';
import { useWorkItems } from '@/features/workitems/api';
import { CreateWorkItemDialog } from '@/features/workitems/CreateWorkItemDialog';
import { WorkItemTable } from '@/features/workitems/WorkItemTable';
import { cn } from '@/lib/utils';

const TABS: { id: string; label: string; filters: WorkItemFilterParams }[] = [
  {
    id: 'assigned',
    label: 'Assigned to me',
    filters: { assignee: 'me', status: 'open', sort: 'priority', order: 'asc', pageSize: '200' },
  },
  {
    id: 'created',
    label: 'Created by me',
    filters: { createdBy: 'me', status: 'open', pageSize: '100' },
  },
  {
    id: 'done',
    label: 'Recently done',
    filters: { assignee: 'me', status: 'done', sort: 'updatedAt', order: 'desc', pageSize: '30' },
  },
];

function Section({ title, items }: { title: string; items: WorkItemSummary[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader
        title={title}
        description={`${items.length} item${items.length === 1 ? '' : 's'}`}
      />
      <WorkItemTable items={items} />
    </Card>
  );
}

export function MyWorkPage() {
  const [tab, setTab] = useState(TABS[0]!.id);
  const [createOpen, setCreateOpen] = useState(false);
  const current = TABS.find((t) => t.id === tab)!;
  const { data, isLoading } = useWorkItems(current.filters);
  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My work</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Everything on your plate, highest priority first.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New item
        </Button>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="My work views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'cursor-pointer border-b-2 pb-3 text-sm font-medium whitespace-nowrap',
                tab === t.id
                  ? 'border-brand-600 text-brand-700 dark:text-brand-100'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      ) : !items.length ? (
        <Card className="flex flex-col items-center p-12 text-center">
          <Inbox className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium">Nothing here</p>
          <p className="mt-1 text-sm text-slate-500">
            {tab === 'assigned' ? 'No open items are assigned to you.' : 'No items yet.'}
          </p>
        </Card>
      ) : tab === 'assigned' ? (
        <div className="space-y-6">
          <Section
            title="In progress"
            items={items.filter((w) => STATE_CATEGORY[w.state] === 'in_progress')}
          />
          <Section
            title="Up next"
            items={items.filter((w) => STATE_CATEGORY[w.state] === 'proposed')}
          />
        </div>
      ) : (
        <Card>
          <WorkItemTable items={items} />
        </Card>
      )}

      <CreateWorkItemDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
