import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  hasPermission,
  type CreateCredentialInput,
  type CredentialAccessEntry,
  type CredentialDto,
  type CredentialImportResult,
  type UpdateCredentialInput,
} from '@tracker/shared';
import type { Credential } from '../../generated/prisma/client';
import { audit } from '../../lib/audit';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { notifyProject } from '../../lib/realtime';
import { credentialAad, decryptSecret, encryptSecret } from '../../lib/vault-crypto';
import { loadProjectAccess, visibleProjectsWhere } from '../projects/access';
import type { CellValue } from '../projects/import-mapping';
import { plain } from '../projects/import.service';
import { userRefSelect } from '../projects/project.mapper';
import { maskSecret, parseCredentialRows, suggestProject } from './credential-import';

type Row = Credential & {
  createdBy: { id: string; name: string; email: string; avatarUrl: string | null } | null;
};

const toDto = (c: Row): CredentialDto => ({
  id: c.id,
  projectId: c.projectId,
  label: c.label,
  username: c.username,
  url: c.url,
  environment: c.environment,
  notes: c.notes,
  createdBy: c.createdBy,
  updatedAt: c.updatedAt.toISOString(),
  lastRotatedAt: c.lastRotatedAt.toISOString(),
  lastRevealedAt: c.lastRevealedAt?.toISOString() ?? null,
});

/** Vault access = Admin or project manager (with vault permissions). Others get 403. */
async function requireVault(user: Express.AuthUser, projectId: string, write = false) {
  const ctx = await loadProjectAccess(user, projectId);
  if (!ctx.access.canManage || !hasPermission(user.role, 'vault:reveal')) {
    throw forbidden('Only administrators and project managers can use the credentials vault');
  }
  if (write && ctx.project.archivedAt) {
    throw badRequest('This project is archived and read-only', 'PROJECT_ARCHIVED');
  }
  return ctx;
}

async function loadCredential(user: Express.AuthUser, id: string, write = false) {
  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) throw notFound('Credential not found');
  // hide existence from people who cannot see the project
  await loadProjectAccess(user, cred.projectId).catch(() => {
    throw notFound('Credential not found');
  });
  await requireVault(user, cred.projectId, write);
  return cred;
}

const include = { createdBy: { select: userRefSelect } } as const;

export async function listCredentials(
  user: Express.AuthUser,
  projectId: string,
): Promise<CredentialDto[]> {
  await requireVault(user, projectId);
  const rows = await prisma.credential.findMany({
    where: { projectId },
    include,
    orderBy: [{ environment: 'asc' }, { label: 'asc' }],
  });
  return rows.map(toDto);
}

export async function createCredential(
  user: Express.AuthUser,
  projectId: string,
  input: CreateCredentialInput,
  ip?: string,
) {
  await requireVault(user, projectId, true);
  const id = randomUUID();
  const enc = encryptSecret(input.secret, credentialAad(projectId, id));
  const row = await prisma.credential.create({
    data: {
      id,
      projectId,
      label: input.label,
      username: input.username ?? null,
      url: input.url ?? null,
      environment: input.environment ?? null,
      notes: input.notes ?? null,
      secretCiphertext: enc.ciphertext,
      secretIv: enc.iv,
      secretTag: enc.tag,
      keyVersion: enc.keyVersion,
      createdById: user.id,
      updatedById: user.id,
    },
    include,
  });
  audit({
    actorId: user.id,
    action: 'vault.created',
    entity: 'credential',
    entityId: id,
    ip,
    metadata: { projectId, label: input.label },
  });
  notifyProject(projectId, 'credentials');
  return toDto(row);
}

export async function updateCredential(
  user: Express.AuthUser,
  id: string,
  input: UpdateCredentialInput,
  ip?: string,
) {
  const cred = await loadCredential(user, id, true);
  const secretData = input.secret
    ? (() => {
        const enc = encryptSecret(input.secret, credentialAad(cred.projectId, id));
        return {
          secretCiphertext: enc.ciphertext,
          secretIv: enc.iv,
          secretTag: enc.tag,
          keyVersion: enc.keyVersion,
          lastRotatedAt: new Date(),
        };
      })()
    : {};
  const row = await prisma.credential.update({
    where: { id },
    data: {
      label: input.label,
      username: input.username,
      url: input.url,
      environment: input.environment,
      notes: input.notes,
      updatedById: user.id,
      ...secretData,
    },
    include,
  });
  audit({
    actorId: user.id,
    action: input.secret ? 'vault.rotated' : 'vault.updated',
    entity: 'credential',
    entityId: id,
    ip,
    metadata: { fields: Object.keys(input).filter((k) => k !== 'secret') },
  });
  notifyProject(cred.projectId, 'credentials');
  return toDto(row);
}

export async function deleteCredential(user: Express.AuthUser, id: string, ip?: string) {
  const cred = await loadCredential(user, id, true);
  await prisma.credential.delete({ where: { id } });
  audit({
    actorId: user.id,
    action: 'vault.deleted',
    entity: 'credential',
    entityId: id,
    ip,
    metadata: { label: cred.label },
  });
  notifyProject(cred.projectId, 'credentials');
}

/** Decrypts one secret. Every reveal is audit-logged. */
export async function revealCredential(user: Express.AuthUser, id: string, ip?: string) {
  const cred = await loadCredential(user, id);
  const secret = decryptSecret(
    {
      ciphertext: cred.secretCiphertext,
      iv: cred.secretIv,
      tag: cred.secretTag,
      keyVersion: cred.keyVersion,
    },
    credentialAad(cred.projectId, cred.id),
  );
  await prisma.credential.update({
    where: { id },
    data: { lastRevealedAt: new Date() },
    select: { id: true },
  });
  audit({
    actorId: user.id,
    action: 'vault.revealed',
    entity: 'credential',
    entityId: id,
    ip,
    metadata: { label: cred.label },
  });
  return { secret };
}

export async function accessLog(
  user: Express.AuthUser,
  id: string,
): Promise<CredentialAccessEntry[]> {
  await loadCredential(user, id);
  const rows = await prisma.auditLog.findMany({
    where: { entity: 'credential', entityId: id },
    include: { actor: { select: userRefSelect } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((r) => ({
    action: r.action,
    actor: r.actor,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ---- import (Sheet2-style workbooks) ----------------------------------------------------

async function readAllRows(buffer: Buffer): Promise<CellValue[][]> {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw badRequest('Upload an Excel .xlsx file', 'INVALID_FILE');
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw badRequest('The file could not be read as an Excel workbook', 'INVALID_FILE');
  }
  const rows: CellValue[][] = [];
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: CellValue[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells[c - 1] = plain(row.getCell(c).value);
      rows.push(cells);
    });
    rows.push([]); // sheet boundary
  }
  return rows;
}

/**
 * Preview (dryRun) or import credentials. `map` assigns each section index to a
 * project id ('' or missing = skip). Secrets never leave the server in the preview.
 */
export async function importCredentials(
  user: Express.AuthUser,
  buffer: Buffer,
  dryRun: boolean,
  map: Record<string, string>,
  ip?: string,
): Promise<CredentialImportResult> {
  const sections = parseCredentialRows(await readAllRows(buffer));
  const projects = await prisma.project.findMany({
    where: { ...visibleProjectsWhere(user), archivedAt: null },
    select: { id: true, key: true, name: true },
  });
  const projectIds = new Set(projects.map((p) => p.id));
  const existing = await prisma.credential.findMany({
    select: { projectId: true, label: true, username: true },
  });
  const exists = (projectId: string | null, label: string, username: string | null) =>
    !!projectId &&
    existing.some((e) => e.projectId === projectId && e.label === label && e.username === username);

  let created = 0;
  let skipped = 0;
  const result = sections.map((s, index) => {
    const suggested = suggestProject(s.title, projects);
    const target = dryRun ? suggested : map[String(index)] || null;
    return {
      index,
      title: s.title,
      suggestedProjectId: suggested,
      target,
      entries: s.entries.map((e) => ({
        ...e,
        secretPreview: maskSecret(e.secret),
        duplicate: exists(target, e.label, e.username),
      })),
    };
  });

  if (!dryRun) {
    for (const section of result) {
      if (!section.target) {
        skipped += section.entries.length;
        continue;
      }
      if (!projectIds.has(section.target))
        throw badRequest(`Unknown project for section "${section.title}"`);
      await requireVault(user, section.target, true);
      for (const e of section.entries) {
        if (e.duplicate) {
          skipped++;
          continue;
        }
        await createCredential(
          user,
          section.target,
          {
            label: e.label,
            username: e.username,
            secret: e.secret,
            url: null,
            notes: `Imported from "${section.title}"`,
          },
          ip,
        );
        created++;
      }
    }
    audit({
      actorId: user.id,
      action: 'vault.imported',
      entity: 'credential',
      ip,
      metadata: { created, skipped },
    });
  }

  return {
    dryRun,
    created,
    skipped,
    sections: result.map(({ index, title, suggestedProjectId, entries }) => ({
      index,
      title,
      suggestedProjectId,
      entries: entries.map(({ label, username, secretPreview, duplicate }) => ({
        label,
        username,
        secretPreview,
        duplicate,
      })),
    })),
  };
}
