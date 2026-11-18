import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { refreshSession, tokenStore } from './api';

/**
 * One shared Socket.IO connection. It authenticates with the in-memory access
 * token (fresh on every (re)connect) and re-joins project rooms after reconnects.
 * Events only say "project X changed" - data is always refetched over REST.
 */
let socket: Socket | null = null;
const joined = new Map<string, number>(); // projectId -> number of watchers

function getSocket(): Socket {
  if (socket) return socket;
  socket = io({
    path: '/socket.io',
    transports: ['websocket'],
    auth: (cb) => cb({ token: tokenStore.get() }),
  });
  socket.on('connect', () => {
    for (const projectId of joined.keys()) socket!.emit('project:join', projectId);
  });
  socket.on('connect_error', async (err) => {
    // access token expired - refresh once, then reconnect with the new one
    if (err.message === 'unauthorized' && (await refreshSession())) socket?.connect();
  });
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
  joined.clear();
}

/**
 * Keeps the signed-in user's notification queries fresh (badge, list).
 * The server puts every socket in a personal room, so no join is needed.
 */
export function useNotificationsLive(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || !tokenStore.get()) return;
    const s = getSocket();
    const refresh = () => void qc.invalidateQueries({ queryKey: ['notifications'] });
    s.on('notification:new', refresh);
    s.on('notification:read', refresh);
    return () => {
      s.off('notification:new', refresh);
      s.off('notification:read', refresh);
    };
  }, [enabled, qc]);
}

type Change = { projectId: string; scope: 'workitems' | 'iterations' | 'board' | 'credentials' };

/** Keeps the given project's queries fresh while the component is mounted. */
export function useProjectLive(projectId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!projectId || !tokenStore.get()) return;
    const s = getSocket();
    joined.set(projectId, (joined.get(projectId) ?? 0) + 1);
    if (s.connected) s.emit('project:join', projectId);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<Change['scope']>();
    const onChange = (e: Change) => {
      if (e.projectId !== projectId) return;
      pending.add(e.scope);
      // batch bursts of events (e.g. completing a sprint moves many items)
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending.has('workitems') || pending.has('board')) {
          void qc.invalidateQueries({ queryKey: ['work-items'] });
          void qc.invalidateQueries({ queryKey: ['board', projectId] });
          void qc.invalidateQueries({ queryKey: ['insights', projectId] });
          void qc.invalidateQueries({ queryKey: ['portfolio'] });
          void qc.invalidateQueries({ queryKey: ['sprint'] });
        }
        if (pending.has('iterations')) {
          void qc.invalidateQueries({ queryKey: ['iterations'] });
          void qc.invalidateQueries({ queryKey: ['sprint'] });
          void qc.invalidateQueries({ queryKey: ['work-items'] });
        }
        if (pending.has('credentials'))
          void qc.invalidateQueries({ queryKey: ['credentials', projectId] });
        pending.clear();
      }, 250);
    };
    s.on('project:changed', onChange);

    return () => {
      clearTimeout(timer);
      s.off('project:changed', onChange);
      const n = (joined.get(projectId) ?? 1) - 1;
      if (n <= 0) {
        joined.delete(projectId);
        s.emit('project:leave', projectId);
      } else {
        joined.set(projectId, n);
      }
    };
  }, [projectId, qc]);
}
