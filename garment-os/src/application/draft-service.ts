import type { DesignConfiguration } from '@/types/design';
import type { DraftIssue, PatternPath } from '@/types/pattern';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { composePattern } from '@/lib/patterns/compose';
import { groupSolutionPieces, validateAllPieces, type PieceRecord } from '@/lib/pattern/piece-registry';
import { makeGateKey } from '@/lib/pattern/preview-gate';
import type { AssemblyReport } from '@/types/assembly';
import { AssemblyError } from '@/lib/pattern/assembly/validate';
import { readConstructionSelection } from '@/lib/pattern/construction-selection';

export interface DraftResult {
  status: 'reference' | 'blocked'; paths: PatternPath[]; pieces: PieceRecord[];
  issues: DraftIssue[]; error: string | null; gateKey: string; productionApproved: false;
  assembly: AssemblyReport | null;
}
/** Complete draft + preview checks have one owner and never depend on React or storage. */
export function computeDraft(input: DesignConfiguration): DraftResult {
  const gateKey = makeGateKey(input.activePatternId, input.gender, input.fit, input.standardSize, input.measurements as unknown as Record<string, number>, input.construction);
  try {
    const construction = readConstructionSelection(input.activePatternId, input.construction);
    const pattern = PATTERN_LIBRARY[input.activePatternId];
    if (!pattern) throw new Error(`模板不存在：${input.activePatternId}`);
    const solution = composePattern(pattern, {}, input.measurements, input.gender, { view: 'all', userOverrides: { fit: input.fit }, construction });
    const review = PATTERN_REVIEWS[pattern.id];
    const pieces = validateAllPieces(groupSolutionPieces(solution.paths), 10).map(piece => {
      const pass = piece.paths.every(path => path.referenceVersion === input.engineVersion && path.referenceEngine === review.engine && path.pieceId === piece.key);
      return { ...piece, pass: piece.pass && pass, checks: [...piece.checks, { id: 'C8-reference', label: '同版本参考几何', pass,
        detail: `${review.engine} ${input.engineVersion}；生产待验收` }] };
    });
    if (!pieces.length || pieces.some(p => !p.pass)) throw new Error('参考裁片检查未通过，已停止映射');
    return { status: 'reference', paths: solution.paths, pieces, assembly: solution.assembly, gateKey, error: null, productionApproved: false,
      issues: [{ ruleId: 'production-unapproved', level: 'warning', message: `${review.engine} 参考几何；${review.limitations}` },
        ...solution.assembly.pending.map(p => ({ ruleId: p.code, level: 'warning' as const, message: `${p.subject}：${p.message}` })),
        ...(solution.assembly.construction?.operations.filter(op=>op.status!=='dimensioned').map(op=>({ruleId:`construction-${op.id}`,level:'warning' as const,message:`${op.label}：${op.requirements.join(' ')}`}))??[])] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'blocked', paths: [], pieces: [], assembly: error instanceof AssemblyError ? error.report : null, error: message, gateKey, productionApproved: false,
      issues: [{ ruleId: 'draft-blocked', level: 'error', message }] };
  }
}
