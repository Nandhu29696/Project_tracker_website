import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@tracker/shared';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  typ: 'access';
}

export function signAccessToken(userId: string, role: Role): string {
  const payload: AccessTokenPayload = { sub: userId, role, typ: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  if (typeof decoded === 'string' || decoded.typ !== 'access' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as unknown as AccessTokenPayload;
}
