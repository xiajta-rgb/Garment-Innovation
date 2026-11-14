import type { ConstructionParameter } from '@/types/construction';

const source = '@freesewing/simon@4.10.2/src/options.mjs';
const n = (key: ConstructionParameter['key'], label: string, group: ConstructionParameter['group'], value: number, min: number, max: number, meaning: string, only?: 'long' | 'short', degree = false): ConstructionParameter =>
  ({ key, label, group, defaultValue: value, min, max, meaning, only, unit: degree ? '°' : 'ratio', step: degree ? 1 : .005, source });
export const CONSTRUCTION_PARAMETERS: ConstructionParameter[] = [
  { key: 'sleeveStyle', label: '袖型', group: 'sleeve', unit: 'choice', defaultValue: 'long', choices: [{ value: 'long', label: '长袖＋袖衩＋袖口' }, { value: 'short', label: '短袖折边' }], meaning: '同方法重算袖片；短袖移除袖口和两种袖衩。', source },
  { key: 'cuffStyle', label: '袖口造型', group: 'cuff', unit: 'choice', defaultValue: 'angledBarrelCuff', only: 'long', choices: [{ value: 'angledBarrelCuff', label: '斜角单翻袖口' }, { value: 'roundedBarrelCuff', label: '圆角单翻袖口' }, { value: 'straightBarrelCuff', label: '直角单翻袖口' }], meaning: '双层单翻袖口，面料4片、衬2片；法式双翻需要独立折叠合同。', source },
  { key: 'hemStyle', label: '下摆造型', group: 'hem', unit: 'choice', defaultValue: 'straight', choices: [{ value: 'straight', label: '平下摆' }, { value: 'baseball', label: '圆弧下摆' }, { value: 'slashed', label: '侧开衩下摆' }], meaning: '前后身一起重算，仍检查侧缝配对。', source },
  n('collarEase', '领围松量比例', 'collar', .02, 0, .1, '领座CF至CF净边目标＝颈围×(1＋本值)。'),
  n('collarAngle', '领尖角', 'collar', 85, 60, 130, '源领尖方向线角度，不是领尖内角。', undefined, true),
  n('collarBend', '领面弯曲比例', 'collar', .035, 0, .1, '源领端下移量相对于领长。'),
  n('collarFlare', '领外展角', 'collar', 3.5, 0, 10, '领上边方向角。', undefined, true),
  n('collarGap', '领面端部留空比例', 'collar', .025, 0, .06, '装领边目标减去颈围×本值；不能直接认定领座剪口已匹配。'),
  n('collarRoll', '领底缩减比例', 'collar', .03, 0, .06, '领底参考线上移/下移来自领面中心宽×本值；独立领底闭合样仍须重建。'),
  n('collarWidth', '领面宽倍率', 'collar', 1.2, .9, 2, '领面中心宽＝领座宽×本值×(1＋领底缩减比例)。'),
  n('collarStandBend', '领座弯折角', 'collar', 3, 0, 5, '源领座中心线弯折角。', undefined, true),
  n('collarStandCurve', '领座曲率角', 'collar', 2, 0, 5, '源领座端部方向角。', undefined, true),
  n('collarStandWidth', '领座宽比例', 'collar', .08, .03, .13, '领座宽＝颈围×本值。'),
  n('cuffEase', '腕围松量比例', 'cuff', .2, .1, .4, '源袖口宽＝腕围×(1＋本值)×1.15；源袖片基础宽用加法，必须独立走缝。', 'long'),
  n('cuffDrape', '袖下口褶量比例', 'cuff', .05, 0, .1, '总褶量＝肩端到腕×本值；大于20 mm为2褶，否则正值1褶，0为无褶。', 'long'),
  n('cuffLength', '袖口高度比例', 'cuff', .1, .03, .15, '单翻袖口高度＝肩端到腕×本值；袖片同时减去袖口高度。', 'long'),
  n('sleevePlacketLength', '袖衩长度比例', 'sleeve', .25, .15, .35, '切口、外搭片和内搭片长度基准＝肩端到腕×本值。', 'long'),
  n('sleevePlacketWidth', '袖衩宽比例', 'sleeve', .13, .08, .18, '外搭宽＝腕围×本值；内搭折边宽＝min(外搭宽/2,10 mm)。', 'long'),
  n('sleeveLengthShort', '短袖长度比例', 'sleeve', .4, .2, 1, '源短袖长度目标相对肩端到腕；受袖山高与折边最低长度约束。', 'short'),
  n('sleeveHemShort', '短袖折边比例', 'sleeve', .04, .01, .2, '源短袖折边深度＝肩端到腕×本值；保留源镜像折返线。', 'short'),
];
export const SHIRT_DEFAULTS = Object.fromEntries(CONSTRUCTION_PARAMETERS.map(p => [p.key, p.defaultValue]));
export const CONSTRUCTION_REVISION = 'construction-20261110-v1';
