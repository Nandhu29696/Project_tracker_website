/**
 * Pure parsing for credential spreadsheets laid out like Sheet2 of
 * "Project Details.xlsx": blocks of
 *
 *     <section title>                  (a row with a single cell, e.g. "BCM Application")
 *     <header row>                     (username | password, Role | email | password, username | API key ...)
 *     <data rows>
 *
 * No database access here - see vault.service.ts. Unit tested in credential-import.test.ts.
 */
import type { CellValue } from '../projects/import-mapping';

const SECRET_HEADER = /^(password|passwd|pass|pwd|api ?key|apikey|secret|token|access ?key)$/i;
const USER_HEADER = /^(user ?name|user|login|e-?mail|email ?id|user ?id|client ?id|id)$/i;
const ROLE_HEADER = /^(role|label|name|account)$/i;

export interface ParsedEntry {
  label: string;
  username: string | null;
  secret: string;
}
export interface ParsedSection {
  title: string;
  entries: ParsedEntry[];
}

const str = (v: CellValue | undefined) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

interface Header {
  secret: number;
  user: number | null;
  role: number | null;
}

function asHeader(cells: string[]): Header | null {
  const secret = cells.findIndex((c) => SECRET_HEADER.test(c));
  if (secret < 0) return null;
  const user = cells.findIndex((c, i) => i !== secret && USER_HEADER.test(c));
  const role = cells.findIndex((c, i) => i !== secret && i !== user && ROLE_HEADER.test(c));
  if (user < 0 && role < 0) return null;
  return { secret, user: user < 0 ? null : user, role: role < 0 ? null : role };
}

export function parseCredentialRows(rows: CellValue[][]): ParsedSection[] {
  const sections: (ParsedSection & { header: Header | null })[] = [];
  let current: (ParsedSection & { header: Header | null }) | null = null;

  for (const raw of rows) {
    const cells = raw.map(str);
    const filled = cells.filter(Boolean);
    if (!filled.length) continue;

    const header = asHeader(cells);
    if (header) {
      if (!current) {
        current = { title: 'Credentials', entries: [], header: null };
        sections.push(current);
      }
      current.header = header;
      continue;
    }

    // a lone cell starts a new section (its title)
    if (filled.length === 1) {
      current = { title: filled[0]!.slice(0, 200), entries: [], header: null };
      sections.push(current);
      continue;
    }

    if (!current?.header) continue;
    const { secret: si, user: ui, role: ri } = current.header;
    const secret = cells[si] ?? '';
    if (!secret) continue;
    const username = ui !== null ? cells[ui] || null : null;
    const role = ri !== null ? cells[ri] || null : null;
    current.entries.push({
      label: (role ?? username ?? current.title).slice(0, 100),
      username: username?.slice(0, 200) ?? null,
      secret: secret.slice(0, 4000),
    });
  }

  return sections
    .filter((s) => s.entries.length > 0)
    .map(({ title, entries }) => ({ title, entries }));
}

const STOPWORDS = new Set([
  'login',
  'logins',
  'credential',
  'credentials',
  'application',
  'app',
  'the',
  'and',
  'for',
  'of',
  'bot',
  'account',
  'accounts',
  'password',
  'passwords',
]);

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );

/** Suggests the project a section belongs to by word overlap (null when unclear). */
export function suggestProject(
  title: string,
  projects: { id: string; key: string; name: string }[],
): string | null {
  const t = tokens(title);
  if (!t.size) return null;
  let best: { id: string; score: number } | null = null;
  let tie = false;
  for (const p of projects) {
    const pt = tokens(`${p.name} ${p.key}`);
    const overlap = [...t].filter((w) => pt.has(w)).length;
    if (!overlap) continue;
    const score = overlap / Math.max(t.size, pt.size);
    if (!best || score > best.score) {
      best = { id: p.id, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  return best && !tie ? best.id : null;
}

/** "s3cret" -> "s•••••" : enough to recognise, not enough to use. */
export const maskSecret = (s: string) =>
  `${s.slice(0, 1)}${'•'.repeat(Math.min(8, Math.max(3, s.length - 1)))}`;
