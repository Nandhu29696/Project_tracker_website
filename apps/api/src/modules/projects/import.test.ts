import { describe, expect, it } from 'vitest';
import {
  detectHeader,
  mapRow,
  parseDate,
  parseEnvironment,
  parseProjectStatus,
  type CellValue,
} from './import-mapping';
import { firstFreeKey, suggestProjectKey } from './keys';

// Header row exactly as in "Project Details.xlsx" (starts in column B)
const HEADER: CellValue[] = [
  null,
  'Sl.No',
  'Category',
  'Project Name',
  'Description',
  'Priority',
  'Final Status',
  'Dev Status',
  'Deployment',
  'Start Date',
  'End Date',
  'Website URL',
  'Login Credentials',
];
const header = detectHeader(HEADER)!;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (...cells: CellValue[]) => [null, ...cells];

describe('project keys', () => {
  it.each([
    ['BCM App', 'BCM'],
    ['HMS', 'HMS'],
    ['AI Email Assitant', 'AEA'],
    ['Job Agent AI', 'JAA'],
    ['Bodhika', 'BODH'],
    ['Tree Plantation', 'TP'],
    ['Enterprise-IT-Support-Agentic-RAG', 'EISAR'],
    ['2fa tool', 'P2T'], // keys must start with a letter
  ])('%s -> %s', (name, key) => {
    expect(suggestProjectKey(name)).toBe(key);
  });

  it('adds a numeric suffix when taken', () => {
    expect(firstFreeKey('BCM', new Set(['BCM', 'BCM2']))).toBe('BCM3');
  });
});

describe('spreadsheet import mapping', () => {
  it('detects the header row', () => {
    expect(header.get('name')).toBe(3);
    expect(header.get('website')).toBe(11);
    expect(detectHeader(['foo', 'bar'])).toBeNull();
  });

  it('maps an in-progress deployed AI tool', () => {
    const r = mapRow(
      row(
        1,
        'AI Tool',
        'AI Email Assitant',
        'Analyse emails',
        'High',
        null,
        'In progress',
        'Deployed',
        d('2026-06-14'),
        d('2026-10-05'),
        'MailAI � Email Intake',
        'AI Email Assistant',
      ),
      header,
    );
    expect(r.kind).toBe('project');
    if (r.kind !== 'project') return;
    expect(r.project).toMatchObject({
      name: 'AI Email Assitant',
      categoryName: 'AI Tool',
      priority: 'HIGH',
      devStatus: 'IN_PROGRESS',
      status: 'ACTIVE',
      startDate: '2026-06-14',
      targetDate: '2026-10-05',
      environment: {
        type: 'PROD',
        status: 'DEPLOYED',
        url: null,
        displayName: 'MailAI - Email Intake',
      },
    });
    expect(r.messages.some((m) => m.includes('Credentials Vault'))).toBe(true);
  });

  it('keeps out-of-order dates but warns (BCM row)', () => {
    const r = mapRow(
      row(
        4,
        'Web App',
        'BCM App',
        'x',
        'High',
        null,
        'Completed',
        'Deployed',
        d('2029-09-13'),
        d('2026-09-29'),
      ),
      header,
    );
    expect(r.kind === 'project' && r.project.startDate).toBe('2029-09-13');
    expect(r.kind === 'project' && r.messages.join()).toMatch(/after end date/);
    expect(r.kind === 'project' && r.project.status).toBe('COMPLETED');
  });

  it('defaults a missing priority and maps client-no-response (Letscalm row)', () => {
    const r = mapRow(
      row(6, 'Mobile', 'Letscalm app', 'voice', null, 'Client no respond', 'Completed'),
      header,
    );
    expect(r.kind === 'project' && r.project.priority).toBe('MEDIUM');
    expect(r.kind === 'project' && r.project.status).toBe('CLIENT_NO_RESPONSE');
    expect(r.kind === 'project' && r.messages.join()).toMatch(/Priority was empty/);
  });

  it('skips note rows without a project name and ignores empty rows', () => {
    expect(mapRow(row(null, null, null, 'Tracker'), header)).toMatchObject({ kind: 'skip' });
    expect(mapRow(row(), header)).toEqual({ kind: 'empty' });
  });

  it('maps deployment values', () => {
    expect(parseEnvironment('DEV deployed', null).value).toMatchObject({
      type: 'DEV',
      status: 'DEPLOYED',
    });
    expect(parseEnvironment('PROD', 'HMS').value).toMatchObject({
      type: 'PROD',
      status: 'DEPLOYED',
      displayName: 'HMS',
    });
    expect(parseEnvironment('Live', 'https://bodhika.app').value).toMatchObject({
      type: 'PROD',
      status: 'LIVE',
      url: 'https://bodhika.app',
    });
    expect(parseEnvironment(null, null).value).toBeNull();
  });

  it('parses date formats', () => {
    expect(parseDate('2026-01-17').value).toBe('2026-01-17');
    expect(parseDate('17/01/2026').value).toBe('2026-01-17');
    expect(parseDate('31/02/2026').warning).toBeTruthy();
    expect(parseDate(46000).value).toBe('2025-12-09');
  });

  it('derives project status from dev status when final status is empty', () => {
    expect(parseProjectStatus(null, 'COMPLETED').value).toBe('COMPLETED');
    expect(parseProjectStatus(null, 'IN_PROGRESS').value).toBe('ACTIVE');
    expect(parseProjectStatus('On hold', 'IN_PROGRESS').value).toBe('ON_HOLD');
  });
});
