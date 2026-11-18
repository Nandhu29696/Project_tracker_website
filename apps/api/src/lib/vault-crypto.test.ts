import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

// a real 32-byte key for this test run only
beforeAll(() => {
  process.env.VAULT_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('vault encryption (AES-256-GCM)', () => {
  it('round-trips a secret', async () => {
    const { encryptSecret, decryptSecret } = await import('./vault-crypto');
    const enc = encryptSecret('Fake-Pass9! ünïcode', 'credential:p1:c1');
    expect(enc.ciphertext).not.toContain('Fake-Pass');
    expect(decryptSecret(enc, 'credential:p1:c1')).toBe('Fake-Pass9! ünïcode');
  });

  it('uses a fresh IV every time', async () => {
    const { encryptSecret } = await import('./vault-crypto');
    const a = encryptSecret('same', 'aad');
    const b = encryptSecret('same', 'aad');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects a ciphertext moved to another record (AAD)', async () => {
    const { encryptSecret, decryptSecret } = await import('./vault-crypto');
    const enc = encryptSecret('secret', 'credential:p1:c1');
    expect(() => decryptSecret(enc, 'credential:p1:c2')).toThrow(/could not be decrypted/);
  });

  it('rejects tampered data', async () => {
    const { encryptSecret, decryptSecret } = await import('./vault-crypto');
    const enc = encryptSecret('secret', 'aad');
    const bytes = Buffer.from(enc.ciphertext, 'base64');
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() => decryptSecret({ ...enc, ciphertext: bytes.toString('base64') }, 'aad')).toThrow();
  });
});
