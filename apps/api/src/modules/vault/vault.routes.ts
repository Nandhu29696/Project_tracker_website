import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createCredentialSchema,
  credentialImportMapSchema,
  updateCredentialSchema,
} from '@tracker/shared';
import { env } from '../../config/env';
import { badRequest } from '../../lib/errors';
import { authenticate, authorize } from '../../middleware/auth';
import * as vault from './vault.service';

const uuid = (name: string) => z.object({ [name]: z.string().uuid('Invalid id') });
const param = (params: unknown, name: string) => uuid(name).parse(params)[name] as string;

/** Reveals are rate limited per user to slow down bulk harvesting with a stolen session. */
const revealLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req) => (req as express.Request).user?.id ?? 'anon',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many reveals. Try again later.' } },
});

/** Mounted at /api/v1 - every route authenticates itself. */
export const vaultRouter = Router();
const read = [authenticate, authorize('vault:read')];
const write = [authenticate, authorize('vault:reveal')];

// never let browsers or proxies cache vault responses
vaultRouter.use(
  ['/projects/:projectId/credentials', '/credentials', '/vault'],
  (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  },
);

vaultRouter.get('/projects/:projectId/credentials', ...read, async (req, res) => {
  res.json({ data: await vault.listCredentials(req.user!, param(req.params, 'projectId')) });
});

vaultRouter.post('/projects/:projectId/credentials', ...write, async (req, res) => {
  const cred = await vault.createCredential(
    req.user!,
    param(req.params, 'projectId'),
    createCredentialSchema.parse(req.body),
    req.ip,
  );
  res.status(201).json({ data: cred });
});

vaultRouter.patch('/credentials/:id', ...write, async (req, res) => {
  res.json({
    data: await vault.updateCredential(
      req.user!,
      param(req.params, 'id'),
      updateCredentialSchema.parse(req.body),
      req.ip,
    ),
  });
});

vaultRouter.delete('/credentials/:id', ...write, async (req, res) => {
  await vault.deleteCredential(req.user!, param(req.params, 'id'), req.ip);
  res.status(204).end();
});

vaultRouter.post('/credentials/:id/reveal', ...write, revealLimiter, async (req, res) => {
  res.json({ data: await vault.revealCredential(req.user!, param(req.params, 'id'), req.ip) });
});

vaultRouter.get('/credentials/:id/access-log', ...read, async (req, res) => {
  res.json({ data: await vault.accessLog(req.user!, param(req.params, 'id')) });
});

/**
 * Body = raw .xlsx. ?dryRun=true (default) returns a masked preview.
 * ?dryRun=false needs the X-Import-Map header: JSON {"<section index>": "<project id>" | ""}.
 */
vaultRouter.post(
  '/vault/import',
  authenticate,
  authorize('data:import', 'vault:reveal'),
  express.raw({ type: () => true, limit: '5mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw badRequest('Send the .xlsx file as the request body');
    const dryRun = req.query.dryRun !== 'false';
    let map: Record<string, string> = {};
    if (!dryRun) {
      try {
        map = credentialImportMapSchema.parse(
          JSON.parse(String(req.headers['x-import-map'] ?? '{}')),
        );
      } catch {
        throw badRequest('Invalid X-Import-Map header');
      }
    }
    res.json({ data: await vault.importCredentials(req.user!, req.body, dryRun, map, req.ip) });
  },
);
