/**
 * V2 参数化基因库
 * 男女款分离 + 品类模板位置对应关系
 */

import type { Gene, GeneParameter, GenderType } from '@/types/gene';

// ─── 通用参数定义 ───

const BODY_PARAMS: GeneParameter[] = [
  { id: 'neckFrontY', name: 'neckFrontY', label: '前颈点Y', type: 'number', unit: 'mm', defaultValue: 34, min: 28, max: 42, step: 1 },
  { id: 'shoulderY', name: 'shoulderY', label: '肩线Y', type: 'number', unit: 'mm', defaultValue: 48, min: 42, max: 56, step: 1 },
  { id: 'shoulderWidth', name: 'shoulderWidth', label: '肩宽(半)', type: 'number', unit: 'mm', defaultValue: 32, min: 20, max: 44, step: 1 },
  { id: 'armholeDepth', name: 'armholeDepth', label: '袖窿深', type: 'number', unit: 'mm', defaultValue: 96, min: 80, max: 110, step: 1 },
  { id: 'waistY', name: 'waistY', label: '腰线Y', type: 'number', unit: 'mm', defaultValue: 140, min: 120, max: 160, step: 1 },
  { id: 'waistSuppression', name: 'waistSuppression', label: '腰收量', type: 'number', unit: 'mm', defaultValue: 8, min: 0, max: 20, step: 1 },
  { id: 'hipY', name: 'hipY', label: '臀线Y', type: 'number', unit: 'mm', defaultValue: 172, min: 155, max: 190, step: 1 },
  { id: 'hemLength', name: 'hemLength', label: '衣长', type: 'number', unit: 'mm', defaultValue: 224, min: 140, max: 260, step: 2 },
  { id: 'hemWidth', name: 'hemWidth', label: '下摆宽(半)', type: 'number', unit: 'mm', defaultValue: 42, min: 28, max: 60, step: 1 },
];

const COLLAR_PARAMS: GeneParameter[] = [
  { id: 'collarType', name: 'collarType', label: '领型', type: 'select', defaultValue: 'round', options: [
    { value: 'round', label: '圆领' },
    { value: 'v', label: 'V领' },
    { value: 'square', label: '方领' },
    { value: 'mandarin', label: '立领' },
  ]},
  { id: 'collarHeight', name: 'collarHeight', label: '领高', type: 'number', unit: 'mm', defaultValue: 14, min: 4, max: 40, step: 1 },
  { id: 'collarSpread', name: 'collarSpread', label: '领口宽(半)', type: 'number', unit: 'mm', defaultValue: 28, min: 16, max: 44, step: 1 },
];

const SLEEVE_PARAMS: GeneParameter[] = [
  { id: 'sleeveType', name: 'sleeveType', label: '袖型', type: 'select', defaultValue: 'long', options: [
    { value: 'sleeveless', label: '无袖' },
    { value: 'short', label: '短袖' },
    { value: 'elbow', label: '七分袖' },
    { value: 'long', label: '长袖' },
    { value: 'flare', label: '喇叭袖' },
    { value: 'puff', label: '泡泡袖' },
  ]},
  { id: 'sleeveLength', name: 'sleeveLength', label: '袖长', type: 'number', unit: 'mm', defaultValue: 160, min: 40, max: 200, step: 2 },
  { id: 'cuffWidth', name: 'cuffWidth', label: '袖口宽(半)', type: 'number', unit: 'mm', defaultValue: 14, min: 6, max: 30, step: 1 },
];

const POCKET_PARAMS: GeneParameter[] = [
  { id: 'pocketType', name: 'pocketType', label: '口袋类型', type: 'select', defaultValue: 'none', options: [
    { value: 'none', label: '无' },
    { value: 'patch', label: '贴袋' },
    { value: 'welt', label: '嵌线袋' },
    { value: 'breast', label: '胸袋' },
  ]},
  { id: 'pocketWidth', name: 'pocketWidth', label: '袋宽', type: 'number', unit: 'mm', defaultValue: 26, min: 14, max: 40, step: 1 },
  { id: 'pocketHeight', name: 'pocketHeight', label: '袋高', type: 'number', unit: 'mm', defaultValue: 36, min: 16, max: 56, step: 1 },
  { id: 'pocketY', name: 'pocketY', label: '袋位Y', type: 'number', unit: 'mm', defaultValue: 132, min: 90, max: 170, step: 2 },
];

const PLACKET_PARAMS: GeneParameter[] = [
  { id: 'placketType', name: 'placketType', label: '门襟类型', type: 'select', defaultValue: 'none', options: [
    { value: 'none', label: '无门襟' },
    { value: 'center', label: '中开襟' },
    { value: 'hidden', label: '暗门襟' },
    { value: 'double', label: '双排扣' },
  ]},
  { id: 'placketWidth', name: 'placketWidth', label: '门襟宽', type: 'number', unit: 'mm', defaultValue: 6, min: 3, max: 14, step: 1 },
  { id: 'buttonCount', name: 'buttonCount', label: '扣数', type: 'number', unit: '粒', defaultValue: 5, min: 3, max: 8, step: 1 },
];

const CUFF_PARAMS: GeneParameter[] = [
  { id: 'cuffType', name: 'cuffType', label: '袖口类型', type: 'select', defaultValue: 'plain', options: [
    { value: 'plain', label: '平袖口' },
    { value: 'button', label: '扣袖口' },
    { value: 'turnback', label: '翻袖口' },
  ]},
  { id: 'cuffHeight', name: 'cuffHeight', label: '袖口高', type: 'number', unit: 'mm', defaultValue: 14, min: 6, max: 24, step: 1 },
];

// ─── 男女款锚点体系 ───
// 所有部件的锚点坐标与衣身锚点严格对应，确保拼接位置不混乱

/** 男款衣身锚点 (基准) */
const MALE_BODY_ANCHORS = {
  shoulderWidth: 36,   // 男性肩宽更大
  shoulderY: 48,
  neckSideY: 42,
  armholeDepth: 98,
  neckFrontY: 34,
};

/** 女款衣身锚点 (基准) */
const FEMALE_BODY_ANCHORS = {
  shoulderWidth: 30,   // 女性肩宽更窄
  shoulderY: 46,
  neckSideY: 40,
  armholeDepth: 92,
  neckFrontY: 32,
};

/** 获取性别对应的基准锚点 */
export function getGenderAnchors(gender: GenderType) {
  return gender === 'female' ? FEMALE_BODY_ANCHORS : MALE_BODY_ANCHORS;
}

// ─── 男女款预设 ───

export interface GenePreset {
  id: string;
  name: string;
  category: Gene['category'];
  gender: GenderType;
  parameterValues: Record<string, number | string | boolean>;
}

// ─── 男款预设 ───

const MALE_BODY_PRESETS: GenePreset[] = [
  {
    id: 'male-body-slim',
    name: '修身',
    category: 'body',
    gender: 'male',
    parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 36, armholeDepth: 98, waistY: 142, waistSuppression: 10, hipY: 174, hemLength: 230, hemWidth: 44 },
  },
  {
    id: 'male-body-regular',
    name: '合身',
    category: 'body',
    gender: 'male',
    parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 36, armholeDepth: 98, waistY: 144, waistSuppression: 4, hipY: 176, hemLength: 234, hemWidth: 46 },
  },
  {
    id: 'male-body-loose',
    name: '宽松',
    category: 'body',
    gender: 'male',
    parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 40, armholeDepth: 100, waistY: 150, waistSuppression: 0, hipY: 182, hemLength: 250, hemWidth: 56 },
  },
  {
    id: 'male-body-crop',
    name: '短款',
    category: 'body',
    gender: 'male',
    parameterValues: { neckFrontY: 34, shoulderY: 48, shoulderWidth: 36, armholeDepth: 98, waistY: 142, waistSuppression: 4, hipY: 174, hemLength: 158, hemWidth: 38 },
  },
];

const MALE_COLLAR_PRESETS: GenePreset[] = [
  { id: 'male-collar-round', name: '圆领', category: 'collar', gender: 'male', parameterValues: { collarType: 'round', collarHeight: 14, collarSpread: 30 } },
  { id: 'male-collar-v', name: 'V领', category: 'collar', gender: 'male', parameterValues: { collarType: 'v', collarHeight: 16, collarSpread: 30 } },
  { id: 'male-collar-square', name: '方领', category: 'collar', gender: 'male', parameterValues: { collarType: 'square', collarHeight: 14, collarSpread: 30 } },
  { id: 'male-collar-mandarin', name: '立领', category: 'collar', gender: 'male', parameterValues: { collarType: 'mandarin', collarHeight: 16, collarSpread: 28 } },
];

const MALE_SLEEVE_PRESETS: GenePreset[] = [
  { id: 'male-sleeve-short', name: '短袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'short', sleeveLength: 60, cuffWidth: 16 } },
  { id: 'male-sleeve-elbow', name: '七分袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'elbow', sleeveLength: 110, cuffWidth: 15 } },
  { id: 'male-sleeve-long', name: '长袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'long', sleeveLength: 164, cuffWidth: 14 } },
  { id: 'male-sleeve-sleeveless', name: '无袖', category: 'sleeve', gender: 'male', parameterValues: { sleeveType: 'sleeveless', sleeveLength: 0, cuffWidth: 0 } },
];

const MALE_POCKET_PRESETS: GenePreset[] = [
  { id: 'male-pocket-none', name: '无', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'none', pocketWidth: 26, pocketHeight: 36, pocketY: 134 } },
  { id: 'male-pocket-patch', name: '贴袋', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'patch', pocketWidth: 28, pocketHeight: 38, pocketY: 134 } },
  { id: 'male-pocket-welt', name: '嵌线袋', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'welt', pocketWidth: 26, pocketHeight: 36, pocketY: 150 } },
  { id: 'male-pocket-breast', name: '胸袋', category: 'pocket', gender: 'male', parameterValues: { pocketType: 'breast', pocketWidth: 22, pocketHeight: 22, pocketY: 134 } },
];

const MALE_PLACKET_PRESETS: GenePreset[] = [
  { id: 'male-placket-none', name: '无门襟', category: 'placket', gender: 'male', parameterValues: { placketType: 'none', placketWidth: 6, buttonCount: 5 } },
  { id: 'male-placket-center', name: '中开襟', category: 'placket', gender: 'male', parameterValues: { placketType: 'center', placketWidth: 6, buttonCount: 5 } },
  { id: 'male-placket-hidden', name: '暗门襟', category: 'placket', gender: 'male', parameterValues: { placketType: 'hidden', placketWidth: 4, buttonCount: 5 } },
  { id: 'male-placket-double', name: '双排扣', category: 'placket', gender: 'male', parameterValues: { placketType: 'double', placketWidth: 8, buttonCount: 6 } },
];

const MALE_CUFF_PRESETS: GenePreset[] = [
  { id: 'male-cuff-plain', name: '平袖口', category: 'cuff', gender: 'male', parameterValues: { cuffType: 'plain', cuffHeight: 14 } },
  { id: 'male-cuff-button', name: '扣袖口', category: 'cuff', gender: 'male', parameterValues: { cuffType: 'button', cuffHeight: 14 } },
  { id: 'male-cuff-turnback', name: '翻袖口', category: 'cuff', gender: 'male', parameterValues: { cuffType: 'turnback', cuffHeight: 16 } },
];

// ─── 女款预设 ───

const FEMALE_BODY_PRESETS: GenePreset[] = [
  {
    id: 'female-body-slim',
    name: '修身',
    category: 'body',
    gender: 'female',
    parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 136, waistSuppression: 14, hipY: 168, hemLength: 218, hemWidth: 40 },
  },
  {
    id: 'female-body-regular',
    name: '合身',
    category: 'body',
    gender: 'female',
    parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 138, waistSuppression: 8, hipY: 170, hemLength: 222, hemWidth: 42 },
  },
  {
    id: 'female-body-loose',
    name: '宽松',
    category: 'body',
    gender: 'female',
    parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 34, armholeDepth: 94, waistY: 144, waistSuppression: 0, hipY: 176, hemLength: 238, hemWidth: 52 },
  },
  {
    id: 'female-body-crop',
    name: '短款',
    category: 'body',
    gender: 'female',
    parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 136, waistSuppression: 8, hipY: 168, hemLength: 148, hemWidth: 34 },
  },
  {
    id: 'female-body-peplum',
    name: '裙摆',
    category: 'body',
    gender: 'female',
    parameterValues: { neckFrontY: 32, shoulderY: 46, shoulderWidth: 30, armholeDepth: 92, waistY: 136, waistSuppression: 0, hipY: 144, hemLength: 226, hemWidth: 80 },
  },
];

const FEMALE_COLLAR_PRESETS: GenePreset[] = [
  { id: 'female-collar-round', name: '圆领', category: 'collar', gender: 'female', parameterValues: { collarType: 'round', collarHeight: 12, collarSpread: 26 } },
  { id: 'female-collar-v', name: 'V领', category: 'collar', gender: 'female', parameterValues: { collarType: 'v', collarHeight: 14, collarSpread: 26 } },
  { id: 'female-collar-square', name: '方领', category: 'collar', gender: 'female', parameterValues: { collarType: 'square', collarHeight: 12, collarSpread: 28 } },
  { id: 'female-collar-mandarin', name: '立领', category: 'collar', gender: 'female', parameterValues: { collarType: 'mandarin', collarHeight: 14, collarSpread: 24 } },
];

const FEMALE_SLEEVE_PRESETS: GenePreset[] = [
  { id: 'female-sleeve-short', name: '短袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'short', sleeveLength: 54, cuffWidth: 14 } },
  { id: 'female-sleeve-elbow', name: '七分袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'elbow', sleeveLength: 100, cuffWidth: 13 } },
  { id: 'female-sleeve-long', name: '长袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'long', sleeveLength: 154, cuffWidth: 12 } },
  { id: 'female-sleeve-sleeveless', name: '无袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'sleeveless', sleeveLength: 0, cuffWidth: 0 } },
  { id: 'female-sleeve-flare', name: '喇叭袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'flare', sleeveLength: 154, cuffWidth: 26 } },
  { id: 'female-sleeve-puff', name: '泡泡袖', category: 'sleeve', gender: 'female', parameterValues: { sleeveType: 'puff', sleeveLength: 58, cuffWidth: 10 } },
];

const FEMALE_POCKET_PRESETS: GenePreset[] = [
  { id: 'female-pocket-none', name: '无', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'none', pocketWidth: 24, pocketHeight: 32, pocketY: 130 } },
  { id: 'female-pocket-patch', name: '贴袋', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'patch', pocketWidth: 24, pocketHeight: 34, pocketY: 130 } },
  { id: 'female-pocket-welt', name: '嵌线袋', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'welt', pocketWidth: 24, pocketHeight: 32, pocketY: 146 } },
  { id: 'female-pocket-breast', name: '胸袋', category: 'pocket', gender: 'female', parameterValues: { pocketType: 'breast', pocketWidth: 20, pocketHeight: 20, pocketY: 130 } },
];

const FEMALE_PLACKET_PRESETS: GenePreset[] = [
  { id: 'female-placket-none', name: '无门襟', category: 'placket', gender: 'female', parameterValues: { placketType: 'none', placketWidth: 5, buttonCount: 4 } },
  { id: 'female-placket-center', name: '中开襟', category: 'placket', gender: 'female', parameterValues: { placketType: 'center', placketWidth: 5, buttonCount: 4 } },
  { id: 'female-placket-hidden', name: '暗门襟', category: 'placket', gender: 'female', parameterValues: { placketType: 'hidden', placketWidth: 3, buttonCount: 4 } },
  { id: 'female-placket-double', name: '双排扣', category: 'placket', gender: 'female', parameterValues: { placketType: 'double', placketWidth: 7, buttonCount: 5 } },
];

const FEMALE_CUFF_PRESETS: GenePreset[] = [
  { id: 'female-cuff-plain', name: '平袖口', category: 'cuff', gender: 'female', parameterValues: { cuffType: 'plain', cuffHeight: 12 } },
  { id: 'female-cuff-button', name: '扣袖口', category: 'cuff', gender: 'female', parameterValues: { cuffType: 'button', cuffHeight: 12 } },
  { id: 'female-cuff-turnback', name: '翻袖口', category: 'cuff', gender: 'female', parameterValues: { cuffType: 'turnback', cuffHeight: 14 } },
];

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

const ALL_PRESETS: GenePreset[] = [
  ...MALE_BODY_PRESETS, ...MALE_COLLAR_PRESETS, ...MALE_SLEEVE_PRESETS,
  ...MALE_POCKET_PRESETS, ...MALE_PLACKET_PRESETS, ...MALE_CUFF_PRESETS,
  ...FEMALE_BODY_PRESETS, ...FEMALE_COLLAR_PRESETS, ...FEMALE_SLEEVE_PRESETS,
  ...FEMALE_POCKET_PRESETS, ...FEMALE_PLACKET_PRESETS, ...FEMALE_CUFF_PRESETS,
];

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
  // 使用合身预设作为默认
  const regular = presets.find((p) => p.id.includes('regular')) || presets[0];
  return { ...regular.parameterValues };
}
