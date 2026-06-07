import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { BomItem, Material } from '@/types';
import { calculateCost } from '@/lib/bom-engine/calculator';

interface BomStore {
  items: BomItem[];

  addBomItem: (item: BomItem) => void;
  removeBomItem: (id: string) => void;
  updateBomItemMaterial: (componentId: string, material: Material) => void;
  addDefaultBomItems: (defaultItemsJson: string) => void;
  clearBom: () => void;
  getTotalCost: () => number;
  getTotalUsage: () => number;
}

export const useBomStore = create<BomStore>()(
  immer((set, get) => ({
    items: [],

    addBomItem: (item) =>
      set((state) => {
        state.items.push(item);
      }),

    removeBomItem: (id) =>
      set((state) => {
        state.items = state.items.filter((i) => i.id !== id);
      }),

    updateBomItemMaterial: (componentId, material) =>
      set((state) => {
        const idx = state.items.findIndex((i) => i.componentId === componentId);
        if (idx !== -1) {
          const item = state.items[idx];
          item.material = material;
          item.cost = calculateCost(item.usage, material.pricePerMeter);
        }
      }),

    addDefaultBomItems: (defaultItemsJson) => {
      try {
        const defaults = JSON.parse(defaultItemsJson);
        // 占位：后续根据实际面料和用量计算
        defaults.forEach((d: { componentName: string; materialType: string }) => {
          set((state) => {
            const exists = state.items.some((i) => i.componentName === d.componentName);
            if (!exists) {
              state.items.push({
                id: `bom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                garmentId: '',
                componentId: '',
                componentName: d.componentName,
                material: {
                  id: '',
                  assetCode: '',
                  name: d.materialType,
                  category: '',
                  imageUrl: '',
                  widthMm: 1500,
                  weightGsm: 0,
                  pricePerMeter: 0,
                  lossRate: 0.12,
                },
                usage: 0,
                unit: 'm',
                cost: 0,
              });
            }
          });
        });
      } catch {
        // 解析失败忽略
      }
    },

    clearBom: () =>
      set((state) => {
        state.items = [];
      }),

    getTotalCost: () => get().items.reduce((sum, i) => sum + i.cost, 0),
    getTotalUsage: () => get().items.reduce((sum, i) => sum + i.usage, 0),
  }))
);
