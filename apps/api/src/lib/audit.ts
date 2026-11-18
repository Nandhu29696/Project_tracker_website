import type { Prisma } from '../generated/prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';

interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Fire-and-forget audit log write. Never throws. */
export function audit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ip: entry.ip ?? null,
      },
    })
    .catch((err) => logger.error({ err, action: entry.action }, 'audit log write failed'));
}
