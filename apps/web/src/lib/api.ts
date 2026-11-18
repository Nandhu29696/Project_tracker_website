import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthResponse } from '@tracker/shared';

const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';

/** Access token lives only in memory (never localStorage) to limit XSS impact. */
let accessToken: string | null = null;
export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

type SessionListener = (session: AuthResponse | null) => void;
const listeners = new Set<SessionListener>();
export function onSessionChange(listener: SessionListener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
const emit = (session: AuthResponse | null) => listeners.forEach((l) => l(session));

export const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function doRefresh(retry = true): Promise<AuthResponse | null> {
  try {
    const res = await axios.post<{ data: AuthResponse }>(`${baseURL}/auth/refresh`, null, {
      withCredentials: true,
    });
    tokenStore.set(res.data.data.accessToken);
    emit(res.data.data);
    return res.data.data;
  } catch (err) {
    if (retry && apiErrorCode(err) === 'REFRESH_RACE') {
      await sleep(300);
      return doRefresh(false);
    }
    tokenStore.set(null);
    emit(null);
    return null;
  }
}

let refreshPromise: Promise<AuthResponse | null> | null = null;
/** Single-flight: concurrent callers share one refresh request. */
export function refreshSession() {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

const NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/register'];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !NO_RETRY.some((p) => original.url?.includes(p))
    ) {
      original._retried = true;
      const session = await refreshSession();
      if (session) {
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError)
    return (err.response?.data as ApiErrorBody | undefined)?.error?.code;
  return undefined;
}

export function getErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  if (err instanceof AxiosError) {
    if (!err.response) return 'Cannot reach the server. Check your connection.';
    return (err.response.data as ApiErrorBody | undefined)?.error?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
