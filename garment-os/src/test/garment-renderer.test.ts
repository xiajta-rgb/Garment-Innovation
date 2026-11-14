import { beforeAll,afterEach,expect,it,vi } from 'vitest';
import * as THREE from 'three';
import { createGarmentRenderer } from '@/features/piece-library/garment-renderer';
import { createGarmentAntialias } from '@/features/piece-library/garment-antialias';
import { createPattern3d } from '@/application/pattern-3d';
import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import { createGarmentDisplay } from '@/lib/pattern/mesh/garment-surface';
import { createFinishedGarment } from '@/lib/pattern/mesh/garment-finish';
import { fitGarmentCamera } from '@/lib/pattern/mesh/garment-view';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { readGarmentTexture } from '@/features/piece-library/garment-material';
import type { GarmentDisplay3d } from '@/types/garment3d';
import type { GarmentRenderView } from '@/features/piece-library/garment-renderer';
const mocks=vi.hoisted(()=>({render:vi.fn(),dispose:vi.fn(),size:vi.fn(),target:vi.fn(),nativeSamples:4,maxSamples:4}));
vi.mock('three',async original=>{const real=await original<typeof THREE>();return {...real,WebGLRenderer:class{shadowMap={};capabilities={get maxSamples(){return mocks.maxSamples;},getMaxAnisotropy:()=>16};getContext(){return {isContextLost:()=>false,SAMPLES:32937,getParameter:()=>mocks.nativeSamples};}setClearColor(){}setPixelRatio(){}setSize=mocks.size;setRenderTarget=mocks.target;render=mocks.render;dispose=mocks.dispose;}};});
let model:GarmentDisplay3d;
beforeAll(()=>{model=createGarmentDisplay(assembleGarment(createPattern3d({activePatternId:'bound-tank',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#446688',fabricId:'solid'})));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();mocks.nativeSamples=4;mocks.maxSamples=4;});
it('actual curved geometry gets UV maps; late tile/image replacement updates textures without rebuilding geometry',()=>{
  const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.push(cb);return frames.length;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const renderer=createGarmentRenderer(document.createElement('canvas'),model,vi.fn()),size={width:900,height:650,dpr:2};
  const state:GarmentRenderView={camera:fitGarmentCamera(model,size),size,wire:false,selected:'',appearance:{color:'#446688',fabric:'solid',repeatMm:60,imageMode:'repeat',imageTarget:'front',rotationDeg:0},tile:document.createElement('canvas'),image:null};
  renderer.update(state);frames[0](0);const scene=mocks.render.mock.calls[0][0] as THREE.Scene,meshes=scene.children.filter((n):n is THREE.Mesh=>n instanceof THREE.Mesh),front=meshes[0],material=front.material as THREE.MeshStandardMaterial,geometry=front.geometry,oldMap=material.map!,dispose=vi.spyOn(oldMap,'dispose');
  expect(meshes).toHaveLength(model.surfaces.length);expect(model.surfaces.filter(s=>s.layer==='rim')).toHaveLength(2);expect(geometry.getAttribute('uv').count).toBe(model.surfaces[0].localMm.length);expect(new Set(Array.from(geometry.getAttribute('position').array).filter((_,i)=>i%3===2)).size).toBeGreaterThan(100);
  expect(material.side).toBe(THREE.FrontSide);expect(oldMap.anisotropy).toBe(8);expect(oldMap.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  for(const [i,mesh]of meshes.entries()){
    expect(mesh.castShadow).toBe(model.surfaces[i].layer==='outer');expect(mesh.receiveShadow).toBe(model.surfaces[i].layer==='outer');
  }
  renderer.update({...state,tile:document.createElement('canvas')});expect(material.map).not.toBe(oldMap);expect(dispose).toHaveBeenCalledOnce();expect(front.geometry).toBe(geometry);
  const image=document.createElement('img'),uploaded={...state,appearance:{...state.appearance,imageDataUrl:'data:image/png;base64,AAA'},image};renderer.update(uploaded);expect(material.map!.image).toBe(image);expect((meshes[1].material as THREE.MeshStandardMaterial).map!.image).toBe(state.tile);
  const next=document.createElement('img');renderer.update({...uploaded,image:next});expect(material.map!.image).toBe(next);
  const positionVersion=(geometry.getAttribute('position') as THREE.BufferAttribute).version;renderer.update({...uploaded,camera:{...state.camera,yawDeg:50}});expect((geometry.getAttribute('position') as THREE.BufferAttribute).version).toBe(positionVersion);expect(mocks.size).toHaveBeenCalledTimes(1);renderer.dispose();expect(mocks.dispose).toHaveBeenCalledOnce();
});
it('checks actual samples, resolves an offscreen multisample target and releases it',()=>{
  mocks.nativeSamples=0;const renderer=new THREE.WebGLRenderer(),canvas=document.createElement('canvas'),aa=createGarmentAntialias(renderer,canvas),scene=new THREE.Scene(),camera=new THREE.Camera();
  aa.resize(900,650,2);aa.render(scene,camera);
  const target=mocks.target.mock.calls[0][0] as THREE.WebGLRenderTarget,disposed=vi.spyOn(target,'dispose');
  expect(canvas.dataset.antialias).toBe('MSAA 4x + SSAA');expect(target.samples).toBe(4);expect(target.width).toBe(1800);expect(target.height).toBe(1300);
  expect(mocks.render.mock.calls[0]).toEqual([scene,camera]);expect(mocks.target.mock.calls[1]).toEqual([null]);expect(mocks.render).toHaveBeenCalledTimes(2);
  aa.dispose();expect(disposed).toHaveBeenCalledOnce();
});
it('uses supersampling when both default and offscreen framebuffers lack multisampling',()=>{
  mocks.nativeSamples=0;mocks.maxSamples=0;const renderer=new THREE.WebGLRenderer(),canvas=document.createElement('canvas'),aa=createGarmentAntialias(renderer,canvas);
  expect(aa.pixelRatio(1)).toBe(2);expect(canvas.dataset.antialias).toBe('SSAA');aa.render(new THREE.Scene(),new THREE.Camera());expect(mocks.target).not.toHaveBeenCalled();expect(mocks.render).toHaveBeenCalledOnce();aa.dispose();
});
it('samples thread shading on 1x screens even when native MSAA is present, with bounded large-viewport resolution',()=>{
  const aa=createGarmentAntialias(new THREE.WebGLRenderer(),document.createElement('canvas'));
  expect(aa.pixelRatio(1,900,650)).toBe(2);expect(aa.pixelRatio(2,900,650)).toBe(2);
  const ratio=aa.pixelRatio(2,1800,1300);expect(ratio).toBeGreaterThanOrEqual(1);expect(1800*1300*ratio*ratio).toBeCloseTo(4000000,6);aa.dispose();
});
it('finished rib, inner turnback and threads retain depth occlusion without participating in coarse self shadows',()=>{
  const frames:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.push(cb);return frames.length;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const source=assembleGarment(createPattern3d({activePatternId:'t-shirt',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#446688',fabricId:'solid'}));
  const finished=createFinishedGarment(source),before=JSON.stringify(finished),renderer=createGarmentRenderer(document.createElement('canvas'),finished,vi.fn()),size={width:900,height:650,dpr:1};
  renderer.update({camera:fitGarmentCamera(finished,size),size,wire:false,selected:'',appearance:{color:'#446688',fabric:'solid',repeatMm:60,imageMode:'repeat',imageTarget:'all',rotationDeg:0},tile:document.createElement('canvas'),image:null});frames[0](0);
  const scene=mocks.render.mock.calls[0][0] as THREE.Scene,meshes=scene.children.filter((n):n is THREE.Mesh=>n instanceof THREE.Mesh);
  expect(finished.surfaces.some(s=>s.detail?.kind==='thread')).toBe(true);expect(finished.surfaces.some(s=>s.detail?.kind==='turnback')).toBe(true);expect(finished.surfaces.some(s=>s.detail?.kind==='rib')).toBe(true);
  for(const [i,mesh]of meshes.entries()){
    const s=finished.surfaces[i],main=s.layer==='outer'&&!s.detail;expect(mesh.castShadow).toBe(main);expect(mesh.receiveShadow).toBe(main);
    const material=mesh.material as THREE.MeshStandardMaterial;expect(material.depthTest).toBe(true);expect(material.depthWrite).toBe(true);
  }
  expect(scene.children.filter((n):n is THREE.DirectionalLight=>n instanceof THREE.DirectionalLight&&n.castShadow).map(n=>n.shadow.intensity)).toEqual([.35]);
  expect(JSON.stringify(finished)).toBe(before);renderer.dispose();
});
it('upload validation rejects unsupported formats and oversize images and releases decoded images',async()=>{
  await expect(readGarmentTexture(new File(['svg'],'x.svg',{type:'image/svg+xml'}))).rejects.toThrow(/PNG/);
  const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:5000,height:20,close})));await expect(readGarmentTexture(new File(['png'],'x.png',{type:'image/png'}))).rejects.toThrow(/4096/);expect(close).toHaveBeenCalledOnce();
  await expect(readGarmentTexture(new File([new Uint8Array(11*1024*1024)],'large.png',{type:'image/png'}))).rejects.toThrow(/10MB/);
});
