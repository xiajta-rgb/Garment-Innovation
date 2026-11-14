/**
 * ─────────────────────────────────────────────────────────────
 *  制版约束校验引擎 (Pattern Validation Engine)
 * ─────────────────────────────────────────────────────────────
 *
 *  核心理念: 标准化的输出不允许错乱 —
 *  每一次制版求解后, 必须通过工业制版规则的机器校验:
 *   - error  : 违反缝合/人体/工艺可行性 → 纸样不可用, 阻断
 *   - warning: 偏离常规工艺范围但可裁剪 → 提示制版师复核
 *
 *  规则全部可追溯到出处 (Aldrich / GB / 服装工程经验值)。
 */

import type { RuleViolation } from '@/types/gene';
import type { BodyMeasurements } from '@/types/measurements';
import type { GenderType } from '@/types/gene';
import {
  draftBodice, draftSleeve, type DraftOptions,
} from './aldrich';

// ════════════════════════════════════════════════════════════
// 校验结果
// ════════════════════════════════════════════════════════════

/** 校验统计 (给 UI 展示 "为何版型可信") */
export interface DraftStats {
  /** 袖窿弧长 AH (mm) */
  armholeLength: number;
  /** 袖山弧长 (mm) */
  capCurveLength: number;
  /** 吃势 (mm) */
  capEase: number;
  /** 袖山高 / 袖窿深 比率 */
  capRatio: number;
  /** 前后侧缝差 (mm) */
  sideSeamDelta: number;
  /** 前后肩线差 (mm) */
  shoulderDelta: number;
  /** 领口弧长 (mm) */
  necklineLength: number;
  /** 袖肥 (mm) */
  bicepWidth: number;
}

export interface ValidationResult {
  violations: RuleViolation[];
  /** 是否有阻断级违规 (error) */
  blocked: boolean;
  stats: DraftStats;
}

// ════════════════════════════════════════════════════════════
// 工程常数 (每条都有出处)
// ════════════════════════════════════════════════════════════

/** 袖山吃势常规范围 (mm) — 专业制版标准: 合体梭织装袖 30~45 (dresspatternmaking/Aldrich), 针织 T 恤 8~15 */
const CAP_EASE_OK: [number, number] = [22, 48];
const CAP_EASE_WARN: [number, number] = [15, 55];
/** 袖山高比例范围 — Aldrich: scye×0.70~0.80, 工程上限 0.9 */
const CAP_RATIO_OK: [number, number] = [0.6, 0.85];
/** 前后侧缝长度允差 (mm) — 走样(walking)常规: ≤8 提示, >20 无法缝合 */
const SIDE_SEAM_TOL = 8;
const SIDE_SEAM_HARD = 20;
/** 前后肩线允差 (mm) */
const SHOULDER_TOL = 3;
/** 缝份范围 (mm) — 工业: 6~15 常规, 下摆折边 15~30 */
const SEAM_RANGE: [number, number] = [5, 30];

// ════════════════════════════════════════════════════════════
// 主校验入口: 一次完整制版 → 违规列表 + 可信度统计
// ════════════════════════════════════════════════════════════

export function validateDraftedPattern(
  m: BodyMeasurements,
  gender: GenderType,
  opts: DraftOptions = { fit: 'regular' },
): ValidationResult {
  const violations: RuleViolation[] = [];
  const V = (ruleId: string, message: string, level: 'error' | 'warning') =>
    violations.push({ ruleId, message, level });

  // ── R0. 测量值本体有效性 ──
  const mFields: Array<[keyof BodyMeasurements, number]> = [
    ['neckCirc', 250], ['bust', 400], ['waist', 400], ['hip', 400],
    ['shoulderWidth', 250], ['sleeveLength', 100], ['wristCirc', 100],
    ['backLength', 250], ['frontLength', 250], ['totalLength', 350],
  ];
  for (const [k, min] of mFields) {
    const v = m[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min) {
      V(`m-${k}-invalid`, `测量值 ${k}=${v} 无效 (下限 ${min}mm), 无法制版`, 'error');
    }
  }
  if (violations.some((v) => v.ruleId.startsWith('m-'))) {
    // 测量值已崩坏, 后续几何无意义 — 立即返回
    return { violations, blocked: true, stats: emptyStats() };
  }

  // ── 求解 (约束引擎与渲染共用同一公式源) ──
  const front = draftBodice(m, gender, 'front', opts);
  const back = draftBodice(m, gender, 'back', opts);
  const sleeve = draftSleeve(m, gender, front.armholeLength, back.armholeLength, opts);

  // ── R1. 肩宽体系一致性 ──
  // 领口宽必须小于肩宽 (人体结构)
  const neckHalf = m.neckCirc / 5 - 5;
  if (neckHalf * 2 >= m.shoulderWidth) {
    V('neck-wider-than-shoulder',
      `领口宽 ${(neckHalf * 2).toFixed(0)}mm ≥ 肩宽 ${m.shoulderWidth.toFixed(0)}mm, 人体学不可行`,
      'error');
  }

  // ── R2. 袖山吃势 (装袖工艺核心) ──
  if (sleeve.capEase < CAP_EASE_OK[0]) {
    V('cap-ease-insufficient',
      `袖山吃势 ${sleeve.capEase.toFixed(1)}mm 不足 (<${CAP_EASE_OK[0]}mm), 装袖后起皱`,
      sleeve.capEase < CAP_EASE_WARN[0] ? 'error' : 'warning');
  } else if (sleeve.capEase > CAP_EASE_OK[1]) {
    V('cap-ease-excessive',
      `袖山吃势 ${sleeve.capEase.toFixed(1)}mm 过大 (>${CAP_EASE_OK[1]}mm), 吃缝不匀`,
      sleeve.capEase > CAP_EASE_WARN[1] ? 'error' : 'warning');
  }

  // ── R3. 袖山高比例 ──
  const capRatio = sleeve.capHeight / front.scyeDepth;
  if (capRatio < CAP_RATIO_OK[0] || capRatio > CAP_RATIO_OK[1]) {
    V('cap-height-out-of-range',
      `袖山高比例 ${capRatio.toFixed(2)} 超出 [${CAP_RATIO_OK[0]}, ${CAP_RATIO_OK[1]}] (Aldrich 0.70~0.80)`,
      'error');
  }

  // ── R4. 袖肥与上臂围 (穿着可行性) ──
  const bicepEaseFit = opts.fit === 'slim' ? 40 : opts.fit === 'loose' ? 80 : 60;
  const minBicepWidth = (m.bicep + bicepEaseFit) / 2;
  if (sleeve.bicepWidth < minBicepWidth) {
    V('bicep-width-insufficient',
      `袖肥 ${sleeve.bicepWidth.toFixed(0)}mm < 上臂围需求 ${minBicepWidth.toFixed(0)}mm (臂围${m.bicep}+松量${bicepEaseFit}), 穿不进`,
      'error');
  }

  // ── R5. 前后侧缝缝合可行性 ──
  const sideSeamDelta = Math.abs(front.sideSeamLength - back.sideSeamLength);
  if (sideSeamDelta > SIDE_SEAM_TOL) {
    V('side-seam-mismatch',
      `前后侧缝差 ${sideSeamDelta.toFixed(1)}mm > ${SIDE_SEAM_TOL}mm, 需走样校正或吃缩`,
      sideSeamDelta > SIDE_SEAM_HARD ? 'error' : 'warning');
  }

  // ── R6. 前后肩线一致性 ──
  const shoulderDelta = Math.abs(front.shoulderLength - back.shoulderLength);
  if (shoulderDelta > SHOULDER_TOL) {
    V('shoulder-mismatch',
      `前后肩线差 ${shoulderDelta.toFixed(1)}mm > ${SHOULDER_TOL}mm, 肩缝无法对齐`,
      'error');
  }

  // ── R7. 领口弧长合理性 (vs 颈围) ──
  // 前后片均为对折裁剪 (quarter piece): 完整领口弧长 = (前+后) × 2
  const necklineSum = (front.necklineLength + back.necklineLength) * 2;
  if (necklineSum < m.neckCirc * 0.75 || necklineSum > m.neckCirc * 1.35) {
    V('neckline-length-sane',
      `领口弧长 ${necklineSum.toFixed(0)}mm 偏离颈围 ${m.neckCirc}mm 合理区间 (75%~135%)`,
      'error');
  }

  // ── R8. 下摆宽度 (套头可行性) ──
  // 前后片均为对折裁剪 (quarter piece): 完整下摆围 = 半片下摆宽 × 4
  const hemCirc = Math.max(Math.abs(front.points.hemSide.x), Math.abs(back.points.hemSide.x)) * 4;
  if (hemCirc < m.hip * 0.85) {
    V('hem-tighter-than-hip',
      `成衣下摆约 ${hemCirc.toFixed(0)}mm < 臀围 ${m.hip.toFixed(0)}mm 的 85%, 套头穿不进 (需开衩或罗纹)`,
      'warning');
  }

  // ── R9. 缝份范围 ──
  const seamW = opts.seamAllowanceMm ?? 10;
  if (seamW < SEAM_RANGE[0] || seamW > SEAM_RANGE[1]) {
    V('seam-allowance-range',
      `缝份 ${seamW}mm 超出工业范围 [${SEAM_RANGE[0]}, ${SEAM_RANGE[1]}]mm`,
      'error');
  }

  // ── R10. 袖口可行性 ──
  const minCuff = m.wristCirc + 20;
  if (sleeve.cuffWidth < minCuff) {
    V('cuff-too-tight',
      `袖口 ${sleeve.cuffWidth.toFixed(0)}mm < 腕围+20mm (${minCuff.toFixed(0)}mm), 手穿不过`,
      'error');
  }

  const stats: DraftStats = {
    armholeLength: front.armholeLength + back.armholeLength,
    capCurveLength: sleeve.capCurveLength,
    capEase: sleeve.capEase,
    capRatio,
    sideSeamDelta,
    shoulderDelta,
    necklineLength: necklineSum,
    bicepWidth: sleeve.bicepWidth,
  };

  return {
    violations,
    blocked: violations.some((v) => v.level === 'error'),
    stats,
  };
}

function emptyStats(): DraftStats {
  return {
    armholeLength: 0, capCurveLength: 0, capEase: 0, capRatio: 0,
    sideSeamDelta: 0, shoulderDelta: 0, necklineLength: 0, bicepWidth: 0,
  };
}



