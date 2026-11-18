import ExcelJS from 'exceljs';
import {
  DEV_STATUS_LABELS,
  HEALTH_LABELS,
  ITERATION_STATE_LABELS,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  RESOLUTION_LABELS,
  SEVERITY_LABELS,
  WORK_ITEM_STATE_LABELS,
  WORK_ITEM_TYPE_LABELS,
} from '@tracker/shared';
import { audit } from '../../lib/audit';
import { fromDbDate } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { computeStats } from '../iterations/snapshots';
import { loadProjectAccess } from '../projects/access';
import { workItemKey } from '../workitems/access';
import { getPortfolio, getProjectInsights } from './insights.service';

type Col = { header: string; key: string; width: number };

function sheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: Col[],
  rows: Record<string, unknown>[],
) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  ws.addRows(rows);
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  if (rows.length)
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const finish = async (wb: ExcelJS.Workbook) =>
  Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

/** All visible projects with health - the replacement for the Excel tracker sheet. */
export async function exportPortfolio(user: Express.AuthUser): Promise<Buffer> {
  const rows = await getPortfolio(user);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Project Tracker';
  sheet(
    wb,
    'Portfolio',
    [
      { header: 'Key', key: 'key', width: 9 },
      { header: 'Project', key: 'name', width: 32 },
      { header: 'Category', key: 'category', width: 13 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Dev status', key: 'dev', width: 13 },
      { header: 'Health', key: 'health', width: 11 },
      { header: 'Why', key: 'reasons', width: 45 },
      { header: 'Open items', key: 'open', width: 11 },
      { header: 'Overdue', key: 'overdue', width: 9 },
      { header: 'Open bugs', key: 'bugs', width: 10 },
      { header: 'Critical bugs', key: 'critical', width: 12 },
      { header: 'Active sprint', key: 'sprint', width: 20 },
      { header: 'Sprint points', key: 'points', width: 12 },
      { header: 'Start', key: 'start', width: 11 },
      { header: 'Target', key: 'target', width: 11 },
      { header: 'Deployment', key: 'envs', width: 28 },
      { header: 'Last activity', key: 'activity', width: 17 },
    ],
    rows.map((r) => ({
      key: r.project.key,
      name: r.project.name,
      category: r.project.category?.name ?? '',
      priority: PRIORITY_LABELS[r.project.priority],
      status: PROJECT_STATUS_LABELS[r.project.status],
      dev: DEV_STATUS_LABELS[r.project.devStatus],
      health: HEALTH_LABELS[r.health.state],
      reasons: r.health.reasons.join('; '),
      open: r.openItems,
      overdue: r.overdueItems,
      bugs: r.openBugs,
      critical: r.openCriticalBugs,
      sprint: r.activeSprint?.name ?? '',
      points: r.activeSprint
        ? `${r.activeSprint.completedPoints}/${r.activeSprint.totalPoints}`
        : '',
      start: r.project.startDate ?? '',
      target: r.project.targetDate ?? '',
      envs: r.project.environments
        .map((e) => `${e.type}: ${e.status.toLowerCase().replace('_', ' ')}`)
        .join(', '),
      activity: r.lastActivity.replace('T', ' ').slice(0, 16),
    })),
  );
  audit({
    actorId: user.id,
    action: 'report.portfolio_exported',
    entity: 'project',
    metadata: { count: rows.length },
  });
  return finish(wb);
}

/** One project: summary + work items + bugs + sprints. */
export async function exportProjectReport(user: Express.AuthUser, projectId: string) {
  await loadProjectAccess(user, projectId);
  const [project, insights, items, sprints] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { category: true, owner: { select: { name: true } } },
    }),
    getProjectInsights(user, projectId),
    prisma.workItem.findMany({
      where: { projectId, state: { not: 'REMOVED' } },
      include: {
        assignee: { select: { name: true } },
        iteration: { select: { name: true } },
        parent: { select: { number: true } },
      },
      orderBy: { number: 'asc' },
    }),
    prisma.iteration.findMany({ where: { projectId }, orderBy: { startDate: 'asc' } }),
  ]);
  const stats = await computeStats(sprints.map((s) => s.id));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Project Tracker';

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 24 }, { width: 60 }];
  const add = (k: string, v: unknown) => summary.addRow([k, v]);
  summary.addRow([`${project.key} · ${project.name}`]).font = { bold: true, size: 14 };
  summary.addRow([
    `Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
  ]).font = { italic: true, color: { argb: 'FF64748B' } };
  summary.addRow([]);
  add('Health', HEALTH_LABELS[insights.health.state]);
  if (insights.health.reasons.length) add('Why', insights.health.reasons.join('; '));
  add('Status', PROJECT_STATUS_LABELS[project.status]);
  add('Development', DEV_STATUS_LABELS[project.devStatus]);
  add('Priority', PRIORITY_LABELS[project.priority]);
  add('Category', project.category?.name ?? '');
  add('Owner', project.owner?.name ?? '');
  add(
    'Start / target',
    `${fromDbDate(project.startDate) ?? '-'} / ${fromDbDate(project.targetDate) ?? '-'}`,
  );
  add('Open / total items', `${insights.counts.open} / ${insights.counts.total}`);
  add('Overdue items', insights.counts.overdue);
  add(
    'Open bugs by severity',
    insights.bugsBySeverity.map((b) => `${SEVERITY_LABELS[b.severity]}: ${b.count}`).join(', '),
  );
  if (insights.activeSprint) {
    add(
      'Active sprint',
      `${insights.activeSprint.name} (${insights.activeSprint.completedPoints}/${insights.activeSprint.totalPoints} points, ends ${insights.activeSprint.endDate})`,
    );
  }
  summary.getColumn(1).font = { bold: true };

  const itemRow = (w: (typeof items)[number]) => ({
    key: workItemKey(project.key, w.number),
    type: WORK_ITEM_TYPE_LABELS[w.type],
    title: w.title,
    state: WORK_ITEM_STATE_LABELS[w.state],
    priority: PRIORITY_LABELS[w.priority],
    severity: w.severity ? SEVERITY_LABELS[w.severity] : '',
    resolution: w.resolution ? RESOLUTION_LABELS[w.resolution] : '',
    assignee: w.assignee?.name ?? '',
    sprint: w.iteration?.name ?? '',
    parent: w.parent ? workItemKey(project.key, w.parent.number) : '',
    points: w.storyPoints ?? '',
    remaining: w.remainingWork ?? '',
    due: fromDbDate(w.dueDate) ?? '',
    tags: w.tags.join(', '),
    created: w.createdAt.toISOString().slice(0, 10),
    closed: w.closedAt?.toISOString().slice(0, 10) ?? '',
  });
  const itemCols: Col[] = [
    { header: 'Key', key: 'key', width: 11 },
    { header: 'Type', key: 'type', width: 11 },
    { header: 'Title', key: 'title', width: 48 },
    { header: 'State', key: 'state', width: 12 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Resolution', key: 'resolution', width: 14 },
    { header: 'Assigned to', key: 'assignee', width: 20 },
    { header: 'Sprint', key: 'sprint', width: 14 },
    { header: 'Parent', key: 'parent', width: 10 },
    { header: 'Points', key: 'points', width: 8 },
    { header: 'Remaining h', key: 'remaining', width: 11 },
    { header: 'Due', key: 'due', width: 11 },
    { header: 'Tags', key: 'tags', width: 20 },
    { header: 'Created', key: 'created', width: 11 },
    { header: 'Closed', key: 'closed', width: 11 },
  ];
  sheet(wb, 'Work items', itemCols, items.map(itemRow));
  sheet(wb, 'Bugs', itemCols, items.filter((w) => w.type === 'BUG').map(itemRow));
  sheet(
    wb,
    'Sprints',
    [
      { header: 'Sprint', key: 'name', width: 18 },
      { header: 'State', key: 'state', width: 11 },
      { header: 'Start', key: 'start', width: 11 },
      { header: 'End', key: 'end', width: 11 },
      { header: 'Items', key: 'items', width: 8 },
      { header: 'Points done', key: 'done', width: 11 },
      { header: 'Points total', key: 'total', width: 11 },
      { header: 'Remaining h', key: 'remaining', width: 11 },
      { header: 'Goal', key: 'goal', width: 40 },
    ],
    sprints.map((s) => {
      const st = stats.get(s.id)!;
      return {
        name: s.name,
        state: ITERATION_STATE_LABELS[s.state],
        start: fromDbDate(s.startDate),
        end: fromDbDate(s.endDate),
        items: st.items,
        done: st.completedPoints,
        total: st.totalPoints,
        remaining: st.remainingWork,
        goal: s.goal ?? '',
      };
    }),
  );
  audit({
    actorId: user.id,
    action: 'report.project_exported',
    entity: 'project',
    entityId: projectId,
  });
  return {
    buffer: await finish(wb),
    fileName: `${project.key}-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
}
