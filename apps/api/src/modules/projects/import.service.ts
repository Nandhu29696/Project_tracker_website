import ExcelJS from 'exceljs';
import type { ImportResult, ImportRowResult } from '@tracker/shared';
import { audit } from '../../lib/audit';
import { toDbDate } from '../../lib/dates';
import { badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { detectHeader, mapRow, type CellValue, type MappedProject } from './import-mapping';
import { firstFreeKey, suggestProjectKey } from './keys';

const MAX_ROWS = 2000;

/** Converts an exceljs cell value (rich text, hyperlink, formula ...) to a plain value. */
export function plain(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value !== 'object') return value as CellValue;
  if ('richText' in value) return value.richText.map((r) => r.text).join('');
  if ('hyperlink' in value) {
    const link = String(value.hyperlink ?? '');
    return /^https?:\/\//i.test(link) ? link : (value.text as string);
  }
  if ('result' in value) return plain(value.result as ExcelJS.CellValue);
  if ('error' in value) return null;
  return String(value);
}

interface SheetRows {
  sheet: string;
  rows: { rowNumber: number; cells: CellValue[] }[];
  header: Map<string, number>;
}

async function readWorkbook(buffer: Buffer): Promise<SheetRows> {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw badRequest('Upload an Excel .xlsx file', 'INVALID_FILE');
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw badRequest('The file could not be read as an Excel workbook', 'INVALID_FILE');
  }

  // Use the first sheet that contains a "Project Name" header row.
  for (const ws of wb.worksheets) {
    let header: Map<string, number> | null = null;
    const rows: SheetRows['rows'] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: CellValue[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells[c - 1] = plain(row.getCell(c).value);
      if (!header) {
        header = detectHeader(cells);
        return;
      }
      rows.push({ rowNumber, cells });
    });
    if (header) {
      if (rows.length > MAX_ROWS) throw badRequest(`Too many rows (max ${MAX_ROWS})`);
      return { sheet: ws.name, rows, header };
    }
  }
  throw badRequest('No sheet with a "Project Name" column was found', 'NO_HEADER');
}

/**
 * Imports projects from an .xlsx file. With dryRun=true nothing is written and the
 * result is a preview. Existing projects (same name, case-insensitive) are skipped.
 */
export async function importProjects(
  user: Express.AuthUser,
  buffer: Buffer,
  dryRun: boolean,
): Promise<ImportResult> {
  const { sheet, rows, header } = await readWorkbook(buffer);

  const [existingProjects, categories, keys] = await Promise.all([
    prisma.project.findMany({ select: { name: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.project.findMany({ select: { key: true } }),
  ]);
  const existingNames = new Set(existingProjects.map((p) => p.name.toLowerCase()));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const takenKeys = new Set(keys.map((k) => k.key));
  const seenNames = new Set<string>();

  const results: ImportRowResult[] = [];
  const toCreate: { row: ImportRowResult; project: MappedProject; key: string }[] = [];

  for (const { rowNumber, cells } of rows) {
    const mapped = mapRow(cells, header);
    if (mapped.kind === 'empty') continue;
    if (mapped.kind !== 'project') {
      results.push({
        row: rowNumber,
        name: mapped.name,
        key: null,
        action: mapped.kind,
        messages: mapped.messages,
      });
      continue;
    }
    const { project } = mapped;
    const lower = project.name.toLowerCase();
    if (existingNames.has(lower) || seenNames.has(lower)) {
      results.push({
        row: rowNumber,
        name: project.name,
        key: null,
        action: 'skip',
        messages: [
          existingNames.has(lower)
            ? 'A project with this name already exists'
            : 'Duplicate row in this file',
        ],
      });
      continue;
    }
    seenNames.add(lower);

    const messages = [...mapped.messages];
    if (project.categoryName && !categoryByName.has(project.categoryName.toLowerCase())) {
      messages.push(`New category "${project.categoryName}" will be created`);
    }
    const key = firstFreeKey(suggestProjectKey(project.name), takenKeys);
    takenKeys.add(key);
    const row: ImportRowResult = {
      row: rowNumber,
      name: project.name,
      key,
      action: 'create',
      messages,
    };
    results.push(row);
    toCreate.push({ row, project, key });
  }

  if (!dryRun && toCreate.length) {
    await prisma.$transaction(async (tx) => {
      for (const { project, key } of toCreate) {
        let categoryId: string | null = null;
        if (project.categoryName) {
          const lower = project.categoryName.toLowerCase();
          categoryId = categoryByName.get(lower) ?? null;
          if (!categoryId) {
            const created = await tx.category.create({ data: { name: project.categoryName } });
            categoryId = created.id;
            categoryByName.set(lower, created.id);
          }
        }
        await tx.project.create({
          data: {
            key,
            name: project.name,
            description: project.description,
            categoryId,
            priority: project.priority,
            status: project.status,
            devStatus: project.devStatus,
            startDate: toDbDate(project.startDate),
            targetDate: toDbDate(project.targetDate),
            ownerId: user.id,
            createdById: user.id,
            members: { create: { userId: user.id, role: 'MANAGER' } },
            environments: project.environment ? { create: project.environment } : undefined,
          },
        });
      }
    });
    audit({
      actorId: user.id,
      action: 'project.imported',
      entity: 'project',
      metadata: { sheet, created: toCreate.map((t) => t.key) },
    });
  }

  const count = (a: ImportRowResult['action']) => results.filter((r) => r.action === a).length;
  return {
    dryRun,
    sheet,
    totals: {
      rows: results.length,
      create: count('create'),
      skip: count('skip'),
      error: count('error'),
    },
    rows: results,
  };
}
