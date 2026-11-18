import type { Request, Response } from 'express';
import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@tracker/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { fakePasswordCheck, hashPassword, verifyPassword } from '../../lib/crypto';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../../lib/errors';
import { sendEmailLater } from '../../lib/mail/mailer';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { consumeAuthToken, createAuthToken } from './auth-tokens';
import { createSession, currentFamilyId, revokeAllSessions } from './session';

export const links = {
  verifyEmail: (token: string) => `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`,
  resetPassword: (token: string) =>
    `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`,
  invite: (token: string) =>
    `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}&invite=1`,
  login: () => `${env.APP_URL}/login`,
};

export type RegisterResult =
  | { status: 'VERIFICATION_REQUIRED'; email: string }
  | { status: 'LOGGED_IN'; session: AuthResponse };

export async function register(
  input: RegisterInput,
  req: Request,
  res: Response,
): Promise<RegisterResult> {
  if (!env.ALLOW_SELF_REGISTRATION) {
    throw forbidden(
      'Self registration is disabled. Ask an administrator for an invite.',
      'REGISTRATION_DISABLED',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: 'EMPLOYEE', // self sign-up is always EMPLOYEE
      emailVerifiedAt: env.REQUIRE_EMAIL_VERIFICATION ? null : new Date(),
    },
  });
  audit({
    actorId: user.id,
    action: 'user.register',
    entity: 'user',
    entityId: user.id,
    ip: req.ip,
  });

  if (env.REQUIRE_EMAIL_VERIFICATION) {
    const token = await createAuthToken(user.id, 'EMAIL_VERIFICATION');
    sendEmailLater(user.email, templates.verifyEmail(user.name, links.verifyEmail(token)));
    return { status: 'VERIFICATION_REQUIRED', email: user.email };
  }

  sendEmailLater(user.email, templates.welcome(user.name, links.login()));
  return { status: 'LOGGED_IN', session: await createSession(user, req, res) };
}

export async function verifyEmail(token: string) {
  const { user } = await consumeAuthToken(token, ['EMAIL_VERIFICATION']);
  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    sendEmailLater(user.email, templates.welcome(user.name, links.login()));
    audit({ actorId: user.id, action: 'user.email_verified', entity: 'user', entityId: user.id });
  }
}

/** Always resolves (no account enumeration). */
export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt || !user.isActive) return;
  const token = await createAuthToken(user.id, 'EMAIL_VERIFICATION');
  sendEmailLater(user.email, templates.verifyEmail(user.name, links.verifyEmail(token)));
}

export async function login(input: LoginInput, req: Request, res: Response): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user?.passwordHash) {
    await fakePasswordCheck(input.password);
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    audit({
      actorId: user.id,
      action: 'auth.login_failed',
      entity: 'user',
      entityId: user.id,
      ip: req.ip,
    });
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw forbidden('Your account has been deactivated', 'ACCOUNT_INACTIVE');
  if (env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before signing in');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  audit({
    actorId: user.id,
    action: 'auth.login',
    entity: 'user',
    entityId: user.id,
    ip: req.ip,
    metadata: { method: 'password' },
  });
  return createSession(updated, req, res);
}

/** Always resolves (no account enumeration). */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;
  const token = await createAuthToken(user.id, 'PASSWORD_RESET');
  sendEmailLater(user.email, templates.passwordReset(user.name, links.resetPassword(token)));
  audit({
    actorId: user.id,
    action: 'auth.password_reset_requested',
    entity: 'user',
    entityId: user.id,
  });
}

/** Handles both "forgot password" resets and invite acceptance. */
export async function resetPassword(input: ResetPasswordInput) {
  const { type, user } = await consumeAuthToken(input.token, ['PASSWORD_RESET', 'INVITE']);
  if (!user.isActive) throw forbidden('Your account has been deactivated', 'ACCOUNT_INACTIVE');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      // clicking an emailed link proves ownership of the inbox
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  await revokeAllSessions(user.id);

  if (type === 'INVITE') {
    sendEmailLater(user.email, templates.welcome(user.name, links.login()));
  } else {
    sendEmailLater(user.email, templates.passwordChanged(user.name));
  }
  audit({
    actorId: user.id,
    action: type === 'INVITE' ? 'auth.invite_accepted' : 'auth.password_reset',
    entity: 'user',
    entityId: user.id,
  });
}

export async function changePassword(userId: string, input: ChangePasswordInput, req: Request) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.passwordHash) {
    if (
      !input.currentPassword ||
      !(await verifyPassword(input.currentPassword, user.passwordHash))
    ) {
      throw badRequest('Current password is incorrect', 'INVALID_PASSWORD');
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  // keep this device signed in, sign out all others
  await revokeAllSessions(userId, await currentFamilyId(req));
  sendEmailLater(user.email, templates.passwordChanged(user.name));
  audit({
    actorId: userId,
    action: 'auth.password_changed',
    entity: 'user',
    entityId: userId,
    ip: req.ip,
  });
}
