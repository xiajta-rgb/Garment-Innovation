/** Execute only complete reviewed engines. A labelled legacy block is not a reviewed template. */
import type { PatternDefinition, PatternSolution } from './types';
import type { BodyMeasurements, GenderType } from '@/types/measurements';
import { requireReviewedPattern } from '@/data/patternReview';
import { assertCanonicalPattern } from '@/data/patternLibrary';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { draftBrian } from '@/lib/pattern/reference/brian';
import { brianPiecePaths } from '@/lib/pattern/reference/brian-paths';
import type { ConstructionSelection } from '@/types/construction';
import { readConstructionSelection } from '@/lib/pattern/construction-selection';
export class CompositionError extends Error { constructor(message: string, public readonly blockId?: string) { super(message); this.name = 'CompositionError'; } }
export interface ComposeOptions {
  construction?: ConstructionSelection;
  view?: 'front' | 'back' | 'all';
  userOverrides?: Record<string, number | string | boolean>;
}
export function composePattern(pattern: PatternDefinition, _extraParams?: Record<string, number | string | boolean>, measurements?: BodyMeasurements, _gender?: GenderType, options: ComposeOptions = {}): PatternSolution {
  const started = performance.now();
  const review = requireReviewedPattern(pattern.id);
  const construction = readConstructionSelection(pattern.id, options.construction);
  assertCanonicalPattern(pattern);
  if (!measurements) throw new CompositionError('缺少真实制版测量值');
  const fit = options.userOverrides?.fit ?? 'regular';
  if (!['slim', 'regular', 'loose'].includes(String(fit))) throw new CompositionError('未声明的松量方案');
  const view = options.view ?? 'front';
  if (review.engine !== 'brian') {
    const draft = draftStandard(pattern.id, measurements, fit as 'regular', construction);
    const assembly = draft.assembly;
    return { paths: draft.pieces.filter(p => view === 'all' || p.view === view || p.view === 'all').flatMap(p => p.paths), anchors: {}, assembly, solveTimeMs: performance.now() - started };
  }
  const draft = draftBrian(measurements, { fit: fit as 'regular' });
  if (!draft.geometryPass) throw new CompositionError('Brian 走缝约束未通过，已阻断映射');
  const assembly = draft.assembly;
  return { paths: draft.pieces.filter(p => view === 'all' || p.kind === view || p.kind === 'sleeve').flatMap(brianPiecePaths), anchors: {}, assembly, solveTimeMs: performance.now() - started };
}
