import type { BodyMeasurements } from '@/types/measurements';
import type { GenePathData, GenderType, RuleViolation } from '@/types/gene';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { composePattern } from '@/lib/patterns/compose';
export interface PatternComputeResult {
  paths: GenePathData[]; anchors: Record<string, { x: number; y: number }>; error: string | null;
  violations: RuleViolation[]; draftStats: import('@/lib/pattern/drafting').DraftStats | null;
}
export function recomputePatternLogic(id: string, measurements: BodyMeasurements, gender: GenderType, fit: 'slim' | 'regular' | 'loose', view: 'front' | 'back'): PatternComputeResult {
  try {
    const pattern = PATTERN_LIBRARY[id];
    if (!pattern) throw new Error(`模板不存在：${id}`);
    const solution = composePattern(pattern, {}, measurements, gender, { view, userOverrides: { fit } });
    return { paths: solution.paths, anchors: solution.anchors as Record<string, { x: number; y: number }>, error: null,
      violations: [{ ruleId: 'production-unapproved', level: 'warning', message: `${PATTERN_REVIEWS[id].engine} 参考几何；${PATTERN_REVIEWS[id].limitations}` }], draftStats: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { paths: [], anchors: {}, error: message, violations: [{ ruleId: 'draft-blocked', level: 'error', message }], draftStats: null };
  }
}
