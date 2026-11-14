import { afterAll, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Simon } from '@freesewing/simon';
import { draftStandard, standardSettings } from '@/lib/pattern/reference/standard';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { CONSTRUCTION_PARAMETERS } from '@/data/constructionMethods';
import { readConstructionSelection, changeConstructionOption } from '@/lib/pattern/construction-selection';
import { createDesignStore } from '@/store/designStore';
import { computeDraft } from '@/application/draft-service';
import { createAssemblyRecord } from '@/application/assembly-record';
import { serializePattern, deserializePattern } from '@/lib/pattern/pattern-format';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import type { ConstructionSelection, ShirtOptions } from '@/types/construction';
import type { DesignDocument, DesignRepository } from '@/types/design';
import { auditConstruction } from '@/lib/pattern/assembly/construction';
import { CONSTRUCTION_INPUTS } from '@/data/constructionInputs';
import { generatePatternSheet } from '@/lib/svg-export/pattern-sheet-exporter';

const m=getReferenceMeasurements('male','M');
const selection=(options:Partial<ShirtOptions>):ConstructionSelection=>({schema:'garment-os/construction/v1',options});
const evidence:unknown[]=[];
const boundaryEvidence:unknown[]=[];
const config = (construction?:ConstructionSelection)=>({activePatternId:'button-up-shirt',gender:'male' as const,standardSize:'M' as const,fit:'regular' as const,measurements:m,engineVersion:'4.10.2' as const,garmentColor:'#cccccc',fabricId:'solid',construction});
it('all declared parameter domains, units and defaults match the installed upstream option definitions',()=>{
  const pattern = new Simon(standardSettings('button-up-shirt',m)); pattern.draft();
  const upstream = pattern as unknown as { config:{options:Record<string,unknown>} };
  for(const p of CONSTRUCTION_PARAMETERS){
    const source=upstream.config.options[p.key] as {pct?:number;deg?:number;dflt?:string;min?:number;max?:number;list?:string[]};
    expect(source, p.key).toBeDefined();
    if(p.unit==='choice'){
      expect(p.defaultValue,p.key).toBe(source.dflt);
      expect(p.choices!.every(c=>source.list!.includes(c.value)),p.key).toBe(true);
    } else {
      const factor=p.unit==='ratio'?.01:1;
      expect(p.defaultValue,p.key).toBeCloseTo((source.pct??source.deg!)*factor,12);
      expect(p.min,p.key).toBeCloseTo(source.min!*factor,12);expect(p.max,p.key).toBeCloseTo(source.max!*factor,12);
    }
  }
});
it('252 component combinations regenerate complete same-method assemblies across sizes and fits',()=>{
  for(const size of ['XS','S','M','L','XL','XXL','XXXL'] as const)for(const fit of ['slim','regular','loose'] as const)for(const hemStyle of ['straight','baseball','slashed'] as const)for(const cuffStyle of ['angledBarrelCuff','roundedBarrelCuff','straightBarrelCuff',null] as const){
    const input=selection(cuffStyle?{hemStyle,cuffStyle}:{hemStyle,sleeveStyle:'short'});
    const draft=draftStandard('button-up-shirt',getReferenceMeasurements('male',size),fit,input);
    evidence.push({size,fit,options:input.options,pieces:draft.pieces.length,integrity:draft.assembly.integrityPass,operations:draft.assembly.construction!.operations.map(o=>({id:o.id,status:o.status,metrics:o.metrics}))});
    expect(draft.assembly.integrityPass,`${size}/${fit}/${hemStyle}/${cuffStyle}`).toBe(true);
    expect(draft.pieces).toHaveLength(cuffStyle?10:7);
    expect(draft.assembly.coverage.classifiedEdges).toBe(draft.assembly.coverage.totalEdges);
    expect(draft.assembly.construction?.readyForAssembly).toBe(false);
    if(!cuffStyle){expect(draft.pieces.some(p=>/cuff|Placket/.test(p.id))).toBe(false);expect(draft.assembly.joins.some(j=>j.id==='cuffs')).toBe(false);}
  }
},30000);
it('changed component contours remain exactly the full upstream draft, including short-sleeve turnback',()=>{
  for(const options of [{collarAngle:100,collarStandWidth:.1,cuffStyle:'roundedBarrelCuff'}, {sleeveStyle:'short',hemStyle:'baseball',sleeveHemShort:.03}] as const){
    const input=selection(options), settings=standardSettings('button-up-shirt',m,'regular',input);
    const upstream=new Simon(settings);upstream.draft();
    const draft=draftStandard('button-up-shirt',m,'regular',input);
    for(const p of draft.pieces){
      const raw=upstream.parts[0][p.id] as {paths:{seam:{asPathstring():string}};points:Record<string,{x:number;y:number}>};
      expect(p.netPathD).toBe(raw.paths.seam.asPathstring());
      for(const [name,point]of Object.entries(p.points))expect(point).toEqual({x:raw.points[name].x,y:raw.points[name].y});
    }
  }
});
it('pleats retain real takeup, do not double lengths for layers, and expose the unresolved source cuff mismatch',()=>{
  for(const cuffDrape of [0,.02,.05] as const){
    const draft=draftStandard('button-up-shirt',m,'regular',selection({cuffDrape}));
    const op=draft.assembly.construction!.operations.find(o=>o.id==='cuff-pleats')!;
    const val=(label:string)=>op.metrics.find(x=>x.label===label)!.value!;
    expect(val('源褶口实收量')).toBeCloseTo(m.sleeveLength*cuffDrape,8);
    expect(val('褶数')).toBe(cuffDrape===0?0:cuffDrape===.02?1:2);
    expect(val('去褶平面基准长')).toBeCloseTo(val('单袖原始净边')-val('源褶口实收量'),8);
    expect(Math.abs(val('去褶后尚余差值'))).toBeGreaterThan(.01);
    expect(op.status).toBe('needs-redraft');
  }
});
it('selection changes the current gate, cache result, source geometry and reproducible record',()=>{
  const base=computeDraft(config()),changed=computeDraft(config(selection({collarAngle:110,cuffStyle:'roundedBarrelCuff'})));
  expect(changed.status).toBe('reference');expect(changed.gateKey).not.toBe(base.gateKey);expect(changed.paths).not.toEqual(base.paths);
  expect(()=>createAssemblyRecord(config(),changed)).toThrow(/不一致/);
  expect(createAssemblyRecord(config(selection({collarAngle:110,cuffStyle:'roundedBarrelCuff'})),changed).assembly.construction!.selection!.options.collarAngle).toBe(110);
});
it('save/load, undo/redo and portable import retain composition and regenerate identical geometry',async()=>{
  const records=new Map<string,DesignDocument>();
  const repository:DesignRepository={save:async d=>{records.set(d.id,structuredClone(d));},get:async id=>records.get(id),list:async()=>[],delete:async()=>{}};
  const editor=createDesignStore({repository}),s=editor.getState();s.applyPattern('button-up-shirt');
  const before=structuredClone(editor.getState().draft.paths),input=selection({sleeveStyle:'short',hemStyle:'baseball',collarAngle:100});s.setConstruction(input);
  const expected=structuredClone(editor.getState().draft.paths);
  expect(editor.getState().draft.status).toBe('reference');s.undo();expect(editor.getState().draft.paths).toEqual(before);s.redo();expect(editor.getState().draft.paths).toEqual(expected);
  const id=await s.saveDesign();s.newDesign();expect(await s.loadDesign(id)).toBe(true);expect(s.getConfiguration().construction).toEqual(input);expect(editor.getState().draft.paths).toEqual(expected);
  const c=s.getConfiguration();const file=deserializePattern(serializePattern(PATTERN_LIBRARY[c.activePatternId],{...c,engineVersion:'4.10.2'}));
  s.newDesign();s.restorePatternInputs(file);expect(editor.getState().construction).toEqual(input);expect(editor.getState().draft.paths).toEqual(expected);
  s.applyPattern('t-shirt');expect(editor.getState().construction).toBeUndefined();expect(editor.getState().draft.status).toBe('reference');
});
it('contradictory, unsupported and out-of-domain choices cannot be smuggled through imports or direct engine calls',()=>{
  for(const options of [{sleeveStyle:'short',cuffStyle:'angledBarrelCuff'},{cuffStyle:'roundedFrenchCuff'},{splitYoke:true},{collarAngle:NaN},{collarAngle:59.99},{collarStandWidth:.5},{cuffDrape:undefined}]){
    const input={schema:'garment-os/construction/v1',options};
    expect(()=>readConstructionSelection('button-up-shirt',input)).toThrow();
    expect(computeDraft(config(input as ConstructionSelection)).status).toBe('blocked');
  }
  expect(()=>readConstructionSelection('t-shirt',selection({collarAngle:85}))).toThrow(/未声明/);
  const long=selection({cuffStyle:'roundedBarrelCuff',cuffDrape:.05,sleevePlacketLength:.3});
  const short=changeConstructionOption(long,'sleeveStyle','short');expect(short.options).toEqual({sleeveStyle:'short'});
});
it('in-range parameter extrema either produce checked geometry or withdraw every drawing with a concrete reason',()=>{
  for(const p of CONSTRUCTION_PARAMETERS.filter(p=>p.unit!=='choice'))for(const value of [p.min!,p.max!]){
    const input=selection({...(p.only==='short'?{sleeveStyle:'short' as const}:{}),[p.key]:value});
    const result=computeDraft(config(input));
    boundaryEvidence.push({key:p.key,value,status:result.status,error:result.error,integrity:result.assembly?.integrityPass??null});
    if(result.status==='blocked'){expect(result.paths).toEqual([]);expect(result.pieces).toEqual([]);expect(result.error).toBeTruthy();}
    else {expect(result.assembly!.integrityPass).toBe(true);expect(result.pieces.length).toBeGreaterThan(0);}
    expect(result.productionApproved).toBe(false);
  }
});
it('missing or displaced construction stations and omitted fold paths block rather than manufacturing a successful rule',()=>{
  for(const fault of ['missing-crease','displaced-crease','missing-pleats','bad-tower','false-cuff-length'] as const){
    const draft=draftStandard('button-up-shirt',m),pieces=draft.pieces,assembly=draft.assembly,options=assembly.construction!.resolvedOptions;
    const sleeve=pieces.find(p=>p.id==='simon.sleeve')!,tower=pieces.find(p=>p.id==='simon.sleevePlacketOverlap')!;
    if(fault==='missing-crease')delete sleeve.points.cuffPleat1Fold;
    if(fault==='displaced-crease')sleeve.points.cuffPleat1Fold.x+=2;
    if(fault==='missing-pleats')delete sleeve.sourcePaths.pleats;
    if(fault==='bad-tower')tower.points.boxTip.x+=1;
    if(fault==='false-cuff-length')assembly.boundaries.find(b=>b.piece==='simon.cuff'&&b.id==='insert')!.lengthMm+=1;
    expect(()=>auditConstruction('button-up-shirt',m,options,pieces,assembly),fault).toThrow(/构造规则缺少|构造源尺寸不一致/);
  }
});
it('required material/process data has complete semantics and remains null, with only applicable requirements exported',()=>{
  expect(new Set(CONSTRUCTION_INPUTS.map(f=>f.code)).size).toBe(CONSTRUCTION_INPUTS.length);
  const long=draftStandard('button-up-shirt',m).assembly.construction!,short=draftStandard('button-up-shirt',m,'regular',selection({sleeveStyle:'short'})).assembly.construction!;
  expect(long.requiredInputs.every(f=>f.value===null&&f.meaning&&f.validation&&f.evidence&&f.requiredWhen)).toBe(true);
  expect(short.requiredInputs.some(f=>f.code==='placket.stitchOffsetMm')).toBe(false);
  expect(long.requiredInputs.some(f=>f.code==='placket.stitchOffsetMm')).toBe(true);
  const knit=draftStandard('t-shirt',m).assembly.construction!;
  expect(knit.requiredInputs.some(f=>f.code==='neck.bandReductionRatio')).toBe(true);
  expect(knit.requiredInputs.find(f=>f.code==='neck.bandReductionRatio')!.value).toBeNull();
});
afterAll(()=>{
  const dir='doc/evidence/construction-20261111';mkdirSync(dir,{recursive:true});
  writeFileSync(`${dir}/component-matrix.json`,JSON.stringify({count:evidence.length,cases:evidence,productionApproved:false},null,2));
  writeFileSync(`${dir}/boundary-inputs.json`,JSON.stringify(boundaryEvidence,null,2));
  writeFileSync(`${dir}/input-dictionary.json`,JSON.stringify({parameters:CONSTRUCTION_PARAMETERS,requiredInputs:CONSTRUCTION_INPUTS},null,2));
  for(const [name,options]of [['long-rounded',{cuffStyle:'roundedBarrelCuff',collarAngle:100}],['short-curved',{sleeveStyle:'short',hemStyle:'baseball'}]] as const){
    const input=config(selection(options)),draft=computeDraft(input);
    writeFileSync(`${dir}/${name}-example.json`,JSON.stringify(createAssemblyRecord(input,draft),null,2));
    writeFileSync(`${dir}/${name}-source-pieces.svg`,generatePatternSheet(PATTERN_LIBRARY[input.activePatternId],draft.paths,{construction:input.construction,patternName:name==='long-rounded'?'M码长袖衬衫 · 圆角袖口 · 领尖角100°':'M码短袖衬衫 · 圆弧下摆',notes:'系统结构验收范例；源路径，不是浏览器截图；仍有完成态和材料缺口'}));
  }
});
