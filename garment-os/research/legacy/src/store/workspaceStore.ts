import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Workspace, Garment, SyncStatus } from '@/types';

interface WorkspaceStore {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  garments: Garment[];
  syncStatus: SyncStatus;

  setCurrentWorkspace: (id: string) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: string) => void;
  addGarment: (garment: Garment) => void;
  removeGarment: (id: string) => void;
  updateGarment: (id: string, updates: Partial<Garment>) => void;
  setSyncStatus: (status: SyncStatus) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  immer((set) => ({
    workspaces: [
      {
        id: 'ws-default',
        name: '默认工作空间',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSynced: false,
        lastSyncVersion: 0,
      },
    ],
    currentWorkspaceId: 'ws-default',
    garments: [],
    syncStatus: 'idle',

    setCurrentWorkspace: (id) =>
      set((state) => {
        state.currentWorkspaceId = id;
      }),

    addWorkspace: (workspace) =>
      set((state) => {
        state.workspaces.push(workspace);
      }),

    removeWorkspace: (id) =>
      set((state) => {
        state.workspaces = state.workspaces.filter((w) => w.id !== id);
        if (state.currentWorkspaceId === id) {
          state.currentWorkspaceId = state.workspaces[0]?.id ?? null;
        }
      }),

    addGarment: (garment) =>
      set((state) => {
        state.garments.push(garment);
      }),

    removeGarment: (id) =>
      set((state) => {
        state.garments = state.garments.filter((g) => g.id !== id);
      }),

    updateGarment: (id, updates) =>
      set((state) => {
        const idx = state.garments.findIndex((g) => g.id === id);
        if (idx !== -1) {
          Object.assign(state.garments[idx], updates);
        }
      }),

    setSyncStatus: (status) =>
      set((state) => {
        state.syncStatus = status;
      }),
  }))
);
