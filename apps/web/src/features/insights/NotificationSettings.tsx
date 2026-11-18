import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationPrefs,
  type NotificationType,
} from '@tracker/shared';
import { Card, CardHeader, Spinner } from '@/components/ui/misc';
import { api, getErrorMessage } from '@/lib/api';
import { useNotificationPrefs } from './api';

/** Per-type email switches (in-app notifications are always on). */
export function NotificationSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useNotificationPrefs();

  const toggle = async (type: NotificationType, on: boolean) => {
    const next: NotificationPrefs = { email: { ...(data?.email ?? {}), [type]: on } };
    qc.setQueryData(['notifications', 'prefs'], next);
    try {
      await api.put('/notifications/preferences', next);
    } catch (err) {
      toast.error(getErrorMessage(err));
      void qc.invalidateQueries({ queryKey: ['notifications', 'prefs'] });
    }
  };

  return (
    <Card id="notifications">
      <CardHeader
        title="Notifications"
        description="You always see notifications in the app (bell icon). Choose which ones are also emailed."
      />
      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {NOTIFICATION_TYPES.map((t) => {
            const on = data?.email[t] !== false;
            return (
              <li key={t} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{NOTIFICATION_TYPE_LABELS[t].label}</p>
                  <p className="text-xs text-slate-500">{NOTIFICATION_TYPE_LABELS[t].hint}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    onChange={(e) => toggle(t, e.target.checked)}
                    aria-label={`Email me: ${NOTIFICATION_TYPE_LABELS[t].label}`}
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 dark:bg-slate-700" />
                  <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
