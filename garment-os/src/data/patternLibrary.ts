/** Canonical template catalogue. Retired/blocked entries contain no executable legacy blocks. */
import type { PatternDefinition } from '@/lib/patterns/types';
import { PATTERN_REVIEWS, isReferencePattern } from './patternReview';

const definitions: Array<[string, string, PatternDefinition['category'], string[]]> = [
  ['elastic-waist-pants','松紧腰直筒基础裤 · Paco','pants',['paco.front','paco.back','paco.waistband']],
  ['panel-circle-skirt','分幅圆裙 · Sandy','skirt',['sandy.skirt','sandy.waistband']],
  ['bound-tank','包边背心 · Aaron','t-shirt',['aaron.front','aaron.back','aaron.neckBinding','aaron.armBinding']],
  ['hooded-zip-sweatshirt','开襟连帽卫衣 · Huey','hoodie',['huey.front','huey.back','huey.sleeve','huey.pocket','huey.hood','huey.waistband','huey.cuff']],
  ['brian-reference', 'Brian 参数化参考基型', 't-shirt', ['bodice-brian', 'sleeve-brian']],
  ['t-shirt', '圆领短袖 T 恤 · Teagan', 't-shirt', ['teagan.front', 'teagan.back', 'teagan.sleeve']],
  ['womens-basic-tee', '收腰针织 T 恤 · Teagan', 't-shirt', ['teagan.front', 'teagan.back', 'teagan.sleeve']],
  ['long-sleeve-tee', '长袖针织上衣 · Sven', 't-shirt', ['sven.front', 'sven.back', 'sven.sleeve']],
  ['button-up-shirt', '男装长袖衬衫 · Simon', 'shirt', ['simon.frontRight', 'simon.frontLeft', 'simon.back', 'simon.yoke', 'simon.sleeve', 'simon.collar', 'simon.collarStand', 'simon.cuff', 'simon.sleevePlacketOverlap', 'simon.sleevePlacketUnderlap']],
  ['t-shirt-pro', '旧 T-Shirt Pro · 已合并', 't-shirt', []],
  ['v-neck-tee', 'V 领 T 恤 · 待重建', 't-shirt', []],
  ['polo-shirt', '短袖 Polo · 待重建', 'polo', []],
  ['long-sleeve-polo', '长袖 Polo · 待重建', 'polo', []],
  ['womens-blouse', '女装梭织衬衫 · 待重建', 'shirt', []],
];
export const PATTERN_LIBRARY: Readonly<Record<string, PatternDefinition>> = Object.freeze(Object.fromEntries(definitions.map(([id, name, category, blockIds]) => {
  const review = PATTERN_REVIEWS[id];
  const blocks = blockIds.map(blockId => Object.freeze({ blockId }));
  const def: PatternDefinition = { id, name, category, description: `${review.reason} ${review.limitations}`, blocks, defaultParams: { fit: 'regular', seamAllowance: 10 } };
  Object.freeze(blocks); Object.freeze(def.defaultParams);
  return [id, Object.freeze(def)];
})));
export const PATTERN_CATEGORIES: Array<{ id: PatternDefinition['category']; label: string }> = [
  { id: 't-shirt', label: '针织 / 基型' }, { id: 'polo', label: 'Polo' }, { id: 'shirt', label: '衬衫' },
  { id:'hoodie',label:'连帽卫衣' },
  { id:'skirt',label:'裙装' },{id:'pants',label:'基础裤装'},
];
export function listPatterns(): PatternDefinition[] { return Object.values(PATTERN_LIBRARY); }
export function listExecutablePatterns(): PatternDefinition[] { return listPatterns().filter(p => isReferencePattern(p.id)); }
export function assertCanonicalPattern(pattern: PatternDefinition): void {
  if (!PATTERN_LIBRARY[pattern.id] || JSON.stringify(pattern) !== JSON.stringify(PATTERN_LIBRARY[pattern.id])) {
    throw new Error('导入模板与已审查定义不同，不能覆盖标准库；请先完成构型审查');
  }
}
