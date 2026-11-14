import { afterAll,expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { createPattern3d } from '@/application/pattern-3d';
import { runGarmentJob } from '@/application/garment-assembly-job';
import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import { createGarmentDisplay } from '@/lib/pattern/mesh/garment-surface';
import { createFinishedGarment } from '@/lib/pattern/mesh/garment-finish';
import { garmentBounds,garmentUv,uvAffine,pickGarment,fitGarmentCamera } from '@/lib/pattern/mesh/garment-view';
import { projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { exportGarmentGltf } from '@/lib/pattern/mesh/garment-gltf';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import type { GarmentAppearance,GarmentAssembly3d } from '@/types/garment3d';

const config=(id='brian-reference',gender:'male'|'female'='male',size:'S'|'M'|'XL'='M')=>({activePatternId:id,gender,standardSize:size,fit:'regular' as const,measurements:getReferenceMeasurements(gender,size),engineVersion:'4.10.2' as const,garmentColor:'#5785bd',fabricId:'solid'});
const evidence:unknown[]=[],displayEvidence:unknown[]=[],cache=new Map<string,GarmentAssembly3d>();
const appearance:GarmentAppearance={color:'#5785bd',fabric:'checker',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0};
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=';
for(const id of ['brian-reference','t-shirt','womens-basic-tee','long-sleeve-tee','bound-tank'])for(const gender of ['male','female'] as const)for(const size of ['S','XL'] as const)
it(`sewn surface and source UV: ${id}/${gender}/${size}`,()=>{
  const source=createPattern3d(config(id,gender,size)),snapshot=JSON.stringify(source),model=assembleGarment(source);cache.set(`${id}/${gender}/${size}`,model);
  expect(JSON.stringify(source)).toBe(snapshot);expect(model.surfaces).toHaveLength(id==='bound-tank'?2:4);
  expect(model.quality.connectedComponents).toBe(1);expect(model.quality.nonManifoldEdges).toBe(0);expect(model.quality.boundaryLoops).toBe(4);
  expect(model.quality.remeshAreaErrorRatio).toBeLessThan(.001);expect(model.quality.maxBoundarySnapMm).toBeLessThan(1e-4);
  expect(model.quality.maxBoundaryDeviationMm).toBeLessThan(.5);
  expect(model.quality.maxSeamGapMm).toBeLessThan(1e-8);expect(model.quality.strainP95).toBeGreaterThan(0);expect(model.drapeValidated).toBe(false);expect(model.productionApproved).toBe(false);
  const display=createGarmentDisplay(model);expect(display.metrics.closedShell).toBe(true);expect(display.metrics.maxBoundaryDisplacementMm).toBeLessThanOrEqual(1+1e-9);expect(JSON.stringify(source)).toBe(snapshot);displayEvidence.push({id,gender,size,metrics:display.metrics});
  // Independent welded edge count: neck/hem/cuffs remain open, sewn boundaries
  // have two incident triangles. No extra cap holes or three-sided seam edges.
  const edges=new Map<string,number>(),positions=new Map<number,number[]>(),measuredStrain:number[]=[],sewnIntervals=new Map<string,number[]>();
  for(const surface of model.surfaces){
    for(let i=0;i<surface.boundary.length;i++){
      const a=surface.boundary[i],b=surface.boundary[(i+1)%surface.boundary.length],key=[surface.simulationIds[a],surface.simulationIds[b]].sort((a,b)=>a-b).join(':'),length=Math.hypot(...surface.localMm[a].map((v,k)=>v-surface.localMm[b][k]));
      sewnIntervals.set(key,[...(sewnIntervals.get(key)??[]),length]);
    }
    const original=source.panels.find(p=>p.id===surface.id)!,boundary=surface.boundary.map(i=>surface.localMm[i]);
    for(const vertex of original.vertices){const error=Math.min(...boundary.map((a,i)=>{const b=boundary[(i+1)%boundary.length],dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((vertex.localMm[0]-a[0])*dx+(vertex.localMm[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(vertex.localMm[0]-a[0]-u*dx,vertex.localMm[1]-a[1]-u*dy);}));expect(error).toBeLessThanOrEqual(model.quality.maxBoundaryDeviationMm+1e-8);}
    expect(surface.uvMm).toEqual(surface.localMm);expect(surface.positionsMm).toHaveLength(surface.localMm.length);
    for(const [i,p]of surface.positionsMm.entries()){
      expect(p.every(Number.isFinite)).toBe(true);const previous=positions.get(surface.simulationIds[i]);if(previous)expect(p).toEqual(previous);else positions.set(surface.simulationIds[i],p);
    }
    const localEdges=new Set<string>();
    for(let t=0;t<surface.triangles.length;t+=3){const local=surface.triangles.slice(t,t+3),ids=local.map(i=>surface.simulationIds[i]);expect(new Set(ids).size).toBe(3);for(let k=0;k<3;k++){
      const a=ids[k],b=ids[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)??0)+1);
      const la=local[k],lb=local[(k+1)%3],localKey=[Math.min(la,lb),Math.max(la,lb)].join(':');if(!localEdges.has(localKey)){
        localEdges.add(localKey);const rest=Math.hypot(...surface.localMm[la].map((v,k)=>v-surface.localMm[lb][k])),actual=Math.hypot(...surface.positionsMm[la].map((v,k)=>v-surface.positionsMm[lb][k]));measuredStrain.push(Math.abs(actual/rest-1));
      }
    }}
  }
  measuredStrain.sort((a,b)=>a-b);expect(model.quality.maxStrain).toBeCloseTo(measuredStrain.at(-1)!,12);expect(model.quality.strainP95).toBeCloseTo(measuredStrain[Math.floor(measuredStrain.length*.95)],12);
  expect([...edges.values()].every(n=>n===1||n===2)).toBe(true);
  // Inspect both panels' physical source lengths for every shared boundary
  // interval. This catches nonuniform cubic-speed pairing even when weld gaps
  // are zero and source total seam lengths pass their separate checks.
  const maxPairedIntervalRatio=Math.max(...[...sewnIntervals.values()].filter(lengths=>lengths.length===2).map(lengths=>Math.max(...lengths)/Math.min(...lengths)));
  expect(maxPairedIntervalRatio).toBeLessThan(1.005);
  const bounds=garmentBounds(model);expect(bounds.max[2]-bounds.min[2]).toBeGreaterThan(100);expect(model.seams).toHaveLength(id==='bound-tank'?4:8);
  if(id==='bound-tank')expect(model.unassembledPanelIds).toHaveLength(3);else expect(model.unassembledPanelIds).toEqual([]);
  evidence.push({id,gender,size,quality:model.quality,maxPairedIntervalRatio,sourceUnchanged:true,unassembled:model.unassembledPanelIds});
},15000);

it('body size changes curved geometry and preserves original source millimetre UVs',()=>{
  const small=cache.get('brian-reference/male/S')!,large=cache.get('brian-reference/male/XL')!;
  expect(garmentBounds(large).max[0]-garmentBounds(large).min[0]).toBeGreaterThan(garmentBounds(small).max[0]-garmentBounds(small).min[0]);
  expect(large.surfaces[0].uvMm).not.toEqual(small.surfaces[0].uvMm);
});
it('UV repeat is measured in source mm and image rotation never changes geometry',()=>{
  const model=cache.get('brian-reference/male/S')!,surface=model.surfaces[0],snapshot=JSON.stringify(model),uv=garmentUv(surface,appearance),double=garmentUv(surface,{...appearance,repeatMm:160});
  for(let i=0;i<uv.length;i++)expect(uv[i]).toBeCloseTo(double[i]*2,10);
  const print=garmentUv(surface,{...appearance,imageDataUrl:pixel,imageMode:'print'});expect(Math.min(...print)).toBeCloseTo(0);expect(Math.max(...print)).toBeCloseTo(1);
  garmentUv(surface,{...appearance,rotationDeg:90});expect(JSON.stringify(model)).toBe(snapshot);
});
it('affine texture fallback maps independent UV corners onto screen triangles',()=>{
  const matrix=uvAffine([[.2,.3],[1.2,.3],[.2,1.3]],[[100,200],[400,250],[50,600]])!;
  for(const [uv,target]of [[ [.2,.3],[100,200]],[[1.2,.3],[400,250]],[[.2,1.3],[50,600]]] as const){const x=matrix[0]*uv[0]+matrix[2]*uv[1]+matrix[4],y=matrix[1]*uv[0]+matrix[3]*uv[1]+matrix[5];expect(x).toBeCloseTo(target[0],9);expect(y).toBeCloseTo(target[1],9);}
  expect(uvAffine([[0,0],[0,0],[0,0]],[[0,0],[1,0],[0,1]])).toBeNull();
});
it('surface picking returns the actual triangle source coordinate after camera projection',()=>{
  const model=structuredClone(cache.get('bound-tank/male/S')!);model.surfaces=[{...model.surfaces[0],id:'independent',localMm:[[0,0],[300,0],[0,400]],uvMm:[[0,0],[300,0],[0,400]],positionsMm:[[0,0,0],[300,0,0],[0,-400,80]],triangles:[0,1,2]}];
  const size={width:1000,height:700,dpr:2},camera=fitGarmentCamera(model,size,31,14),point=projectPhysicalPoint([90,-200,40],camera,size),hit=pickGarment(model,camera,size,point)!;
  expect(hit.id).toBe('independent');expect(hit.uvMm[0]).toBeCloseTo(90,8);expect(hit.uvMm[1]).toBeCloseTo(200,8);
});
it('glTF independently reads curved metres, source mm, UVs and embedded material maps',async()=>{
  const model=cache.get('brian-reference/male/S')!,settings={...appearance,imageDataUrl:pixel,imageMode:'print' as const,imageTarget:'front' as const};
  const text=exportGarmentGltf(model,settings,pixel),json=JSON.parse(text),doc=await new NodeIO().readJSON({json,resources:{}});
  const display=createFinishedGarment(model,settings);expect(doc.getRoot().listNodes()).toHaveLength(display.surfaces.length);expect(doc.getRoot().listTextures()).toHaveLength(2);
  for(const [i,node]of doc.getRoot().listNodes().entries()){
    const surface=display.surfaces[i],primitive=node.getMesh()!.listPrimitives()[0],p=primitive.getAttribute('POSITION')!,uv=primitive.getAttribute('TEXCOORD_0')!,cad=primitive.getAttribute(surface.detail?.coordinateSpace==='path-mm'?'_PATH2D':'_CAD2D')!;
    expect(uv.getCount()).toBe(surface.localMm.length);expect(Array.from(primitive.getIndices()!.getArray()!)).toEqual(surface.triangles);
    for(const n of [0,Math.floor(p.getCount()/2),p.getCount()-1]){const world=p.getElement(n,[]).map(v=>v*1000);expect(Math.hypot(...world.map((v,k)=>v-surface.positionsMm[n][k]))).toBeLessThan(.001);expect(cad.getElement(n,[])[0]).toBeCloseTo(surface.uvMm[n][0],3);}
    expect(json.meshes[i].primitives[0].material).toBe(surface.detail?2+(['rib','turnback','thread'] as const).indexOf(surface.detail.kind):surface.sourceId.endsWith('.front')&&surface.layer==='outer'?1:0);
  }
  expect(doc.getRoot().getExtras().productionApproved).toBe(false);
  mkdirSync('doc/evidence/garment-finish-20261111',{recursive:true});writeFileSync('doc/evidence/garment-finish-20261111/brian-textured-garment.gltf',text);
});
it('unsupported or invalid source fails closed instead of pretending to sew a shirt or hoodie',()=>{
  for(const id of ['button-up-shirt','hooded-zip-sweatshirt']){const result=runGarmentJob({requestId:3,revision:'bad',model:createPattern3d(config(id))});expect(result).toMatchObject({error:expect.stringContaining('尚未接通')});expect('model' in result).toBe(false);}
  const corrupt=createPattern3d(config());corrupt.sourceAssembly.integrityPass=false;expect(()=>assembleGarment(corrupt)).toThrow(/源裁片/);
});
afterAll(()=>{mkdirSync('doc/evidence/garment-assembly-20261111',{recursive:true});writeFileSync('doc/evidence/garment-assembly-20261111/source-matrix.json',JSON.stringify({kind:'numerical-sewn-mesh-and-UV-validation',cases:evidence,browserAcceptance:false,productionApproved:false},null,2));mkdirSync('doc/evidence/garment-finish-20261111',{recursive:true});writeFileSync('doc/evidence/garment-finish-20261111/display-matrix.json',JSON.stringify({cases:displayEvidence,browserAcceptance:false},null,2));});
