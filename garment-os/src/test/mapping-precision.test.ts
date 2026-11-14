import { afterAll,expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { Matrix4,OrthographicCamera,Vector3 } from 'three';
import { createPattern3d } from '@/application/pattern-3d';
import { runMeshJob } from '@/application/pattern-mesh-job';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { prepareMeshRenderData } from '@/lib/pattern/mesh/render-data';
import { calibrateScreen,cameraBasis,fitPhysicalCamera,frontCamera,mapSurfaceAnchor,measureSurfaceAnchors,pickPhysicalSurface,projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { placePoint,reflect } from '@/lib/pattern/mesh/panel-mesh';
import type { PhysicalCamera } from '@/lib/pattern/mesh/viewport-mapping';
import type { PanelMesh,PatternMesh3d,XYZ } from '@/types/pattern3d';
import type { DesignConfiguration } from '@/types/design';

const dir='doc/evidence/mapping-precision-20261111',cases:unknown[]=[],benchmarks:unknown[]=[];
const config=(id='bound-tank'):DesignConfiguration=>({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#cccccc',fabricId:'solid'});
const tank=createPattern3d(config());
const close=(a:number[],b:number[],tolerance=1e-7)=>expect(Math.hypot(...a.map((v,i)=>v-b[i]))).toBeLessThan(tolerance);
function triangle(){
  const panel:PanelMesh={...structuredClone(tank.panels[0]),id:'triangle#1',sourceId:'triangle',unfolded:false,placement:{yawDeg:31,translationMm:[-150,90,80]},triangles:[0,1,2],sourceEdges:[],vertices:[[0,0],[300,0],[0,400]].map(p=>({localMm:[p[0],p[1]],sourceMm:[p[0],p[1]],sourceEdge:'independent',t:0,mirrored:false}))};
  panel.positionsMm=panel.vertices.map(v=>placePoint(v.localMm,panel.placement));
  return {...structuredClone(tank),panels:[panel],seams:[]} as PatternMesh3d;
}

for(const yaw of [-70,0,88,150])for(const tilt of [-30,0,60])for(const ppm of [.3,3])for(const dpr of [1,2])
it(`independent triangle → projection → pick: yaw${yaw}/tilt${tilt}/scale${ppm}/DPR${dpr}`,()=>{
  const model=triangle(),camera:PhysicalCamera={centerMm:[100,-100,0],yawDeg:yaw,tiltDeg:tilt,pixelsPerMm:ppm,panCss:[37,-19]},size={width:1234,height:567,dpr};
  const anchor=mapSurfaceAnchor(model,'triangle#1',0,[.2,.3,.5]);close(anchor.localMm,[90,200]);
  const screen=projectPhysicalPoint(anchor.worldMm,camera,size),picked=pickPhysicalSurface(model,['triangle#1'],screen,camera,size)!;
  close(picked.localMm,[90,200]);close(picked.worldMm,anchor.worldMm);close(picked.weights,[.2,.3,.5]);
  // Independent Three camera projection, not the hand-written projection or its inverse.
  const basis=cameraBasis(camera),c=new OrthographicCamera(-size.width/(2*ppm),size.width/(2*ppm),size.height/(2*ppm),-size.height/(2*ppm),.01,10000);
  const target=camera.centerMm.map((v,k)=>v-basis.right[k]*camera.panCss[0]/ppm+basis.up[k]*camera.panCss[1]/ppm) as XYZ;
  c.position.set(...target.map((v,k)=>v+basis.forward[k]*3000) as XYZ);c.up.set(...basis.up);c.lookAt(new Vector3(...target));c.updateMatrixWorld();
  const ndc=new Vector3(...anchor.worldMm).project(c),threeScreen=[(ndc.x+1)*size.width/2,(1-ndc.y)*size.height/2];close(screen,threeScreen);
  cases.push({yaw,tilt,ppm,dpr,pickErrorMm:Math.hypot(...picked.localMm.map((v,k)=>v-anchor.localMm[k])),projectionErrorCssPx:Math.hypot(...screen.map((v,k)=>v-threeScreen[k]))});
});

it('3-4-5 material distance is invariant; another physical copy means spatial gap only',()=>{
  const model=triangle(),a=mapSurfaceAnchor(model,'triangle#1',0,[1,0,0]),b=mapSurfaceAnchor(model,'triangle#1',0,[.98,.01,.01]);
  const m=measureSurfaceAnchors(a,b);expect(m.restMm).toBeCloseTo(5,12);expect(m.spatialMm).toBeCloseTo(5,12);
  expect(measureSurfaceAnchors(a,{...b,panelId:'triangle#2'}).restMm).toBeNull();expect(measureSurfaceAnchors(a,{...b,panelId:'triangle#2'}).kind).toBe('inter-panel-gap');
});
it('camera rotation, viewport/DPR changes and panning never rescale or mutate source geometry',()=>{
  const model=triangle(),snapshot=JSON.stringify(model),camera=fitPhysicalCamera(model,{width:800,height:420,dpr:1});
  const a=[0,0,0] as XYZ,b=[100,0,0] as XYZ,front={...camera,yawDeg:0,tiltDeg:0};
  for(const size of [{width:800,height:420,dpr:1},{width:800,height:420,dpr:3},{width:1600,height:900,dpr:2}]){
    const p=projectPhysicalPoint(a,front,size),q=projectPhysicalPoint(b,front,size);expect(q[0]-p[0]).toBeCloseTo(100*camera.pixelsPerMm,10);
  }
  expect(JSON.stringify(model)).toBe(snapshot);
});
it('front view and calibrated 100 mm marker have physical scale; uncalibrated CSS mm is never assumed',()=>{
  const model=triangle(),camera=frontCamera(model.panels[0],fitPhysicalCamera(model,{width:800,height:420,dpr:1})),cal=calibrateScreen(220,55,'screen1');
  const a=mapSurfaceAnchor(model,'triangle#1',0,[1,0,0]),b=mapSurfaceAnchor(model,'triangle#1',0,[2/3,1/3,0]),size={width:800,height:420,dpr:2};camera.pixelsPerMm=cal.cssPxPerPhysicalMm;
  const p=projectPhysicalPoint(a.worldMm,camera,size),q=projectPhysicalPoint(b.worldMm,camera,size);expect(Math.hypot(q[0]-p[0],q[1]-p[1])).toBeCloseTo(400,10);
  for(const bad of [0,NaN,Infinity,9,1001])expect(()=>calibrateScreen(220,bad,'screen1')).toThrow();
});
it('inverse picking resolves an interior triangle spanning the fold without collapsing to half-source width',()=>{
  const panel=tank.panels.find(p=>p.unfolded)!;
  let found=false;
  for(let triangle=0;triangle<panel.triangles.length/3;triangle++){
    const vertices=panel.triangles.slice(triangle*3,triangle*3+3).map(i=>panel.vertices[i]);
    if(!vertices.some(v=>v.mirrored)||!vertices.some(v=>!v.mirrored))continue;
    const anchor=mapSurfaceAnchor(tank,panel.id,triangle,[.2,.3,.5]),naive=[0,1].map(k=>vertices.reduce((s,v,i)=>s+v.sourceMm[k]*[.2,.3,.5][i],0));
    if(Math.hypot(...naive.map((v,k)=>v-anchor.sourceMm[k]))<1)continue;
    const fold=tank.sourceAssembly.boundaries.find(b=>b.piece===panel.sourceId&&b.disposition==='fold')!,edge=panel.sourceEdges.find(e=>e.id===fold.edgeIds[0])!;
    close(anchor.sourceMm,anchor.mirrored?reflect(anchor.localMm,[edge.from.x,edge.from.y],[edge.to.x,edge.to.y]):anchor.localMm);
    const camera=frontCamera(panel,fitPhysicalCamera(tank,{width:1200,height:800,dpr:1})),size={width:1200,height:800,dpr:1};
    const pick=pickPhysicalSurface(tank,[panel.id],projectPhysicalPoint(anchor.worldMm,camera,size),camera,size)!;close(pick.sourceMm,anchor.sourceMm);found=true;break;
  }
  expect(found).toBe(true);
});
it('occluded surfaces pick nearest visible plane; an empty filter or edge-on view picks nothing',()=>{
  const model=triangle(),copy=structuredClone(model.panels[0]);copy.id='near';copy.placement.translationMm[2]+=100;copy.positionsMm=copy.vertices.map(v=>placePoint(v.localMm,copy.placement));model.panels.push(copy);
  const camera=frontCamera(copy,fitPhysicalCamera(model,{width:800,height:420,dpr:1})),size={width:800,height:420,dpr:1},a=mapSurfaceAnchor(model,'near',0,[.2,.3,.5]),p=projectPhysicalPoint(a.worldMm,camera,size);
  expect(pickPhysicalSurface(model,model.panels.map(p=>p.id),p,camera,size)?.panelId).toBe('near');expect(pickPhysicalSurface(model,[],p,camera,size)).toBeNull();
  expect(pickPhysicalSurface(model,['near'],p,{...camera,yawDeg:59},size)).toBeNull();
});
it('invalid triangle/weights and corrupt same-source copies fail closed',()=>{
  const model=triangle();for(const weights of [[.1,.2,.3],[-.2,.6,.6],[NaN,0,1]])expect(()=>mapSurfaceAnchor(model,'triangle#1',0,weights as XYZ)).toThrow();
  expect(()=>mapSurfaceAnchor(model,'triangle#1',2,[1,0,0])).toThrow();
  const corrupt=structuredClone(tank),copy=corrupt.panels.find(p=>p.quantity>1)!;copy.vertices[1].localMm[0]+=.1;expect(()=>prepareMeshRenderData(corrupt)).toThrow(/副本几何/);
});
for(const id of ['bound-tank','hooded-zip-sweatshirt'])for(const shift of [0,1e9,1e12])
it(`${id}: locally rebased render buffers reconstruct mm coordinates at global offset ${shift}`,()=>{
  const model=createPattern3d(config(id));for(const panel of model.panels){panel.placement.translationMm=panel.placement.translationMm.map(v=>v+shift) as XYZ;panel.positionsMm=panel.vertices.map(v=>placePoint(v.localMm,panel.placement));}
  const snapshot=JSON.stringify(model),data=prepareMeshRenderData(model);expect(data.geometries).toHaveLength(id==='bound-tank'?4:7);
  let error=0;
  for(const node of data.panels){const panel=model.panels.find(p=>p.id===node.id)!,g=data.geometries.find(g=>g.key===node.geometry)!,matrix=new Matrix4().makeRotationY(node.yawDeg*Math.PI/180);matrix.setPosition(...node.translation);
    for(let i=0;i<g.positions.length/3;i++){const p=new Vector3().fromArray(g.positions,i*3).applyMatrix4(matrix);const world=[p.x,p.y,p.z].map((v,k)=>v+data.originMm[k]);error=Math.max(error,Math.hypot(...world.map((v,k)=>v-panel.positionsMm[i][k])));}
  }
  expect(error).toBeLessThan(.001);expect(data.maxUploadErrorMm).toBeLessThan(.001);expect(data.maxTransformQuantizationMm).toBeLessThan(.01);expect(JSON.stringify(model)).toBe(snapshot);cases.push({id,shift,cpuRenderBufferReconstructionMm:error,uploadConversionMm:data.maxUploadErrorMm,cpuFloat32TransformProbeMm:data.maxTransformQuantizationMm});
});
it('far-apart instances cannot silently exceed display precision despite locally exact vertices',()=>{
  const model=triangle(),copy=structuredClone(model.panels[0]);copy.id='far';copy.placement.translationMm[0]+=1e9;copy.positionsMm=copy.vertices.map(v=>placePoint(v.localMm,copy.placement));model.panels.push(copy);
  expect(()=>prepareMeshRenderData(model)).toThrow(/浮点量化/);
});
it('worker job returns transferable display copies and errors without promoting cloth validation',()=>{
  const result=runMeshJob({requestId:1,revision:'a',configuration:config()});expect('renderData' in result).toBe(true);if(!('renderData' in result))return;
  const detached=structuredClone(result,{transfer:result.renderData.geometries.flatMap(g=>[g.positions.buffer,g.indices.buffer]) as ArrayBuffer[]});
  expect(detached.model.panels[0].vertices.length).toBeGreaterThan(0);expect(detached.model.productionApproved).toBe(false);expect(result.renderData.geometries[0].positions.byteLength).toBe(0);expect(result.model.panels[0].vertices[0].localMm).toEqual(detached.model.panels[0].vertices[0].localMm);
  expect(runMeshJob({requestId:2,revision:'b',configuration:config('v-neck-tee')})).toMatchObject({requestId:2,revision:'b',error:expect.stringContaining('尚未重建')});
});
it('synthetic 1000-instance preparation shares one geometry and does not multiply buffer storage',()=>{
  const model=triangle(),source=model.panels[0];model.panels=Array.from({length:1000},(_,i)=>{const p={...source,id:`synthetic-${i}`,placement:{...source.placement,translationMm:[i%40*400,Math.floor(i/40)*500,0] as XYZ}};return {...p,positionsMm:p.vertices.map(v=>placePoint(v.localMm,p.placement))};});
  const timings:number[]=[];for(let i=0;i<5;i++){const start=performance.now(),data=prepareMeshRenderData(model);timings.push(performance.now()-start);expect(data.geometries).toHaveLength(1);expect(data.panels).toHaveLength(1000);expect(data.geometries[0].positions.byteLength).toBe(36);}
  benchmarks.push({kind:'synthetic independent triangles, CPU buffer preparation only',instances:1000,sourceGeometries:1,positionBytes:36,iterationsMs:timings,hardwareGpuFpsMeasured:false});
});
it('synthetic repetition of genuine hoodie panels shares seven buffers across 1008 physical instances',()=>{
  const model=createPattern3d(config('hooded-zip-sweatshirt')),sources=model.panels;
  model.panels=Array.from({length:72},(_,i)=>sources.map(panel=>{
    const placement={...panel.placement,translationMm:panel.placement.translationMm.map((v,k)=>v+(k===0?i%9*2200:k===1?-Math.floor(i/9)*4200:0)) as XYZ};
    return {...panel,id:`synthetic-${i}/${panel.id}`,placement,positionsMm:panel.vertices.map(v=>placePoint(v.localMm,placement))};
  })).flat();
  model.seams=[];const start=performance.now(),data=prepareMeshRenderData(model),elapsed=performance.now()-start;
  expect(data.panels).toHaveLength(1008);expect(data.geometries).toHaveLength(7);expect(data.maxTransformQuantizationMm).toBeLessThan(.01);
  benchmarks.push({kind:'synthetic repetition of real Huey source boundaries, CPU preparation only',instances:1008,canonicalVertices:model.panels.reduce((s,p)=>s+p.vertices.length,0),sourceGeometries:data.geometries.length,sharedPositionAndIndexBytes:data.geometries.reduce((s,g)=>s+g.positions.byteLength+g.indices.byteLength,0),preparationMs:elapsed,transformProbeMm:data.maxTransformQuantizationMm,hardwareGpuFpsMeasured:false});
});
afterAll(()=>{mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/precision.json`,JSON.stringify({mode:'numerical tests and independent Three CPU matrix comparison',cases,benchmarks,actualBrowserChecked:false,screenPhysicallyCalibrated:false,hardwareGpuFpsMeasured:false,drapeValidated:false},null,2));writeFileSync(`${dir}/worker-inputs.json`,JSON.stringify([
  ...['bound-tank','hooded-zip-sweatshirt','brian-reference','t-shirt','womens-basic-tee','long-sleeve-tee','button-up-shirt'].map(id=>({configuration:config(id),expectedPanels:createPattern3d(config(id)).panels.length})),
  {configuration:config('v-neck-tee'),expectedError:'尚未重建'},
],null,2));});
