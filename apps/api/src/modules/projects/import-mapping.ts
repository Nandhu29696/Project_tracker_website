/**
 * Pure mapping from spreadsheet rows (like "Project Details.xlsx") to projects.
 * No database access here - see import.service.ts. Unit tested in import.test.ts.
 */
import type {
  DeploymentStatus,
  DevStatus,
  EnvironmentType,
  Priority,
  ProjectStatus,
} from '@tracker/shared';

export type CellValue = string | number | boolean | Date | null;

/** Canonical column ids and the header spellings that map to them. */
export const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['projectname', 'project', 'name'],
  category: ['category', 'type'],
  description: ['description', 'details'],
  priority: ['priority'],
  finalStatus: ['finalstatus', 'status', 'projectstatus'],
  devStatus: ['devstatus', 'developmentstatus'],
  deployment: ['deployment', 'deploymentstatus', 'environment'],
  startDate: ['startdate', 'start'],
  endDate: ['enddate', 'targetdate', 'end', 'duedate'],
  website: ['websiteurl', 'website', 'url', 'link'],
  credentials: ['logincredentials', 'credentials', 'login'],
};

export const normalizeHeader = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Maps header cells to column ids; returns null if this row is not a header row. */
export function detectHeader(cells: CellValue[]): Map<string, number> | null {
  const map = new Map<string, number>();
  cells.forEach((cell, idx) => {
    if (typeof cell !== 'string') return;
    const norm = normalizeHeader(cell);
    for (const [col, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (!map.has(col) && aliases.includes(norm)) map.set(col, idx);
    }
  });
  return map.has('name') ? map : null;
}

const text = (v: CellValue | undefined): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).replace(/�/g, '-').trim();
  return s ? s : null;
};

const key = (v: string | null) => (v ?? '').toLowerCase().replace(/[^a-z]/g, '');

export function parsePriority(v: string | null): { value: Priority; warning?: string } {
  const k = key(v);
  if (!k) return { value: 'MEDIUM', warning: 'Priority was empty - set to Medium' };
  if (k.startsWith('crit') || k === 'urgent') return { value: 'CRITICAL' };
  if (k.startsWith('high')) return { value: 'HIGH' };
  if (k.startsWith('med') || k === 'normal') return { value: 'MEDIUM' };
  if (k.startsWith('low')) return { value: 'LOW' };
  return { value: 'MEDIUM', warning: `Unknown priority "${v}" - set to Medium` };
}

export function parseDevStatus(v: string | null): { value: DevStatus; warning?: string } {
  const k = key(v);
  if (!k) return { value: 'NOT_STARTED' };
  if (k.includes('progress') || k === 'wip' || k === 'ongoing') return { value: 'IN_PROGRESS' };
  if (k.startsWith('complete') || k === 'done' || k === 'finished') return { value: 'COMPLETED' };
  if (k.includes('notstarted') || k === 'todo' || k === 'new') return { value: 'NOT_STARTED' };
  return { value: 'NOT_STARTED', warning: `Unknown dev status "${v}" - set to Not started` };
}

/** Uses the explicit final status when given, otherwise derives it from the dev status. */
export function parseProjectStatus(
  v: string | null,
  dev: DevStatus,
): { value: ProjectStatus; warning?: string } {
  const k = key(v);
  if (!k) return { value: dev === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE' };
  if (k.startsWith('client')) return { value: 'CLIENT_NO_RESPONSE' };
  if (k.includes('hold') || k === 'paused') return { value: 'ON_HOLD' };
  if (k.startsWith('cancel') || k === 'dropped') return { value: 'CANCELLED' };
  if (k.startsWith('complete') || k === 'done' || k === 'closed') return { value: 'COMPLETED' };
  if (k === 'active' || k.includes('progress') || k === 'open') return { value: 'ACTIVE' };
  return { value: 'ACTIVE', warning: `Unknown final status "${v}" - set to Active` };
}

export interface ParsedEnvironment {
  type: EnvironmentType;
  status: DeploymentStatus;
  url: string | null;
  displayName: string | null;
}

/** "DEV deployed" -> DEV/DEPLOYED, "PROD" -> PROD/DEPLOYED, "Live" -> PROD/LIVE, "Deployed" -> PROD/DEPLOYED */
export function parseEnvironment(
  deployment: string | null,
  website: string | null,
): { value: ParsedEnvironment | null; warning?: string } {
  const k = key(deployment);
  const isUrl = !!website && /^https?:\/\//i.test(website);
  let type: EnvironmentType = 'PROD';
  let status: DeploymentStatus = 'NOT_DEPLOYED';
  let warning: string | undefined;

  if (k) {
    if (k.startsWith('dev')) type = 'DEV';
    else if (k.startsWith('qa') || k.startsWith('test')) type = 'QA';
    else if (k.startsWith('uat')) type = 'UAT';
    else if (k.startsWith('stag')) type = 'STAGING';

    if (k.includes('notdeployed') || k === 'no' || k === 'pending') status = 'NOT_DEPLOYED';
    else if (k.includes('live')) status = 'LIVE';
    else if (k.includes('down')) status = 'DOWN';
    else if (k.includes('deployed') || k.includes('prod') || ['dev', 'qa', 'uat'].includes(k))
      status = 'DEPLOYED';
    else warning = `Unknown deployment value "${deployment}" - recorded as not deployed`;
  } else if (!website) {
    return { value: null };
  }

  return {
    value: { type, status, url: isUrl ? website : null, displayName: isUrl ? null : website },
    warning,
  };
}

/** Accepts Excel dates, ISO strings and dd/mm/yyyy (or dd-mm-yyyy). */
export function parseDate(v: CellValue | undefined): { value: string | null; warning?: string } {
  if (v === null || v === undefined || v === '') return { value: null };
  if (v instanceof Date) {
    return Number.isNaN(v.getTime())
      ? { value: null, warning: 'Invalid date' }
      : { value: v.toISOString().slice(0, 10) };
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!, s);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return validDate(+m[3]!, +m[2]!, +m[1]!, s);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return { value: d.toISOString().slice(0, 10) };
  }
  return { value: null, warning: `Could not read date "${s}"` };
}

function validDate(y: number, mo: number, d: number, raw: string) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return { value: null, warning: `Could not read date "${raw}"` };
  }
  return { value: dt.toISOString().slice(0, 10) };
}

export interface MappedProject {
  name: string;
  description: string | null;
  categoryName: string | null;
  priority: Priority;
  status: ProjectStatus;
  devStatus: DevStatus;
  startDate: string | null;
  targetDate: string | null;
  environment: ParsedEnvironment | null;
}

export type MapRowResult =
  | { kind: 'empty' }
  | { kind: 'skip'; name: string | null; messages: string[] }
  | { kind: 'error'; name: string | null; messages: string[] }
  | { kind: 'project'; project: MappedProject; messages: string[] };

export function mapRow(cells: CellValue[], header: Map<string, number>): MapRowResult {
  const get = (col: string) => {
    const idx = header.get(col);
    return idx === undefined ? undefined : cells[idx];
  };
  const name = text(get('name'));
  const otherValues = [...header.keys()].filter((c) => c !== 'name').some((c) => text(get(c)));

  if (!name) {
    if (!otherValues) return { kind: 'empty' };
    return { kind: 'skip', name: null, messages: ['No project name - row skipped'] };
  }
  if (name.length > 120)
    return { kind: 'error', name, messages: ['Project name is longer than 120 characters'] };
  if (name.length < 2) return { kind: 'error', name, messages: ['Project name is too short'] };

  const messages: string[] = [];
  const note = (w?: string) => w && messages.push(w);

  const priority = parsePriority(text(get('priority')));
  note(priority.warning);
  const dev = parseDevStatus(text(get('devStatus')));
  note(dev.warning);
  const status = parseProjectStatus(text(get('finalStatus')), dev.value);
  note(status.warning);
  const start = parseDate(get('startDate'));
  note(start.warning && `Start date: ${start.warning}`);
  const end = parseDate(get('endDate'));
  note(end.warning && `End date: ${end.warning}`);
  if (start.value && end.value && start.value > end.value) {
    messages.push(
      `Start date ${start.value} is after end date ${end.value} - please correct after import`,
    );
  }
  const environment = parseEnvironment(text(get('deployment')), text(get('website')));
  note(environment.warning);
  if (text(get('credentials'))) {
    messages.push(
      'Login credentials were not imported - store them in the Credentials Vault (Phase 4)',
    );
  }

  const description = text(get('description'));
  return {
    kind: 'project',
    messages,
    project: {
      name,
      description: description ? description.slice(0, 5000) : null,
      categoryName: text(get('category'))?.slice(0, 50) ?? null,
      priority: priority.value,
      status: status.value,
      devStatus: dev.value,
      startDate: start.value,
      targetDate: end.value,
      environment: environment.value,
    },
  };
}
