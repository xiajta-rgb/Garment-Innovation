import { beforeEach, describe, expect, it } from 'vitest';
import { useDesignStore } from '@/store/useDesignStore';
import { listExecutablePatterns } from '@/data/patternLibrary';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { groupSolutionPieces } from '@/lib/pattern/piece-registry';
describe('reviewed template switching',()=>{
 beforeEach(()=>useDesignStore.getState().newDesign());
 it('all eight executable templates use source geometry and retain production warnings',()=>{for(const p of listExecutablePatterns()){const s=useDesignStore.getState();s.updateMeasurements(getReferenceMeasurements(p.id==='womens-basic-tee'?'female':'male','M'));s.applyPattern(p.id);const next=useDesignStore.getState();expect(next.activePatternId).toBe(p.id);expect(next.lastError).toBeNull();expect(next.draft.paths.every(p=>p.referenceVersion==='4.10.2'&&p.pieceId)).toBe(true);expect(groupSolutionPieces(next.draft.paths)).toHaveLength(p.id==='panel-circle-skirt'?2:p.id==='button-up-shirt'?10:p.id==='bound-tank'?4:p.id==='hooded-zip-sweatshirt'?7:3);}});
 it('switching tee to shirt changes construction, without a fabricated pocket',()=>{const s=useDesignStore.getState();s.applyPattern('t-shirt');expect(groupSolutionPieces(useDesignStore.getState().draft.paths)).toHaveLength(3);s.applyPattern('button-up-shirt');const pieces=groupSolutionPieces(useDesignStore.getState().draft.paths);expect(pieces).toHaveLength(10);expect(pieces.some(p=>p.category==='pocket')).toBe(false);});
 it('size changes use complete explicit source samples and failed inputs remove the previous geometry',()=>{const s=useDesignStore.getState();s.applyPattern('t-shirt');s.setSize('L');expect(useDesignStore.getState().measurements).toEqual(getReferenceMeasurements('male','L'));s.updateMeasurements({waistToArmpit:undefined});expect(useDesignStore.getState().draft.paths).toEqual([]);expect(useDesignStore.getState().lastError).toBeTruthy();expect(useDesignStore.getState().draft.issues.some(v=>v.level==='error')).toBe(true);});
});
