import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type Konva from 'konva';
import type { CanvasComponent, PathData } from '@/types';

let _stageRef: Konva.Stage | null = null;

// 撤销/重做历史
interface HistoryEntry {
  components: CanvasComponent[];
  selectedId: string | null;
}

const MAX_HISTORY = 50;
let _history: HistoryEntry[] = [];
let _historyIndex = -1;

interface CanvasStore {
  stageWidth: number;
  stageHeight: number;
  zoom: number;
  components: CanvasComponent[];
  selectedId: string | null;
  isDirty: boolean;
  lastSavedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;

  getStageRef: () => Konva.Stage | null;
  setStageRef: (stage: Konva.Stage | null) => void;
  setStageSize: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
  addComponent: (component: CanvasComponent) => void;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, updates: Partial<CanvasComponent>) => void;
  setSelectedId: (id: string | null) => void;
  updateComponentPaths: (id: string, paths: PathData[]) => void;
  applyMaterial: (componentId: string, materialId: string, paths: PathData[]) => void;
  clearCanvas: () => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  loadComponents: (components: CanvasComponent[]) => void;
}

function snapshotState(components: CanvasComponent[], selectedId: string | null): HistoryEntry {
  return { components: JSON.parse(JSON.stringify(components)), selectedId };
}

export const useCanvasStore = create<CanvasStore>()(
  immer((set, get) => ({
    stageWidth: 800,
    stageHeight: 1000,
    zoom: 1,
    components: [],
    selectedId: null,
    isDirty: false,
    lastSavedAt: null,
    canUndo: false,
    canRedo: false,

    getStageRef: () => _stageRef,
    setStageRef: (stage) => {
      _stageRef = stage;
    },

    setStageSize: (width, height) =>
      set((state) => {
        state.stageWidth = width;
        state.stageHeight = height;
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(0.1, Math.min(5, zoom));
      }),

    pushHistory: () => {
      const { components, selectedId } = get();
      const entry = snapshotState(components, selectedId);
      // 丢弃当前位置之后的历史
      _history = _history.slice(0, _historyIndex + 1);
      _history.push(entry);
      if (_history.length > MAX_HISTORY) _history.shift();
      _historyIndex = _history.length - 1;
      set({ canUndo: _historyIndex > 0, canRedo: false });
    },

    addComponent: (component) =>
      set((state) => {
        state.components.push(component);
        state.selectedId = component.id;
        state.isDirty = true;
      }),

    removeComponent: (id) =>
      set((state) => {
        state.components = state.components.filter((c) => c.id !== id);
        if (state.selectedId === id) state.selectedId = null;
        state.isDirty = true;
      }),

    updateComponent: (id, updates) =>
      set((state) => {
        const idx = state.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          Object.assign(state.components[idx], updates);
          state.isDirty = true;
        }
      }),

    setSelectedId: (id) =>
      set((state) => {
        state.selectedId = id;
      }),

    updateComponentPaths: (id, paths) =>
      set((state) => {
        const idx = state.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          state.components[idx].paths = paths;
          state.isDirty = true;
        }
      }),

    applyMaterial: (componentId, materialId, paths) =>
      set((state) => {
        const idx = state.components.findIndex((c) => c.id === componentId);
        if (idx !== -1) {
          state.components[idx].materialId = materialId;
          state.components[idx].paths = paths;
          state.isDirty = true;
        }
      }),

    clearCanvas: () =>
      set((state) => {
        state.components = [];
        state.selectedId = null;
        state.isDirty = true;
      }),

    markSaved: () =>
      set((state) => {
        state.isDirty = false;
        state.lastSavedAt = Date.now();
      }),

    undo: () => {
      if (_historyIndex <= 0) return;
      _historyIndex--;
      const entry = _history[_historyIndex];
      set({
        components: JSON.parse(JSON.stringify(entry.components)),
        selectedId: entry.selectedId,
        isDirty: true,
        canUndo: _historyIndex > 0,
        canRedo: _historyIndex < _history.length - 1,
      });
    },

    redo: () => {
      if (_historyIndex >= _history.length - 1) return;
      _historyIndex++;
      const entry = _history[_historyIndex];
      set({
        components: JSON.parse(JSON.stringify(entry.components)),
        selectedId: entry.selectedId,
        isDirty: true,
        canUndo: _historyIndex > 0,
        canRedo: _historyIndex < _history.length - 1,
      });
    },

    loadComponents: (components) =>
      set((state) => {
        state.components = components;
        state.selectedId = null;
        state.isDirty = false;
      }),
  }))
);
