import { describe, expect, it } from 'vitest';
import { maskSecret, parseCredentialRows, suggestProject } from './credential-import';

// Same layout as Sheet2 of "Project Details.xlsx" (starts in column B) - with fake secrets.
const SHEET: (string | null)[][] = [
  [null, 'AI Email Bot Login credentials'],
  [null, 'username', 'password'],
  [null, 'admin', 'fake-pass-1'],
  [null, 'demo_client', 'fake-pass-2'],
  [],
  [null, 'BCM Application'],
  [null, 'Role', 'email', 'password'],
  [null, 'BCM Administrator', 'admin@example.com', 'fake-pass-3'],
  [null, 'BCM Coordinator', 'coord@example.com', 'fake-pass-4'],
  [null, 'Enterprise-IT-Support-Agentic-RAG'],
  [null, 'username', 'API key'],
  [null, 'ADMIN_API_KEY', 'fake-key'],
  [null, 'Notes without a header'],
  [null, 'just', 'text'],
];

const PROJECTS = [
  { id: 'aea', key: 'AEA', name: 'AI Email Assitant' },
  { id: 'jaa', key: 'JAA', name: 'Job Agent AI' },
  { id: 'bcm', key: 'BCM', name: 'BCM App' },
  { id: 'eisar', key: 'EISAR', name: 'Enterprise-IT-Support-Agentic-RAG' },
  { id: 'hms', key: 'HMS', name: 'HMS' },
];

describe('credential sheet parsing', () => {
  const sections = parseCredentialRows(SHEET);

  it('finds the sections that have credentials', () => {
    expect(sections.map((s) => s.title)).toEqual([
      'AI Email Bot Login credentials',
      'BCM Application',
      'Enterprise-IT-Support-Agentic-RAG',
    ]);
  });

  it('maps username/password rows', () => {
    expect(sections[0]!.entries).toEqual([
      { label: 'admin', username: 'admin', secret: 'fake-pass-1' },
      { label: 'demo_client', username: 'demo_client', secret: 'fake-pass-2' },
    ]);
  });

  it('uses the role column as label and email as username', () => {
    expect(sections[1]!.entries[0]).toEqual({
      label: 'BCM Administrator',
      username: 'admin@example.com',
      secret: 'fake-pass-3',
    });
  });

  it('understands API key columns', () => {
    expect(sections[2]!.entries).toEqual([
      { label: 'ADMIN_API_KEY', username: 'ADMIN_API_KEY', secret: 'fake-key' },
    ]);
  });
});

describe('project suggestion', () => {
  it.each([
    ['AI Email Bot Login credentials', 'aea'],
    ['AI Job Agent Login credentials', 'jaa'],
    ['BCM Application', 'bcm'],
    ['Enterprise-IT-Support-Agentic-RAG', 'eisar'],
    ['Something unrelated', null],
  ])('%s -> %s', (title, id) => {
    expect(suggestProject(title, PROJECTS)).toBe(id);
  });
});

describe('masking', () => {
  it('never shows more than the first character', () => {
    expect(maskSecret('Fake-Pass9!')).toBe('F••••••••');
    expect(maskSecret('ab')).toBe('a•••');
  });
});
