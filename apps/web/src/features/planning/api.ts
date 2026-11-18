import { useQuery } from '@tanstack/react-query';
import type {
  BoardData,
  BoardLevel,
  CredentialDto,
  IterationDto,
  ProjectRef,
  SprintDetail,
} from '@tracker/shared';
import { api } from '@/lib/api';
import { cleanParams } from '@/features/projects/api';

export function useIterations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['iterations', projectId],
    queryFn: async () =>
      (await api.get<{ data: IterationDto[] }>(`/projects/${projectId}/iterations`)).data.data,
    enabled: !!projectId,
  });
}

export function useMyIterations() {
  return useQuery({
    queryKey: ['iterations', 'mine'],
    queryFn: async () =>
      (await api.get<{ data: (IterationDto & { project: ProjectRef })[] }>('/iterations')).data
        .data,
  });
}

export function useSprint(id: string | undefined) {
  return useQuery({
    queryKey: ['sprint', id],
    queryFn: async () => (await api.get<{ data: SprintDetail }>(`/iterations/${id}`)).data.data,
    enabled: !!id,
  });
}

export interface BoardFilters {
  level: BoardLevel;
  iteration?: string;
  assignee?: string;
}

export const boardKey = (projectId: string, f: BoardFilters) => ['board', projectId, f] as const;

export function useBoard(projectId: string, filters: BoardFilters) {
  return useQuery({
    queryKey: boardKey(projectId, filters),
    queryFn: async () =>
      (
        await api.get<{ data: BoardData }>(`/projects/${projectId}/board`, {
          params: cleanParams(filters),
        })
      ).data.data,
  });
}

export function useCredentials(projectId: string) {
  return useQuery({
    queryKey: ['credentials', projectId],
    queryFn: async () =>
      (await api.get<{ data: CredentialDto[] }>(`/projects/${projectId}/credentials`)).data.data,
  });
}
