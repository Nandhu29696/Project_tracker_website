import type { Request, Response } from 'express';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { generateToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { sendEmailLater } from '../../lib/mail/mailer';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { links } from './auth.service';
import { createSession } from './session';

const OAUTH_COOKIE = 'pt_oauth';
const OAUTH_COOKIE_PATH = '/api/v1/auth/google';

let client: OAuth2Client | null = null;
function getClient(): OAuth2Client {
  if (!env.googleEnabled)
    throw new AppError(404, 'GOOGLE_DISABLED', 'Google sign-in is not configured');
  client ??= new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALLBACK_URL,
  });
  return client;
}

/** Step 1: redirect the browser to Google's consent screen (Authorization Code + PKCE). */
export async function startGoogleLogin(_req: Request, res: Response) {
  const oauth = getClient();
  const state = generateToken(24);
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();

  res.cookie(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax', // must survive the top-level redirect back from Google
    signed: true,
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60 * 1000,
  });

  const url = oauth.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    prompt: 'select_account',
  });
  res.redirect(url);
}

const failRedirect = (res: Response, code: string) =>
  res.redirect(`${env.APP_URL}/login?error=${encodeURIComponent(code)}`);

/** Step 2: Google redirects back here with ?code&state. */
export async function handleGoogleCallback(req: Request, res: Response) {
  const stored = req.signedCookies?.[OAUTH_COOKIE] as string | undefined;
  res.clearCookie(OAUTH_COOKIE, {
    path: OAUTH_COOKIE_PATH,
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    signed: true,
  });

  if (typeof req.query.error === 'string') return failRedirect(res, 'google_cancelled');

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  let saved: { state: string; codeVerifier: string } | undefined;
  try {
    saved = stored ? JSON.parse(stored) : undefined;
  } catch {
    saved = undefined;
  }
  if (!code || !state || !saved || saved.state !== state) return failRedirect(res, 'google_state');

  try {
    const oauth = getClient();
    const { tokens } = await oauth.getToken({ code, codeVerifier: saved.codeVerifier });
    if (!tokens.id_token) return failRedirect(res, 'google_failed');

    const ticket = await oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) {
      return failRedirect(res, 'google_email_unverified');
    }

    const email = profile.email.toLowerCase();
    const domain = email.split('@')[1] ?? '';
    if (env.GOOGLE_ALLOWED_DOMAINS.length && !env.GOOGLE_ALLOWED_DOMAINS.includes(domain)) {
      return failRedirect(res, 'google_domain');
    }

    // 1) already linked  2) link to existing account with same email  3) create new EMPLOYEE
    let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });
    let isNew = false;

    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.sub,
            avatarUrl: byEmail.avatarUrl ?? profile.picture ?? null,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
            emailVerificationRequired: false,
          },
        });
        audit({
          actorId: user.id,
          action: 'auth.google_linked',
          entity: 'user',
          entityId: user.id,
          ip: req.ip,
        });
      } else {
        if (!env.ALLOW_SELF_REGISTRATION) return failRedirect(res, 'registration_disabled');
        user = await prisma.user.create({
          data: {
            name: (profile.name || email.split('@')[0]!).slice(0, 100),
            email,
            googleId: profile.sub,
            avatarUrl: profile.picture ?? null,
            role: 'EMPLOYEE',
            emailVerifiedAt: new Date(),
          },
        });
        isNew = true;
        audit({
          actorId: user.id,
          action: 'user.register',
          entity: 'user',
          entityId: user.id,
          ip: req.ip,
          metadata: { method: 'google' },
        });
      }
    }

    if (!user.isActive) return failRedirect(res, 'account_inactive');
    if (user.emailVerificationRequired) return failRedirect(res, 'email_not_verified');

    user = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user, req, res); // sets refresh cookie; web app fetches the access token via /auth/refresh
    audit({
      actorId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      ip: req.ip,
      metadata: { method: 'google' },
    });
    if (isNew) sendEmailLater(user.email, templates.welcome(user.name, links.login()));

    return res.redirect(`${env.APP_URL}/auth/callback`);
  } catch (err) {
    logger.error({ err }, 'google oauth callback failed');
    return failRedirect(res, 'google_failed');
  }
}
