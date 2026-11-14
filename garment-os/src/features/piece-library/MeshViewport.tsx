import { useCallback,useEffect,useRef,useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPhysicalRenderer } from './physical-renderer';
import { ProjectedMesh } from './ProjectedMesh';
import type { PhysicalRenderer,RenderView } from './physical-renderer';
import type { PatternMesh3d,XY } from '@/types/pattern3d';
import type { MeshRenderData } from '@/lib/pattern/mesh/render-data';
import type { ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import { projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';

interface Props extends RenderView {model:PatternMesh3d;data:MeshRenderData;tool?:'select'|'orbit'|'measure';onOrbit?:(dx:number,dy:number)=>void;onFrame?:()=>void;onSize:(size:ViewportSize)=>void;onDevice:(key:string)=>void;onPick:(p:XY)=>void;onPan:(dx:number,dy:number)=>void;onZoom:(factor:number)=>void}
function screenKey(){const monitor=screen as Screen&{availLeft?:number;availTop?:number};return [window.devicePixelRatio,screen.width,screen.height,screen.availWidth,screen.availHeight,monitor.availLeft,monitor.availTop,window.visualViewport?.scale??1].join(':');}
export function MeshViewport(props:Props){
  const canvas=useRef<HTMLCanvasElement>(null),surface=useRef<HTMLDivElement>(null),renderer=useRef<PhysicalRenderer|null>(null),drag=useRef<{x:number;y:number;startX:number;startY:number;moved:boolean;action:'select'|'orbit'|'pan'|'measure'}|null>(null);
  const [mode,setMode]=useState('正在初始化');
  const [compatible,setCompatible]=useState(false),[attempt,setAttempt]=useState(0),[reason,setReason]=useState('');
  const switchToCompatible=useCallback((message:string)=>{setReason(message);setCompatible(true);drag.current=null;},[]);
  const {model,data,onSize,onDevice}=props;
  useEffect(()=>{
    if(compatible)return;
    const target=canvas.current!;let active=true,created:PhysicalRenderer|null=null;
    const fail=(message:string)=>queueMicrotask(()=>{if(active)switchToCompatible(message);});
    const lost=(e:Event)=>{e.preventDefault();fail('硬件图形连接中断，已自动切换兼容显示。');};
    // Listen before initialization so an early context loss cannot be missed.
    target.addEventListener('webglcontextlost',lost);
    target.addEventListener('contextlost',lost);
    try{
      created=createPhysicalRenderer(target,model,data,()=>fail('硬件绘制失败，已自动切换兼容显示。'));
      renderer.current=created;
      if(created.mode==='unavailable')fail('此环境无法创建画布，已自动切换兼容显示。');
      else{const createdMode=created.mode;queueMicrotask(()=>{if(active)setMode(createdMode);});}
    }catch{fail('画布初始化失败，已自动切换兼容显示。');}
    return ()=>{active=false;target.removeEventListener('webglcontextlost',lost);target.removeEventListener('contextlost',lost);created?.dispose();if(renderer.current===created)renderer.current=null;};
  },[model,data,compatible,attempt,switchToCompatible]);
  useEffect(()=>{
    const target=surface.current!;let active=true;
    const resize=()=>{const rect=target.getBoundingClientRect();onSize({width:Math.max(1,rect.width||800),height:Math.max(1,rect.height||420),dpr:window.devicePixelRatio||1});onDevice(screenKey());};
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);observer?.observe(target);
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);queueMicrotask(()=>{if(active)resize();});
    return ()=>{active=false;observer?.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};
  },[onSize,onDevice]);
  useEffect(()=>{
    const current=renderer.current;
    try{current?.update(props);}catch{queueMicrotask(()=>{if(current&&renderer.current===current)switchToCompatible('画布更新失败，已自动切换兼容显示。');});}
  },[props,compatible,attempt,switchToCompatible]);
  const {onZoom}=props;
  useEffect(()=>{const target=surface.current!,wheel=(e:WheelEvent)=>{e.preventDefault();if(e.deltaY)onZoom(Math.exp(Math.max(-1,Math.min(1,-e.deltaY*.0015))));};target.addEventListener('wheel',wheel,{passive:false});return ()=>target.removeEventListener('wheel',wheel);},[onZoom]);
  const displayMode=compatible?'SVG':mode;
  const pointerHandlers={
    onPointerDown:(e:ReactPointerEvent<HTMLCanvasElement|SVGSVGElement>)=>{e.preventDefault();e.currentTarget.closest<HTMLElement>('[tabindex="0"]')?.focus({preventScroll:true});const action=e.shiftKey||e.button===2?'pan':e.button===1||e.altKey||props.tool==='orbit'?'orbit':props.tool==='measure'?'measure':'select';drag.current={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,action};e.currentTarget.setPointerCapture?.(e.pointerId);},
    onPointerMove:(e:ReactPointerEvent<HTMLCanvasElement|SVGSVGElement>)=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>3)d.moved=true;if(!d.moved)return;if(d.action==='pan')props.onPan(dx,dy);else if(d.action!=='measure')props.onOrbit?.(dx,dy);d.x=e.clientX;d.y=e.clientY;},
    onPointerCancel:()=>{drag.current=null;},
    onPointerUp:(e:ReactPointerEvent<HTMLCanvasElement|SVGSVGElement>)=>{const d=drag.current;drag.current=null;if(d?.moved||d?.action==='orbit'||d?.action==='pan'||!['WebGL2','Canvas2D','SVG'].includes(displayMode))return;const rect=e.currentTarget.getBoundingClientRect();props.onPick([e.clientX-rect.left,e.clientY-rect.top]);},
    onDoubleClick:()=>props.onFrame?.(),
    onContextMenu:(e:React.MouseEvent)=>e.preventDefault(),
  };
  return <div className="mesh-viewport" data-camera-yaw={props.camera.yawDeg} data-camera-scale={props.camera.pixelsPerMm} data-camera-pan={props.camera.panCss.join(',')}>
    <div ref={surface} className="mesh-viewport-surface" style={{cursor:props.tool==='measure'?'crosshair':props.tool==='orbit'?'grab':'default'}}>
    {compatible?<svg data-testid="mesh-preview" aria-label="真实裁片三维网格，点击两点量尺" viewBox={`0 0 ${props.size.width} ${props.size.height}`} preserveAspectRatio="none" style={{width:'100%',height:'100%',display:'block'}} {...pointerHandlers}>
      <ProjectedMesh {...props}/>
    </svg>:<canvas key={attempt} ref={canvas} data-testid="mesh-preview" aria-label="真实裁片三维网格，点击两点量尺" style={{width:'100%',height:'100%',display:'block'}} {...pointerHandlers}/>}
    <svg aria-label="量尺选点" viewBox={`0 0 ${props.size.width} ${props.size.height}`} preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>{props.anchors.map((a,i)=>{const [x,y]=projectPhysicalPoint(a.worldMm,props.camera,props.size);return <g key={i}><circle cx={x} cy={y} r="4" fill="#edac64"/><text x={x+7} y={y-7} fill="#edac64">{i+1}</text></g>;})}</svg>
    <svg aria-label="视平面毫米标尺" width="180" height="32" viewBox="0 0 180 32" style={{position:'absolute',left:8,bottom:8,pointerEvents:'none',color:'#b8bdc9'}}><path d="M10 4V16 M10 10H110 M110 4V16" stroke="currentColor"/><text x="10" y="29" fill="currentColor" fontSize="10">{(100/props.camera.pixelsPerMm).toFixed(2)} mm（视平面）</text></svg></div>
    <div className="mesh-render-status"><p data-testid="render-mode">{displayMode}{compatible?' · 兼容三维投影':mode==='Canvas2D'?' · 兼容画布':mode==='WebGL2'?' · 实体着色 / 按需绘制':''}</p><span>{props.visible.length} 片可见</span>
      {compatible?<button onClick={()=>{setMode('正在初始化');setCompatible(false);setAttempt(a=>a+1);}}>重试硬件渲染</button>:<button onClick={()=>switchToCompatible('已选择兼容显示。')}>切换兼容显示</button>}
    </div>{compatible&&<p className="mesh-render-notice" role="status">{reason}旋转与毫米量尺保持可用。</p>}
  </div>;
}
