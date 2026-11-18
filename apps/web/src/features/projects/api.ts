import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  CategoryDto,
  ListProjectsQuery,
  Paginated,
  ProjectDetail,
  ProjectSummary,
} from '@tracker/shared';
import { api } from '@/lib/api';

export type ProjectFilters = Partial<ListProjectsQuery>;

/** Drops empty values so they are not sent as query params. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as Partial<T>;
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (f: ProjectFilters) => ['projects', 'list', f] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async () =>
      (await api.get<Paginated<ProjectSummary>>('/projects', { params: cleanParams(filters) }))
        .data,
    placeholderData: keepPreviousData,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: async () => (await api.get<{ data: ProjectDetail }>(`/projects/${id}`)).data.data,
    enabled: !!id,
  });
}

export function useCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['categories', { includeInactive }],
    queryFn: async () =>
      (
        await api.get<{ data: CategoryDto[] }>('/categories', {
          params: includeInactive ? { includeInactive: 'true' } : undefined,
        })
      ).data.data,
    staleTime: 5 * 60_000,
  });
}

/** Downloads a file from an authenticated endpoint. */
export async function downloadFile(path: string, params: object, fallbackName: string) {
  const res = await api.get<Blob>(path, { params: cleanParams(params), responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const name = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
