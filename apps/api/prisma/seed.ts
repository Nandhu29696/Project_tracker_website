/**
 * Seeds the first ADMIN account from SEED_ADMIN_* env vars.
 *   dev:   npm run db:seed
 *   prod:  docker compose -f docker-compose.prod.yml exec api node dist/seed.js
 * Safe to run repeatedly - it never overwrites an existing user's password.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_CATEGORIES = [
  { name: 'AI Tool', color: '#7c3aed', sortOrder: 1 },
  { name: 'Web App', color: '#2563eb', sortOrder: 2 },
  { name: 'Website', color: '#0891b2', sortOrder: 3 },
  { name: 'Mobile', color: '#059669', sortOrder: 4 },
];

async function seedCategories() {
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }
  console.log(`Categories ensured: ${DEFAULT_CATEGORIES.map((c) => c.name).join(', ')}`);
}

async function main() {
  await seedCategories();
  await seedAdmin();
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'System Admin';

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }
  if (password.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN' || !existing.isActive) {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN', isActive: true } });
      console.log(`Promoted existing user ${email} to ADMIN`);
    } else {
      console.log(`Admin ${email} already exists - nothing to do`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Created admin ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
