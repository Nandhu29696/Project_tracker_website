import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  hasPermission,
  type AuthResponse,
  type LoginInput,
  type Permission,
  type PublicUser,
} from '@tracker/shared';
import { api, onSessionChange, refreshSession, tokenStore } from '@/lib/api';
import { disconnectRealtime } from '@/lib/realtime';

type Status = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  user: PublicUser | null;
  status: Status;
  login: (input: LoginInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
  setSession: (session: AuthResponse) => void;
  setUser: (user: PublicUser) => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // keep React state in sync with background token refreshes / failures
  useEffect(
    () =>
      onSessionChange((session) => {
        setUserState(session?.user ?? null);
        setStatus(session ? 'authenticated' : 'guest');
      }),
    [],
  );

  // restore the session from the httpOnly refresh cookie on first load
  useEffect(() => {
    void refreshSession();
  }, []);

  const setSession = useCallback((session: AuthResponse) => {
    tokenStore.set(session.accessToken);
    setUserState(session.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await api.post<{ data: AuthResponse }>('/auth/login', input);
      setSession(res.data.data);
      return res.data.data.user;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      disconnectRealtime();
      tokenStore.set(null);
      setUserState(null);
      setStatus('guest');
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      logout,
      setSession,
      setUser: setUserState,
      can: (permission) => hasPermission(user?.role, permission),
    }),
    [user, status, login, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
