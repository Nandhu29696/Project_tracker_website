import { Router } from 'express';
import { z } from 'zod';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from '@tracker/shared';
import { authenticate, authorize } from '../../middleware/auth';
import * as users from './users.service';

const idParam = z.object({ id: z.string().uuid('Invalid user id') });

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', authorize('user:read'), async (req, res) => {
  res.json(await users.listUsers(listUsersQuerySchema.parse(req.query)));
});

usersRouter.get('/:id', authorize('user:read'), async (req, res) => {
  res.json({ data: await users.getUser(idParam.parse(req.params).id) });
});

usersRouter.post('/', authorize('user:create'), async (req, res) => {
  const user = await users.inviteUser(createUserSchema.parse(req.body), req.user!);
  res
    .status(201)
    .json({ data: user, message: 'User invited. An email with a sign-up link was sent.' });
});

usersRouter.post('/:id/resend-invite', authorize('user:create'), async (req, res) => {
  await users.resendInvite(idParam.parse(req.params).id, req.user!);
  res.json({ message: 'Invite sent again.' });
});

usersRouter.patch('/:id', authorize('user:update'), async (req, res) => {
  const user = await users.updateUser(
    idParam.parse(req.params).id,
    updateUserSchema.parse(req.body),
    req.user!,
  );
  res.json({ data: user });
});
