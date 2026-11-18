import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/** URL-safe random token (sent to the user). */
export const generateToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

/** Deterministic hash used to look up tokens without storing them in plain text. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// Used to spend comparable time when the user does not exist (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);
export const fakePasswordCheck = (password: string) => bcrypt.compare(password, DUMMY_HASH);
