import {afterAll,expect,it} from 'vitest';
import {Sandy} from '@freesewing/sandy';
import * as models from '@freesewing/models';
import {mkdirSync,writeFileSync} from 'node:fs';
import {draftStandard,standardSettings} from '@/lib/pattern/reference/standard';
import {getReferenceMeasurements,referenceProfileId} from '@/data/referenceMeasurements';
import {readConfiguration} from '@/application/design-document';
import {createPattern3d} from '@/application/pattern-3d';
import {computeDraft} from '@/application/draft-service';
import {readConstructionSelection} from '@/lib/pattern/construction-selection';
import {SKIRT_PATTERN_ID,SKIRT_PARAMETERS} from '@/data/skirtMethods';
import {useDesignStore} from '@/store/useDesignStore';
import type {ConstructionSelection} from '@/types/construction';
import type {StandardSize} from '@/types/measurements';
interface SourcePart {hidden:boolean;points:Record<string,{x:number;y:number}>;paths:Record<string,{asPathstring():string;hidden:boolean;attributes:{list:{class:string[]}}}>}
const cases:unknown[]=[];
const variants=[{circleRatio:.5,panels:2,gathering:0},{circleRatio:1,panels:2,gathering:0},{circleRatio:1,panels:4,gathering:.5}];
for(const gender of ['male','female'] as const)for(const size of ['XS','S','M','L','XL','XXL','XXXL'] as StandardSize[])for(const options of variants)
it(`Sandy independent source + physical mapping: ${gender}/${size}/${options.circleRatio}/${options.panels}/${options.gathering}`,()=>{
  const measurements=getReferenceMeasurements(gender,size),profile=referenceProfileId(gender,size),model=models[profile];
  const selection:ConstructionSelection={schema:'garment-os/construction/v1',options};
  const oracle=new Sandy({measurements:model,options:{waistbandPosition:0,waistbandShape:'straight',seamlessFullCircle:false,...options,lengthBonus:model.waistToKnee/model.waistToFloor},sa:10,expand:true});oracle.draft();
  const draft=draftStandard(SKIRT_PATTERN_ID,measurements,'regular',selection);
  expect(draft.pieces.map(p=>p.id).sort()).toEqual(['sandy.skirt','sandy.waistband']);
  for(const piece of draft.pieces){
    const raw=oracle.parts[0][piece.id] as SourcePart;
    expect(piece.netPathD).toBe(raw.paths.seam.asPathstring());
    expect(piece.cutPaths).toEqual({sa:raw.paths.sa.asPathstring()});
    expect(piece.cutInstructions).toEqual((oracle.setStores[0].get('cutlist') as Record<string,unknown>)[piece.id]);
    for(const [id,p]of Object.entries(piece.points))expect(p).toEqual({x:raw.points[id].x,y:raw.points[id].y});
    for(const [id,path]of Object.entries(piece.sourcePaths))expect(path.data).toBe(raw.paths[id].asPathstring());
  }
  expect(draft.pieces.find(p=>p.id==='sandy.skirt')?.qty).toBe(options.panels);
  expect(draft.pieces.find(p=>p.id==='sandy.skirt')?.onFold).toBe(true);
  expect(draft.pieces.find(p=>p.id==='sandy.waistband')?.qty).toBe(1);
  expect(draft.assembly.integrityPass).toBe(true);expect(draft.assembly.status).toBe('incomplete');
  expect(draft.assembly.coverage.classifiedEdges).toBe(draft.assembly.coverage.totalEdges);
  expect(draft.assembly.joins.every(j=>j.status==='pending')).toBe(true);
  const configuration={...useDesignStore.getState().getConfiguration(),activePatternId:SKIRT_PATTERN_ID,measurements,gender,standardSize:size,construction:selection};
  const qc=computeDraft(configuration);expect(qc.status,qc.error??'').toBe('reference');
  const mesh=createPattern3d(configuration);expect(mesh.panels).toHaveLength(options.panels+1);
  for(const panel of mesh.panels){expect(panel.metrics.areaErrorRatio).toBeLessThan(.001);expect(panel.metrics.maxEdgeDistortionMm).toBeLessThan(1e-6);expect(panel.metrics.maxRoundtripMm).toBeLessThan(1e-6);}
  expect(mesh.simulationReady).toBe(false);expect(mesh.productionApproved).toBe(false);
  cases.push({gender,size,options,sourceContoursEqual:true,sourcePointsEqual:true,sourceCutlistEqual:true,allEdgesClassified:true,meshPanels:mesh.panels.length,maxAreaErrorRatio:Math.max(...mesh.panels.map(p=>p.metrics.areaErrorRatio)),productionApproved:false});
});
it('requires only the explicitly consumed lower-body inputs and preserves them through reading and export',()=>{
  const configuration=useDesignStore.getState().getConfiguration(),m=getReferenceMeasurements('female','M');
  const input={...configuration,activePatternId:SKIRT_PATTERN_ID,construction:undefined,measurements:{waist:m.waist,hip:m.hip,hipDepth:m.hipDepth,waistToFloor:m.waistToFloor,skirtLength:m.skirtLength}};
  const read=readConfiguration(input);expect(read.measurements).toEqual(input.measurements);expect(computeDraft(read).status).toBe('reference');
  expect(()=>readConfiguration({...input,activePatternId:'t-shirt'})).toThrow('缺失');
  for(const key of ['waist','hip','hipDepth','waistToFloor','skirtLength'])expect(()=>readConfiguration({...input,measurements:{...input.measurements,[key]:undefined}}),key).toThrow('缺失');
});
it('does not let upper-body length/ease settings alter skirt geometry',()=>{
  const m=getReferenceMeasurements('female','M'),base=draftStandard(SKIRT_PATTERN_ID,m);
  const next=draftStandard(SKIRT_PATTERN_ID,{...m,totalLength:m.totalLength+100,bust:m.bust+120,neckCirc:m.neckCirc+10},'loose');
  expect(next.pieces.map(p=>p.netPathD)).toEqual(base.pieces.map(p=>p.netPathD));
  const changed=draftStandard(SKIRT_PATTERN_ID,{...m,skirtLength:m.skirtLength!+100});
  expect(changed.pieces.find(p=>p.id==='sandy.skirt')?.netPathD).not.toBe(base.pieces.find(p=>p.id==='sandy.skirt')?.netPathD);
  expect(changed.pieces.find(p=>p.id==='sandy.waistband')?.netPathD).toBe(base.pieces.find(p=>p.id==='sandy.waistband')?.netPathD);
});
it('rejects missing, nonfinite or impossible inputs and unreviewed variants without source clamping',()=>{
  const m=getReferenceMeasurements('female','M');
  for(const changes of [{skirtLength:undefined},{waistToFloor:NaN},{skirtLength:2000},{skirtLength:50},{waist:1500,hip:1000},{skirtLength:100,waistToFloor:1500}])expect(()=>draftStandard(SKIRT_PATTERN_ID,{...m,...changes})).toThrow();
  for(const options of [{panels:1},{panels:2.5},{circleRatio:2},{seamlessFullCircle:true},{waistbandShape:'curved'},{waistbandPosition:.5},{ribbing:true},{waistbandWidth:NaN}])expect(()=>readConstructionSelection(SKIRT_PATTERN_ID,{schema:'garment-os/construction/v1',options})).toThrow();
  expect(standardSettings(SKIRT_PATTERN_ID,m).measurements).not.toHaveProperty('chest');
  expect(SKIRT_PARAMETERS.map(p=>p.key)).toContain('panels');
  const config={...useDesignStore.getState().getConfiguration(),activePatternId:SKIRT_PATTERN_ID,measurements:{...m,bust:NaN}};
  expect(()=>readConfiguration(config)).toThrow('已提供的身体测量无效');
});

for(const p of SKIRT_PARAMETERS)for(const bound of ['min','max']as const)it(`Sandy parameter boundary ${p.key}/${bound} is retained exactly or blocks incompatible geometry`,()=>{
  const value=p[bound],selection:ConstructionSelection={schema:'garment-os/construction/v1',options:{[p.key]:value}};
  const m=getReferenceMeasurements('female','M');
  expect(readConstructionSelection(SKIRT_PATTERN_ID,selection)?.options[p.key]).toBe(value);
  const actual=draftStandard(SKIRT_PATTERN_ID,m,'regular',selection);
  const model=models.cisFemaleAdult34;
  const oracle=new Sandy({measurements:model,options:{waistbandPosition:0,waistbandShape:'straight',seamlessFullCircle:false,circleRatio:1,panels:2,gathering:0,waistbandWidth:.04,waistbandOverlap:.03,hemWidth:.02,[p.key]:value,lengthBonus:model.waistToKnee/model.waistToFloor},sa:10,expand:true});oracle.draft();
  for(const piece of actual.pieces)expect(piece.netPathD).toBe((oracle.parts[0][piece.id] as SourcePart).paths.seam.asPathstring());
  expect(actual.assembly.construction?.resolvedOptions[p.key]).toBe(value);
});
it('supports an explicitly odd three-panel cut without inventing extra folds or copies',()=>{
  const d=draftStandard(SKIRT_PATTERN_ID,getReferenceMeasurements('female','M'),'regular',{schema:'garment-os/construction/v1',options:{panels:3}});
  expect(d.pieces.find(p=>p.id==='sandy.skirt')).toMatchObject({qty:3,onFold:true});
});
afterAll(()=>{const out='doc/evidence/category-connection-20261111';mkdirSync(out,{recursive:true});writeFileSync(`${out}/sandy-source-matrix.json`,JSON.stringify({source:'@freesewing/sandy@4.10.2',cases,browserAcceptance:false,productionApproved:false},null,2));});
