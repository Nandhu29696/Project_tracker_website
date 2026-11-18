import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { forbidden } from '../lib/errors';

const rateLimitMessage = (message: string) => ({ error: { code: 'RATE_LIMITED', message } });

/** Strict limiter for credential endpoints (login, register, forgot password ...). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: rateLimitMessage('Too many attempts. Please try again in a few minutes.'),
});

/** General API limiter. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: rateLimitMessage('Too many requests. Slow down.'),
});

/**
 * CSRF protection for endpoints authenticated by the refresh cookie.
 * Browsers always send Origin on cross-site POSTs; reject unknown origins.
 */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && !env.corsOrigins.includes(origin))
    throw forbidden('Untrusted origin', 'BAD_ORIGIN');
  next();
}
