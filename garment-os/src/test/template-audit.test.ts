import { describe, expect, it } from 'vitest';
import { listPatterns, assertCanonicalPattern } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { composePattern } from '@/lib/patterns/compose';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { useDesignStore } from '@/store/useDesignStore';
const m=getReferenceMeasurements('male','M');
describe('every template receives a bounded review disposition',()=>{
  it('catalogue and reviews are exactly the same fourteen templates',()=>{expect(listPatterns()).toHaveLength(14);expect(Object.keys(PATTERN_REVIEWS).sort()).toEqual(listPatterns().map(p=>p.id).sort());expect(Object.values(PATTERN_REVIEWS).filter(r=>r.disposition==='rebuild-required')).toHaveLength(4);});
  for(const pattern of listPatterns()) it(`${pattern.id}: reviewed reference or blocked legacy`,()=>{
    const review=PATTERN_REVIEWS[pattern.id];expect(review.reason).toBeTruthy();expect(review.limitations).toBeTruthy();
    if(review.engine){expect(composePattern(pattern,{},m).paths.length).toBeGreaterThan(0);}
    else {expect(pattern.blocks).toEqual([]);expect(()=>composePattern(pattern,{},m)).toThrow();useDesignStore.getState().newDesign();useDesignStore.getState().applyPattern(pattern.id);expect(useDesignStore.getState().activePatternId).toBe('brian-reference');expect(useDesignStore.getState().lastError).toBeTruthy();}
  });
  it('modified or unknown definitions cannot masquerade as a reviewed engine',()=>{const p=listPatterns()[0];expect(()=>assertCanonicalPattern({...p,blocks:[]})).toThrow();expect(()=>composePattern({...p,blocks:[]},{},m)).toThrow();expect(()=>composePattern({...p,id:'unreviewed'},{},m)).toThrow();expect(Object.isFrozen(p)).toBe(true);expect(Object.isFrozen(p.blocks)).toBe(true);});
  it('keeps no simulation or fabricated cost state in the canonical editor',()=>{
    const state=useDesignStore.getState();
    for(const key of ['instances','parameters','bomItems','cost','anchors','patternPaths','violations']) expect(state).not.toHaveProperty(key);
    for(const p of listPatterns().filter(p=>PATTERN_REVIEWS[p.id].engine)) {
      state.updateMeasurements(m); state.applyPattern(p.id);
      expect(useDesignStore.getState().draft.productionApproved).toBe(false);
    }
  });
});
