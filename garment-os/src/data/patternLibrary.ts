/**
 * Pattern Library (模式库)
 *
 * 真实服装模板, 每个都是一组 Block 的具体组合
 * 与旧版"geneLibrary" (preset → parameterValues) 根本不同:
 *  - 不同 Pattern → 不同 Block 集合 → 不同几何 → 视觉清晰不同
 *  - 共享 Bodice Block 仍可定制参数
 */

import type { PatternDefinition } from '@/lib/patterns/types';

/**
 * 通用默认参数 (从 size chart 推导后的男女默认值)
 * UI 切换 size 时会被 setSize action 覆盖
 */
const MENS_REGULAR_DEFAULTS = {
  gender: 'male' as const,
  shoulderWidth: 38,
  armholeDepth: 23,
  waistY: 44,
  hipY: 62,
  hemLength: 70,
  hemWidth: 24,
  neckFrontY: 14,
  shoulderY: 12,
  waistSuppression: 0,
  collarType: 'round',
  collarSpread: 18,
  collarHeight: 3,
  sleeveLength: 30,
  cuffWidth: 6,
  sleeveType: 'short',
  cuffType: 'plain',
  cuffHeight: 3,
  placketType: 'none',
  placketWidth: 0,
  buttonCount: 0,
  pocketType: 'none',
  pocketWidth: 13,
  pocketHeight: 15,
  pocketY: 0,
};

const WOMENS_REGULAR_DEFAULTS = {
  gender: 'female' as const,
  shoulderWidth: 39,
  armholeDepth: 20.5,
  waistY: 40,
  hipY: 62,
  hemLength: 64,
  hemWidth: 24,
  neckFrontY: 14,
  shoulderY: 12,
  waistSuppression: 2,
  collarType: 'round',
  collarSpread: 17,
  collarHeight: 2.5,
  sleeveLength: 22,
  cuffWidth: 5,
  sleeveType: 'short',
  cuffType: 'plain',
  cuffHeight: 2,
  placketType: 'none',
  placketWidth: 0,
  buttonCount: 0,
  pocketType: 'none',
  pocketWidth: 12,
  pocketHeight: 14,
  pocketY: 0,
};

/**
 * 1. T-Shirt (圆领短袖) - 最基础模板
 *  - Bodice + Short Sleeve + Round Neck
 *  - 无门襟, 无袖口
 */
const T_SHIRT: PatternDefinition = {
  id: 't-shirt',
  name: 'T-Shirt',
  description: '圆领短袖 T 恤, 最基础的上装模板',
  category: 't-shirt',
  blocks: [
    { blockId: 'bodice-basic' },
    { blockId: 'sleeve-set-in' },
    { blockId: 'collar-mandarin', params: { collarType: 'round', collarHeight: 0 } },
    { blockId: 'pocket-none' },
  ],
  defaultParams: MENS_REGULAR_DEFAULTS,
};

/**
 * 2. V-Neck T-Shirt (V 领短袖)
 *  - Bodice + Short Sleeve + V Neck
 *  - V 领由 Bodice 轮廓直接整合
 */
const V_NECK_TEE: PatternDefinition = {
  id: 'v-neck-tee',
  name: 'V-Neck T-Shirt',
  description: 'V 领短袖 T 恤, 大身轮廓直接整合 V 形领口',
  category: 't-shirt',
  blocks: [
    { blockId: 'bodice-basic', params: { collarType: 'v' } },
    { blockId: 'sleeve-set-in' },
    { blockId: 'pocket-none' },
  ],
  defaultParams: MENS_REGULAR_DEFAULTS,
};

/**
 * 3. Polo Shirt (Polo 衫)
 *  - Bodice + Short Sleeve + Mandarin Collar + Center Placket
 *  - 有门襟 (3 粒扣) + 立领 + 短袖
 */
const POLO: PatternDefinition = {
  id: 'polo-shirt',
  name: 'Polo Shirt',
  description: '立领 + 中开襟 + 短袖, 含门襟结构和立领独立部件',
  category: 'polo',
  blocks: [
    { blockId: 'bodice-basic', params: { collarType: 'mandarin' } },
    { blockId: 'sleeve-set-in' },
    { blockId: 'collar-mandarin', params: { collarType: 'mandarin', collarHeight: 5 } },
    { blockId: 'placket-center', params: { placketType: 'center', placketWidth: 8, buttonCount: 3 } },
    { blockId: 'pocket-none' },
  ],
  defaultParams: MENS_REGULAR_DEFAULTS,
};

/**
 * 4. Button-Up Shirt (纽扣衬衫)
 *  - Bodice + Long Sleeve + Mandarin Collar + Plain Cuff + Center Placket
 *  - 完整衬衫结构: 长袖 + 袖口 + 立领 + 5 粒扣门襟
 */
const BUTTON_UP: PatternDefinition = {
  id: 'button-up-shirt',
  name: 'Button-Up Shirt',
  description: '立领 + 长袖 + 袖口 + 5 粒扣门襟, 完整衬衫结构',
  category: 'shirt',
  blocks: [
    { blockId: 'bodice-basic', params: { collarType: 'mandarin', hemLength: 78 } },
    { blockId: 'sleeve-set-in', params: { sleeveType: 'long', sleeveLength: 60 } },
    { blockId: 'collar-mandarin', params: { collarType: 'mandarin', collarHeight: 7 } },
    { blockId: 'cuff-plain', params: { cuffType: 'plain', cuffHeight: 5 } },
    { blockId: 'placket-center', params: { placketType: 'center', placketWidth: 10, buttonCount: 5 } },
    { blockId: 'pocket-patch', params: { pocketType: 'patch', pocketWidth: 12, pocketHeight: 14 } },
  ],
  defaultParams: MENS_REGULAR_DEFAULTS,
};

/**
 * 5. Womens Blouse (女衬衫)
 *  - Bodice + Short Sleeve + Round Neck + 无门襟 + 贴袋
 *  - 女款专用参数 (含腰省)
 */
const WOMENS_BLOUSE: PatternDefinition = {
  id: 'womens-blouse',
  name: "Women's Blouse",
  description: '女款圆领短袖衬衫, 含腰省修身 + 贴袋',
  category: 'shirt',
  blocks: [
    { blockId: 'bodice-basic', params: { collarType: 'round' } },
    { blockId: 'sleeve-set-in', params: { sleeveType: 'short' } },
    { blockId: 'collar-mandarin', params: { collarType: 'round', collarHeight: 0 } },
    { blockId: 'pocket-patch', params: { pocketType: 'patch' } },
  ],
  defaultParams: WOMENS_REGULAR_DEFAULTS,
};

/** 模式库 (按 ID 索引) */
export const PATTERN_LIBRARY: Record<string, PatternDefinition> = {
  [T_SHIRT.id]:        T_SHIRT,
  [V_NECK_TEE.id]:     V_NECK_TEE,
  [POLO.id]:           POLO,
  [BUTTON_UP.id]:      BUTTON_UP,
  [WOMENS_BLOUSE.id]:  WOMENS_BLOUSE,
};

/** 列出所有模式 */
export function listPatterns(): PatternDefinition[] {
  return Object.values(PATTERN_LIBRARY);
}

/** 按类别列出 */
export function listPatternsByCategory(cat: PatternDefinition['category']): PatternDefinition[] {
  return listPatterns().filter((p) => p.category === cat);
}

/** 模式库分类汇总 (UI 渲染用) */
export const PATTERN_CATEGORIES: Array<{ id: PatternDefinition['category']; label: string }> = [
  { id: 't-shirt', label: 'T-Shirt' },
  { id: 'polo',    label: 'Polo' },
  { id: 'shirt',   label: 'Shirt' },
  { id: 'jacket',  label: 'Jacket' },
  { id: 'dress',   label: 'Dress' },
  { id: 'skirt',   label: 'Skirt' },
  { id: 'pants',   label: 'Pants' },
];
