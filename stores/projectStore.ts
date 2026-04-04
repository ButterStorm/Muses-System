import { create } from 'zustand';
import * as projectService from '@/services/projectService';
import type { Project } from '@/services/projectService';

interface ProjectState {
  currentProject: { id: string; name: string } | null;
  isDirty: boolean;
  isSaving: boolean;

  setCurrentProject: (project: { id: string; name: string } | null) => void;
  setDirty: (dirty: boolean) => void;

  createProject: (userId: string, name?: string) => Promise<Project>;
  loadProject: (id: string) => Promise<Project['flow_data'] | null>;
  saveProject: (flowData: Project['flow_data']) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  isDirty: false,
  isSaving: false,

  setCurrentProject: (project) => set({ currentProject: project, isDirty: false }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  createProject: async (userId, name) => {
    const project = await projectService.createProject(userId, name);
    set({ currentProject: { id: project.id, name: project.name }, isDirty: false });
    return project;
  },

  loadProject: async (id) => {
    const project = await projectService.getProject(id);
    set({ currentProject: { id: project.id, name: project.name }, isDirty: false });
    return project.flow_data;
  },

  saveProject: async (flowData) => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({ isSaving: true });
    try {
      await projectService.saveProject(currentProject.id, flowData);
      set({ isDirty: false });
    } finally {
      set({ isSaving: false });
    }
  },

  deleteProject: async (id) => {
    await projectService.deleteProject(id);
    const { currentProject } = get();
    if (currentProject?.id === id) {
      set({ currentProject: null, isDirty: false });
    }
  },

  renameProject: async (id, name) => {
    await projectService.renameProject(id, name);
    const { currentProject } = get();
    if (currentProject?.id === id) {
      set({ currentProject: { ...currentProject, name } });
    }
  },
}));
