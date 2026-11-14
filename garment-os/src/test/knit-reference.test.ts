import { afterAll,expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { Aaron } from '@freesewing/aaron';
import { Huey } from '@freesewing/huey';
import * as models from '@freesewing/models';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { getReferenceMeasurements,referenceProfileId } from '@/data/referenceMeasurements';
import { groupSolutionPieces,validateAllPieces } from '@/lib/pattern/piece-registry';
import { requireSourcePieceRole } from '@/data/pieceRoleBindings';

const evidence:unknown[]=[];
for(const [id,engine,Design,count]of [['bound-tank','aaron',Aaron,4],['hooded-zip-sweatshirt','huey',Huey,7]] as const)
for(const gender of ['male','female']as const)for(const size of ['XS','S','M','L','XL','XXL','XXXL']as const)for(const fit of ['slim','regular','loose']as const){
  it(`${id}/${gender}/${size}/${fit}: identical original curves, SA, folds, quantities and exact roles`,()=>{
    const model=models[referenceProfileId(gender,size)];
    const chestEase=engine==='aaron'?{slim:.04,regular:.08,loose:.16}[fit]:{slim:.08,regular:.15,loose:.25}[fit];
    const oracle=new Design({measurements:model,options:{chestEase,lengthBonus:0},sa:10,expand:true});oracle.draft();
    const result=draftStandard(id,getReferenceMeasurements(gender,size),fit);
    const raw=oracle.parts[0] as Record<string,{hidden?:boolean;paths:Record<string,{asPathstring():string;hidden?:boolean;attributes:{list:Record<string,string[]>}}>}>;
    const active=Object.entries(raw).filter(([,p])=>!p.hidden&&p.paths.seam).map(([key])=>key).sort();
    expect(result.pieces.map(p=>p.id).sort()).toEqual(active);expect(result.pieces).toHaveLength(count);
    for(const p of result.pieces){
      const part=raw[p.id],binding=requireSourcePieceRole(p.id);
      const points=(part as unknown as {points:Record<string,{x:number;y:number}>}).points;
      for(const [key,point]of Object.entries(p.points))expect(point).toEqual({x:points[key].x,y:points[key].y});
      expect(p.netPathD).toBe(part.paths.seam.asPathstring());
      for(const [key,path]of Object.entries(p.sourcePaths))expect(path.data).toBe(part.paths[key].asPathstring());
      const cutKeys=p.id.endsWith('Binding')?['seam']:p.id.startsWith('aaron.')?['sa','saShoulder']:['sa'];
      expect(p.cutPaths).toEqual(Object.fromEntries(cutKeys.map(k=>[k,part.paths[k].asPathstring()])));
      expect(p.cutInstructions).toEqual((oracle.setStores[0].get('cutlist') as Record<string,unknown>)[p.id]);
      expect(p.paths.every(path=>path.pieceRole===binding.role&&path.materialRole===binding.material)).toBe(true);
    }
    const qc=validateAllPieces(groupSolutionPieces(result.pieces.flatMap(p=>p.paths)));
    expect(qc.map(p=>({id:p.key,failed:p.checks.filter(c=>!c.pass&&c.level!=='warning')})).filter(p=>p.failed.length)).toEqual([]);
    expect(result.assembly.integrityPass).toBe(true);expect(result.assembly.coverage.classifiedEdges).toBe(result.assembly.coverage.totalEdges);
    expect(result.productionApproved).toBe(false);
    evidence.push({id,engine,gender,size,fit,sourceMatch:true,classificationPass:true,productionApproved:false,pieces:result.pieces.map(p=>({id:p.id,qty:p.qty,onFold:p.onFold,material:requireSourcePieceRole(p.id).material})),assembly:result.assembly.coverage});
  });
}
afterAll(()=>{const dir='doc/evidence/capability-20261111';mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/source-matrix.json`,JSON.stringify(evidence,null,2));});
