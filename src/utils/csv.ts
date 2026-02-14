import type { Milestone } from '../types';

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV(milestones: Milestone[]): string {
  const byId = new Map(milestones.map((m) => [m.id, m]));

  const headers = [
    'Title',
    'Description',
    'Status',
    'Start Date',
    'End Date',
    'Progress(%)',
    'Color',
    'Dependencies',
    'Parent Group',
  ];

  const rows = milestones.map((m) => {
    const deps = m.dependencies
      .map((id) => byId.get(id)?.title ?? id)
      .join('; ');
    const parent = m.parentId ? (byId.get(m.parentId)?.title ?? '') : '';

    return [
      escapeCSV(m.title),
      escapeCSV(m.description),
      m.status,
      m.startDate,
      m.endDate,
      String(m.progress),
      m.color,
      escapeCSV(deps),
      escapeCSV(parent),
    ].join(',');
  });

  // BOM for Excel UTF-8 compatibility
  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n') + '\n';
}
