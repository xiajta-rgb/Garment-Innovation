import { describe, expect, it } from 'vitest';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { groupSolutionPieces, validateAllPieces, pieceKeyFor } from '@/lib/pattern/piece-registry';
const m=getReferenceMeasurements('male','M');
describe('piece identity and drawing checks',()=>{
  it('keeps ten Simon identities, both fronts, both collars and both back sections separate',()=>{const d=draftStandard('button-up-shirt',m);const grouped=validateAllPieces(groupSolutionPieces(d.pieces.flatMap(p=>p.paths)));expect(grouped).toHaveLength(10);expect(new Set(grouped.map(p=>p.key)).size).toBe(10);expect(grouped.every(p=>p.pass)).toBe(true);expect(grouped.filter(p=>p.checks.some(c=>c.id==='C5-grain'&&!c.pass)).map(p=>p.key).sort()).toEqual(['simon.cuff','simon.sleevePlacketOverlap','simon.sleevePlacketUnderlap'].sort());expect(grouped.find(p=>p.key==='simon.cuff')!.tags).toContain('cut4');expect(grouped.find(p=>p.key==='simon.frontLeft')!.tags).toContain('single');expect(grouped.find(p=>p.key==='simon.yoke')!.tags).toContain('cut2');expect(grouped.find(p=>p.key==='simon.yoke')!.tags).not.toContain('fold');});
  it('missing source cutting segments cannot pass the preview gate',()=>{const d=draftStandard('button-up-shirt',m);const p=d.pieces.find(p=>p.id==='simon.frontRight')!;const paths=p.paths.filter(path=>!path.id.endsWith(':ffsa'));expect(validateAllPieces(groupSolutionPieces(paths))[0].pass).toBe(false);});
  it('explicit piece identity takes precedence over category/view',()=>{expect(pieceKeyFor('body','front','simon.frontLeft')).not.toBe(pieceKeyFor('body','front','simon.frontRight'));expect(pieceKeyFor('body','front')).toBe('body:front');});
});
