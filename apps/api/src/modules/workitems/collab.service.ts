import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ATTACHMENT_TYPES,
  LINK_LABELS,
  MAX_ATTACHMENT_BYTES,
  type AttachmentDto,
  type CommentDto,
  type CommentInput,
  type CreateLinkInput,
  type UserRef,
} from '@tracker/shared';
import { audit } from '../../lib/audit';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { sendEmailLater } from '../../lib/mail/mailer';
import { templates } from '../../lib/mail/templates';
import { prisma } from '../../lib/prisma';
import { userRefSelect } from '../projects/project.mapper';
import { findIdByKey, loadWorkItem, requireEdit, workItemKey } from './access';
import { uploadRoot } from './files';
import { commentInclude, toAttachmentDto, toCommentDto } from './mapper';
import { itemUrl } from './workitems.service';

const addHistory = (
  workItemId: string,
  actorId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
) => prisma.workItemHistory.create({ data: { workItemId, actorId, field, oldValue, newValue } });

// ---- comments ---------------------------------------------------------------------------

async function mentionMap(ids: string[]): Promise<Map<string, UserRef>> {
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: userRefSelect });
  return new Map(users.map((u) => [u.id, u]));
}

export async function listComments(
  user: Express.AuthUser,
  workItemId: string,
): Promise<CommentDto[]> {
  const { access, canManageProject } = await loadWorkItem(user, workItemId);
  const rows = await prisma.comment.findMany({
    where: { workItemId },
    include: commentInclude,
    orderBy: { createdAt: 'asc' },
    take: 1000,
  });
  const users = await mentionMap([...new Set(rows.flatMap((c) => c.mentions))]);
  return rows.map((c) =>
    toCommentDto(c, users, { userId: user.id, canComment: access.canComment, canManageProject }),
  );
}

/** Keeps only mentioned users who are active members of the project. */
async function validMentions(projectId: string, ids: string[], authorId: string) {
  if (!ids.length) return [];
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: ids }, user: { isActive: true } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return members.map((m) => m.user).filter((u) => u.id !== authorId);
}

export async function addComment(
  user: Express.AuthUser,
  workItemId: string,
  input: CommentInput,
): Promise<CommentDto> {
  const { item, access, key, canManageProject } = await loadWorkItem(user, workItemId);
  if (item.project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  if (!access.canComment) throw forbidden('Viewers cannot comment');

  const mentioned = await validMentions(item.projectId, [...new Set(input.mentions)], user.id);
  const comment = await prisma.comment.create({
    data: { workItemId, authorId: user.id, body: input.body, mentions: mentioned.map((m) => m.id) },
    include: commentInclude,
  });
  await prisma.workItem.update({ where: { id: workItemId }, data: { updatedAt: new Date() } });

  for (const m of mentioned) {
    sendEmailLater(
      m.email,
      templates.mentioned(m.name, user.name, { key, title: item.title }, input.body, itemUrl(key)),
    );
  }
  const users = await mentionMap(comment.mentions);
  return toCommentDto(comment, users, { userId: user.id, canComment: true, canManageProject });
}

async function loadComment(user: Express.AuthUser, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw notFound('Comment not found');
  const ctx = await loadWorkItem(user, comment.workItemId);
  if (ctx.item.project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  return { comment, ...ctx };
}

export async function updateComment(
  user: Express.AuthUser,
  commentId: string,
  input: CommentInput,
): Promise<CommentDto> {
  const { comment, item, access, key, canManageProject } = await loadComment(user, commentId);
  if (!access.canComment || comment.authorId !== user.id)
    throw forbidden('You can only edit your own comments');

  const mentioned = await validMentions(item.projectId, [...new Set(input.mentions)], user.id);
  const newlyMentioned = mentioned.filter((m) => !comment.mentions.includes(m.id));
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: input.body, mentions: mentioned.map((m) => m.id), editedAt: new Date() },
    include: commentInclude,
  });
  for (const m of newlyMentioned) {
    sendEmailLater(
      m.email,
      templates.mentioned(m.name, user.name, { key, title: item.title }, input.body, itemUrl(key)),
    );
  }
  const users = await mentionMap(updated.mentions);
  return toCommentDto(updated, users, { userId: user.id, canComment: true, canManageProject });
}

export async function deleteComment(user: Express.AuthUser, commentId: string) {
  const { comment, access, canManageProject } = await loadComment(user, commentId);
  if (!access.canComment || (comment.authorId !== user.id && !canManageProject)) {
    throw forbidden('You can only delete your own comments');
  }
  await prisma.comment.delete({ where: { id: commentId } });
  audit({
    actorId: user.id,
    action: 'comment.deleted',
    entity: 'work_item',
    entityId: comment.workItemId,
  });
}

// ---- links ------------------------------------------------------------------------------

export async function addLink(user: Express.AuthUser, workItemId: string, input: CreateLinkInput) {
  const { item, access, key } = await loadWorkItem(user, workItemId);
  requireEdit(access, !!item.project.archivedAt);

  const targetId = await findIdByKey(input.targetKey).catch(() => {
    throw badRequest(`Work item ${input.targetKey} was not found`, 'TARGET_NOT_FOUND');
  });
  // the target must be visible to this user too
  await loadWorkItem(user, targetId).catch(() => {
    throw badRequest(`Work item ${input.targetKey} was not found`, 'TARGET_NOT_FOUND');
  });
  if (targetId === workItemId) throw badRequest('An item cannot be linked to itself', 'SELF_LINK');

  const existing = await prisma.workItemLink.findFirst({
    where: {
      OR: [
        { sourceId: workItemId, targetId, type: input.type },
        // a symmetric "related" link in the other direction is the same link
        ...(input.type === 'RELATES'
          ? [{ sourceId: targetId, targetId: workItemId, type: input.type }]
          : []),
      ],
    },
  });
  if (existing) throw conflict('These items are already linked that way', 'LINK_EXISTS');

  await prisma.workItemLink.create({
    data: { sourceId: workItemId, targetId, type: input.type, createdById: user.id },
  });
  const label = LINK_LABELS[input.type];
  await Promise.all([
    addHistory(workItemId, user.id, 'Link', null, `${label.outgoing} ${input.targetKey}`),
    addHistory(targetId, user.id, 'Link', null, `${label.incoming} ${key}`),
  ]);
}

export async function deleteLink(user: Express.AuthUser, linkId: string) {
  const link = await prisma.workItemLink.findUnique({
    where: { id: linkId },
    include: {
      source: { select: { number: true, project: { select: { key: true } } } },
      target: { select: { number: true, project: { select: { key: true } } } },
    },
  });
  if (!link) throw notFound('Link not found');
  // editing either end is enough to remove the link
  const [src, tgt] = await Promise.all([
    loadWorkItem(user, link.sourceId).catch(() => null),
    loadWorkItem(user, link.targetId).catch(() => null),
  ]);
  const allowed = [src, tgt].some((c) => c && c.access.canEdit && !c.item.project.archivedAt);
  if (!allowed) throw forbidden('You cannot change links on these items');

  await prisma.workItemLink.delete({ where: { id: linkId } });
  const label = LINK_LABELS[link.type];
  const srcKey = workItemKey(link.source.project.key, link.source.number);
  const tgtKey = workItemKey(link.target.project.key, link.target.number);
  await Promise.all([
    addHistory(link.sourceId, user.id, 'Link', `${label.outgoing} ${tgtKey}`, null),
    addHistory(link.targetId, user.id, 'Link', `${label.incoming} ${srcKey}`, null),
  ]);
}

// ---- attachments ------------------------------------------------------------------------

/** Magic-byte checks so a renamed file cannot pretend to be an image / PDF / Office file. */
function signatureMatches(ext: string, buf: Buffer): boolean {
  const hex = buf.subarray(0, 12).toString('hex');
  switch (ext) {
    case 'png':
      return hex.startsWith('89504e470d0a1a0a');
    case 'jpg':
    case 'jpeg':
      return hex.startsWith('ffd8ff');
    case 'gif':
      return hex.startsWith('474946383');
    case 'webp':
      return hex.startsWith('52494646') && buf.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'pdf':
      return buf.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return hex.startsWith('504b0304');
    default: // text formats: reject binary content
      return !buf.subarray(0, 8000).includes(0);
  }
}

export function sanitizeFileName(raw: string): string {
  const base = raw
    .replace(/^.*[\\/]/, '') // drop any path the client sent
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
    .trim();
  return (base || 'file').slice(0, 200);
}

export async function addAttachment(
  user: Express.AuthUser,
  workItemId: string,
  rawName: string,
  body: Buffer,
): Promise<AttachmentDto> {
  const { item, access } = await loadWorkItem(user, workItemId);
  if (item.project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  if (!access.canComment) throw forbidden('Viewers cannot add attachments');

  const fileName = sanitizeFileName(rawName);
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  const mimeType = ATTACHMENT_TYPES[ext];
  if (!mimeType) {
    throw badRequest(`File type .${ext || '?'} is not allowed`, 'FILE_TYPE', {
      allowed: Object.keys(ATTACHMENT_TYPES),
    });
  }
  if (!body.length) throw badRequest('The file is empty', 'EMPTY_FILE');
  if (body.length > MAX_ATTACHMENT_BYTES)
    throw badRequest('Files can be at most 10 MB', 'FILE_TOO_LARGE');
  if (!signatureMatches(ext, body)) {
    throw badRequest(`The file content does not look like a .${ext} file`, 'FILE_SIGNATURE');
  }

  const storageKey = `${randomUUID()}.${ext}`;
  await mkdir(uploadRoot(), { recursive: true });
  await writeFile(join(uploadRoot(), storageKey), body, { flag: 'wx' });
  try {
    const row = await prisma.attachment.create({
      data: {
        workItemId,
        uploadedById: user.id,
        fileName,
        mimeType,
        size: body.length,
        storageKey,
      },
      include: { uploadedBy: { select: userRefSelect } },
    });
    await addHistory(workItemId, user.id, 'Attachment', null, fileName);
    return toAttachmentDto(row, true);
  } catch (err) {
    await rm(join(uploadRoot(), storageKey), { force: true });
    throw err;
  }
}

export async function openAttachment(user: Express.AuthUser, attachmentId: string) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att) throw notFound('Attachment not found');
  await loadWorkItem(user, att.workItemId); // visibility check
  const path = join(uploadRoot(), att.storageKey);
  const info = await stat(path).catch(() => null);
  if (!info) throw notFound('The file is missing from storage');
  return { attachment: att, size: info.size, stream: () => createReadStream(path) };
}

export async function deleteAttachment(user: Express.AuthUser, attachmentId: string) {
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att) throw notFound('Attachment not found');
  const { item, access, canManageProject } = await loadWorkItem(user, att.workItemId);
  if (item.project.archivedAt)
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  if (!access.canComment || (att.uploadedById !== user.id && !canManageProject)) {
    throw forbidden('You can only remove your own attachments');
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await rm(join(uploadRoot(), att.storageKey), { force: true });
  await addHistory(att.workItemId, user.id, 'Attachment', att.fileName, null);
}
