import { Router } from 'express';
import { z } from 'zod';
import { searchQuerySchema } from '@tracker/shared';
import { authenticate, authorize } from '../../middleware/auth';
import { getPortfolio, getProjectInsights } from './insights.service';
import { exportPortfolio, exportProjectReport } from './reports.service';
import { search } from './search.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const projectParam = z.object({ projectId: z.string().uuid('Invalid project id') });

/** Mounted at /api/v1 - every route authenticates itself. */
export const insightsRouter = Router();
const read = [authenticate, authorize('project:read')];

insightsRouter.get('/search', ...read, async (req, res) => {
  const { q, limit } = searchQuerySchema.parse(req.query);
  res.json({ data: await search(req.user!, q, limit) });
});

insightsRouter.get('/projects/:projectId/insights', ...read, async (req, res) => {
  res.json({ data: await getProjectInsights(req.user!, projectParam.parse(req.params).projectId) });
});

insightsRouter.get(
  '/projects/:projectId/report.xlsx',
  ...read,
  authorize('data:export'),
  async (req, res) => {
    const { buffer, fileName } = await exportProjectReport(
      req.user!,
      projectParam.parse(req.params).projectId,
    );
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  },
);

insightsRouter.get('/reports/portfolio', ...read, async (req, res) => {
  res.json({ data: await getPortfolio(req.user!, req.query.archived === 'true') });
});

insightsRouter.get(
  '/reports/portfolio.xlsx',
  ...read,
  authorize('data:export'),
  async (req, res) => {
    const buffer = await exportPortfolio(req.user!);
    res.setHeader('Content-Type', XLSX);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="portfolio-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.send(buffer);
  },
);
