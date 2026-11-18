import express, { Router } from 'express';
import { z } from 'zod';
import {
  addMemberSchema,
  createProjectSchema,
  environmentSchema,
  listProjectsQuerySchema,
  updateEnvironmentSchema,
  updateMemberSchema,
  updateProjectSchema,
} from '@tracker/shared';
import { authenticate, authorize } from '../../middleware/auth';
import { badRequest } from '../../lib/errors';
import { exportProjects } from './export.service';
import { importProjects } from './import.service';
import { suggestProjectKey } from './keys';
import * as projects from './projects.service';

const idParam = z.object({ id: z.string().uuid('Invalid project id') });
const memberParams = z.object({ id: z.string().uuid(), userId: z.string().uuid() });
const envParam = z.object({ envId: z.string().uuid('Invalid environment id') });

export const projectsRouter = Router();
projectsRouter.use(authenticate);

// ---- collection ----------------------------------------------------------------------

projectsRouter.get('/', authorize('project:read'), async (req, res) => {
  res.json(await projects.listProjects(req.user!, listProjectsQuerySchema.parse(req.query)));
});

projectsRouter.post('/', authorize('project:create'), async (req, res) => {
  const project = await projects.createProject(req.user!, createProjectSchema.parse(req.body));
  res.status(201).json({ data: project });
});

projectsRouter.get('/suggest-key', authorize('project:create'), (req, res) => {
  const name = z.string().trim().min(1).max(120).parse(req.query.name);
  res.json({ data: { key: suggestProjectKey(name) } });
});

projectsRouter.get('/export', authorize('data:export'), async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  const buffer = await exportProjects(req.user!, listProjectsQuerySchema.parse(req.query), format);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader(
    'Content-Type',
    format === 'csv'
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="projects-${stamp}.${format}"`);
  res.send(buffer);
});

/** Upload the raw .xlsx bytes as the request body. ?dryRun=true returns a preview only. */
projectsRouter.post(
  '/import',
  authorize('data:import'),
  express.raw({
    type: [
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    limit: '5mb',
  }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw badRequest(
        'Send the .xlsx file as the request body (Content-Type: application/octet-stream)',
      );
    }
    const dryRun = req.query.dryRun !== 'false';
    res.json({ data: await importProjects(req.user!, req.body, dryRun) });
  },
);

// ---- single project ------------------------------------------------------------------

projectsRouter.get('/:id', authorize('project:read'), async (req, res) => {
  res.json({ data: await projects.getProject(req.user!, idParam.parse(req.params).id) });
});

projectsRouter.patch('/:id', authorize('project:update'), async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.json({
    data: await projects.updateProject(req.user!, id, updateProjectSchema.parse(req.body)),
  });
});

projectsRouter.post('/:id/archive', authorize('project:update'), async (req, res) => {
  res.json({ data: await projects.setArchived(req.user!, idParam.parse(req.params).id, true) });
});

projectsRouter.post('/:id/restore', authorize('project:update'), async (req, res) => {
  res.json({ data: await projects.setArchived(req.user!, idParam.parse(req.params).id, false) });
});

projectsRouter.delete('/:id', authorize('project:delete'), async (req, res) => {
  await projects.deleteProject(req.user!, idParam.parse(req.params).id);
  res.status(204).end();
});

// ---- members -------------------------------------------------------------------------

projectsRouter.post('/:id/members', authorize('project:members'), async (req, res) => {
  const { id } = idParam.parse(req.params);
  res
    .status(201)
    .json({ data: await projects.addMember(req.user!, id, addMemberSchema.parse(req.body)) });
});

projectsRouter.patch('/:id/members/:userId', authorize('project:members'), async (req, res) => {
  const { id, userId } = memberParams.parse(req.params);
  const { role } = updateMemberSchema.parse(req.body);
  res.json({ data: await projects.updateMemberRole(req.user!, id, userId, role) });
});

projectsRouter.delete('/:id/members/:userId', authorize('project:members'), async (req, res) => {
  const { id, userId } = memberParams.parse(req.params);
  res.json({ data: await projects.removeMember(req.user!, id, userId) });
});

// ---- environments --------------------------------------------------------------------

projectsRouter.post('/:id/environments', authorize('project:update'), async (req, res) => {
  const { id } = idParam.parse(req.params);
  res.status(201).json({
    data: await projects.addEnvironment(req.user!, id, environmentSchema.parse(req.body)),
  });
});

export const environmentsRouter = Router();
environmentsRouter.use(authenticate);

environmentsRouter.patch('/:envId', authorize('project:update'), async (req, res) => {
  const { envId } = envParam.parse(req.params);
  res.json({
    data: await projects.updateEnvironment(
      req.user!,
      envId,
      updateEnvironmentSchema.parse(req.body),
    ),
  });
});

environmentsRouter.delete('/:envId', authorize('project:update'), async (req, res) => {
  await projects.deleteEnvironment(req.user!, envParam.parse(req.params).envId);
  res.status(204).end();
});
