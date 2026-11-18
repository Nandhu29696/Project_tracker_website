import { randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { User } from '../../generated/prisma/client';
import type { AuthResponse } from '@tracker/shared';
import { env } from '../../config/env';
import { generateToken, sha256 } from '../../lib/crypto';
import { signAccessToken } from '../../lib/jwt';
import { prisma } from '../../lib/prisma';
import { unauthorized } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { toPublicUser } from '../users/user.mapper';

export const REFRESH_COOKIE = 'pt_rt';
const REFRESH_COOKIE_PATH = '/api/v1/auth';
/** Two tabs refreshing at the same moment both send the old token; tolerate that briefly. */
const REUSE_GRACE_MS = 30_000;

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: REFRESH_COOKIE_PATH,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

export function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...opts } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
}

/** Creates a refresh token row, sets the cookie and returns an access token + user. */
export async function createSession(
  user: User,
  req: Request,
  res: Response,
  familyId: string = randomUUID(),
): Promise<AuthResponse> {
  const rawToken = generateToken(64);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(rawToken),
      familyId,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      userAgent: req.headers['user-agent']?.slice(0, 500),
      ip: req.ip?.slice(0, 64),
    },
  });
  res.cookie(REFRESH_COOKIE, rawToken, refreshCookieOptions());
  return { accessToken: signAccessToken(user.id, user.role), user: toPublicUser(user) };
}

/** Validates + rotates the refresh token from the cookie. */
export async function rotateSession(req: Request, res: Response): Promise<AuthResponse> {
  const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) throw unauthorized('No session', 'NO_SESSION');

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  });

  if (!existing) {
    clearRefreshCookie(res);
    throw unauthorized('Session not found', 'NO_SESSION');
  }

  if (existing.revokedAt) {
    if (Date.now() - existing.revokedAt.getTime() < REUSE_GRACE_MS) {
      // concurrent refresh from another tab - client should retry with the new cookie
      throw unauthorized('Session was just refreshed, retry', 'REFRESH_RACE');
    }
    // Token re-use => likely stolen. Kill the whole family.
    logger.warn(
      { userId: existing.userId, familyId: existing.familyId },
      'refresh token reuse detected',
    );
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    throw unauthorized('Session revoked', 'SESSION_REVOKED');
  }

  if (existing.expiresAt < new Date() || !existing.user.isActive) {
    clearRefreshCookie(res);
    throw unauthorized('Session expired', 'SESSION_EXPIRED');
  }

  // Atomically revoke the old token (guards against parallel requests).
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: existing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw unauthorized('Session was just refreshed, retry', 'REFRESH_RACE');

  return createSession(existing.user, req, res, existing.familyId);
}

export async function revokeSessionFromCookie(req: Request, res: Response) {
  const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (rawToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
}

export async function revokeAllSessions(userId: string, exceptFamilyId?: string) {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function currentFamilyId(req: Request): Promise<string | undefined> {
  const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) return undefined;
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: { familyId: true },
  });
  return token?.familyId;
}
