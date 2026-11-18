import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Prisma 7 talks to Postgres through the `pg` driver adapter
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter, log: env.isProd ? ['error'] : ['warn', 'error'] });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (!env.isProd) globalForPrisma.prisma = prisma;
