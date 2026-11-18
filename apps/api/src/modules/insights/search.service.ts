import type { SearchResults, WorkItemState, WorkItemType } from '@tracker/shared';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { visibleProjectsWhere } from '../projects/access';
import { workItemKey } from '../workitems/access';

/**
 * Turns free text into a safe prefix tsquery: "login sso" -> "login:* & sso:*".
 * Only letters/digits survive, so users cannot inject tsquery operators.
 */
export function toPrefixQuery(q: string): string | null {
  // letters + combining marks (e.g. Tamil vowel signs) + digits
  const tokens = (q.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).slice(0, 6);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null;
}

type Row = {
  id: string;
  number: number;
  type: WorkItemType;
  title: string;
  state: WorkItemState;
  project_id: string;
  key: string;
  name: string;
  snippet: string | null;
};

/** Ranked full-text search over work items + name/key search over projects. */
export async function search(
  user: Express.AuthUser,
  q: string,
  limit: number,
): Promise<SearchResults> {
  const visible =
    user.role === 'ADMIN'
      ? Prisma.empty
      : Prisma.sql`AND EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = w.project_id AND m.user_id = ${user.id}::uuid)`;

  const results: Row[] = [];

  // exact key ("BCM-12") goes first
  const key = q
    .trim()
    .toUpperCase()
    .match(/^([A-Z][A-Z0-9]{1,9})-(\d{1,7})$/);
  if (key) {
    const exact = await prisma.$queryRaw<Row[]>`
      SELECT w.id, w.number, w.type, w.title, w.state, p.id AS project_id, p.key, p.name, NULL AS snippet
      FROM work_items w JOIN projects p ON p.id = w.project_id
      WHERE p.key = ${key[1]} AND w.number = ${Number(key[2])} ${visible}`;
    results.push(...exact);
  }

  const tsq = toPrefixQuery(q);
  if (tsq) {
    const ranked = await prisma.$queryRaw<Row[]>`
      SELECT w.id, w.number, w.type, w.title, w.state, p.id AS project_id, p.key, p.name,
             NULLIF(ts_headline('simple', coalesce(w.description, ''), query,
               'MaxFragments=1, MaxWords=16, MinWords=6, StartSel=<<, StopSel=>>'), '') AS snippet
      FROM work_items w
      JOIN projects p ON p.id = w.project_id,
           to_tsquery('simple', ${tsq}) AS query
      WHERE w.search_vector @@ query AND w.state <> 'REMOVED' ${visible}
      ORDER BY ts_rank(w.search_vector, query) DESC, w.updated_at DESC
      LIMIT ${limit}`;
    for (const r of ranked) if (!results.some((x) => x.id === r.id)) results.push(r);
  }

  const projects = await prisma.project.findMany({
    where: {
      ...visibleProjectsWhere(user),
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { key: { startsWith: q.toUpperCase() } },
      ],
    },
    select: { id: true, key: true, name: true, status: true },
    orderBy: [{ archivedAt: { sort: 'desc', nulls: 'first' } }, { name: 'asc' }],
    take: Math.min(limit, 6),
  });

  return {
    workItems: results.slice(0, limit).map((r) => ({
      id: r.id,
      key: workItemKey(r.key, r.number),
      type: r.type,
      title: r.title,
      state: r.state,
      project: { id: r.project_id, key: r.key, name: r.name },
      // only show a snippet when the description actually matched (has markers)
      snippet: r.snippet && r.snippet.includes('<<') ? r.snippet.slice(0, 300) : null,
    })),
    projects,
  };
}
