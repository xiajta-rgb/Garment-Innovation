import type { ComponentCategory } from './canvas';

// 模板定义
export interface Template {
  id: string;
  name: string;
  category: ComponentCategory;
  subCategory: string;
  thumbnail: string;       // 缩略图 URL
  canvasData: string;      // Konva.js 序列化 JSON（含 paths）
  defaultBomItems: string; // JSON 字符串，默认 BOM 项
  version: number;
  tags?: string[];
}

// 模板分类
export interface TemplateCategory {
  key: ComponentCategory;
  label: string;
  icon?: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { key: 'body', label: '衣身' },
  { key: 'collar', label: '领子' },
  { key: 'sleeve', label: '袖子' },
  { key: 'pocket', label: '口袋' },
  { key: 'placket', label: '门襟' },
  { key: 'cuff', label: '袖口' },
];
