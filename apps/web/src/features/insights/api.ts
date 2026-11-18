import { useQuery } from '@tanstack/react-query';
import type {
  Insights,
  NotificationDto,
  NotificationPrefs,
  Paginated,
  PortfolioRow,
  SearchResults,
} from '@tracker/shared';
import { api } from '@/lib/api';

export function useInsights(projectId: string) {
  return useQuery({
    queryKey: ['insights', projectId],
    queryFn: async () =>
      (await api.get<{ data: Insights }>(`/projects/${projectId}/insights`)).data.data,
  });
}

export function usePortfolio(archived: boolean) {
  return useQuery({
    queryKey: ['portfolio', archived],
    queryFn: async () =>
      (
        await api.get<{ data: PortfolioRow[] }>('/reports/portfolio', {
          params: archived ? { archived: 'true' } : {},
        })
      ).data.data,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: async ({ signal }) =>
      (await api.get<{ data: SearchResults }>('/search', { params: { q }, signal })).data.data,
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () =>
      (await api.get<{ data: { count: number } }>('/notifications/unread-count')).data.data.count,
    refetchInterval: 5 * 60_000, // safety net; live socket events keep it current
  });
}

export function useNotifications(unread: boolean, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['notifications', 'list', unread, page, pageSize],
    queryFn: async () =>
      (
        await api.get<Paginated<NotificationDto> & { unread: number }>('/notifications', {
          params: { unread: unread ? 'true' : undefined, page, pageSize },
        })
      ).data,
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notifications', 'prefs'],
    queryFn: async () =>
      (await api.get<{ data: NotificationPrefs }>('/notifications/preferences')).data.data,
  });
}
