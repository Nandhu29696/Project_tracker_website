import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
  type AuthProviders,
} from '@tracker/shared';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { authLimiter, requireTrustedOrigin } from '../../middleware/security';
import { toPublicUser } from '../users/user.mapper';
import * as auth from './auth.service';
import { handleGoogleCallback, startGoogleLogin } from './google.service';
import { revokeSessionFromCookie, rotateSession } from './session';

export const authRouter = Router();

authRouter.get('/providers', (_req, res) => {
  const providers: AuthProviders = {
    password: true,
    google: env.googleEnabled,
    selfRegistration: env.ALLOW_SELF_REGISTRATION,
  };
  res.json({ data: providers });
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const result = await auth.register(registerSchema.parse(req.body), req, res);
  if (result.status === 'LOGGED_IN') {
    res.status(201).json({ data: result.session });
  } else {
    res.status(201).json({
      data: { verificationRequired: true, email: result.email },
      message: 'Account created. Check your email to verify your address.',
    });
  }
});

authRouter.post('/verify-email', authLimiter, async (req, res) => {
  await auth.verifyEmail(verifyEmailSchema.parse(req.body).token);
  res.json({ message: 'Email verified. You can now sign in.' });
});

authRouter.post('/resend-verification', authLimiter, async (req, res) => {
  await auth.resendVerification(resendVerificationSchema.parse(req.body).email);
  res.json({ message: 'If the account exists and is unverified, a new link has been sent.' });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  res.json({ data: await auth.login(loginSchema.parse(req.body), req, res) });
});

authRouter.post('/refresh', requireTrustedOrigin, async (req, res) => {
  res.json({ data: await rotateSession(req, res) });
});

authRouter.post('/logout', requireTrustedOrigin, async (req, res) => {
  await revokeSessionFromCookie(req, res);
  res.status(204).end();
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  await auth.forgotPassword(forgotPasswordSchema.parse(req.body).email);
  res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  await auth.resetPassword(resetPasswordSchema.parse(req.body));
  res.json({ message: 'Password updated. You can now sign in.' });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ data: toPublicUser(user) });
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name: input.name },
  });
  audit({ actorId: user.id, action: 'user.profile_updated', entity: 'user', entityId: user.id });
  res.json({ data: toPublicUser(user) });
});

authRouter.post('/change-password', authenticate, authLimiter, async (req, res) => {
  await auth.changePassword(req.user!.id, changePasswordSchema.parse(req.body), req);
  res.json({ message: 'Password changed. Other sessions were signed out.' });
});

// Google OAuth2
authRouter.get('/google', authLimiter, startGoogleLogin);
authRouter.get('/google/callback', authLimiter, handleGoogleCallback);
