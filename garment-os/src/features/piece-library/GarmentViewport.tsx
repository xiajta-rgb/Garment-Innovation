import { useCallback,useEffect,useRef,useState } from 'react';
import { createGarmentRenderer } from './garment-renderer';
import { createGarmentSoftwareRenderer } from './garment-software-renderer';
import type { GarmentRenderView } from './garment-renderer';
import type { GarmentDisplay3d } from '@/types/garment3d';
import type { ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import type { XY } from '@/types/pattern3d';
import { detectGarmentPerformance,downgradeGarmentPerformance,type GarmentPerformanceProfile } from './garment-performance';

export function GarmentViewport(props:GarmentRenderView&{model:GarmentDisplay3d;tileUrl:string;onSize:(size:ViewportSize)=>void;onOrbit:(dx:number,dy:number)=>void;onPan:(dx:number,dy:number)=>void;onZoom:(factor:number)=>void;onPick:(point:XY)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null),renderer=useRef<ReturnType<typeof createGarmentRenderer>|null>(null),drag=useRef<{x:number;y:number;startX:number;startY:number;pan:boolean;moved:boolean}|null>(null);
  const initialProfile=detectGarmentPerformance();
  const [compatible,setCompatible]=useState(initialProfile.tier==='compatibility'),[attempt,setAttempt]=useState(0),[status,setStatus]=useState('正在初始化'),[profile,setProfile]=useState<GarmentPerformanceProfile>(initialProfile);
  const profileRef=useRef(profile),slowFrames=useRef(0);
  const onPerformance=useCallback(({frameMs}:{frameMs:number})=>{const current=profileRef.current;if(frameMs>current.maxFrameMs){slowFrames.current+=1;if(slowFrames.current>=2&&current.tier!=='compatibility'){const next=downgradeGarmentPerformance(current);profileRef.current=next;setProfile(next);slowFrames.current=0;if(next.tier==='compatibility')setCompatible(true);}}else slowFrames.current=0;},[]);
  const {model,onSize}=props;
  useEffect(()=>{
    const target=canvas.current!;let active=true;const fail=()=>queueMicrotask(()=>{if(active){setStatus(compatible?'兼容绘制失败，请重试硬件渲染':'正在切换兼容显示');if(!compatible)setCompatible(true);}});
    const lost=(e:Event)=>{e.preventDefault();fail();};target.addEventListener('webglcontextlost',lost);
    let created:ReturnType<typeof createGarmentRenderer>|null=null;
    try{created=compatible?createGarmentSoftwareRenderer(target,model,fail):createGarmentRenderer(target,model,fail);renderer.current=created;queueMicrotask(()=>{if(active)setStatus(compatible?`Canvas2D · 深度缓冲与UV贴图（兼容） · ${profileRef.current.label}`:`WebGL2 · 成衣曲面与UV贴图 · ${profileRef.current.label}`);});}catch{fail();}
    return()=>{active=false;target.removeEventListener('webglcontextlost',lost);created?.dispose();if(renderer.current===created)renderer.current=null;};
  },[model,compatible,attempt]);
  useEffect(()=>{try{renderer.current?.update({...props,performance:profile,onPerformance});}catch{queueMicrotask(()=>setCompatible(true));}},[props,compatible,attempt,profile,onPerformance]);
  useEffect(()=>{const target=host.current!;const resize=()=>{const box=target.getBoundingClientRect();onSize({width:Math.max(1,box.width||800),height:Math.max(1,box.height||600),dpr:window.devicePixelRatio||1});};
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);observer?.observe(target);window.addEventListener('resize',resize);queueMicrotask(resize);return()=>{observer?.disconnect();window.removeEventListener('resize',resize);};
  },[onSize]);
  const {onZoom}=props;
  useEffect(()=>{const target=host.current!,wheel=(e:WheelEvent)=>{e.preventDefault();onZoom(Math.exp(Math.max(-1,Math.min(1,-e.deltaY*.0015))));};target.addEventListener('wheel',wheel,{passive:false});return()=>target.removeEventListener('wheel',wheel);},[onZoom]);
  const handlers={onPointerDown:(e:React.PointerEvent<HTMLCanvasElement|SVGSVGElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);drag.current={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pan:e.shiftKey||e.button===2,moved:false};},
    onPointerMove:(e:React.PointerEvent)=>{const d=drag.current;if(!d)return;if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>3)d.moved=true;if(!d.moved)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(d.pan)props.onPan(dx,dy);else props.onOrbit(dx,dy);d.x=e.clientX;d.y=e.clientY;},
    onPointerUp:(e:React.PointerEvent<HTMLCanvasElement|SVGSVGElement>)=>{const d=drag.current;drag.current=null;if(!d||d.moved||d.pan)return;const box=e.currentTarget.getBoundingClientRect();props.onPick([e.clientX-box.left,e.clientY-box.top]);},onPointerCancel:()=>{drag.current=null;},onContextMenu:(e:React.MouseEvent)=>e.preventDefault()};
  return <div className="mesh-viewport" data-testid="garment-viewport" data-garment-yaw={props.camera.yawDeg} data-garment-scale={props.camera.pixelsPerMm}>
    <div className="mesh-viewport-surface" ref={host}><canvas key={`${compatible}:${attempt}`} ref={canvas} data-testid="garment-canvas" style={{width:'100%',height:'100%',display:'block'}} {...handlers}/></div>
    <div className="mesh-render-status"><span data-testid="garment-render-mode" role={status.includes('失败')?'alert':undefined}>{status}</span><span data-testid="performance-profile">性能档位：{profile.label}</span><button onClick={()=>{if(compatible){setCompatible(false);setAttempt(n=>n+1);}else setCompatible(true);}}>{compatible?'重试硬件渲染':'切换兼容显示'}</button></div>
  </div>;
}
