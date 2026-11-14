import {beforeAll,expect,it} from 'vitest';
import {createPattern3d} from '@/application/pattern-3d';
import {getReferenceMeasurements} from '@/data/referenceMeasurements';
import {COMPANY_STYLE_MASTERS} from '@/data/companyStyleMasters';
import {assembleGarment} from '@/lib/pattern/mesh/garment-assembly';
import {createCompanyGarmentIllustration} from '@/lib/pattern/mesh/garment-company-shape';
import {createFinishedGarment} from '@/lib/pattern/mesh/garment-finish';
import {exportGarmentGltf} from '@/lib/pattern/mesh/garment-gltf';
import {garmentUsesImage} from '@/lib/pattern/mesh/garment-view';
import type {GarmentAppearance,GarmentAssembly3d} from '@/types/garment3d';

const masters=COMPANY_STYLE_MASTERS.filter(m=>m.cadTemplateId),models=new Map<string,GarmentAssembly3d>();
beforeAll(()=>{for(const m of masters)models.set(m.id,assembleGarment(createPattern3d({activePatternId:m.cadTemplateId!,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:m.color,fabricId:'solid'})));});

it.each(masters)('$id shares authored neck/shoulder/hem proportions, keeps welded seams and never rewrites CAD or UV',m=>{
  const source=models.get(m.id)!,before=JSON.stringify(source),display=createCompanyGarmentIllustration(source,m.id,{subdivision:0,thicknessMm:0,roundedEdges:false});
  const front=source.surfaces.find(s=>s.sourceId.endsWith('.front'))!,shoulder=source.seams.find(s=>s.id==='shoulder-right')!.path!.map(r=>front.localMm[r.vertex]),side=source.seams.find(s=>s.id==='side-right')!.path!.map(r=>front.localMm[r.vertex]),top=Math.min(...shoulder.map(p=>p[1])),height=Math.max(...side.map(p=>p[1]))-top;
  for(const s of source.surfaces){const out=display.surfaces.find(p=>p.sourceSurfaceId===s.id)!;expect(out.uvMm).toEqual(s.uvMm);expect(out.localMm).toEqual(s.localMm);}
  const positions=new Map<number,number[]>();
  for(const s of display.surfaces)for(const [i,id]of s.simulationIds.entries()){if(positions.has(id))expect(s.positionsMm[i]).toEqual(positions.get(id));else positions.set(id,s.positionsMm[i]);}
  for(const back of [false,true]){
    const s=source.surfaces.find(s=>s.sourceId.endsWith(back?'.back':'.front'))!,out=display.surfaces.find(p=>p.sourceSurfaceId===s.id)!,loop=source.openings!.find(o=>o.role==='neck')!.edges.filter(e=>e.surfaceId===s.id),center=loop.flatMap(e=>[e.a,e.b]).sort((a,b)=>Math.abs(s.localMm[a][0])-Math.abs(s.localMm[b][0]))[0];
    expect((-out.positionsMm[center][1]-top)/height).toBeCloseTo(back?m.shape.backDrop:m.shape.frontDrop,5);
  }
  const hem=source.openings!.find(o=>o.role==='body-hem')!,ys=hem.edges.filter(e=>e.surfaceId===front.id).map(e=>display.surfaces.find(s=>s.sourceSurfaceId===front.id)!.positionsMm[e.a][1]);
  expect(Math.max(...ys)-Math.min(...ys)).toBeLessThan(1e-7);expect(JSON.stringify(source)).toBe(before);
  expect(display.source).toBe(source);expect(display.illustration?.companyMasterId).toBe(m.id);expect(display.illustration?.proportionOnly).toBe(true);expect(source.productionApproved).toBe(false);
});
it('company matching rejects a different CAD or an unconnected hoodie instead of silently drawing another garment',()=>{
  expect(()=>createCompanyGarmentIllustration(models.get(masters[0].id)!,'company-cot25m002')).toThrow(/不匹配/);
  expect(()=>createCompanyGarmentIllustration(models.get(masters[0].id)!,'company-at25m3288')).toThrow(/不匹配/);
});
it('the scene, finish edits and glTF export consume the same company profile with independent front-only print UVs',()=>{
  const m=masters[0],source=models.get(m.id)!,appearance:GarmentAppearance={color:m.color,fabric:'solid',repeatMm:80,imageMode:'print',imageTarget:'front',rotationDeg:0,companyMasterId:m.id,finish:m.finish,imageDataUrl:'data:image/png;base64,AA=='},display=createFinishedGarment(source,appearance);
  const recolored:GarmentAppearance={...appearance,color:'#bbbbbb'};expect(createFinishedGarment(source,recolored)).toBe(display);
  expect(display.metrics.closedShell).toBe(true);expect(display.surfaces.some(s=>s.detail?.kind==='rib')).toBe(true);expect(display.surfaces.some(s=>s.detail?.operationId==='cap-right-thread')).toBe(true);
  expect(garmentUsesImage(display.surfaces.find(s=>s.sourceId.endsWith('.front')&&s.layer==='outer')!,appearance)).toBe(true);expect(garmentUsesImage(display.surfaces.find(s=>s.sourceId.endsWith('.back'))!,appearance)).toBe(false);
  const changed=createFinishedGarment(source,{...appearance,finish:{...m.finish,neckWidthMm:22}});expect(changed.finishPlan?.settings.neckWidthMm).toBe(22);expect(changed.illustration?.companyMasterId).toBe(m.id);expect(changed).not.toBe(display);
  const exported=JSON.parse(exportGarmentGltf(source,appearance,'data:image/png;base64,AA=='));expect(exported.extras.rendering.illustration).toEqual(display.illustration);expect(exported.extras.rendering.metrics).toEqual(display.metrics);expect(exported.extras.productionApproved).toBe(false);expect(exported.extras.drapeValidated).toBe(false);
});
