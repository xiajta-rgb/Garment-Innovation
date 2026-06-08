/**
 * V2 参数化基因库 — 聚合入口
 * 男女款预设已拆分至 presets/ 目录:
 * - presets/male.ts
 * - presets/female.ts
 */

import type { Gene, GeneParameter, GenderType } from '@/types/gene';
import { ALL_MALE_PRESETS, MALE_BODY_PRESETS, MALE_COLLAR_PRESETS, MALE_SLEEVE_PRESETS, MALE_POCKET_PRESETS, MALE_PLACKET_PRESETS, MALE_CUFF_PRESETS } from './presets/male';
import { ALL_FEMALE_PRESETS, FEMALE_BODY_PRESETS } from './presets/female';

// ─── 通用参数定义 ───

const BODY_PARAMS: GeneParameter[] = [
  { id: 'neckFrontY', name: '前领深', label: '前领深', type: 'number', defaultValue: 34, min: 20, max: 60, unit: 'mm', step: 1 },
  { id: 'shoulderY', name: '肩线Y', label: '肩线Y', type: 'number', defaultValue: 48, min: 30, max: 70, unit: 'mm', step: 1 },
  { id: 'shoulderWidth', name: '肩宽', label: '肩宽', type: 'number', defaultValue: 40, min: 20, max: 60, unit: 'mm', step: 1 },
  { id: 'armholeDepth', name: '袖窿深', label: '袖窿深', type: 'number', defaultValue: 96, min: 60, max: 140, unit: 'mm', step: 1 },
  { id: 'waistY', name: '腰线Y', label: '腰线Y', type: 'number', defaultValue: 142, min: 80, max: 200, unit: 'mm', step: 1 },
  { id: 'waistSuppression', name: '腰收量', label: '腰收量', type: 'number', defaultValue: 4, min: 0, max: 20, unit: 'mm', step: 1 },
  { id: 'hipY', name: '臀线Y', label: '臀线Y', type: 'number', defaultValue: 174, min: 100, max: 240, unit: 'mm', step: 1 },
  { id: 'hemLength', name: '衣长', label: '衣长', type: 'number', defaultValue: 228, min: 100, max: 300, unit: 'mm', step: 1 },
  { id: 'hemWidth', name: '下摆宽', label: '下摆宽', type: 'number', defaultValue: 44, min: 20, max: 80, unit: 'mm', step: 1 },
];

const COLLAR_PARAMS: GeneParameter[] = [
  { id: 'collarType', name: '领型', label: '领型', type: 'select', defaultValue: 'round', options: [{ value: 'round', label: '圆领' }, { value: 'v', label: 'V领' }, { value: 'square', label: '方领' }, { value: 'mandarin', label: '立领' }, { value: 'lapel', label: '翻领' }, { value: 'turtle', label: '高领' }, { value: 'boat', label: '船领' }, { value: 'halter', label: '挂脖' }] },
  { id: 'collarHeight', name: '领高', label: '领高', type: 'number', defaultValue: 12, min: 4, max: 40, unit: 'mm', step: 1 },
  { id: 'collarSpread', name: '领口宽', label: '领口宽', type: 'number', defaultValue: 28, min: 16, max: 50, unit: 'mm', step: 1 },
];

const SLEEVE_PARAMS: GeneParameter[] = [
  { id: 'sleeveType', name: '袖型', label: '袖型', type: 'select', defaultValue: 'long', options: [{ value: 'sleeveless', label: '无袖' }, { value: 'cap', label: '盖袖' }, { value: 'short', label: '短袖' }, { value: 'elbow', label: '七分袖' }, { value: 'long', label: '长袖' }, { value: 'flutter', label: '飞飞袖' }, { value: 'puff', label: '泡泡袖' }, { value: 'bell', label: '喇叭袖' }] },
  { id: 'sleeveLength', name: '袖长', label: '袖长', type: 'number', defaultValue: 160, min: 0, max: 200, unit: 'mm', step: 1 },
  { id: 'cuffWidth', name: '袖口宽', label: '袖口宽', type: 'number', defaultValue: 14, min: 4, max: 40, unit: 'mm', step: 1 },
];

const POCKET_PARAMS: GeneParameter[] = [
  { id: 'pocketType', name: '口袋型', label: '口袋型', type: 'select', defaultValue: 'none', options: [{ value: 'none', label: '无' }, { value: 'patch', label: '贴袋' }, { value: 'welt', label: '嵌线袋' }, { value: 'slash', label: '斜插袋' }, { value: 'breast', label: '胸袋' }, { value: 'kangaroo', label: '袋鼠袋' }] },
  { id: 'pocketWidth', name: '口袋宽', label: '口袋宽', type: 'number', defaultValue: 28, min: 10, max: 60, unit: 'mm', step: 1 },
  { id: 'pocketHeight', name: '口袋高', label: '口袋高', type: 'number', defaultValue: 36, min: 10, max: 60, unit: 'mm', step: 1 },
  { id: 'pocketY', name: '口袋Y位置', label: '口袋Y位置', type: 'number', defaultValue: 136, min: 80, max: 200, unit: 'mm', step: 1 },
];

const PLACKET_PARAMS: GeneParameter[] = [
  { id: 'placketType', name: '门襟型', label: '门襟型', type: 'select', defaultValue: 'none', options: [{ value: 'none', label: '无门襟' }, { value: 'center', label: '中开襟' }, { value: 'half', label: '半开襟' }, { value: 'hidden', label: '暗门襟' }, { value: 'wrap', label: '裹式' }, { value: 'double', label: '双排扣' }] },
  { id: 'placketWidth', name: '门襟宽', label: '门襟宽', type: 'number', defaultValue: 5, min: 2, max: 12, unit: 'mm', step: 1 },
  { id: 'buttonCount', name: '纽扣数', label: '纽扣数', type: 'number', defaultValue: 5, min: 0, max: 10, step: 1 },
];

const CUFF_PARAMS: GeneParameter[] = [
  { id: 'cuffType', name: '袖口型', label: '袖口型', type: 'select', defaultValue: 'plain', options: [{ value: 'none', label: '无袖口' }, { value: 'plain', label: '平袖口' }, { value: 'button', label: '纽扣袖口' }, { value: 'turnup', label: '翻袖口' }, { value: 'elastic', label: '松紧袖口' }] },
  { id: 'cuffHeight', name: '袖口高', label: '袖口高', type: 'number', defaultValue: 14, min: 4, max: 30, unit: 'mm', step: 1 },
];

// ─── 男女款锚点体系 ───

const MALE_BODY_ANCHORS = {
  neckFrontY: 34, shoulderY: 48, shoulderWidth: 40,
  armholeDepth: 96, waistY: 142, hipY: 174, hemLength: 228,
};

const FEMALE_BODY_ANCHORS = {
  neckFrontY: 32, shoulderY: 46, shoulderWidth: 30,
  armholeDepth: 92, waistY: 138, hipY: 170, hemLength: 222,
};

export function getGenderAnchors(gender: GenderType) {
  return gender === 'female' ? FEMALE_BODY_ANCHORS : MALE_BODY_ANCHORS;
}

// ─── 预设接口 ───

export interface GenePreset {
  id: string;
  name: string;
  category: string;
  gender: 'male' | 'female' | 'unisex';
  parameterValues: Record<string, number | string | boolean>;
}

// ─── 基因定义 (男女通用参数, 预设区分男女) ───

export const GENE_DEFINITIONS: Gene[] = [
  {
    id: 'gene-body',
    name: '衣身',
    category: 'body',
    subCategory: 'torso',
    version: '2.0.0',
    description: '参数化衣身基因, 支持肩宽/袖窿深/腰收/衣长/下摆宽等参数实时调整',
    parameters: BODY_PARAMS,
    geometryGenerator: 'generateBody',
    anchors: [
      { id: 'sn-left', name: '颈侧点左', x: 72, y: 42, allowedConnections: ['collar'] },
      { id: 'sn-right', name: '颈侧点右', x: 128, y: 42, allowedConnections: ['collar'] },
      { id: 'sp-left', name: '肩点左', x: 32, y: 48, allowedConnections: ['sleeve'] },
      { id: 'sp-right', name: '肩点右', x: 168, y: 48, allowedConnections: ['sleeve'] },
      { id: 'ap-left', name: '袖窿底左', x: 36, y: 96, allowedConnections: ['sleeve'] },
      { id: 'ap-right', name: '袖窿底右', x: 164, y: 96, allowedConnections: ['sleeve'] },
    ],
    constraints: [
      { id: 'body-hem-above-waist', description: '下摆不能高于腰线', expression: 'params.hemLength >= params.waistY + 10', errorMessage: '下摆不能高于腰线以下 10mm', level: 'error' },
      { id: 'body-shoulder-min', description: '肩宽最小值', expression: 'params.shoulderWidth >= 20', errorMessage: '肩宽过窄，不符合人体工学', level: 'warning' },
    ],
    defaultBomItems: [
      { materialAssetCode: 'FAB-001', usagePerPiece: 1.2, unit: 'm' },
    ],
  },
  {
    id: 'gene-collar',
    name: '衣领',
    category: 'collar',
    subCategory: 'neckline',
    version: '2.0.0',
    description: '参数化衣领基因, 支持领型/领高/领口宽等参数实时调整',
    parameters: COLLAR_PARAMS,
    geometryGenerator: 'generateCollar',
    anchors: [
      { id: 'sn-left', name: '颈侧点左', x: 72, y: 42, allowedConnections: ['body'] },
      { id: 'sn-right', name: '颈侧点右', x: 128, y: 42, allowedConnections: ['body'] },
    ],
    constraints: [
      { id: 'collar-height-max', description: '领高上限', expression: 'params.collarHeight <= 40', errorMessage: '领高过大，影响穿着舒适度', level: 'warning' },
    ],
    defaultBomItems: [],
  },
  {
    id: 'gene-sleeve',
    name: '袖子',
    category: 'sleeve',
    subCategory: 'arm',
    version: '2.0.0',
    description: '参数化袖子基因, 支持袖型/袖长/袖口宽等参数实时调整',
    parameters: SLEEVE_PARAMS,
    geometryGenerator: 'generateSleeve',
    anchors: [
      { id: 'sp-left', name: '肩点左', x: 32, y: 48, allowedConnections: ['body'] },
      { id: 'sp-right', name: '肩点右', x: 168, y: 48, allowedConnections: ['body'] },
      { id: 'ap-left', name: '袖窿底左', x: 36, y: 96, allowedConnections: ['body'] },
      { id: 'ap-right', name: '袖窿底右', x: 164, y: 96, allowedConnections: ['body'] },
    ],
    constraints: [
      { id: 'sleeve-length-max', description: '袖长上限', expression: 'params.sleeveLength <= 200', errorMessage: '袖长过长，超过合理范围', level: 'warning' },
    ],
    defaultBomItems: [
      { materialAssetCode: 'FAB-001', usagePerPiece: 0.6, unit: 'm' },
    ],
  },
  {
    id: 'gene-pocket',
    name: '口袋',
    category: 'pocket',
    subCategory: 'detail',
    version: '2.0.0',
    description: '参数化口袋基因',
    parameters: POCKET_PARAMS,
    geometryGenerator: 'generatePocket',
    anchors: [],
    constraints: [],
    defaultBomItems: [],
  },
  {
    id: 'gene-placket',
    name: '门襟',
    category: 'placket',
    subCategory: 'closure',
    version: '2.0.0',
    description: '参数化门襟基因',
    parameters: PLACKET_PARAMS,
    geometryGenerator: 'generatePlacket',
    anchors: [],
    constraints: [],
    defaultBomItems: [
      { materialAssetCode: 'BTN-001', usagePerPiece: 5, unit: '粒' },
    ],
  },
  {
    id: 'gene-cuff',
    name: '袖口',
    category: 'cuff',
    subCategory: 'detail',
    version: '2.0.0',
    description: '参数化袖口基因',
    parameters: CUFF_PARAMS,
    geometryGenerator: 'generateCuff',
    anchors: [],
    constraints: [],
    defaultBomItems: [],
  },
];

// ─── 按性别分组的预设 ───

const ALL_PRESETS: GenePreset[] = [...ALL_MALE_PRESETS, ...ALL_FEMALE_PRESETS];

/** 获取指定性别+品类的预设 */
export function getPresetsByGender(category: string, gender: GenderType): GenePreset[] {
  return ALL_PRESETS.filter((p) => p.category === category && (p.gender === gender || p.gender === 'unisex'));
}

/** 兼容旧接口: 获取品类预设 (默认男款) */
export const GENE_PRESETS: Record<string, GenePreset[]> = {
  body: MALE_BODY_PRESETS,
  collar: MALE_COLLAR_PRESETS,
  sleeve: MALE_SLEEVE_PRESETS,
  pocket: MALE_POCKET_PRESETS,
  placket: MALE_PLACKET_PRESETS,
  cuff: MALE_CUFF_PRESETS,
};

/** 根据 category 获取基因定义 */
export function getGeneDefinition(category: string): Gene | undefined {
  return GENE_DEFINITIONS.find((g) => g.category === category);
}

/** 根据 presetId 获取预设参数值 */
export function getPresetValues(
  _category: string,
  presetId: string
): Record<string, number | string | boolean> | undefined {
  return ALL_PRESETS.find((p) => p.id === presetId)?.parameterValues;
}

/** 获取性别的默认衣身参数 */
export function getGenderDefaultParams(gender: GenderType): Record<string, number | string | boolean> {
  const presets = gender === 'female' ? FEMALE_BODY_PRESETS : MALE_BODY_PRESETS;
  const regular = presets.find((p) => p.id.includes('regular')) || presets[0];
  return { ...regular.parameterValues };
}
