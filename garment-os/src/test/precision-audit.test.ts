import { describe, expect, it } from 'vitest';
import { listExecutablePatterns } from '@/data/patternLibrary';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { useDesignStore } from '@/store/useDesignStore';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { flattenSvgPathD } from '@/lib/pattern/geometry';
describe('reference paths and dimensional provenance',()=>{
  it('SVG close returns to each subpath origin and exponent coordinates retain scale',()=>{expect(flattenSvgPathD('M1e2 0 L120 0 L120 10 Z').at(-1)).toEqual({x:100,y:0});});
  it('front/back recompute preserves independent identities with no duplicate common pieces',()=>{useDesignStore.getState().newDesign();useDesignStore.getState().updateMeasurements(getReferenceMeasurements('male','M'));for(const p of listExecutablePatterns()){useDesignStore.getState().applyPattern(p.id);const paths=useDesignStore.getState().draft.paths;expect(new Set(paths.map(p=>p.id)).size).toBe(paths.length);expect(useDesignStore.getState().draft.issues.some(v=>v.ruleId==='production-unapproved')).toBe(true);}});
  it('preserves actual shirt button locations, pleats, darts and split cutting boundaries',()=>{const d=draftStandard('button-up-shirt',getReferenceMeasurements('male','M'));const left=d.pieces.find(p=>p.id==='simon.frontLeft')!,sleeve=d.pieces.find(p=>p.id==='simon.sleeve')!;expect(Object.values(left.markings).filter(m=>m.kind==='buttonhole').length).toBeGreaterThan(0);expect(Object.keys(left.cutPaths)).toEqual(['ffsa','saFromArmhole','hemSa','saConnect']);expect(sleeve.paths.some(p=>p.layer==='fold-line')).toBe(true);});
});
