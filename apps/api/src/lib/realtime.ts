import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from './jwt';
import { logger } from './logger';
import { prisma } from './prisma';

/**
 * Live updates for boards, backlogs and sprints.
 * Clients authenticate with their access token, then join a room per project
 * (membership is checked). Events only carry ids - clients refetch through the
 * normal, permission-checked REST API.
 */
let io: Server | null = null;

export type ChangeScope = 'workitems' | 'iterations' | 'board' | 'credentials';

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
    serveClient: false,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('missing token');
      const { sub } = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: sub },
        select: { id: true, role: true, isActive: true },
      });
      if (!user?.isActive) throw new Error('inactive');
      socket.data.user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { id: string; role: string };
    // personal room: notifications for this user
    void socket.join(`user:${user.id}`);

    socket.on('project:join', async (projectId: unknown, ack?: (r: { ok: boolean }) => void) => {
      if (typeof projectId !== 'string' || !/^[0-9a-f-]{36}$/i.test(projectId))
        return ack?.({ ok: false });
      const allowed =
        user.role === 'ADMIN'
          ? !!(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))
          : !!(await prisma.projectMember.findUnique({
              where: { projectId_userId: { projectId, userId: user.id } },
              select: { userId: true },
            }));
      if (allowed) await socket.join(`project:${projectId}`);
      ack?.({ ok: allowed });
    });

    socket.on('project:leave', (projectId: unknown) => {
      if (typeof projectId === 'string') void socket.leave(`project:${projectId}`);
    });
  });

  logger.info('realtime (socket.io) ready');
}

/** Tell everyone viewing a project that something changed. */
export function notifyProject(
  projectId: string,
  scope: ChangeScope,
  extra: Record<string, unknown> = {},
) {
  io?.to(`project:${projectId}`).emit('project:changed', { projectId, scope, ...extra });
}

/** Push an event to one user (all their open tabs). */
export function notifyUser(userId: string, event: string, payload: Record<string, unknown> = {}) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export async function closeRealtime() {
  await io?.close();
  io = null;
}
