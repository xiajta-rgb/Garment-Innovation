import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Template, ComponentCategory } from '@/types';

interface TemplateStore {
  templates: Template[];
  loading: boolean;
  activeCategory: ComponentCategory;
  searchQuery: string;

  setActiveCategory: (category: ComponentCategory) => void;
  setSearchQuery: (query: string) => void;
  fetchTemplates: (category: ComponentCategory) => Promise<void>;
  getFilteredTemplates: () => Template[];
}

// 模拟模板数据（后续替换为 API/SQLite 数据源）
const MOCK_TEMPLATES: Template[] = [
  {
    id: 'tpl-body-001',
    name: '修身衣身',
    category: 'body',
    subCategory: 'slim',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M200,50 L350,50 L380,400 L170,400 Z', fill: '#f0f0f0', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '衣身', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-body-002',
    name: '宽松衣身',
    category: 'body',
    subCategory: 'loose',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M180,50 L370,50 L400,400 L150,400 Z', fill: '#f0f0f0', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '衣身', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-collar-001',
    name: '方领',
    category: 'collar',
    subCategory: 'square',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M240,50 L310,50 L310,90 L240,90 Z', fill: '#e8e8e8', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '领子', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-collar-002',
    name: '圆领',
    category: 'collar',
    subCategory: 'round',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M245,50 Q275,80 305,50', fill: '#e8e8e8', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '领子', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-sleeve-001',
    name: '长袖',
    category: 'sleeve',
    subCategory: 'long',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M170,80 L100,80 L80,350 L150,350 Z', fill: '#f5f5f5', stroke: '#333', strokeWidth: 1 },
        { data: 'M380,80 L450,80 L470,350 L400,350 Z', fill: '#f5f5f5', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '袖子', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-sleeve-002',
    name: '短袖',
    category: 'sleeve',
    subCategory: 'short',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M170,80 L120,80 L110,200 L160,200 Z', fill: '#f5f5f5', stroke: '#333', strokeWidth: 1 },
        { data: 'M380,80 L430,80 L440,200 L390,200 Z', fill: '#f5f5f5', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '袖子', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-pocket-001',
    name: '贴袋',
    category: 'pocket',
    subCategory: 'patch',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M220,200 L280,200 L280,260 L220,260 Z', fill: '#e0e0e0', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '口袋', materialType: '主面料' }]),
    version: 1,
  },
  {
    id: 'tpl-pocket-002',
    name: '插袋',
    category: 'pocket',
    subCategory: 'slash',
    thumbnail: '',
    canvasData: JSON.stringify({
      paths: [
        { data: 'M210,250 L290,250 L285,260 L215,260 Z', fill: '#e0e0e0', stroke: '#333', strokeWidth: 1 },
      ],
    }),
    defaultBomItems: JSON.stringify([{ componentName: '口袋', materialType: '主面料' }]),
    version: 1,
  },
];

export const useTemplateStore = create<TemplateStore>()(
  immer((set, get) => ({
    templates: MOCK_TEMPLATES,
    loading: false,
    activeCategory: 'body',
    searchQuery: '',

    setActiveCategory: (category) =>
      set((state) => {
        state.activeCategory = category;
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query;
      }),

    fetchTemplates: async (category) => {
      set((state) => {
        state.loading = true;
        state.activeCategory = category;
      });
      // 模拟异步加载（后续替换为 SQLite/API 查询）
      await new Promise((r) => setTimeout(r, 200));
      set((state) => {
        state.loading = false;
      });
    },

    getFilteredTemplates: () => {
      const { templates, activeCategory, searchQuery } = get();
      let filtered = templates.filter((t) => t.category === activeCategory);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
      }
      return filtered;
    },
  }))
);
