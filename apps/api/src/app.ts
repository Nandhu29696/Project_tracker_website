import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiLimiter } from './middleware/security';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { workItemsRouter } from './modules/workitems/workitems.routes';
import { iterationsRouter } from './modules/iterations/iterations.routes';
import { vaultRouter } from './modules/vault/vault.routes';
import { environmentsRouter, projectsRouter } from './modules/projects/projects.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  if (!env.isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down', time: new Date().toISOString() });
    }
  });

  const v1 = express.Router();
  v1.use(apiLimiter);
  v1.use('/auth', authRouter);
  v1.use('/users', usersRouter);
  v1.use(workItemsRouter); // project-scoped + /work-items, /comments, /attachments ...
  v1.use(iterationsRouter); // /projects/:id/iterations + /iterations
  v1.use(vaultRouter); // /projects/:id/credentials + /credentials + /vault
  v1.use('/categories', categoriesRouter);
  v1.use('/projects', projectsRouter);
  v1.use('/environments', environmentsRouter);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
