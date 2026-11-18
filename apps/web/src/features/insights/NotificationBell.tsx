import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  MessageSquare,
  AtSign,
  UserPlus,
  ArrowRightLeft,
  FolderPlus,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationDto, NotificationType } from '@tracker/shared';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { timeAgo } from '@/features/workitems/meta';
import { api } from '@/lib/api';
import { useNotificationsLive } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { useNotifications, useUnreadCount } from './api';

export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  ASSIGNED: UserPlus,
  MENTIONED: AtSign,
  STATE_CHANGED: ArrowRightLeft,
  COMMENTED: MessageSquare,
  DUE_SOON: CalendarClock,
  ADDED_TO_PROJECT: FolderPlus,
};

export function NotificationRow({
  n,
  onOpen,
}: {
  n: NotificationDto;
  onOpen: (n: NotificationDto) => void;
}) {
  const Icon = NOTIFICATION_ICON[n.type];
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        'flex w-full cursor-pointer gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60',
        !n.readAt && 'bg-brand-50/60 dark:bg-brand-500/5',
      )}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', !n.readAt && 'font-medium')}>{n.title}</span>
        {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
        <span className="block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.readAt && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
      )}
    </button>
  );
}

export function useOpenNotification() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return async (n: NotificationDto) => {
    if (!n.readAt) {
      await api.post('/notifications/read', { ids: [n.id] }).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link) navigate(n.link);
  };
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useNotificationsLive(true);
  const unread = useUnreadCount();
  const list = useNotifications(false, 1, 8);
  const openNotification = useOpenNotification();
  const count = unread.data ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative"
      >
        {count ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                onClick={async () => {
                  await api.post('/notifications/read', { ids: 'all' });
                  void qc.invalidateQueries({ queryKey: ['notifications'] });
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.isLoading ? (
              <div className="flex justify-center p-6">
                <Spinner />
              </div>
            ) : !list.data?.data.length ? (
              <p className="p-6 text-center text-sm text-slate-500">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data.data.map((n) => (
                  <li key={n.id}>
                    <NotificationRow
                      n={n}
                      onOpen={(x) => {
                        setOpen(false);
                        void openNotification(x);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-200 px-3 py-2 text-center text-xs font-medium text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
