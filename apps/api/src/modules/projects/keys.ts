import { prisma } from '../../lib/prisma';

/**
 * Suggests a short project key from its name:
 *   "BCM App" -> BCM, "AI Email Assistant" -> AEA, "Bodhika" -> BODH,
 *   "Enterprise-IT-Support-Agentic-RAG" -> EISAR
 */
export function suggestProjectKey(name: string): string {
  const words = name
    .normalize('NFKD')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return 'PRJ';

  const first = words[0]!;
  let key: string;
  if (/^[A-Z]{3,6}$/.test(first)) {
    key = first; // existing acronym, e.g. BCM, HMS
  } else if (words.length >= 2) {
    key = words
      .slice(0, 5)
      .map((w) => w[0])
      .join('');
  } else {
    key = first.slice(0, 4);
  }

  key = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]/.test(key)) key = `P${key}`;
  if (key.length < 2)
    key = (key + first.toUpperCase().replace(/[^A-Z0-9]/g, '') + 'XX').slice(0, 3);
  return key.slice(0, 8);
}

/** Returns `base` or `base2`, `base3` ... - the first key not in `taken`. */
export function firstFreeKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 10 - String(i).length)}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Could not allocate a project key');
}

export async function takenKeysLike(base: string): Promise<Set<string>> {
  const rows = await prisma.project.findMany({
    where: { key: { startsWith: base.slice(0, 6) } },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key));
}

export async function generateUniqueKey(name: string): Promise<string> {
  const base = suggestProjectKey(name);
  return firstFreeKey(base, await takenKeysLike(base));
}
