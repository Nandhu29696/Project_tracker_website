import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { signAccessToken } from './lib/jwt';

const app = createApp();

describe('auth API (no database required)', () => {
  it('lists enabled auth providers', async () => {
    const res = await request(app).get('/api/v1/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ password: true, google: false, selfRegistration: true });
  });

  it('rejects invalid registration input with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'onlyletters' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/number/);
  });

  it('requires a token for /auth/me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('refresh without cookie returns 401', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_SESSION');
  });

  it('refresh from an untrusted origin is blocked (CSRF)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BAD_ORIGIN');
  });

  it('google login returns 404 when not configured', async () => {
    const res = await request(app).get('/api/v1/auth/google');
    expect(res.status).toBe(404);
  });

  it('signs verifiable access tokens', () => {
    const token = signAccessToken('00000000-0000-0000-0000-000000000000', 'EMPLOYEE');
    expect(token.split('.')).toHaveLength(3);
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
