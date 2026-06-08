/**
 * 女款预设数据
 * 从 geneLibrary.ts 拆分
 */

import type { GenePreset } from '../geneLibrary';

export const FEMALE_BODY_PRESETS: GenePreset[] = [
  { id: 'female-body-slim', name: '修身', category: 'body', gender: 'female', parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 28, armholeDepth: 90, waistY: 136, waistSuppression: 10, hipY: 168, hemLength: 216, hemWidth: 36 } },
  { id: 'female-body-regular', name: '合身', category: 'body', gender: 'female', parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 138, waistSuppression: 8, hipY: 170, hemLength: 222, hemWidth: 42 } },
  { id: 'female-body-loose', name: '宽松', category: 'body', gender: 'female', parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 34, armholeDepth: 94, waistY: 144, waistSuppression: 0, hipY: 176, hemLength: 238, hemWidth: 52 } },
  { id: 'female-body-crop', name: '短款', category: 'body', gender: 'female', parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 136, waistSuppression: 8, hipY: 168, hemLength: 148, hemWidth: 34 } },
  { id: 'female-body-peplum', name: '裙摆', category: 'body', gender: 'female', parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 136, waistSuppression: 0, hipY: 144, hemLength: 226, hemWidth: 80 } },
];

export const FEMALE_COLLAR_PRESETS: GenePreset[] = [
  { id: 'female-collar-round', name: '圆领', category: 'collar', gender: 'female', parameterValues: { collarType: 'round', collarHeight: 12, collarSpread: 26 } },
  { id: 'female-collar-v', name: 'V领', category: 'collar', gender: 'female', parameterValues: { collarType: 'v', collarHeight: 14, collarSpread: 26 } },
  { id: 'female-collar-square', name: '方领', category: 'collar', gender: 'female', parameterValues: { collarType: 'square', collarHeight: 12, collarSpread: 28 } },
  { id: 'female-collar-mandarin', name: '立领', category: 'collar', gender: 'female', parameterValues: { collarType: 'mandarin', collarHeight: 14, collarSpread: 24 } },
];

export const FEMALE_SLEEVE_PRESETS: GenePreset[] = [
  { id: 'female-sleeve-short', name: '短袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'short', sleeveLength: 54, cuffWidth: 14 } },
  { id: 'female-sleeve-elbow', name: '七分袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'elbow', sleeveLength: 100, cuffWidth: 13 } },
  { id: 'female-sleeve-long', name: '长袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'long', sleeveLength: 154, cuffWidth: 12 } },
  { id: 'female-sleeve-sleeveless', name: '无袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'sleeveless', sleeveLength: 0, cuffWidth: 0 } },
  { id: 'female-sleeve-flare', name: '喇叭袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'flare', sleeveLength: 154, cuffWidth: 26 } },
  { id: 'female-sleeve-puff', name: '泡泡袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'puff', sleeveLength: 58, cuffWidth: 10 } },
];

export const FEMALE_POCKET_PRESETS: GenePreset[] = [
  { id: 'female-pocket-none', name: '无', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'none', pocketWidth: 24, pocketHeight: 32, pocketY: 130 } },
  { id: 'female-pocket-patch', name: '贴袋', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'patch', pocketWidth: 24, pocketHeight: 34, pocketY: 130 } },
  { id: 'female-pocket-welt', name: '嵌线袋', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'welt', pocketWidth: 24, pocketHeight: 32, pocketY: 146 } },
  { id: 'female-pocket-breast', name: '胸袋', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'breast', pocketWidth: 20, pocketHeight: 20, pocketY: 130 } },
];

export const FEMALE_PLACKET_PRESETS: GenePreset[] = [
  { id: 'female-placket-none', name: '无门襟', category: 'placket', gender: 'female', parameterValues: { placketType: 'none', placketWidth: 5, buttonCount: 4 } },
  { id: 'female-placket-center', name: '中开襟', category: 'placket', gender: 'female', parameterValues: { placketType: 'center', placketWidth: 5, buttonCount: 4 } },
  { id: 'female-placket-hidden', name: '暗门襟', category: 'placket', gender: 'female', parameterValues: { placketType: 'hidden', placketWidth: 3, buttonCount: 4 } },
  { id: 'female-placket-double', name: '双排扣', category: 'placket', gender: 'female', parameterValues: { placketType: 'double', placketWidth: 7, buttonCount: 5 } },
];

export const FEMALE_CUFF_PRESETS: GenePreset[] = [
  { id: 'female-cuff-plain', name: '平袖口', category: 'cuff', gender: 'female', parameterValues: { cuffType: 'plain', cuffHeight: 12 } },
  { id: 'female-cuff-button', name: '扣袖口', category: 'cuff', gender: 'female', parameterValues: { cuffType: 'button', cuffHeight: 12 } },
  { id: 'female-cuff-turnback', name: '翻袖口', category: 'cuff', gender: 'female', parameterValues: { cuffType: 'turnback', cuffHeight: 14 } },
];

export const ALL_FEMALE_PRESETS: GenePreset[] = [
  ...FEMALE_BODY_PRESETS, ...FEMALE_COLLAR_PRESETS, ...FEMALE_SLEEVE_PRESETS,
  ...FEMALE_POCKET_PRESETS, ...FEMALE_PLACKET_PRESETS, ...FEMALE_CUFF_PRESETS,
];
