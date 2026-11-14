import { afterEach,expect,it,vi } from 'vitest';
import * as THREE from 'three';
import { createPhysicalRenderer } from '@/features/piece-library/physical-renderer';
import { createFrameScheduler } from '@/features/piece-library/frame-scheduler';
import { createPattern3d } from '@/application/pattern-3d';
import { prepareMeshRenderData } from '@/lib/pattern/mesh/render-data';
import { fitPhysicalCamera,projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import type { RenderView } from '@/features/piece-library/physical-renderer';

const mocks=vi.hoisted(()=>({render:vi.fn(),dispose:vi.fn(),loss:vi.fn(),size:vi.fn(),dpr:vi.fn(),failCreate:false,contextLost:false}));
vi.mock('three',async original=>{const real=await original<typeof THREE>();return {...real,WebGLRenderer:class {constructor(){if(mocks.failCreate)throw new Error('GPU unavailable');}getContext(){return {isContextLost:()=>mocks.contextLost};}setClearColor(){}setPixelRatio=mocks.dpr;setSize=mocks.size;render=mocks.render;dispose=mocks.dispose;forceContextLoss=mocks.loss;}};});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();mocks.failCreate=false;mocks.contextLost=false;});
it('frame scheduler coalesces bursts, stays idle, and cancels a pending frame on disposal',()=>{
  let pending:FrameRequestCallback|undefined;const draw=vi.fn(),request=vi.fn(cb=>{pending=cb;return 5;}),cancel=vi.fn();const scheduler=createFrameScheduler(draw,request,cancel);
  for(let i=0;i<100;i++)scheduler.invalidate();expect(request).toHaveBeenCalledTimes(1);pending!(0);expect(draw).toHaveBeenCalledTimes(1);expect(request).toHaveBeenCalledTimes(1);
  scheduler.invalidate();scheduler.dispose();expect(cancel).toHaveBeenCalledWith(5);pending!(1);expect(draw).toHaveBeenCalledTimes(1);scheduler.invalidate();expect(request).toHaveBeenCalledTimes(2);
});
it('GPU adapter uses source instancing; camera-only changes do not update vertex or instance buffers (GPU mocked)',()=>{
  const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',vi.fn(cb=>{frames.push(cb);return frames.length;}));vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const contextProbe=vi.spyOn(HTMLCanvasElement.prototype,'getContext');
  const model=createPattern3d({activePatternId:'hooded-zip-sweatshirt',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#ffffff',fabricId:'solid'}),data=prepareMeshRenderData(model),size={width:1000,height:600,dpr:3};
  const adapter=createPhysicalRenderer(document.createElement('canvas'),model,data);expect(adapter.mode).toBe('WebGL2');
  expect(contextProbe).not.toHaveBeenCalled();
  const state:RenderView={camera:fitPhysicalCamera(model,size),size,visible:model.panels.map(p=>p.id),selected:model.panels[0].id,wire:false,seams:false,anchors:[]};
  adapter.update(state);adapter.update(state);expect(frames).toHaveLength(1);frames[0](0);
  const [scene,camera]=mocks.render.mock.calls.at(-1) as [THREE.Scene,THREE.OrthographicCamera];
  expect(mocks.dpr).toHaveBeenCalledWith(2);expect(scene.children.filter(x=>x instanceof THREE.InstancedMesh)).toHaveLength(14);
  const solids=scene.children.filter((x):x is THREE.InstancedMesh=>x instanceof THREE.InstancedMesh&&!((x.material as THREE.MeshBasicMaterial).wireframe));
  expect(solids.reduce((s,p)=>s+p.count,0)).toBe(14);expect(new Set(solids.map(p=>p.geometry)).size).toBe(7);
  const versions=solids.map(p=>[(p.geometry.getAttribute('position') as THREE.BufferAttribute).version,p.instanceMatrix.version,p.instanceColor!.version]),sourceSnapshot=JSON.stringify(model);
  const modified={...state,camera:{...state.camera,yawDeg:61,tiltDeg:-17}};adapter.update(modified);frames[1](1);
  expect(solids.map(p=>[(p.geometry.getAttribute('position') as THREE.BufferAttribute).version,p.instanceMatrix.version,p.instanceColor!.version])).toEqual(versions);expect(JSON.stringify(model)).toBe(sourceSnapshot);
  camera.updateMatrixWorld();const world=model.panels[0].positionsMm[0],relative=world.map((v,k)=>v-data.originMm[k]),ndc=new THREE.Vector3(...relative as [number,number,number]).project(camera),expected=projectPhysicalPoint(world,modified.camera,size);
  expect(Math.hypot((ndc.x+1)*size.width/2-expected[0],(1-ndc.y)*size.height/2-expected[1])).toBeLessThan(1e-7);
  adapter.update({...modified,visible:[model.panels[0].id]});expect(solids.reduce((s,p)=>s+p.count,0)).toBe(1);expect(solids.map(p=>(p.geometry.getAttribute('position') as THREE.BufferAttribute).version)).toEqual(versions.map(v=>v[0]));
  const dispose=vi.spyOn(solids[0].geometry,'dispose');adapter.dispose();expect(dispose).toHaveBeenCalledTimes(1);expect(mocks.dispose).toHaveBeenCalledTimes(1);expect(mocks.loss).not.toHaveBeenCalled();
});
it('no graphics contexts yields an explicit unavailable renderer',()=>{
  mocks.failCreate=true;
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  const model=createPattern3d({activePatternId:'bound-tank',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#ffffff',fabricId:'solid'});
  const adapter=createPhysicalRenderer(document.createElement('canvas'),model,prepareMeshRenderData(model));expect(adapter.mode).toBe('unavailable');adapter.dispose();
});

it('an asynchronous draw failure requests recovery once and cancels further GPU work',()=>{
  const frames:FrameRequestCallback[]=[];
  vi.stubGlobal('requestAnimationFrame',vi.fn(cb=>{frames.push(cb);return frames.length;}));vi.stubGlobal('cancelAnimationFrame',vi.fn());
  mocks.render.mockImplementationOnce(()=>{throw new Error('GPU draw failed');});
  const model=createPattern3d({activePatternId:'bound-tank',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#ffffff',fabricId:'solid'});
  const failure=vi.fn(),adapter=createPhysicalRenderer(document.createElement('canvas'),model,prepareMeshRenderData(model),failure);
  const size={width:800,height:420,dpr:1},state:RenderView={camera:fitPhysicalCamera(model,size),size,visible:model.panels.map(p=>p.id),selected:'',wire:false,seams:false,anchors:[]};
  adapter.update(state);expect(()=>frames[0](0)).not.toThrow();expect(failure).toHaveBeenCalledOnce();
  adapter.update(state);expect(frames).toHaveLength(1);adapter.dispose();expect(mocks.loss).not.toHaveBeenCalled();
});

it('a previously lost canvas is rejected before declaring the GPU renderer ready',()=>{
  mocks.contextLost=true;
  const model=createPattern3d({activePatternId:'bound-tank',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#ffffff',fabricId:'solid'});
  const adapter=createPhysicalRenderer(document.createElement('canvas'),model,prepareMeshRenderData(model));
  expect(adapter.mode).toBe('unavailable');expect(mocks.dispose).toHaveBeenCalledOnce();expect(mocks.render).not.toHaveBeenCalled();
});

it('lost GPU state at draw time triggers recovery even without a browser context-loss event',()=>{
  const frames:FrameRequestCallback[]=[];
  vi.stubGlobal('requestAnimationFrame',vi.fn(cb=>{frames.push(cb);return frames.length;}));vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const model=createPattern3d({activePatternId:'bound-tank',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#ffffff',fabricId:'solid'});
  const failure=vi.fn(),adapter=createPhysicalRenderer(document.createElement('canvas'),model,prepareMeshRenderData(model),failure);
  const size={width:800,height:420,dpr:1};adapter.update({camera:fitPhysicalCamera(model,size),size,visible:model.panels.map(p=>p.id),selected:'',wire:false,seams:false,anchors:[]});
  mocks.contextLost=true;frames[0](0);expect(failure).toHaveBeenCalledOnce();expect(mocks.render).not.toHaveBeenCalled();adapter.dispose();
});
