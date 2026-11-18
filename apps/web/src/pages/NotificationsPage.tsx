import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, Spinner } from '@/components/ui/misc';
import { useNotifications } from '@/features/insights/api';
import { NotificationRow, useOpenNotification } from '@/features/insights/NotificationBell';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotifications(unreadOnly, page, 30);
  const open = useOpenNotification();
  const pages = Math.max(1, Math.ceil((data?.meta.total ?? 0) / 30));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.unread} unread` : ' '}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/profile#notifications"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" /> Email settings
          </Link>
          <Button
            size="sm"
            variant="outline"
            disabled={!data?.unread}
            onClick={async () => {
              await api.post('/notifications/read', { ids: 'all' });
              await qc.invalidateQueries({ queryKey: ['notifications'] });
            }}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        </div>
      </div>
      <div className="flex gap-2" role="group" aria-label="Filter">
        {[false, true].map((u) => (
          <button
            key={String(u)}
            type="button"
            aria-pressed={unreadOnly === u}
            onClick={() => {
              setUnreadOnly(u);
              setPage(1);
            }}
            className={cn(
              'cursor-pointer rounded-full border px-3 py-1 text-sm',
              unreadOnly === u
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-100'
                : 'border-slate-300 dark:border-slate-700',
            )}
          >
            {u ? 'Unread' : 'All'}
          </button>
        ))}
      </div>
      <Card>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Spinner />
          </div>
        ) : !data?.data.length ? (
          <div className="flex flex-col items-center p-12 text-center">
            <BellOff className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Nothing here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.data.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
            <Button
              size="icon"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {page} / {pages}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
