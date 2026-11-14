import { expect,it } from 'vitest';
import { Simon } from '@freesewing/simon';
import { draftStandard,standardSettings } from '@/lib/pattern/reference/standard';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import type { ConstructionSelection } from '@/types/construction';

it.each(['straight','baseball','slashed'] as const)('%s classifies the full perimeter and pairs side seams with real positive hem extensions',hemStyle=>{
  for(const gender of ['male','female'] as const)for(const size of ['S','M','XL'] as const)for(const bonus of [.1,.25,.4]){
    const m=getReferenceMeasurements(gender,size);m.totalLength=(m.hpsToWaistBack!+m.hipDepth)*(1+bonus);
    const selection:ConstructionSelection={schema:'garment-os/construction/v1',options:{hemStyle}},draft=draftStandard('button-up-shirt',m,'regular',selection);
    expect(draft.assembly.integrityPass).toBe(true);expect(draft.assembly.coverage.classifiedEdges).toBe(draft.assembly.coverage.totalEdges);
    expect(draft.assembly.joins.filter(j=>j.id.startsWith('side-')).every(j=>j.status==='passed'&&Math.abs(j.deltaMm!)<=1)).toBe(true);
    const def=getAssemblyDefinition('button-up-shirt',selection),point=hemStyle==='baseball'?'bballEnd':hemStyle==='slashed'?'hips':'hem';
    for(const id of ['simon.frontLeft','simon.frontRight','simon.back'])expect(def.pieces.find(p=>p.id===id)?.boundaries.find(b=>b.id==='side')?.from).toBe(point);
  }
});
it('hem variants visibly change all three body curves, retaining exact upstream geometry at the source default 25% extension',()=>{
  const m=getReferenceMeasurements('male','M');m.totalLength=(m.hpsToWaistBack!+m.hipDepth)*1.25;
  const contours:Record<string,string[]>={};
  for(const hemStyle of ['straight','baseball','slashed'] as const){
    const selection:ConstructionSelection={schema:'garment-os/construction/v1',options:{hemStyle}},upstream=new Simon(standardSettings('button-up-shirt',m,'regular',selection));upstream.draft();
    const draft=draftStandard('button-up-shirt',m,'regular',selection);
    for(const id of ['simon.frontLeft','simon.frontRight','simon.back']){
      const raw=upstream.parts[0][id] as {paths:{seam:{asPathstring():string}}};
      const piece=draft.pieces.find(p=>p.id===id)!;expect(piece.netPathD).toBe(raw.paths.seam.asPathstring());(contours[id]??=[]).push(piece.netPathD);
    }
  }
  for(const curves of Object.values(contours))expect(new Set(curves).size).toBe(3);
});
it('zero-extension hem choices explicitly disclose the degenerate geometry',()=>{
  const m=getReferenceMeasurements('male','M');
  const draft=draftStandard('button-up-shirt',m,'regular',{schema:'garment-os/construction/v1',options:{hemStyle:'baseball'}});
  expect(draft.assembly.construction?.operations.find(o=>o.id==='body-hems')?.requirements.join('')).toContain('曲线下摆会退化');
});
