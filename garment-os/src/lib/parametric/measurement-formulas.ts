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
 */
export function measurementsToBodyParams(
  m: BodyMeasurements,
  gender: GenderType,
  fit: keyof typeof FIT_PRESETS = 'regular'
): Record<string, number> {
  const ease = FIT_PRESETS[fit];

  // ─── 颈部和领口 (Neck & Neckline) ───
  // 前领口深 = 颈围 / 5 + 1.5cm (基础领)
  const neckFrontY = 34; // 前颈点 y 坐标 (相对位置, 不会随身高变化)

  // ─── 肩部 (Shoulder) ───
  // 半肩宽 = 总肩宽 / 2 - 1cm (肩部松量)
  const halfShoulder = m.shoulderWidth / 2 - 10;
  // 肩线 Y = 锁骨水平位置 (固定 48mm 相对原点)
  const shoulderY = 48;

  // ─── 袖窿 (Armhole) ───
  // 袖窿深 = 标准袖窿深 + 0.5cm (前后差)
  const armholeDepth = m.armholeDepth + 5;

  // ─── 胸围到袖窿距离 ───
  // bust line Y (胸围水平线) = 肩线 Y + 袖窿深
  const bustLineY = shoulderY + armholeDepth;

  // ─── 腰线 (Waist) ───
  // 腰线 Y = 腰深 + 肩线 Y
  const waistY = m.waistDepth + shoulderY;
  // 腰收量 = (胸围 - 腰围)/4 + 1cm 放松余量
  const waistSuppression = Math.max(0, (m.bust - m.waist) / 4 - ease.waist * 10);

  // ─── 臀线 (Hip) ───
  // 臀线 Y = 腰线 Y + 臀深
  const hipY = waistY + m.hipDepth;

  // ─── 衣长 (Total Length) ───
  // 衣长 = 总长 - 肩部到衣领的距离
  const hemLength = m.totalLength - 30; // 减去领口到肩线距离

  // ─── 下摆宽 ───
  // 下摆宽 (半) = (臀围 + 放松) / 4
  const hemWidth = (m.hip + ease.hip * 10) / 4;

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
    _bustLineY: bustLineY,
    _halfShoulder: halfShoulder,
    _easeNeck: neckEase(gender),
  };
}

/**
 * 从测量值推导 collar 部件参数
 */
export function measurementsToCollarParams(m: BodyMeasurements, _gender: GenderType): Record<string, number | string> {
  return {
    collarType: 'round', // 默认圆领
    collarHeight: 14,    // 基础领高 14mm
    // 领口宽 (半) = 颈围 / 5 + 1cm
    collarSpread: m.neckCirc / 5 + 10,
  };
}

/**
 * 从测量值推导 sleeve 部件参数
 */
export function measurementsToSleeveParams(
  m: BodyMeasurements,
  _gender: GenderType,
  fit: keyof typeof FIT_PRESETS = 'regular'
): Record<string, number | string> {
  const ease = FIT_PRESETS[fit];
  return {
    sleeveType: 'long',
    // 袖长 = 测量袖长
    sleeveLength: m.sleeveLength,
    // 袖口宽 (半) = (腕围 + 放松) / 2
    cuffWidth: (m.wristCirc + ease.wrist * 10) / 2,
    // 袖长比例 = 1.0 (用绝对长度, 不依赖大身)
    sleeveLengthRatio: m.totalLength > 0 ? m.sleeveLength / m.totalLength : 0.7,
  };
}

/**
 * 从测量值推导 cuff 部件参数
 */
export function measurementsToCuffParams(_m: BodyMeasurements): Record<string, number | string> {
  return {
    cuffType: 'plain',
    cuffHeight: 14, // 基础袖口高
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
      pocketType: 'none', // 默认无口袋
      pocketWidth: 130,   // 袋宽 13cm
      pocketHeight: 150,  // 袋高 15cm
      pocketY: 600,       // 袋位 (后续由 anchor 推导)
    },
    placket: {
      placketType: 'center', // 默认中开襟
      placketWidth: 30,      // 门襟宽 3cm
      buttonCount: 5,        // 5 粒扣
    },
    cuff: measurementsToCuffParams(m),
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
