/**
 * 身体测量值类型
 * 单位和测量定义必须随来源记录；类型本身不代表符合某项尺码标准。
 *
 * 设计原则: 测量值是参数推导的"单一可信源" (Single Source of Truth)
 * 所有 pattern 参数 (shoulderWidth, armholeDepth...) 都不应硬编码,
 * 而应通过 measurement-formulas.ts 从测量值推导
 */

export type GenderType = 'male' | 'female' | 'unisex';

/** 17 项核心测量值 (上衣 + 下装通用, 单位 mm) */
export interface BodyMeasurements {
  // ─── 围度 (Circumferences) ───
  /** 颈围 */
  neckCirc: number;
  /** 颈点(HPS)→胸围线 垂直距离 — Brian 标准驱动胸围线深度 */
  hpsToBust: number;
  /** HPS 到后腰线；旧设计缺失时须补测，不能把 C7 背长直接代入。 */
  hpsToWaistBack?: number;
  /** 腰线到腋下的垂直距离 (Brian 袖窿定位输入)。 */
  waistToArmpit?: number;
  /** 肩斜角，单位度；不再用固定 13 度代替实测。 */
  shoulderSlope?: number;
  /** 胸围 */
  bust: number;
  /** 腰围 */
  waist: number;
  /** 臀围 */
  hip: number;
  /** 上臂围 (二头肌处) */
  bicep: number;
  /** 腕围 */
  wristCirc: number;

  // ─── 宽度 (Widths) ───
  /** 总肩宽 (从一侧肩端点到另一侧) */
  shoulderWidth: number;
  /** 背宽 (背部左右肩胛骨间距离) */
  acrossBack: number;
  /** 前胸宽 (胸部最宽处左右距离) */
  acrossFront: number;

  // ─── 长度 (Lengths) ───
  /** 背长 (后颈点到腰线) */
  backLength: number;
  /** 前腰节长 (前颈点到腰线) */
  frontLength: number;
  /** 袖窿深 (从肩端点垂直向下到袖窿底) */
  armholeDepth: number;
  /** 袖长到腕 (从肩端点经肘到腕) */
  sleeveLength: number;
  /** 腰高/腰深 (从肩端到腰线垂直距离) */
  waistDepth: number;
  /** 臀深 (从腰线到臀线垂直距离) */
  hipDepth: number;
  /** 衣长/总长 (从肩部到下摆) */
  totalLength: number;

  // ─── 身高体重 (用于体形判断) ───
  /** 身高 */
  height: number;
  /** 体重 (kg, 用于面料用量估算) */
  weight: number;
}

/** 标准尺寸码 */
export type StandardSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';

/** 测量值来源元数据 */
export interface MeasurementSource {
  /** 来源: 标准尺码表 / 用户自定义 / 旧设计 */
  source: 'size-chart' | 'custom' | 'inherit';
  /** 标准尺码 (如果来源是 size-chart) */
  standardSize?: StandardSize;
  /** 时间戳 */
  updatedAt: string;
}
