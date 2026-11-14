/**
 * 毫米制版引擎 (Drafting Engine) — 公开出口
 *
 * 用法 (Block 内):
 *   const front = draftBodice(m, gender, 'front', { fit });
 *   const seamPath = seamAllowancePath(front.contour);
 */

export * from './geometry';
export * from './aldrich';
export * from './seam-allowance';
export * from './constraints';
export * from './parts';

import type { BodyMeasurements } from '@/types/measurements';
import type { GenderType } from '@/types/gene';
import { draftBodice, draftSleeve, type DraftOptions } from './aldrich';
import { INDUSTRIAL_SEAM, segmentedGrossArea } from './seam-allowance';
import { INDUSTRIAL_WIDTHS } from './aldrich';

/**
 * 一次求解全套衣身+袖毛样面积 (mm²) — BOM 用料估算的输入
 *
 * 件数规则 (T 恤类标准):
 *   前片 ×1, 后片 ×1, 袖片 ×2 (左右对称一片裁两件)
 */
export function estimatePatternGrossAreas(
  m: BodyMeasurements,
  gender: GenderType,
  opts: DraftOptions = { fit: 'regular' },
): { front: number; back: number; sleeve: number; totalPerGarment: number } {
  const frontDraft = draftBodice(m, gender, 'front', opts);
  const backDraft = draftBodice(m, gender, 'back', opts);
  const sleeveDraft = draftSleeve(m, gender, frontDraft.armholeLength, backDraft.armholeLength, opts);
  const w = opts.seamAllowanceMm ?? INDUSTRIAL_SEAM.default;

  // 分段缝份面积 (对折边 0 / 领口 6 / 缝合 10 / 下摆 25) — 生产级 BOM 用量
  const widths = { ...INDUSTRIAL_WIDTHS, seam: w };
  const front = segmentedGrossArea(frontDraft.edges, widths);
  const back = segmentedGrossArea(backDraft.edges, widths);
  const sleeve = segmentedGrossArea(sleeveDraft.edges, widths);

  return {
    front,
    back,
    sleeve,
    totalPerGarment: front + back + sleeve * 2,
  };
}





