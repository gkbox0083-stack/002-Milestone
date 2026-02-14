export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'at_risk' | 'blocked';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  startDate: string; // ISO date string
  endDate: string;
  color: string;
  progress: number; // 0-100
  dependencies: string[]; // IDs of milestones this depends on
  parentId: string | null; // ID of parent milestone (1-level grouping)
}

export interface ProjectData {
  id: string;
  name: string;
  milestones: Milestone[];
}

export type ViewMode = 'timeline' | 'network' | 'split' | 'table';

export const STATUS_COLORS: Record<MilestoneStatus, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  at_risk: '#f59e0b',
  blocked: '#ef4444',
};

export const STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  at_risk: 'At Risk',
  blocked: 'Blocked',
};

export const MILESTONE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e',
  '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];
