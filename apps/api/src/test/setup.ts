// Test environment - no real DB / SMTP needed for the HTTP-level tests.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5999/test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-123456';
process.env.COOKIE_SECRET = 'test-cookie-secret-that-is-long-enough-1234567';
process.env.MAIL_ENABLED = 'false';
process.env.APP_URL = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
