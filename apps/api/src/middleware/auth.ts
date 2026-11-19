import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission } from '@tracker/shared';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';

/**
 * Verifies the Bearer access token and re-loads the user from the DB so that
 * role changes and deactivation take effect immediately.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let userId: string;
  try {
    userId = verifyAccessToken(header.slice(7)).sub;
  } catch {
    throw unauthorized('Session expired or invalid', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerificationRequired: true,
    },
  });
  if (!user || !user.isActive) throw unauthorized('Account is not active', 'ACCOUNT_INACTIVE');
  if (user.emailVerificationRequired)
    throw unauthorized('Please verify your email before continuing', 'EMAIL_NOT_VERIFIED');

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
}

/** Requires the authenticated user to hold ALL of the given permissions. */
export function authorize(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    const missing = permissions.filter((p) => !hasPermission(req.user!.role, p));
    if (missing.length) throw forbidden();
    next();
  };
}
