import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommentDto,
  HistoryEntryDto,
  Paginated,
  SavedQueryDto,
  WorkItemDetail,
  WorkItemFilterParams,
  WorkItemSummary,
} from '@tracker/shared';
import { api } from '@/lib/api';
import { cleanParams } from '@/features/projects/api';

export const wiKeys = {
  all: ['work-items'] as const,
  list: (f: WorkItemFilterParams) => ['work-items', 'list', f] as const,
  backlog: (projectId: string, includeDone: boolean) =>
    ['work-items', 'backlog', projectId, includeDone] as const,
  detail: (key: string) => ['work-items', 'detail', key] as const,
  comments: (id: string) => ['work-items', 'comments', id] as const,
  history: (id: string) => ['work-items', 'history', id] as const,
};

export function useWorkItems(filters: WorkItemFilterParams, enabled = true) {
  return useQuery({
    queryKey: wiKeys.list(filters),
    queryFn: async () =>
      (await api.get<Paginated<WorkItemSummary>>('/work-items', { params: cleanParams(filters) }))
        .data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBacklog(projectId: string, includeDone: boolean) {
  return useQuery({
    queryKey: wiKeys.backlog(projectId, includeDone),
    queryFn: async () =>
      (
        await api.get<{ data: WorkItemSummary[]; meta: { truncated: boolean } }>(
          `/projects/${projectId}/backlog`,
          { params: { includeDone: String(includeDone) } },
        )
      ).data,
  });
}

export function useWorkItem(key: string | undefined) {
  return useQuery({
    queryKey: wiKeys.detail(key ?? ''),
    queryFn: async () =>
      (await api.get<{ data: WorkItemDetail }>(`/work-items/key/${key}`)).data.data,
    enabled: !!key,
  });
}

export function useComments(id: string) {
  return useQuery({
    queryKey: wiKeys.comments(id),
    queryFn: async () =>
      (await api.get<{ data: CommentDto[] }>(`/work-items/${id}/comments`)).data.data,
  });
}

export function useHistory(id: string, enabled: boolean) {
  return useQuery({
    queryKey: wiKeys.history(id),
    queryFn: async () =>
      (await api.get<{ data: HistoryEntryDto[] }>(`/work-items/${id}/history`)).data.data,
    enabled,
  });
}

export function useSavedQueries() {
  return useQuery({
    queryKey: ['saved-queries'],
    queryFn: async () => (await api.get<{ data: SavedQueryDto[] }>('/saved-queries')).data.data,
  });
}

/** Refreshes every work item query (lists, backlog, detail) plus project data. */
export function useInvalidateWorkItems() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: wiKeys.all });
}

/** Attachments need the auth header, so images are loaded as blobs. */
export function useAttachmentUrl(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .get<Blob>(`/attachments/${id}`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}
