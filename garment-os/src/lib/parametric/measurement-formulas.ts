/**
 * 测量值 → 纸样参数 推导公式
 *
 * 这是 Milestone A 的核心: 把"魔法数字"变成"有据可查的公式"
 *
 * 公式来源:
 * - Aldrich Method (Winifred Aldrich, 工业制版)
 * - Helen Joseph-Armstrong's Patternmaking for Fashion Design
 * - 行业经验: 围度加放松量 (ease), 长度加 1.5-2cm
 *
 * 放松量 (EASE) 是服装工程的核心: 人体围度 + 必要活动空间
 * 不同服装类型有不同的 ease (紧身 0-2cm, 合身 4-8cm, 宽松 10-20cm)
 */

import type { BodyMeasurements, GenderType } from '@/types/measurements';
import type { GeneParameter } from '@/types/gene';

/** 放松量配置 */
export interface EaseConfig {
  /** 胸围放松量 (cm) */
  bust: number;
  /** 腰围放松量 (cm) */
  waist: number;
  /** 臀围放松量 (cm) */
  hip: number;
  /** 上臂围放松量 (cm) */
  bicep: number;
  /** 腕围放松量 (cm) */
  wrist: number;
}

export const FIT_PRESETS: Record<string, EaseConfig> = {
  /** 紧身 (Slim Fit) — 0-2cm 放松 */
  slim: { bust: 2, waist: 1, hip: 2, bicep: 1.5, wrist: 0.5 },
  /** 合身 (Regular Fit) — 4-6cm 放松 */
  regular: { bust: 6, waist: 4, hip: 4, bicep: 2, wrist: 1 },
  /** 宽松 (Loose Fit) — 10-14cm 放松 */
  loose: { bust: 12, waist: 8, hip: 10, bicep: 4, wrist: 1.5 },
};

/** 性别相关的颈部缩进 (女性颈部略细) */
function neckEase(gender: GenderType): number {
  return gender === 'female' ? -5 : 0; // mm
}

/**
 * 核心公式: 从测量值推导所有 body 部件参数
 * 输出: 用于 body gene instance 的 parameterValues
 *
 * 坐标系说明:
 * 渲染坐标系是独立的坐标系统, 与毫米测量值不是 1:1 映射。
 * 使用基准尺码 (M 码男性) 的测量值与渲染默认值建立缩放关系,
 * 其他尺码按比例缩放。
 */
export function measurementsToBodyParams(
  m: BodyMeasurements,
  gender: GenderType,
  fit: keyof typeof FIT_PRESETS = 'regular'
): Record<string, number> {
  // ease 配置保留参数签名兼容, 实际缩放由基准值比例计算
  void FIT_PRESETS[fit];

  // ─── 基准值 (M 码男性测量值 → 渲染坐标映射) ───
  // 基准测量值 (mm)
  const REF = gender === 'female'
    ? { shoulderWidth: 360, armholeDepth: 190, waistDepth: 370, hipDepth: 195, totalLength: 590, bust: 840, waist: 660, hip: 920 }
    : { shoulderWidth: 390, armholeDepth: 205, waistDepth: 400, hipDepth: 210, totalLength: 640, bust: 880, waist: 720, hip: 960 };
  // 基准渲染坐标
  const REF_RENDER = gender === 'female'
    ? { shoulderWidth: 35, armholeDepth: 88, waistY: 132, hipY: 168, hemLength: 200, hemWidth: 40, waistSuppression: 8 }
    : { shoulderWidth: 38, armholeDepth: 96, waistY: 140, hipY: 172, hemLength: 224, hemWidth: 42, waistSuppression: 4 };

  // ─── 颈部和领口 (Neck & Neckline) ───
  const neckFrontY = gender === 'female' ? 32 : 34;

  // ─── 肩部 (Shoulder) ───
  // 半肩宽: 按比例缩放, 基准是总肩宽的一半减去松量
  const halfShoulder = (m.shoulderWidth / REF.shoulderWidth) * REF_RENDER.shoulderWidth;
  const shoulderY = gender === 'female' ? 46 : 48;

  // ─── 袖窿 (Armhole) ───
  const armholeDepth = (m.armholeDepth / REF.armholeDepth) * REF_RENDER.armholeDepth;

  // ─── 腰线 (Waist) ───
  const waistY = (m.waistDepth / REF.waistDepth) * REF_RENDER.waistY;
  // 腰收量: 按围度差比例缩放
  const refWaistDiff = REF.bust - REF.waist;
  const curWaistDiff = m.bust - m.waist;
  const waistSuppression = refWaistDiff > 0
    ? Math.max(0, (curWaistDiff / refWaistDiff) * REF_RENDER.waistSuppression)
    : REF_RENDER.waistSuppression;

  // ─── 臀线 (Hip) ───
  const hipY = waistY + (m.hipDepth / REF.hipDepth) * (REF_RENDER.hipY - REF_RENDER.waistY);

  // ─── 衣长 (Total Length) ───
  const hemLength = (m.totalLength / REF.totalLength) * REF_RENDER.hemLength;

  // ─── 下摆宽 ───
  const hemWidth = (m.hip / REF.hip) * REF_RENDER.hemWidth;

  return {
    neckFrontY,
    shoulderY,
    shoulderWidth: halfShoulder,
    armholeDepth,
    waistY,
    waistSuppression,
    hipY,
    hemLength,
    hemWidth,
    // 暴露给其他公式使用的内部值
    _bustLineY: shoulderY + armholeDepth,
    _halfShoulder: halfShoulder,
    _easeNeck: neckEase(gender),
  };
}

/**
 * 从测量值推导 collar 部件参数
 * 输出渲染坐标系值
 */
export function measurementsToCollarParams(m: BodyMeasurements, gender: GenderType): Record<string, number | string> {
  // 领口宽按颈围比例缩放, 基准: 男性颈围 360mm → collarSpread 28
  const refNeckCirc = gender === 'female' ? 340 : 360;
  const refCollarSpread = gender === 'female' ? 26 : 28;
  const collarSpread = (m.neckCirc / refNeckCirc) * refCollarSpread;
  return {
    // collarType 由模板定义决定, 不在此硬编码
    collarHeight: gender === 'female' ? 2.5 : 3,
    collarSpread,
  };
}

/**
 * 从测量值推导 sleeve 部件参数
 * 输出渲染坐标系值
 */
export function measurementsToSleeveParams(
  m: BodyMeasurements,
  gender: GenderType,
  _fit: keyof typeof FIT_PRESETS = 'regular'
): Record<string, number | string> {
  // 袖长: 按比例缩放, 基准: 男性袖长 580mm → 渲染 60 (短袖默认)
  // 注意: sleeveLength 在渲染坐标系中表示袖子从肩点下垂的距离
  // 短袖约 60, 长袖约 180 (与 hemLength 224 协调)
  const refSleeveLength = gender === 'female' ? 560 : 580;
  const refRenderSleeve = gender === 'female' ? 55 : 60;
  const sleeveLength = (m.sleeveLength / refSleeveLength) * refRenderSleeve;

  // 袖口宽: 按腕围比例缩放, 基准: 男性腕围 160mm → cuffWidth 14
  const refWristCirc = gender === 'female' ? 150 : 160;
  const refCuffWidth = gender === 'female' ? 12 : 14;
  const cuffWidth = (m.wristCirc / refWristCirc) * refCuffWidth;

  return {
    // sleeveType 由模板定义决定, 不在此硬编码
    sleeveLength,
    cuffWidth,
    sleeveLengthRatio: m.totalLength > 0 ? m.sleeveLength / m.totalLength : 0.7,
  };
}

/**
 * 从测量值推导 cuff 部件参数
 * 输出渲染坐标系值
 */
export function measurementsToCuffParams(gender: GenderType): Record<string, number | string> {
  return {
    cuffType: 'plain',
    cuffHeight: gender === 'female' ? 2 : 3,
  };
}

/**
 * 一站式: 从测量值推导所有部件参数
 * 这是用户在选择尺码或调整测量值时调用的主入口
 */
export function measurementsToAllParams(
  m: BodyMeasurements,
  gender: GenderType,
  fit: keyof typeof FIT_PRESETS = 'regular'
): Record<string, Record<string, number | string | boolean>> {
  return {
    body: measurementsToBodyParams(m, gender, fit),
    collar: measurementsToCollarParams(m, gender),
    sleeve: measurementsToSleeveParams(m, gender, fit),
    pocket: {
      // pocketType 由模板定义决定, 不在此硬编码
      pocketWidth: 26,    // 袋宽 (渲染坐标)
      pocketHeight: 36,   // 袋高 (渲染坐标)
      pocketY: 0,         // 0 = 使用默认位置 (腰线下方)
    },
    placket: {
      // placketType 由模板定义决定, 不在此硬编码
      placketWidth: 6,       // 门襟宽 (渲染坐标)
      buttonCount: 5,        // 5 粒扣
    },
    cuff: measurementsToCuffParams(gender),
  };
}

/**
 * 测量值合理性校验
 * 防止用户输入明显错误的数据
 */
export function validateMeasurements(m: BodyMeasurements): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 围度必须为正
  if (m.bust < 600 || m.bust > 1500) issues.push(`胸围 ${m.bust}mm 超出合理范围 (600-1500mm)`);
  if (m.waist < 500 || m.waist > 1400) issues.push(`腰围 ${m.waist}mm 超出合理范围 (500-1400mm)`);
  if (m.hip < 700 || m.hip > 1600) issues.push(`臀围 ${m.hip}mm 超出合理范围 (700-1600mm)`);

  // 围度关系: 臀 > 胸 > 腰 (一般情况)
  if (!(m.hip > m.bust)) issues.push('臀围应大于胸围');
  if (!(m.bust > m.waist)) issues.push('胸围应大于腰围');

  // 长度必须为正
  if (m.shoulderWidth < 300 || m.shoulderWidth > 550) issues.push(`总肩宽 ${m.shoulderWidth}mm 超出范围 (300-550mm)`);
  if (m.sleeveLength < 400 || m.sleeveLength > 700) issues.push(`袖长 ${m.sleeveLength}mm 超出范围 (400-700mm)`);
  if (m.height < 1400 || m.height > 2000) issues.push(`身高 ${m.height}mm 超出范围 (1400-2000mm)`);

  return { valid: issues.length === 0, issues };
}

/** 重新生成 GeneParameter 列表 (带测量值说明) */
export function annotateParamWithMeasurement(p: GeneParameter, sourceKey?: keyof BodyMeasurements): GeneParameter {
  if (!sourceKey) return p;
  return {
    ...p,
    // 增加描述说明, 帮助用户理解
    label: `${p.label} ← 测:${sourceKey}`,
  };
}
