import * as THREE from 'three';
import type { GarmentPerformanceTier } from './garment-performance';
/** Inspect the actual framebuffer: requesting antialias does not guarantee samples. */
export function createGarmentAntialias(renderer:THREE.WebGLRenderer,canvas:HTMLCanvasElement){
  const gl=renderer.getContext(),nativeSamples=gl.getParameter(gl.SAMPLES) as number;
  const samples=Math.min(4,renderer.capabilities.maxSamples);
  const target=nativeSamples<4&&samples>=2?new THREE.WebGLRenderTarget(1,1,{samples}):null;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),geometry=new THREE.PlaneGeometry(2,2);
  // Offscreen targets contain linear light; tone mapping / sRGB conversion
  // happen once, when presenting the resolved multisample texture.
  const material=new THREE.MeshBasicMaterial({map:target?.texture??null,depthTest:false,depthWrite:false});scene.add(new THREE.Mesh(geometry,material));
  // MSAA samples silhouette coverage, but a subpixel thread also needs its
  // shading sampled more than once. Resolve at 2x CSS resolution on 1x screens.
  canvas.dataset.antialias=target?`MSAA ${samples}x + SSAA`:nativeSamples>=2?`MSAA ${nativeSamples}x + SSAA`:'SSAA';
  return {
    pixelRatio(dpr:number,width=1,height=1,tier:GarmentPerformanceTier='high'){const cap=tier==='high'?2:tier==='balanced'?1.35:1,budget=tier==='high'?4000000:tier==='balanced'?2200000:1200000;return Math.min(cap,Math.max(1,dpr)*2,Math.max(1,Math.sqrt(budget/(Math.max(1,width)*Math.max(1,height)))));},
    resize(width:number,height:number,dpr:number){target?.setSize(Math.floor(width*dpr),Math.floor(height*dpr));},
    render(modelScene:THREE.Scene,modelCamera:THREE.Camera){
      if(!target){renderer.render(modelScene,modelCamera);return;}
      try{renderer.setRenderTarget(target);renderer.render(modelScene,modelCamera);}finally{renderer.setRenderTarget(null);}
      renderer.render(scene,camera);
    },
    dispose(){target?.dispose();geometry.dispose();material.dispose();},
  };
}
