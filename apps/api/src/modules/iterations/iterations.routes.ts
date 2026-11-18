import { Router } from 'express';
import { z } from 'zod';
import {
  capacitySchema,
  completeIterationSchema,
  createIterationSchema,
  ITERATION_STATES,
  updateIterationSchema,
} from '@tracker/shared';
import { authenticate, authorize } from '../../middleware/auth';
import * as sprints from './iterations.service';

const uuid = (name: string) => z.object({ [name]: z.string().uuid('Invalid id') });
const param = (params: unknown, name: string) => uuid(name).parse(params)[name] as string;

/** Mounted at /api/v1 - every route authenticates itself. */
export const iterationsRouter = Router();
const read = [authenticate, authorize('workitem:read')];
const manage = [authenticate, authorize('iteration:manage')];

iterationsRouter.get('/projects/:projectId/iterations', ...read, async (req, res) => {
  res.json({
    data: await sprints.listProjectIterations(req.user!, param(req.params, 'projectId')),
  });
});

iterationsRouter.post('/projects/:projectId/iterations', ...manage, async (req, res) => {
  const it = await sprints.createIteration(
    req.user!,
    param(req.params, 'projectId'),
    createIterationSchema.parse(req.body),
  );
  res.status(201).json({ data: it });
});

/** ?state=ACTIVE,PLANNED - sprints across all projects the user can see. */
iterationsRouter.get('/iterations', ...read, async (req, res) => {
  const states = z
    .string()
    .default('ACTIVE,PLANNED')
    .transform((s) => s.split(','))
    .pipe(z.array(z.enum(ITERATION_STATES)))
    .parse(req.query.state);
  res.json({ data: await sprints.listMyIterations(req.user!, states) });
});

iterationsRouter.get('/iterations/:id', ...read, async (req, res) => {
  res.json({ data: await sprints.getSprint(req.user!, param(req.params, 'id')) });
});

iterationsRouter.patch('/iterations/:id', ...manage, async (req, res) => {
  res.json({
    data: await sprints.updateIteration(
      req.user!,
      param(req.params, 'id'),
      updateIterationSchema.parse(req.body),
    ),
  });
});

iterationsRouter.delete('/iterations/:id', ...manage, async (req, res) => {
  await sprints.deleteIteration(req.user!, param(req.params, 'id'));
  res.status(204).end();
});

iterationsRouter.post('/iterations/:id/start', ...manage, async (req, res) => {
  res.json({ data: await sprints.startIteration(req.user!, param(req.params, 'id')) });
});

iterationsRouter.post('/iterations/:id/complete', ...manage, async (req, res) => {
  const { moveTo } = completeIterationSchema.parse(req.body ?? {});
  res.json({ data: await sprints.completeIteration(req.user!, param(req.params, 'id'), moveTo) });
});

iterationsRouter.put('/iterations/:id/capacity', ...manage, async (req, res) => {
  res.json({
    data: await sprints.setCapacity(
      req.user!,
      param(req.params, 'id'),
      capacitySchema.parse(req.body),
    ),
  });
});
