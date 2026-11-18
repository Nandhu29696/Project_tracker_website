import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from './errors';

/**
 * AES-256-GCM encryption for vault secrets.
 *  - a fresh 96-bit IV per encryption
 *  - the GCM tag authenticates the ciphertext
 *  - `aad` (project id + record id) is bound in, so a ciphertext copied onto another
 *    record or project fails to decrypt
 * keyVersion is stored with each secret so the key can be rotated later.
 */
export const VAULT_KEY_VERSION = 1;

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

function key(): Buffer {
  if (!env.VAULT_ENCRYPTION_KEY) {
    throw new AppError(
      503,
      'VAULT_DISABLED',
      'The credentials vault is not configured (VAULT_ENCRYPTION_KEY)',
    );
  }
  return Buffer.from(env.VAULT_ENCRYPTION_KEY, 'base64');
}

export function encryptSecret(plaintext: string, aad: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    keyVersion: VAULT_KEY_VERSION,
  };
}

export function decryptSecret(secret: EncryptedSecret, aad: string): string {
  if (secret.keyVersion !== VAULT_KEY_VERSION) {
    throw new AppError(
      500,
      'VAULT_KEY_VERSION',
      'This secret was encrypted with an unknown key version',
    );
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(secret.iv, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new AppError(
      500,
      'VAULT_DECRYPT_FAILED',
      'The secret could not be decrypted (wrong key or tampered data)',
    );
  }
}

export const credentialAad = (projectId: string, credentialId: string) =>
  `credential:${projectId}:${credentialId}`;
