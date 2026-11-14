import { afterAll, expect, it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { Aaron } from '@freesewing/aaron';
import { Huey } from '@freesewing/huey';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { draftStandard,standardSettings } from '@/lib/pattern/reference/standard';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { changeKnitOption,readConstructionSelection } from '@/lib/pattern/construction-selection';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { validateAssembly } from '@/lib/pattern/assembly/validate';
import { groupSolutionPieces,validateAllPieces } from '@/lib/pattern/piece-registry';
import { createDesignStore } from '@/store/designStore';
import { readConfiguration } from '@/application/design-document';
import { resolveReviewedImport } from '@/application/pattern-transfer';
import { serializePattern,deserializePattern } from '@/lib/pattern/pattern-format';
import { generatePatternSheet } from '@/lib/svg-export/pattern-sheet-exporter';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import type { ConstructionSelection,KnitOptions } from '@/types/construction';
import type { DesignDocument,DesignRepository } from '@/types/design';
import { createPendingElementCandidates } from '@/application/pending-element-candidates';
import { PENDING_SOURCE_IDS } from '@/data/pendingElementRegistrations';

const dir='doc/evidence/capability-20261111',m=getReferenceMeasurements('male','M');
const selection=(options:Partial<KnitOptions>):ConstructionSelection=>({schema:'garment-os/construction/v1',options});
const draft=(id='hooded-zip-sweatshirt',options:Partial<KnitOptions>={},measurements=m)=>draftStandard(id,measurements,'regular',selection(options));
const seam=(d:ReturnType<typeof draft>,id:string)=>d.pieces.find(p=>p.id===id)!.netPathD;
const evidence:unknown[]=[];

it('local registration proposals cover exactly the pending source pieces without remote IDs or invented tests',()=>{
  const candidates=createPendingElementCandidates();
  expect(candidates.methods).toHaveLength(4);expect(candidates.remoteWritten).toBe(false);
  const pieces=candidates.methods.flatMap(m=>m.components);expect(pieces.map(p=>p.sourcePieceId).sort()).toEqual([...PENDING_SOURCE_IDS].sort());
  for(const p of pieces){expect(p.feishuRecordId).toBeNull();expect(p.quantity).toBeGreaterThan(0);expect(p.productionApproved).toBe(false);}
  for(const method of candidates.methods)expect(method.parameters?.length).toBeGreaterThan(0);
  const skirt=candidates.methods.find(m=>m.engine==='sandy')!;
  expect(skirt.measurementDefinitions?.map(f=>f.id)).toEqual(['waist','hip','hipDepth','waistToFloor','skirtLength']);
  for(const id of ['bound-tank','hooded-zip-sweatshirt']){
    const report=draft(id).assembly.construction!;
    expect(report.requiredInputs.every(f=>f.value===null)).toBe(true);
    expect(new Set(report.requiredInputs.map(f=>f.code)).size).toBe(report.requiredInputs.length);
    expect(report.requiredInputs.filter(f=>f.code.startsWith(id==='bound-tank'?'binding.':'ribbing.')).length).toBeGreaterThan(0);
  }
  mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/element-registration-candidates.json`,JSON.stringify(candidates,null,2));
});

it('every exposed default, range and unit matches the installed source option contract',()=>{
  for(const [id,D]of [['bound-tank',Aaron],['hooded-zip-sweatshirt',Huey]]as const){
    const upstream=new D(standardSettings(id,m));upstream.draft();
    const config=(upstream as unknown as {config:{options:Record<string,{bool?:boolean;pct?:number;deg?:number;count?:number;min?:number;max?:number}>}}).config;
    for(const p of KNIT_PARAMETERS[id]){
      const source=config.options[p.key];expect(source,p.key).toBeDefined();
      if(p.unit==='boolean')expect(p.defaultValue,p.key).toBe(source.bool);
      else {const factor=p.unit==='ratio'?.01:1;
        expect(p.defaultValue,p.key).toBeCloseTo((source.pct??source.deg??source.count!)*factor,12);
        expect(p.min,p.key).toBeCloseTo(source.min!*factor,12);expect(p.max,p.key).toBeCloseTo(source.max!*factor,12);}
    }
  }
});

for(const ribbing of [true,false])for(const pocket of [true,false])it(`hoodie switches ribbing=${ribbing}, pocket=${pocket} regenerate all sizes, fits and both sample groups`,()=>{
  for(const gender of ['male','female']as const)for(const size of ['XS','S','M','L','XL','XXL','XXXL']as const)for(const fit of ['slim','regular','loose']as const){
    const s=selection({ribbing,pocket}),d=draftStandard('hooded-zip-sweatshirt',getReferenceMeasurements(gender,size),fit,s);
    expect(d.pieces).toHaveLength(4+(ribbing?2:0)+(pocket?1:0));
    expect(d.assembly.integrityPass).toBe(true);expect(d.assembly.coverage.classifiedEdges).toBe(d.assembly.coverage.totalEdges);
    expect(d.pieces.some(p=>p.id==='huey.cuff')).toBe(ribbing);expect(d.pieces.some(p=>p.id==='huey.waistband')).toBe(ribbing);
    expect(!!d.pieces.find(p=>p.id==='huey.front')!.sourcePaths.pocket).toBe(pocket);
    expect(d.assembly.joins.some(j=>j.id==='pocket-side')).toBe(pocket);
    expect(d.assembly.construction!.readyForAssembly).toBe(false);
    evidence.push({gender,size,fit,ribbing,pocket,pieces:d.pieces.map(p=>p.id),coverage:d.assembly.coverage,productionApproved:false});
  }
},30000);

for(const [id,parameters] of Object.entries(KNIT_PARAMETERS))for(const p of parameters.filter(p=>p.unit!=='boolean'))for(const end of ['min','max']as const)
it(`${id}/${p.key}/${end}: a declared source boundary either passes full geometry or fails explicitly`,()=>{
  // In-range single options can still conflict geometrically: no clamping or silent fallback.
  const value=p[end]!;expect(readConstructionSelection(id,selection({[p.key]:value}))!.options[p.key]).toBe(value);
  try{
    const d=draft(id,{[p.key]:value});expect(d.assembly.integrityPass).toBe(true);
    expect(d.assembly.construction!.resolvedOptions[p.key]).toBe(value);
    evidence.push({id,parameter:p.key,value,status:'geometry-pass',productionApproved:false});
  }catch(e){expect(String(e)).toMatch(/阻断|结构|走缝|不符|拓扑/);evidence.push({id,parameter:p.key,value,status:'blocked',reason:String(e)});}
});

it('head circumference affects the hood only; missing values block without substituting neck circumference',()=>{
  const a=draft(),b=draft('hooded-zip-sweatshirt',{}, {...m,headCirc:m.headCirc!+30});
  expect(seam(b,'huey.hood')).not.toBe(seam(a,'huey.hood'));
  for(const p of a.pieces.filter(p=>p.id!=='huey.hood'))expect(seam(b,p.id)).toBe(p.netPathD);
  expect(()=>draft('hooded-zip-sweatshirt',{}, {...m,headCirc:undefined})).toThrow(/头围/);
  for(const d of [a,b])expect(d.assembly.construction!.operations.find(o=>o.id==='hood-neck')!.metrics.find(m=>m.label==='帽底残差')!.value).toBeCloseTo(0,9);
});
it('ribbing height shortens body and sleeves; stretch changes only the real ribbing length',()=>{
  const a=draft(),height=draft('hooded-zip-sweatshirt',{ribbingHeight:.12}),stretch=draft('hooded-zip-sweatshirt',{ribbingStretch:.2});
  for(const id of ['huey.front','huey.back','huey.sleeve','huey.cuff','huey.waistband'])expect(seam(height,id)).not.toBe(seam(a,id));
  for(const id of ['huey.front','huey.back','huey.sleeve','huey.hood','huey.pocket'])expect(seam(stretch,id)).toBe(seam(a,id));
  for(const id of ['huey.cuff','huey.waistband']){
    const length=(d:ReturnType<typeof draft>)=>{const p=d.pieces.find(p=>p.id===id)!.points;return Math.hypot(p.topLeft.x-p.bottomLeft.x,p.topLeft.y-p.bottomLeft.y);};
    expect(length(stretch)/length(a)).toBeCloseTo(.8/.85,10);
  }
});
it('body width, garment length, sleeve length and neckline changes propagate to their dependent components',()=>{
  const a=draft(),wide=draft('hooded-zip-sweatshirt',{}, {...m,bust:m.bust+40}),long=draft('hooded-zip-sweatshirt',{}, {...m,totalLength:m.totalLength+20}),sleeve=draft('hooded-zip-sweatshirt',{}, {...m,sleeveLength:m.sleeveLength+20});
  for(const d of [wide,long])for(const id of ['huey.front','huey.back'])expect(seam(d,id)).not.toBe(seam(a,id));
  expect(seam(wide,'huey.pocket')).toBe(seam(a,'huey.pocket'));
  expect(seam(draft('hooded-zip-sweatshirt',{}, {...m,hip:m.hip+40}),'huey.pocket')).not.toBe(seam(a,'huey.pocket'));
  // Source pocket width follows hips; its vertical stations follow the garment hem.
  expect(seam(long,'huey.pocket')).not.toBe(seam(a,'huey.pocket'));
  expect(seam(sleeve,'huey.sleeve')).not.toBe(seam(a,'huey.sleeve'));expect(seam(sleeve,'huey.front')).toBe(seam(a,'huey.front'));
  const tank=draft('bound-tank'),neck=draft('bound-tank',{necklineDrop:.25});
  expect(seam(neck,'aaron.front')).not.toBe(seam(tank,'aaron.front'));expect(seam(neck,'aaron.neckBinding')).not.toBe(seam(tank,'aaron.neckBinding'));
  expect(seam(neck,'aaron.armBinding')).toBe(seam(tank,'aaron.armBinding'));
});
it('unknown parameters, invalid types, bounds and disabled-option contradictions are rejected',()=>{
  for(const [id,parameters]of Object.entries(KNIT_PARAMETERS))for(const p of parameters){
    expect(()=>readConstructionSelection(id,selection({[p.key]:p.unit==='boolean'?1:'0.1'} as never))).toThrow();
    if(p.unit!=='boolean')for(const value of [p.min!-.001,p.max!+.001,NaN,Infinity])expect(()=>readConstructionSelection(id,selection({[p.key]:value}))).toThrow();
  }
  for(const options of [{necklineBend:2},{ribbing:false,ribbingStretch:.2},{pocket:false,pocketHeight:.3}])expect(()=>readConstructionSelection('hooded-zip-sweatshirt',selection(options))).toThrow();
  const a=changeKnitOption('hooded-zip-sweatshirt',selection({ribbingStretch:.2,pocketHeight:.3}),'ribbing',false);
  const b=changeKnitOption('hooded-zip-sweatshirt',a,'pocket',false);expect(b.options).toEqual({ribbing:false,pocket:false});
});
it('wrong main material, quantities and placement masquerading as a cut are detected',()=>{
  for(const kind of ['material','quantity','path-kind','missing-kind']as const){
    const d=draft(),def=getAssemblyDefinition('hooded-zip-sweatshirt');
    if(kind==='material')d.assemblyPieces.find(p=>p.id==='huey.cuff')!.primaryMaterial='fabric';
    if(kind==='quantity')d.assemblyPieces.find(p=>p.id==='huey.cuff')!.materials.ribbing[0].cut=1;
    if(kind==='path-kind')def.pieces.find(p=>p.id==='huey.front')!.boundaries.find(b=>b.id==='pocket-side')!.sourcePathKind='cut';
    if(kind==='missing-kind')delete d.assemblyPieces.find(p=>p.id==='huey.front')!.internalPathKinds;
    const report=validateAssembly(def,d.assemblyPieces);expect(report.integrityPass,kind).toBe(false);expect(report.status).toBe('blocked');
  }
});
it('net-as-cut permission is exact-source only, consistent on every path and cannot hide extra offset contours',()=>{
  const a=draft('bound-tank'),paths=a.pieces.flatMap(p=>p.paths);
  for(const change of ['mixed','offset','wrong-source']as const){
    const changed=structuredClone(paths),id=change==='wrong-source'?'aaron.front':'aaron.neckBinding';
    if(change==='mixed')changed.find(p=>p.pieceId===id&&p.layer==='cutting-line')!.referenceCutMode='source-sa';
    if(change==='offset')changed.find(p=>p.pieceId===id&&p.layer==='cutting-line')!.data+=' M0 0L20 20';
    if(change==='wrong-source')changed.filter(p=>p.pieceId===id).forEach(p=>p.referenceCutMode='source-net-as-cut');
    expect(validateAllPieces(groupSolutionPieces(changed)).find(p=>p.key===id)!.pass,change).toBe(false);
  }
});
it('save/load, undo/redo and portable imports retain independent head input and construction choices',async()=>{
  const records=new Map<string,unknown>();const repository:DesignRepository={save:async d=>{records.set(d.id,structuredClone(d));},get:async id=>records.get(id),list:async()=>[],delete:async id=>{records.delete(id);}};
  const editor=createDesignStore({repository}),s=editor.getState();s.applyPattern('hooded-zip-sweatshirt');s.updateMeasurements({headCirc:590});s.setConstruction(selection({ribbing:false,pocket:false,hoodHeight:.6}));
  const configuration=s.getConfiguration(),paths=editor.getState().draft.paths;
  const envelope=deserializePattern(serializePattern(PATTERN_LIBRARY[configuration.activePatternId],configuration));
  expect(resolveReviewedImport(envelope).measurements.headCirc).toBe(590);
  expect(resolveReviewedImport(envelope).construction).toEqual(configuration.construction);
  const id=await s.saveDesign();s.newDesign();expect(await s.loadDesign(id)).toBe(true);
  expect(s.getConfiguration()).toEqual(configuration);expect(editor.getState().draft.paths).toEqual(paths);
  s.updateMeasurements({headCirc:undefined});expect(editor.getState().draft.paths).toEqual([]);s.undo();expect(editor.getState().measurements.headCirc).toBe(590);s.redo();expect(editor.getState().draft.paths).toEqual([]);
  const saved=records.get(id)as DesignDocument;delete saved.configuration.measurements.headCirc;
  expect(()=>readConfiguration(saved.configuration)).toThrow(/头围/);
  delete envelope.overrides!.measurements!.headCirc;expect(()=>resolveReviewedImport(envelope)).toThrow(/头围/);
});

afterAll(()=>{
  mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/construction-cases.json`,JSON.stringify(evidence,null,2));
  for(const [id,options,name]of [['bound-tank',{},'tank-default'],['hooded-zip-sweatshirt',{},'hoodie-default'],['hooded-zip-sweatshirt',{ribbing:false,pocket:false},'hoodie-no-rib-no-pocket']]as const){
    const d=draft(id,options),construction=selection(options);
    writeFileSync(`${dir}/${name}.svg`,generatePatternSheet(PATTERN_LIBRARY[id],d.pieces.flatMap(p=>p.paths),{size:'M',construction,notes:'参数化参考毫米图纸；非浏览器截图，未生产验收'}));
    writeFileSync(`${dir}/${name}.json`,JSON.stringify({measurements:m,construction,assembly:d.assembly},null,2));
  }
});
