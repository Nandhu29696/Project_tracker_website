import type { Prisma } from '../../generated/prisma/client';
import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  PublicUser,
  UpdateUserInput,
} from '@tracker/shared';
import { audit } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { sendEmailLater } from '../../lib/mail/mailer';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { createAuthToken } from '../auth/auth-tokens';
import { links } from '../auth/auth.service';
import { revokeAllSessions } from '../auth/session';
import { toPublicUser } from './user.mapper';

export async function listUsers(query: ListUsersQuery): Promise<Paginated<PublicUser>> {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { isActive: query.status === 'active' } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return {
    data: users.map(toPublicUser),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getUser(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

/** Admin invite: creates the account and emails a "set your password" link. */
export async function inviteUser(
  input: CreateUserInput,
  actor: Express.AuthUser,
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('A user with this email already exists', 'EMAIL_TAKEN');

  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, role: input.role },
  });
  const token = await createAuthToken(user.id, 'INVITE');
  sendEmailLater(
    user.email,
    templates.invite(user.name, actor.name, user.role, links.invite(token)),
  );
  audit({
    actorId: actor.id,
    action: 'user.invited',
    entity: 'user',
    entityId: user.id,
    metadata: { role: user.role },
  });
  return toPublicUser(user);
}

export async function resendInvite(id: string, actor: Express.AuthUser) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User not found');
  if (user.passwordHash || user.googleId)
    throw badRequest('User has already activated their account');
  const token = await createAuthToken(user.id, 'INVITE');
  sendEmailLater(
    user.email,
    templates.invite(user.name, actor.name, user.role, links.invite(token)),
  );
  audit({ actorId: actor.id, action: 'user.invite_resent', entity: 'user', entityId: user.id });
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor: Express.AuthUser,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User not found');

  if (id === actor.id && input.role !== undefined && input.role !== user.role) {
    throw badRequest('You cannot change your own role', 'SELF_ROLE_CHANGE');
  }
  if (id === actor.id && input.isActive === false) {
    throw badRequest('You cannot deactivate your own account', 'SELF_DEACTIVATE');
  }

  const losingAdmin =
    user.role === 'ADMIN' &&
    user.isActive &&
    ((input.role !== undefined && input.role !== 'ADMIN') || input.isActive === false);
  if (losingAdmin) {
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (activeAdmins <= 1) throw badRequest('At least one active admin is required', 'LAST_ADMIN');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { name: input.name, role: input.role, isActive: input.isActive },
  });

  if (input.role && input.role !== user.role) {
    sendEmailLater(updated.email, templates.roleChanged(updated.name, updated.role));
    audit({
      actorId: actor.id,
      action: 'user.role_changed',
      entity: 'user',
      entityId: id,
      metadata: { from: user.role, to: updated.role },
    });
  }
  if (input.isActive !== undefined && input.isActive !== user.isActive) {
    if (!input.isActive) await revokeAllSessions(id);
    sendEmailLater(updated.email, templates.accountStatus(updated.name, updated.isActive));
    audit({
      actorId: actor.id,
      action: updated.isActive ? 'user.reactivated' : 'user.deactivated',
      entity: 'user',
      entityId: id,
    });
  }
  if (input.name && input.name !== user.name) {
    audit({
      actorId: actor.id,
      action: 'user.updated',
      entity: 'user',
      entityId: id,
      metadata: { name: input.name },
    });
  }
  return toPublicUser(updated);
}
