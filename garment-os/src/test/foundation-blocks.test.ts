import {afterAll,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Paco} from '@freesewing/paco';
import {Teagan} from '@freesewing/teagan';
import * as models from '@freesewing/models';
import {draftStandard,standardSettings} from '@/lib/pattern/reference/standard';
import {getReferenceMeasurements,referenceProfileId} from '@/data/referenceMeasurements';
import {PANTS_MEASUREMENT_FIELDS,PANTS_PATTERN_ID,TEE_PARAMETERS,PANTS_PARAMETERS} from '@/data/foundationMethods';
import {configureStructureAsset} from '@/application/asset-library';
import {computeDraft} from '@/application/draft-service';
import {readConfiguration} from '@/application/design-document';
import {createPattern3d} from '@/application/pattern-3d';
import {createDesignStore} from '@/store/designStore';
import {useDesignStore} from '@/store/useDesignStore';
import {readConstructionSelection} from '@/lib/pattern/construction-selection';
import type {DesignDocument,DesignRepository} from '@/types/design';
import type {ConstructionSelection} from '@/types/construction';
interface NativePart{points:Record<string,{x:number;y:number}>;paths:Record<string,{asPathstring():string}>}
const evidence:unknown[]=[];
for(const gender of ['male','female']as const)for(const size of ['XS','S','M','L','XL','XXL','XXXL']as const)for(const options of [{heelEase:.05,lengthBonus:0},{heelEase:.3,lengthBonus:0},{heelEase:.05,lengthBonus:-.1}])it(`Paco baseline exact source ${gender}/${size}/${options.heelEase}/${options.lengthBonus}`,()=>{
  const m=getReferenceMeasurements(gender,size),model=models[referenceProfileId(gender,size)],selection:ConstructionSelection={schema:'garment-os/construction/v1',options};
  const oracle=new Paco({measurements:model,options:{elasticatedCuff:false,frontPockets:false,backPockets:false,...options},sa:10,expand:true});oracle.draft();
  const actual=draftStandard(PANTS_PATTERN_ID,m,'regular',selection);
  expect(actual.pieces.map(p=>p.id).sort()).toEqual(['paco.back','paco.front','paco.waistband']);
  for(const p of actual.pieces){const source=oracle.parts[0][p.id]as NativePart;expect(p.netPathD).toBe(source.paths.seam.asPathstring());expect(p.cutPaths).toEqual({sa:source.paths.sa.asPathstring()});expect(p.cutInstructions).toEqual((oracle.setStores[0].get('cutlist')as Record<string,unknown>)[p.id]);for(const [id,point]of Object.entries(p.points))expect(point).toEqual({x:source.points[id].x,y:source.points[id].y});}
  expect(actual.pieces.map(p=>p.qty)).toEqual([2,2,1]);expect(actual.pieces.every(p=>!p.onFold)).toBe(true);
  expect(actual.assembly.integrityPass).toBe(true);expect(actual.assembly.coverage.classifiedEdges).toBe(actual.assembly.coverage.totalEdges);
  expect(actual.assembly.joins.filter(j=>j.id!=='waistband').every(j=>j.status==='passed'&&j.directionChecked)).toBe(true);
  const config={...useDesignStore.getState().getConfiguration(),activePatternId:PANTS_PATTERN_ID,gender,standardSize:size,measurements:m,construction:selection},mesh=createPattern3d(config);
  expect(mesh.panels).toHaveLength(5);for(const p of mesh.panels){expect(p.metrics.maxRoundtripMm).toBeLessThan(1e-6);expect(p.metrics.maxEdgeDistortionMm).toBeLessThan(1e-6);expect(p.metrics.areaErrorRatio).toBeLessThan(.001);}
  expect(mesh.productionApproved).toBe(false);expect(mesh.simulationReady).toBe(false);
  evidence.push({template:PANTS_PATTERN_ID,gender,size,options,sourceEqual:true,cutlistEqual:true,meshPanels:5,joins:actual.assembly.joins.map(j=>({id:j.id,status:j.status,deltaMm:j.deltaMm})),manufacturingApproved:false});
});
for(const gender of ['male','female']as const)for(const size of ['S','M','XL']as const)for(const [id,options]of [['basic-sleeve',{sleeveLength:.3,sleeveEase:.15}],['extended-sleeve',{sleeveLength:.7,sleeveEase:.15}],['tapered-sleeve',{sleeveLength:.45,sleeveEase:.05}]]as const)it(`Teagan sleeve module ${gender}/${size}/${id} preserves source bodies and matches its native sleeve`,()=>{
  const m=getReferenceMeasurements(gender,size),selection:ConstructionSelection={schema:'garment-os/construction/v1',options};
  const actual=draftStandard('t-shirt',m,'regular',selection),base=draftStandard('t-shirt',m);
  const oracle=new Teagan({...standardSettings('t-shirt',m),options:{...standardSettings('t-shirt',m).options,...options}});oracle.draft();
  for(const p of actual.pieces)expect(p.netPathD).toBe((oracle.parts[0][p.id]as NativePart).paths.seam.asPathstring());
  for(const body of ['teagan.front','teagan.back'])expect(actual.pieces.find(p=>p.id===body)?.netPathD).toBe(base.pieces.find(p=>p.id===body)?.netPathD);
  const cap=d=>d.assembly.boundaries.find(b=>b.piece==='teagan.sleeve'&&b.id==='cap')!.pathD;
  expect(cap(actual)).toBe(cap(base));expect(actual.assembly.integrityPass).toBe(true);
  const sleeve=actual.pieces.find(p=>p.id==='teagan.sleeve')!.points,baseSleeve=base.pieces.find(p=>p.id==='teagan.sleeve')!.points;
  const hemWidth=sleeve.hemRight.x-sleeve.hemLeft.x,baseHemWidth=baseSleeve.hemRight.x-baseSleeve.hemLeft.x;
  if(id==='tapered-sleeve')expect(hemWidth).toBeLessThan(baseHemWidth);
  if(id==='extended-sleeve')expect(sleeve.hemRight.y).toBeGreaterThan(baseSleeve.hemRight.y);
  evidence.push({template:'t-shirt',gender,size,module:id,options,actualHemWidthMm:hemWidth,baseHemWidthMm:baseHemWidth,sourceEqual:true,unchangedBody:true,unchangedSleeveCap:true,manufacturingApproved:false});
});
it('source width saturation is explicit instead of passing off a capped option as a wider sleeve',()=>{
  const m=getReferenceMeasurements('male','M'),base=draftStandard('t-shirt',m),wide=draftStandard('t-shirt',m,'regular',{schema:'garment-os/construction/v1',options:{sleeveEase:.3}});
  const width=d=>{const p=d.pieces.find(p=>p.id==='teagan.sleeve')!.points;return p.hemRight.x-p.hemLeft.x;};
  expect(width(wide)).toBe(width(base));
  expect(wide.assembly.construction!.operations.find(o=>o.id==='tee-sleeve-module')!.metrics.find(m=>m.label==='宽度限制差')!.value).toBeLessThan(0);
});
it('lower-only pants records never fabricate upper inputs and reject missing direct arcs or unsupported pockets',()=>{
  const m=getReferenceMeasurements('male','M'),base=useDesignStore.getState().getConfiguration();
  const config=readConfiguration({...base,activePatternId:PANTS_PATTERN_ID,construction:undefined,measurements:Object.fromEntries(PANTS_MEASUREMENT_FIELDS.map(f=>[f.id,m[f.id]]))});
  expect(computeDraft(config).status).toBe('reference');expect(config.measurements).not.toHaveProperty('bust');
  for(const key of ['seatBack','waistBack','crossSeamFront','heel'])expect(()=>readConfiguration({...config,measurements:{...config.measurements,[key]:undefined}})).toThrow('缺失');
  for(const options of [{frontPockets:true},{backPockets:true},{elasticatedCuff:true},{sleeveLength:.4},{heelEase:NaN},{lengthBonus:-.8}])expect(()=>readConstructionSelection(PANTS_PATTERN_ID,{schema:'garment-os/construction/v1',options})).toThrow();
  expect(()=>draftStandard(PANTS_PATTERN_ID,{...m,crossSeam:600,crossSeamFront:600})).toThrow('次序');
  expect(standardSettings(PANTS_PATTERN_ID,m).measurements).not.toHaveProperty('chest');
});
it('T-shirt sleeve and pants changes preserve their exact configuration and source paths through save, reopen and undo',async()=>{
  const docs=new Map<string,DesignDocument>(),repository:DesignRepository={save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>docs.get(id),list:async()=>[],delete:async()=>{}};
  const editor=createDesignStore({repository}),s=editor.getState();
  for(const preset of ['t-shirt-extended-sleeve','pants-wide-opening']){
    s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),preset));const config=s.getConfiguration(),paths=structuredClone(editor.getState().draft.paths);
    s.setConstruction(undefined);s.undo();expect(s.getConfiguration()).toEqual(config);expect(editor.getState().draft.paths).toEqual(paths);s.redo();s.undo();
    const id=await s.saveDesign();s.newDesign();expect(await s.loadDesign(id)).toBe(true);expect(s.getConfiguration()).toEqual(config);expect(editor.getState().draft.paths).toEqual(paths);
  }
});
it('the editable foundation parameter bounds are a strict subset of the pinned native option contracts',()=>{
  for(const [D,id,parameters]of [[Teagan,'t-shirt',TEE_PARAMETERS],[Paco,PANTS_PATTERN_ID,PANTS_PARAMETERS]]as const){
    const native=new D(standardSettings(id,getReferenceMeasurements('male','M')));native.draft();
    const config=(native as unknown as {config:{options:Record<string,{pct:number;min:number;max:number}>}}).config;
    for(const p of parameters){const source=config.options[p.key];expect(source).toBeDefined();expect(p.defaultValue).toBe(source.pct/100);expect(p.min!).toBeGreaterThanOrEqual(source.min/100);expect(p.max!).toBeLessThanOrEqual(source.max/100);}
  }
});
afterAll(()=>{const out='doc/evidence/foundation-blocks-20261111';mkdirSync(out,{recursive:true});writeFileSync(`${out}/source-matrix.json`,JSON.stringify({kind:'independent-pinned-source-comparison',cases:evidence,browserAcceptance:false,productionApproved:false},null,2));});
