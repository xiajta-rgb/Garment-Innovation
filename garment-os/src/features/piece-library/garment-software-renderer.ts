import {rasterGarment} from '@/lib/pattern/mesh/garment-raster';
import {createFrameScheduler} from './frame-scheduler';
import type {GarmentRasterTexture} from '@/lib/pattern/mesh/garment-raster';
import type {GarmentDisplay3d} from '@/types/garment3d';
import type {GarmentRenderView} from './garment-renderer';
import {garmentBounds} from '@/lib/pattern/mesh/garment-view';
import {projectPhysicalPoint} from '@/lib/pattern/mesh/viewport-mapping';
import {mannequinDimensions} from '@/types/mannequin';

/**
 * Draw the same display-only body in the Canvas2D fallback. This is a
 * proportional silhouette, not a collision or cloth simulation. Keeping it
 * here means the mannequin toggle remains honest when WebGL is unavailable.
 */
function drawMannequinOverlay(context:CanvasRenderingContext2D,model:GarmentDisplay3d,view:GarmentRenderView,width:number,height:number){
  const spec=view.mannequin;if(!spec?.enabled)return;if(spec.mode==='real-human'){view.onAvatarStatus?.('unsupported');return;}
  const bounds=garmentBounds(model),d=mannequinDimensions(spec),scaleX=width/Math.max(1,view.size.width);
  const camera={...view.camera,pixelsPerMm:view.camera.pixelsPerMm*scaleX,panCss:view.camera.panCss.map(v=>v*scaleX) as [number,number]};
  const point=(world:[number,number,number])=>projectPhysicalPoint(world,camera,{width,height,dpr:1});
  const center=bounds.center,top=bounds.max[1]-center[1],shoulderY=top-8;
  const body=(x:number,y:number,z=0)=>point([center[0]+x,center[1]+y,center[2]+z]);
  const ellipse=(x:number,y:number,rxMm:number,ryMm:number)=>{
    const c=body(x,y),px=body(x+rxMm,y),py=body(x,y+ryMm);
    context.beginPath();context.ellipse(c[0],c[1],Math.max(1,Math.hypot(px[0]-c[0],px[1]-c[1])),Math.max(1,Math.hypot(py[0]-c[0],py[1]-c[1])),0,0,Math.PI*2);context.fill();
  };
  context.save();context.globalAlpha=.24;context.fillStyle=spec.gender==='female'?'#d7a99a':'#b88776';context.strokeStyle='rgba(97,57,48,.45)';
  ellipse(0,shoulderY-d.torsoLengthMm/2,d.bustWidthMm/2,d.torsoLengthMm/2);
  ellipse(0,shoulderY+55+d.headRadiusMm+38,d.headRadiusMm,d.headRadiusMm);
  context.globalAlpha=.3;context.lineCap='round';const armX=d.shoulderWidthMm/2,armRadius=d.upperArmRadiusMm;
  const shoulderEdge=body(armX+armRadius,shoulderY-6),shoulder=body(armX,shoulderY-6);context.lineWidth=Math.max(2,Math.hypot(shoulderEdge[0]-shoulder[0],shoulderEdge[1]-shoulder[1])*2);
  const arm=(side:number)=>{const from=body(side*armX,shoulderY-6),to=body(side*armX,shoulderY-d.armLengthMm*.8);context.beginPath();context.moveTo(from[0],from[1]);context.lineTo(to[0],to[1]);context.stroke();};
  arm(-1);arm(1);context.restore();
}

export function createGarmentSoftwareRenderer(canvas:HTMLCanvasElement,model:GarmentDisplay3d,onFailure:()=>void){
  const context=canvas.getContext('2d',{alpha:false});if(!context)throw Error('兼容画布不可用');
  let state:GarmentRenderView|null=null,failed=false;
  const textureCache=new WeakMap<HTMLCanvasElement|HTMLImageElement,GarmentRasterTexture>();
  const texture=(input:HTMLCanvasElement|HTMLImageElement)=>{
    const cached=textureCache.get(input);if(cached)return cached;
    const w='naturalWidth' in input?input.naturalWidth:input.width,h='naturalHeight' in input?input.naturalHeight:input.height,f=Math.min(1,1024/Math.max(w,h)),buffer=document.createElement('canvas');buffer.width=Math.max(1,Math.round(w*f));buffer.height=Math.max(1,Math.round(h*f));
    const ctx=buffer.getContext('2d')!;ctx.drawImage(input,0,0,buffer.width,buffer.height);const result={width:buffer.width,height:buffer.height,pixels:ctx.getImageData(0,0,buffer.width,buffer.height).data};textureCache.set(input,result);return result;
  };
  const scheduler=createFrameScheduler(()=>{
    if(!state||failed)return;
    try{
      const start=globalThis.performance.now(),frame=rasterGarment(model,state.appearance,state.camera,state.size,{wire:state.wire,tile:texture(state.tile),image:state.image?texture(state.image):undefined});
      if(canvas.width!==frame.width||canvas.height!==frame.height){canvas.width=frame.width;canvas.height=frame.height;}
      const image=context.createImageData(frame.width,frame.height);image.data.set(frame.pixels);context.putImageData(image,0,0);canvas.dataset.softwareFrameMs=(performance.now()-start).toFixed(1);canvas.dataset.depthTriangles=String(frame.triangles);canvas.dataset.antialias=`SSAA ${frame.samples}x${frame.samples}`;
      drawMannequinOverlay(context,model,state,frame.width,frame.height);state.onPerformance?.({frameMs:globalThis.performance.now()-start,triangles:frame.triangles,tier:state.performance?.tier??'compatibility'});
    }catch{failed=true;onFailure();}
  });
  return {update(view:GarmentRenderView){state=view;scheduler.invalidate();},dispose(){scheduler.dispose();}};
}
