/**
 * 男款预设数据
 * 从 geneLibrary.ts 拆分
 */

import type { GenePreset } from '../geneLibrary';

export const MALE_BODY_PRESETS: GenePreset[] = [
  { id: 'male-body-slim', name: '修身', category: 'body', gender: 'male', parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 36, armholeDepth: 96, waistY: 142, waistSuppression: 6, hipY: 174, hemLength: 224, hemWidth: 38 } },
  { id: 'male-body-regular', name: '合身', category: 'body', gender: 'male', parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 40, armholeDepth: 96, waistY: 142, waistSuppression: 4, hipY: 174, hemLength: 228, hemWidth: 44 } },
  { id: 'male-body-loose', name: '宽松', category: 'body', gender: 'male', parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 44, armholeDepth: 98, waistY: 148, waistSuppression: 0, hipY: 180, hemLength: 246, hemWidth: 56 } },
];

export const MALE_COLLAR_PRESETS: GenePreset[] = [
  { id: 'male-collar-round', name: '圆领', category: 'collar', gender: 'male', parameterValues: { collarType: 'round', collarHeight: 12, collarSpread: 28 } },
  { id: 'male-collar-v', name: 'V领', category: 'collar', gender: 'male', parameterValues: { collarType: 'v', collarHeight: 14, collarSpread: 28 } },
  { id: 'male-collar-mandarin', name: '立领', category: 'collar', gender: 'male', parameterValues: { collarType: 'mandarin', collarHeight: 16, collarSpread: 26 } },
];

export const MALE_SLEEVE_PRESETS: GenePreset[] = [
  { id: 'male-sleeve-short', name: '短袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'short', sleeveLength: 60, cuffWidth: 16 } },
  { id: 'male-sleeve-long', name: '长袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'long', sleeveLength: 160, cuffWidth: 14 } },
  { id: 'male-sleeve-sleeveless', name: '无袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'sleeveless', sleeveLength: 0, cuffWidth: 0 } },
];

export const MALE_POCKET_PRESETS: GenePreset[] = [
  { id: 'male-pocket-none', name: '无', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'none', pocketWidth: 28, pocketHeight: 36, pocketY: 136 } },
  { id: 'male-pocket-patch', name: '贴袋', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'patch', pocketWidth: 28, pocketHeight: 36, pocketY: 136 } },
  { id: 'male-pocket-welt', name: '嵌线袋', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'welt', pocketWidth: 28, pocketHeight: 36, pocketY: 150 } },
];

export const MALE_PLACKET_PRESETS: GenePreset[] = [
  { id: 'male-placket-none', name: '无门襟', category: 'placket', gender: 'male', parameterValues: { placketType: 'none', placketWidth: 5, buttonCount: 5 } },
  { id: 'male-placket-center', name: '中开襟', category: 'placket', gender: 'male', parameterValues: { placketType: 'center', placketWidth: 5, buttonCount: 5 } },
  { id: 'male-placket-hidden', name: '暗门襟', category: 'placket', gender: 'male', parameterValues: { placketType: 'hidden', placketWidth: 3, buttonCount: 5 } },
];

export const MALE_CUFF_PRESETS: GenePreset[] = [
  { id: 'male-cuff-plain', name: '平袖口', category: 'cuff', gender: 'male', parameterValues: { cuffType: 'plain', cuffHeight: 14 } },
  { id: 'male-cuff-button', name: '扣袖口', category: 'cuff', gender: 'male', parameterValues: { cuffType: 'button', cuffHeight: 14 } },
];

export const ALL_MALE_PRESETS: GenePreset[] = [
  ...MALE_BODY_PRESETS, ...MALE_COLLAR_PRESETS, ...MALE_SLEEVE_PRESETS,
  ...MALE_POCKET_PRESETS, ...MALE_PLACKET_PRESETS, ...MALE_CUFF_PRESETS,
];
