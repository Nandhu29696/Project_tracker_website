import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PORT: z.coerce.number().int().default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: csv,
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_ISSUER: z.string().default('project-tracker'),
  JWT_AUDIENCE: z.string().default('project-tracker-web'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  COOKIE_SECURE: bool(false),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  REQUIRE_EMAIL_VERIFICATION: bool(true),
  ALLOW_SELF_REGISTRATION: bool(true),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(20),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_CALLBACK_URL: optionalString,
  GOOGLE_ALLOWED_DOMAINS: csv,

  MAIL_ENABLED: bool(true),
  /** smtp = real delivery (Mailpit in dev); file = save to apps/api/.mail-outbox (no SMTP needed) */
  MAIL_TRANSPORT: z.enum(['smtp', 'file']).default('smtp'),
  MAIL_FROM: z.string().default('Project Tracker <no-reply@project-tracker.local>'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: bool(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,

  /** 32 random bytes, base64 - encrypts the credentials vault. Losing it makes stored secrets unreadable. */
  VAULT_ENCRYPTION_KEY: optionalString.refine(
    (v) => v === undefined || Buffer.from(v, 'base64').length === 32,
    'VAULT_ENCRYPTION_KEY must be 32 bytes, base64 encoded',
  ),

  /** Where work item attachments are stored (relative to the API working directory). */
  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGIN.length ? raw.CORS_ORIGIN : [raw.APP_URL],
  vaultEnabled: Boolean(raw.VAULT_ENCRYPTION_KEY),
  googleEnabled: Boolean(
    raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET && raw.GOOGLE_CALLBACK_URL,
  ),
};

if (env.isProd && !env.COOKIE_SECURE) {
  console.warn('[warn] COOKIE_SECURE=false in production - cookies will be sent over plain HTTP');
}

export type Env = typeof env;
