import type { AuthTokenType, User } from '../../generated/prisma/client';
import { generateToken, sha256 } from '../../lib/crypto';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/errors';

export const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
  INVITE: 72 * 60 * 60 * 1000,
};

/** Creates a one-time email token. Older unused tokens of the same type are invalidated. */
export async function createAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  const raw = generateToken(32);
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
      },
    }),
  ]);
  return raw;
}

/** Validates and marks a token as used. Returns the token type and its user. */
export async function consumeAuthToken(
  raw: string,
  allowed: AuthTokenType[],
): Promise<{ type: AuthTokenType; user: User }> {
  const token = await prisma.authToken.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  });
  if (!token || !allowed.includes(token.type) || token.usedAt || token.expiresAt < new Date()) {
    throw badRequest('This link is invalid or has expired', 'TOKEN_INVALID');
  }
  const { count } = await prisma.authToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw badRequest('This link is invalid or has expired', 'TOKEN_INVALID');
  return { type: token.type, user: token.user };
}
