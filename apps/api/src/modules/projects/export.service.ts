import ExcelJS from 'exceljs';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEV_STATUS_LABELS,
  ENVIRONMENT_TYPES,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type ListProjectsQuery,
} from '@tracker/shared';
import { audit } from '../../lib/audit';
import { fromDbDate } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { buildProjectOrder, buildProjectWhere } from './projects.service';

const MAX_EXPORT = 5000;

/** Builds an .xlsx or .csv of all projects matching the list filters (ignores paging). */
export async function exportProjects(
  user: Express.AuthUser,
  q: ListProjectsQuery,
  format: 'xlsx' | 'csv',
): Promise<Buffer> {
  const projects = await prisma.project.findMany({
    where: buildProjectWhere(user, q),
    orderBy: buildProjectOrder(q),
    take: MAX_EXPORT,
    include: {
      category: true,
      owner: { select: { name: true } },
      environments: true,
      _count: { select: { members: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Project Tracker';
  wb.created = new Date();
  const ws = wb.addWorksheet('Projects', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Key', key: 'key', width: 10 },
    { header: 'Project Name', key: 'name', width: 32 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Description', key: 'description', width: 60 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Dev Status', key: 'devStatus', width: 14 },
    { header: 'Start Date', key: 'startDate', width: 12 },
    { header: 'Target Date', key: 'targetDate', width: 12 },
    { header: 'Owner', key: 'owner', width: 20 },
    { header: 'Members', key: 'members', width: 9 },
    ...ENVIRONMENT_TYPES.flatMap((t) => [
      { header: `${t} Status`, key: `${t}_status`, width: 13 },
      { header: `${t} URL`, key: `${t}_url`, width: 30 },
    ]),
    { header: 'Archived', key: 'archived', width: 10 },
    { header: 'Last Updated', key: 'updatedAt', width: 18 },
  ];

  for (const p of projects) {
    const row: Record<string, unknown> = {
      key: p.key,
      name: p.name,
      category: p.category?.name ?? '',
      description: p.description ?? '',
      priority: PRIORITY_LABELS[p.priority],
      status: PROJECT_STATUS_LABELS[p.status],
      devStatus: DEV_STATUS_LABELS[p.devStatus],
      startDate: fromDbDate(p.startDate) ?? '',
      targetDate: fromDbDate(p.targetDate) ?? '',
      owner: p.owner?.name ?? '',
      members: p._count.members,
      archived: p.archivedAt ? 'Yes' : 'No',
      updatedAt: p.updatedAt.toISOString().replace('T', ' ').slice(0, 16),
    };
    for (const e of p.environments) {
      row[`${e.type}_status`] = DEPLOYMENT_STATUS_LABELS[e.status];
      row[`${e.type}_url`] = e.url ?? e.displayName ?? '';
    }
    ws.addRow(row);
  }

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  audit({
    actorId: user.id,
    action: 'project.exported',
    entity: 'project',
    metadata: { format, count: projects.length },
  });

  const out = format === 'csv' ? await wb.csv.writeBuffer() : await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
