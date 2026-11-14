import { afterAll,expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { createPattern3d } from '@/application/pattern-3d';
import { buildPanelMeshes,edgePoint,placePoint,reflect,sampleEdge,unplacePoint } from '@/lib/pattern/mesh/panel-mesh';
import { exportPatternGltf } from '@/lib/pattern/mesh/gltf-export';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { draftStandard } from '@/lib/pattern/reference/standard';
import type { DesignConfiguration } from '@/types/design';
import type { PanelMesh,XY } from '@/types/pattern3d';
import { prepareMeshRenderData } from '@/lib/pattern/mesh/render-data';

const dir='doc/evidence/capability-20261111',evidence:unknown[]=[];
const renderCases:unknown[]=[];
const config=(id:string,gender:'male'|'female'='male',size:'XS'|'S'|'M'|'L'|'XL'|'XXL'|'XXXL'='M',fit:'slim'|'regular'|'loose'='regular'):DesignConfiguration=>({activePatternId:id,gender,standardSize:size,fit,measurements:getReferenceMeasurements(gender,size),engineVersion:'4.10.2',garmentColor:'#cccccc',fabricId:'solid'});
const close=(a:number[],b:number[],limit=1e-6)=>expect(Math.hypot(...a.map((v,i)=>v-b[i]))).toBeLessThan(limit);

for(const id of ['bound-tank','hooded-zip-sweatshirt'])for(const gender of ['male','female']as const)for(const size of ['XS','S','M','L','XL','XXL','XXXL']as const)for(const fit of ['slim','regular','loose']as const)
it(`${id}/${gender}/${size}/${fit}: every physical copy maps to valid triangles without changing local lengths`,()=>{
  const c=config(id,gender,size,fit),model=createPattern3d(c),source=draftStandard(id,c.measurements,fit);
  expect(model.panels).toHaveLength(id==='bound-tank'?5:14);
  expect(model.panels.reduce((s,p)=>s+(p.unfolded?1:0),0)).toBe(id==='bound-tank'?2:1);
  expect(model.drapeValidated).toBe(false);expect(model.simulationReady).toBe(false);expect(model.productionApproved).toBe(false);
  const display=prepareMeshRenderData(model);expect(display.maxUploadErrorMm).toBeLessThan(.001);expect(display.maxTransformQuantizationMm).toBeLessThan(.01);
  renderCases.push({id,gender,size,fit,physicalPanels:model.panels.length,sharedGeometries:display.geometries.length,localFloat32Mm:display.maxUploadErrorMm,transformFloat32ProbeMm:display.maxTransformQuantizationMm});
  for(const panel of model.panels){
    const original=source.assemblyPieces.find(p=>p.id===panel.sourceId)!;
    expect(panel.metrics.areaErrorRatio).toBeLessThan(.001);
    expect(panel.metrics.triangleAreaMm2).toBeCloseTo(panel.metrics.polygonAreaMm2,5);
    expect(panel.metrics.maxRoundtripMm).toBeLessThan(1e-6);expect(panel.metrics.maxEdgeDistortionMm).toBeLessThan(1e-6);
    for(let i=0;i<panel.vertices.length;i++){
      const v=panel.vertices[i],edge=original.edges.find(e=>e.id===v.sourceEdge)!;
      close(v.sourceMm,edgePoint(edge,v.t));close(v.localMm,unplacePoint(panel.positionsMm[i],panel.placement));
      expect(v.t).toBeGreaterThanOrEqual(0);expect(v.t).toBeLessThanOrEqual(1);
      if(!v.mirrored)close(v.localMm,v.sourceMm);
      else {
        const fold=source.assembly.boundaries.find(b=>b.piece===panel.sourceId&&b.disposition==='fold')!,e=original.edges.find(e=>e.id===fold.edgeIds[0])!;
        close(v.localMm,reflect(v.sourceMm,[e.from.x,e.from.y],[e.to.x,e.to.y]));
      }
    }
    for(const i of panel.triangles){expect(Number.isInteger(i)).toBe(true);expect(i).toBeGreaterThanOrEqual(0);expect(i).toBeLessThan(panel.vertices.length);}
  }
  if(id==='bound-tank'){
    expect(model.seams).toHaveLength(4);
    for(const seam of model.seams){expect(seam.status).toBe('unsewn');expect(Math.abs(seam.sourceLengthDeltaMm)).toBeLessThan(.01);expect(seam.samples).toHaveLength(17);expect(seam.samples.some(p=>p.gapMm>1)).toBe(true);}
  }else expect(model.seams).toEqual([]);
  evidence.push({id,gender,size,fit,physicalPanels:model.panels.length,vertices:model.panels.reduce((s,p)=>s+p.vertices.length,0),triangles:model.panels.reduce((s,p)=>s+p.triangles.length/3,0),maxAreaErrorRatio:Math.max(...model.panels.map(p=>p.metrics.areaErrorRatio)),maxRoundtripMm:Math.max(...model.panels.map(p=>p.metrics.maxRoundtripMm)),maxEdgeDistortionMm:Math.max(...model.panels.map(p=>p.metrics.maxEdgeDistortionMm)),unsewnAssignments:model.seams.length,drapeValidated:false});
});

it('rigid inverse transforms and nonvertical fold axes preserve an independent 3-4-5 distance',()=>{
  const placement:PanelMesh['placement']={yawDeg:71,translationMm:[-200,80,130]},a:XY=[0,0],b:XY=[3,4];
  const x=placePoint(a,placement),y=placePoint(b,placement);expect(Math.hypot(...x.map((v,i)=>v-y[i]))).toBeCloseTo(5,12);
  close(a,unplacePoint(x,placement));close(b,unplacePoint(y,placement));
  close(reflect([1,0],[0,0],[1,1]),[0,1]);close(reflect(reflect([7,-3],[2,3],[9,8]),[2,3],[9,8]),[7,-3]);
});
it('collinear curve controls beyond endpoints cannot pass a false zero-flatness subdivision',()=>{
  const samples=sampleEdge({id:'curve',kind:'curve',from:{x:0,y:0},to:{x:1,y:0},cp1:{x:100,y:0},cp2:{x:100,y:0},lengthMm:149.126});
  expect(Math.max(...samples.map(p=>p.point[0]))).toBeGreaterThan(70);
  expect(samples.length).toBeGreaterThan(10);
});
it('ribbing/pocket switches change the actual 3D inventory; head measurements change the hood mesh',()=>{
  const c=config('hooded-zip-sweatshirt'),a=createPattern3d(c),b=createPattern3d({...c,construction:{schema:'garment-os/construction/v1',options:{ribbing:false,pocket:false}}});
  expect(b.panels).toHaveLength(9);expect(b.panels.some(p=>/cuff|waistband|pocket/.test(p.sourceId))).toBe(false);
  const changed=createPattern3d({...c,measurements:{...c.measurements,headCirc:c.measurements.headCirc!+30}});
  expect(changed.panels.find(p=>p.sourceId==='huey.hood')!.vertices).not.toEqual(a.panels.find(p=>p.sourceId==='huey.hood')!.vertices);
});
it('missing head input, unsupported templates and corrupt geometry cannot retain a previous mesh',()=>{
  const c=config('hooded-zip-sweatshirt');expect(()=>createPattern3d({...c,measurements:{...c.measurements,headCirc:undefined}})).toThrow(/头围/);
  expect(()=>createPattern3d(config('v-neck-tee'))).toThrow(/尚未重建|停用/);
  for(const fault of ['quantity','geometry','missing-piece','fold-axis']as const){
    const input=draftStandard('bound-tank',getReferenceMeasurements('male','M'));
    if(fault==='quantity')input.assemblyPieces[0].quantity+=1;
    if(fault==='geometry')input.assemblyPieces[0].edges[0].from.x=NaN;
    if(fault==='missing-piece')input.assemblyPieces.pop();
    if(fault==='fold-axis')input.assemblyPieces[0].onFold=false;
    expect(()=>buildPanelMeshes(input),fault).toThrow();
  }
});
it.each(['bound-tank','hooded-zip-sweatshirt'])('%s: independent glTF-Transform readback preserves every vertex, triangle, source attribute and metre scale',async id=>{
  const model=createPattern3d(config(id)),gltf=exportPatternGltf(model),io=new NodeIO();
  // The JSON document API loads embedded base64 buffers independently of our writer.
  const doc=await io.readJSON({json:JSON.parse(gltf),resources:{}});
  expect(doc.getRoot().listNodes()).toHaveLength(model.panels.length);
  for(const [i,node]of doc.getRoot().listNodes().entries()){
    const panel=model.panels[i],primitive=node.getMesh()!.listPrimitives()[0],position=primitive.getAttribute('POSITION')!,cad=primitive.getAttribute('_CAD2D')!,source=primitive.getAttribute('_SOURCE2D')!;
    expect(node.getName()).toBe(panel.id);expect(position.getCount()).toBe(panel.vertices.length);expect(Array.from(primitive.getIndices()!.getArray()!)).toEqual(panel.triangles);
    for(let n=0;n<panel.vertices.length;n++){
      close(position.getElement(n,[]).map(x=>x*1000),panel.positionsMm[n],.001);
      close(cad.getElement(n,[]),panel.vertices[n].localMm,.001);close(source.getElement(n,[]),panel.vertices[n].sourceMm,.001);
    }
    expect(node.getExtras().sourceId).toBe(panel.sourceId);
  }
  expect(doc.getRoot().getExtras().drapeValidated).toBe(false);
  mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${id}-mapping.gltf`,gltf);writeFileSync(`${dir}/${id}-mesh.json`,JSON.stringify(model,null,2));
});
afterAll(()=>{mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/mesh-validation.json`,JSON.stringify({mode:'source geometry and independent glTF readback',cases:evidence,actualBrowserChecked:false,drapeValidated:false},null,2));const mappingDir='doc/evidence/mapping-precision-20261111';mkdirSync(mappingDir,{recursive:true});writeFileSync(`${mappingDir}/render-data-matrix.json`,JSON.stringify({cases:renderCases,actualGpuMeasured:false},null,2));});
