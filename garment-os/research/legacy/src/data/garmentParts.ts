/**
 * 服装部件定义 — 聚合入口
 * 各部件变体数据已拆分至 parts/ 目录:
 * - parts/body.ts
 * - parts/collar.ts
 * - parts/sleeve.ts
 * - parts/pocket.ts
 * - parts/placket.ts
 * - parts/cuff.ts
 */

import { BODY_VARIANTS } from './parts/body';
import { COLLAR_VARIANTS } from './parts/collar';
import { SLEEVE_VARIANTS } from './parts/sleeve';
import { POCKET_VARIANTS } from './parts/pocket';
import { PLACKET_VARIANTS } from './parts/placket';
import { CUFF_VARIANTS } from './parts/cuff';

export type PartType = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';

export interface PartVariant {
  id: string;
  name: string;
  frontPath: string;
  backPath: string;
  zIndex: number;
  filled?: boolean;
  details?: string;
  backDetails?: string;
}

export interface PartCategory {
  type: PartType;
  label: string;
  labelEn: string;
  icon: string;
  variants: PartVariant[];
}

/* ═══════════════════════════════════════════
   导出部件分类
   ═══════════════════════════════════════════ */
export const PART_CATEGORIES: PartCategory[] = [
  { type: 'body', label: '衣身', labelEn: 'Body', icon: 'body', variants: BODY_VARIANTS },
  { type: 'collar', label: '衣领', labelEn: 'Collar', icon: 'collar', variants: COLLAR_VARIANTS },
  { type: 'sleeve', label: '袖子', labelEn: 'Sleeve', icon: 'sleeve', variants: SLEEVE_VARIANTS },
  { type: 'pocket', label: '口袋', labelEn: 'Pocket', icon: 'pocket', variants: POCKET_VARIANTS },
  { type: 'placket', label: '门襟', labelEn: 'Placket', icon: 'placket', variants: PLACKET_VARIANTS },
  { type: 'cuff', label: '袖口', labelEn: 'Cuff', icon: 'cuff', variants: CUFF_VARIANTS },
];

/** 默认选中的部件变体 */
export const DEFAULT_SELECTION: Record<PartType, string> = {
  body: 'body-regular',
  collar: 'collar-round',
  sleeve: 'sleeve-long',
  pocket: 'pocket-none',
  placket: 'placket-none',
  cuff: 'cuff-plain',
};

/** 替换某个部件的 SVG 路径数据 */
export function replacePartVariant(
  partType: PartType,
  variantId: string,
  newPath: { frontPath: string; backPath: string }
): void {
  const category = PART_CATEGORIES.find((c) => c.type === partType);
  if (!category) return;
  const variant = category.variants.find((v) => v.id === variantId);
  if (!variant) return;
  variant.frontPath = newPath.frontPath;
  variant.backPath = newPath.backPath;
}

/** 添加新的部件变体 */
export function addPartVariant(
  partType: PartType,
  variant: PartVariant
): void {
  const category = PART_CATEGORIES.find((c) => c.type === partType);
  if (!category) return;
  if (category.variants.some((v) => v.id === variant.id)) return;
  category.variants.push(variant);
}
