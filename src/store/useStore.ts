import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Milestone, ProjectData, ViewMode } from '../types';
import type { Language } from '../i18n/translations';
import { createDefaultMilestone, generateId } from '../utils';

interface AppState {
  project: ProjectData;
  viewMode: ViewMode;
  selectedMilestoneId: string | null;
  selectedMilestoneIds: string[];
  editingMilestone: Milestone | null;
  showEditPanel: boolean;
  darkMode: boolean;
  language: Language;
  collapsedGroupIds: string[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  selectMilestone: (id: string | null) => void;
  selectMilestones: (ids: string[]) => void;
  toggleMilestoneSelection: (id: string) => void;
  clearSelection: () => void;
  addMilestone: (milestone?: Partial<Milestone>) => Milestone;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  addDependency: (milestoneId: string, dependsOnId: string) => void;
  removeDependency: (milestoneId: string, dependsOnId: string) => void;
  setEditingMilestone: (ms: Milestone | null) => void;
  setShowEditPanel: (show: boolean) => void;
  setProjectName: (name: string) => void;
  toggleDarkMode: () => void;
  setLanguage: (lang: Language) => void;
  loadSampleData: () => void;
  toggleGroupCollapse: (parentId: string) => void;
  reorderMilestone: (dragId: string, targetId: string, position: 'before' | 'after') => void;
}

const SAMPLE_MILESTONES: Milestone[] = [
  // Top-level milestones
  {
    id: 'ms_1',
    title: 'Project Kickoff',
    description: 'Initial project setup and team alignment',
    status: 'completed',
    startDate: '2026-01-05',
    endDate: '2026-01-12',
    color: '#3b82f6',
    progress: 100,
    dependencies: [],
    parentId: null,
  },
  {
    id: 'ms_2',
    title: 'Requirements Analysis',
    description: 'Gather and document all project requirements',
    status: 'completed',
    startDate: '2026-01-12',
    endDate: '2026-01-26',
    color: '#8b5cf6',
    progress: 100,
    dependencies: ['ms_1'],
    parentId: null,
  },
  // Frontend Group (parent)
  {
    id: 'ms_fe',
    title: 'Frontend',
    description: 'All frontend-related milestones',
    status: 'not_started',
    startDate: '2026-01-26',
    endDate: '2026-03-16',
    color: '#ec4899',
    progress: 0,
    dependencies: ['ms_2'],
    parentId: null,
  },
  // Frontend children
  {
    id: 'ms_3',
    title: 'UI/UX Design',
    description: 'Design wireframes and prototypes',
    status: 'in_progress',
    startDate: '2026-01-26',
    endDate: '2026-02-16',
    color: '#ec4899',
    progress: 65,
    dependencies: ['ms_2'],
    parentId: 'ms_fe',
  },
  {
    id: 'ms_5',
    title: 'Frontend Development',
    description: 'Implement the frontend application',
    status: 'not_started',
    startDate: '2026-02-16',
    endDate: '2026-03-16',
    color: '#22c55e',
    progress: 0,
    dependencies: ['ms_3'],
    parentId: 'ms_fe',
  },
  // Backend Group (parent)
  {
    id: 'ms_be',
    title: 'Backend',
    description: 'All backend-related milestones',
    status: 'not_started',
    startDate: '2026-01-26',
    endDate: '2026-03-09',
    color: '#f59e0b',
    progress: 0,
    dependencies: ['ms_2'],
    parentId: null,
  },
  // Backend children
  {
    id: 'ms_4',
    title: 'Backend Architecture',
    description: 'Design and implement backend infrastructure',
    status: 'in_progress',
    startDate: '2026-01-26',
    endDate: '2026-02-23',
    color: '#f59e0b',
    progress: 40,
    dependencies: ['ms_2'],
    parentId: 'ms_be',
  },
  {
    id: 'ms_6',
    title: 'API Integration',
    description: 'Connect frontend with backend services',
    status: 'not_started',
    startDate: '2026-02-23',
    endDate: '2026-03-09',
    color: '#06b6d4',
    progress: 0,
    dependencies: ['ms_4', 'ms_5'],
    parentId: 'ms_be',
  },
  // Top-level milestones
  {
    id: 'ms_7',
    title: 'Testing & QA',
    description: 'Comprehensive testing and quality assurance',
    status: 'not_started',
    startDate: '2026-03-09',
    endDate: '2026-03-23',
    color: '#f97316',
    progress: 0,
    dependencies: ['ms_6'],
    parentId: null,
  },
  {
    id: 'ms_8',
    title: 'Launch',
    description: 'Deploy to production and go live',
    status: 'not_started',
    startDate: '2026-03-23',
    endDate: '2026-03-30',
    color: '#e11d48',
    progress: 0,
    dependencies: ['ms_7'],
    parentId: null,
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      project: {
        id: generateId(),
        name: 'My Project',
        milestones: [],
      },
      viewMode: 'split',
      selectedMilestoneId: null,
      selectedMilestoneIds: [],
      editingMilestone: null,
      showEditPanel: false,
      darkMode: false,
      language: 'en' as Language,
      collapsedGroupIds: [],

      setViewMode: (mode) => set({ viewMode: mode }),

      selectMilestone: (id) => set({ selectedMilestoneId: id, selectedMilestoneIds: id ? [id] : [] }),

      selectMilestones: (ids) => set({ selectedMilestoneIds: ids, selectedMilestoneId: ids.length === 1 ? ids[0] : null }),

      toggleMilestoneSelection: (id) =>
        set((state) => {
          const ids = state.selectedMilestoneIds.includes(id)
            ? state.selectedMilestoneIds.filter((i) => i !== id)
            : [...state.selectedMilestoneIds, id];
          return { selectedMilestoneIds: ids, selectedMilestoneId: ids.length === 1 ? ids[0] : null };
        }),

      clearSelection: () => set({ selectedMilestoneId: null, selectedMilestoneIds: [] }),

      addMilestone: (overrides) => {
        const ms = createDefaultMilestone(overrides);
        set((state) => ({
          project: {
            ...state.project,
            milestones: [...state.project.milestones, ms],
          },
        }));
        return ms;
      },

      updateMilestone: (id, updates) =>
        set((state) => ({
          project: {
            ...state.project,
            milestones: state.project.milestones.map((m) =>
              m.id === id ? { ...m, ...updates } : m,
            ),
          },
        })),

      deleteMilestone: (id) =>
        set((state) => ({
          project: {
            ...state.project,
            milestones: state.project.milestones
              .filter((m) => m.id !== id)
              .map((m) => ({
                ...m,
                dependencies: m.dependencies.filter((d) => d !== id),
                // Orphan children: set parentId to null
                parentId: m.parentId === id ? null : m.parentId,
              })),
          },
          selectedMilestoneId:
            state.selectedMilestoneId === id ? null : state.selectedMilestoneId,
          selectedMilestoneIds: state.selectedMilestoneIds.filter((sid) => sid !== id),
          collapsedGroupIds: state.collapsedGroupIds.filter((gid) => gid !== id),
        })),

      addDependency: (milestoneId, dependsOnId) =>
        set((state) => ({
          project: {
            ...state.project,
            milestones: state.project.milestones.map((m) =>
              m.id === milestoneId && !m.dependencies.includes(dependsOnId)
                ? { ...m, dependencies: [...m.dependencies, dependsOnId] }
                : m,
            ),
          },
        })),

      removeDependency: (milestoneId, dependsOnId) =>
        set((state) => ({
          project: {
            ...state.project,
            milestones: state.project.milestones.map((m) =>
              m.id === milestoneId
                ? { ...m, dependencies: m.dependencies.filter((d) => d !== dependsOnId) }
                : m,
            ),
          },
        })),

      setEditingMilestone: (ms) => set({ editingMilestone: ms, showEditPanel: !!ms }),
      setShowEditPanel: (show) => set({ showEditPanel: show, editingMilestone: show ? get().editingMilestone : null }),
      setProjectName: (name) =>
        set((state) => ({ project: { ...state.project, name } })),

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setLanguage: (lang) => set({ language: lang }),

      loadSampleData: () =>
        set((state) => ({
          project: {
            ...state.project,
            milestones: SAMPLE_MILESTONES,
          },
          collapsedGroupIds: [],
        })),

      toggleGroupCollapse: (parentId) =>
        set((state) => ({
          collapsedGroupIds: state.collapsedGroupIds.includes(parentId)
            ? state.collapsedGroupIds.filter((id) => id !== parentId)
            : [...state.collapsedGroupIds, parentId],
        })),

      reorderMilestone: (dragId, targetId, position) =>
        set((state) => {
          if (dragId === targetId) return state;
          const milestones = state.project.milestones;
          const drag = milestones.find((m) => m.id === dragId);
          const target = milestones.find((m) => m.id === targetId);
          if (!drag || !target || drag.parentId !== target.parentId) return state;

          const byId = new Map(milestones.map((m) => [m.id, m]));
          const topLevel = milestones.filter((m) => m.parentId === null).map((m) => m.id);
          const childrenOf = new Map<string, string[]>();
          for (const m of milestones) {
            if (m.parentId) {
              if (!childrenOf.has(m.parentId)) childrenOf.set(m.parentId, []);
              childrenOf.get(m.parentId)!.push(m.id);
            }
          }

          const list = drag.parentId === null ? topLevel : (childrenOf.get(drag.parentId) || []);
          const dragIdx = list.indexOf(dragId);
          if (dragIdx === -1) return state;
          list.splice(dragIdx, 1);
          const tgtIdx = list.indexOf(targetId);
          if (tgtIdx === -1) return state;
          list.splice(position === 'before' ? tgtIdx : tgtIdx + 1, 0, dragId);

          const newMs: Milestone[] = [];
          for (const id of topLevel) {
            newMs.push(byId.get(id)!);
            for (const cid of (childrenOf.get(id) || [])) {
              newMs.push(byId.get(cid)!);
            }
          }
          return { project: { ...state.project, milestones: newMs } };
        }),
    }),
    {
      name: 'milestone-app-storage',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          const project = state.project as ProjectData | undefined;
          if (project?.milestones) {
            project.milestones = project.milestones.map((m) => ({
              ...m,
              parentId: (m as Milestone).parentId ?? null,
            }));
          }
          state.collapsedGroupIds = [];
        }
        if (version < 3) {
          state.selectedMilestoneIds = [];
        }
        return state as AppState;
      },
    },
  ),
);
