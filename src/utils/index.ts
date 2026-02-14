import type { Milestone, MilestoneStatus } from '../types';
import { MILESTONE_COLORS } from '../types';

export interface DisplayRow {
  milestone: Milestone;
  indent: number;
  isParent: boolean;
  isCollapsed: boolean;
}

export function generateId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultMilestone(overrides?: Partial<Milestone>): Milestone {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return {
    id: generateId(),
    title: 'New Milestone',
    description: '',
    status: 'not_started',
    startDate: today.toISOString().split('T')[0],
    endDate: nextWeek.toISOString().split('T')[0],
    color: MILESTONE_COLORS[Math.floor(Math.random() * MILESTONE_COLORS.length)],
    progress: 0,
    dependencies: [],
    parentId: null,
    ...overrides,
  };
}

export function getDaysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function formatDate(date: string, locale: string = 'en-US'): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateFull(date: string, locale: string = 'en-US'): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Find all milestones on the critical path (longest dependency chain) */
export function findCriticalPath(milestones: Milestone[]): Set<string> {
  const byId = new Map(milestones.map(m => [m.id, m]));
  const memo = new Map<string, { length: number; path: string[] }>();
  const visiting = new Set<string>();

  function longestPath(id: string): { length: number; path: string[] } {
    if (memo.has(id)) return memo.get(id)!;
    // Cycle detected — break the loop with a zero-length result
    if (visiting.has(id)) return { length: 0, path: [] };
    visiting.add(id);

    const ms = byId.get(id);
    if (!ms || ms.dependencies.length === 0) {
      const result = { length: getDaysBetween(ms?.startDate ?? '', ms?.endDate ?? ''), path: [id] };
      memo.set(id, result);
      visiting.delete(id);
      return result;
    }

    let best = { length: 0, path: [id] };
    for (const depId of ms.dependencies) {
      const sub = longestPath(depId);
      const total = sub.length + getDaysBetween(ms.startDate, ms.endDate);
      if (total > best.length) {
        best = { length: total, path: [...sub.path, id] };
      }
    }
    memo.set(id, best);
    visiting.delete(id);
    return best;
  }

  // Find the longest path across all milestones
  let criticalPath: string[] = [];
  let maxLen = 0;
  for (const m of milestones) {
    const result = longestPath(m.id);
    if (result.length > maxLen) {
      maxLen = result.length;
      criticalPath = result.path;
    }
  }

  return new Set(criticalPath);
}

/** Check if adding a dependency would create a cycle */
export function wouldCreateCycle(
  milestones: Milestone[],
  fromId: string,
  toId: string,
): boolean {
  const byId = new Map(milestones.map(m => [m.id, m]));
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (id === fromId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const ms = byId.get(id);
    if (!ms) return false;
    return ms.dependencies.some(depId => dfs(depId));
  }

  return dfs(toId);
}

/** Get children of a parent milestone */
export function getChildren(milestones: Milestone[], parentId: string): Milestone[] {
  return milestones.filter(m => m.parentId === parentId);
}

/** Compute aggregated dates/progress/status for a parent from its children */
export function computeParentAggregation(milestones: Milestone[], parentId: string): {
  startDate: string;
  endDate: string;
  progress: number;
  status: MilestoneStatus;
} {
  const children = getChildren(milestones, parentId);
  if (children.length === 0) {
    const parent = milestones.find(m => m.id === parentId)!;
    return { startDate: parent.startDate, endDate: parent.endDate, progress: parent.progress, status: parent.status };
  }

  const startDate = children.reduce((min, c) => c.startDate < min ? c.startDate : min, children[0].startDate);
  const endDate = children.reduce((max, c) => c.endDate > max ? c.endDate : max, children[0].endDate);

  // Weighted average progress by duration
  let totalDuration = 0;
  let weightedProgress = 0;
  for (const c of children) {
    const dur = Math.max(getDaysBetween(c.startDate, c.endDate), 1);
    totalDuration += dur;
    weightedProgress += dur * c.progress;
  }
  const progress = totalDuration > 0 ? Math.round(weightedProgress / totalDuration) : 0;

  // Status aggregation
  let status: MilestoneStatus;
  const statuses = children.map(c => c.status);
  if (statuses.every(s => s === 'completed')) {
    status = 'completed';
  } else if (statuses.some(s => s === 'blocked')) {
    status = 'blocked';
  } else if (statuses.some(s => s === 'at_risk')) {
    status = 'at_risk';
  } else if (statuses.some(s => s === 'in_progress')) {
    status = 'in_progress';
  } else {
    status = 'not_started';
  }

  return { startDate, endDate, progress, status };
}

/** Return milestone with aggregated values if it has children, otherwise return as-is */
export function getEffectiveMilestone(milestones: Milestone[], ms: Milestone): Milestone {
  const children = getChildren(milestones, ms.id);
  if (children.length === 0) return ms;
  const agg = computeParentAggregation(milestones, ms.id);
  return { ...ms, ...agg };
}

/** Build a flat display list for Timeline: parents before children, with indent info */
export function buildDisplayList(milestones: Milestone[], collapsedIds: string[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const childrenOf = new Map<string, Milestone[]>();

  // Group children by parentId
  for (const ms of milestones) {
    if (ms.parentId) {
      if (!childrenOf.has(ms.parentId)) childrenOf.set(ms.parentId, []);
      childrenOf.get(ms.parentId)!.push(ms);
    }
  }

  // Iterate: top-level milestones (no parentId), inserting children after parent
  for (const ms of milestones) {
    if (ms.parentId) continue; // skip children, they are inserted under their parent
    const children = childrenOf.get(ms.id);
    const isParent = !!children && children.length > 0;
    const isCollapsed = collapsedIds.includes(ms.id);

    rows.push({
      milestone: isParent ? getEffectiveMilestone(milestones, ms) : ms,
      indent: 0,
      isParent,
      isCollapsed,
    });

    if (isParent && !isCollapsed) {
      for (const child of children) {
        rows.push({
          milestone: child,
          indent: 1,
          isParent: false,
          isCollapsed: false,
        });
      }
    }
  }

  return rows;
}

/** Validate whether candidateParentId can be a parent of childId (1 level only) */
export function canBeParent(milestones: Milestone[], candidateParentId: string, childId: string): boolean {
  // Can't parent yourself
  if (candidateParentId === childId) return false;
  // The candidate must not already be a child of someone (1 level only)
  const candidate = milestones.find(m => m.id === candidateParentId);
  if (!candidate || candidate.parentId) return false;
  // The child must not already have children (would create 2+ levels)
  const childHasChildren = milestones.some(m => m.parentId === childId);
  if (childHasChildren) return false;
  return true;
}
