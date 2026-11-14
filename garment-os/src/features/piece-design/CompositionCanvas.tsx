import { useLayoutEffect, useRef, useState } from 'react';
import { anchorCompositionPiece, compositionMovable, pieceDisplaySize, resolveCompositionPiece } from '@/application/composition-catalogue';
import type { CompositionPiece, CompositionPlan, CompositionView } from '@/types/piece-composition';
import { COMPOSITION_VIEWS, VIEW_LABELS } from './composition-views';
import { compositionDecoratedMarkup, compositionGraphicMarkup, compositionPieceColor } from '@/application/composition-decoration';
import type { CompositionGraphic } from '@/types/composition-elements';
import { accessoryScale, transformAccessory } from './accessory-transform';
import type { AccessoryFrame, AccessoryGestureMode } from './accessory-transform';
interface Props {
 plan:CompositionPlan;selected?:string;showGrid?:boolean;showNet?:boolean;focusView?:CompositionView;
 onSelect?:(id:string)=>void;onDeselect?:()=>void;onChange?:(piece:CompositionPiece)=>void;
 onSelectGraphic?:(id:string)=>void;onChangeGraphic?:(graphic:CompositionGraphic)=>void;
 onDrop?:(templateId:string,assetKey:string|null,view:CompositionView,x:number,y:number)=>void;
}
export function CompositionCanvas({plan,selected,showGrid=true,showNet=false,focusView,onSelect,onDeselect,onChange,onDrop,onSelectGraphic,onChangeGraphic}:Props){
 const [ghost,setGhost]=useState<CompositionPiece>();
 const [graphicGhost,setGraphicGhost]=useState<CompositionGraphic>();
 const svgRef=useRef<SVGSVGElement>(null),[handleUnit,setHandleUnit]=useState(1);
 useLayoutEffect(()=>{const svg=svgRef.current;if(!svg)return;const update=()=>setHandleUnit((focusView?500:1500)/Math.max(1,svg.getBoundingClientRect().width));if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);}const observer=new ResizeObserver(update);observer.observe(svg);return()=>observer.disconnect();},[focusView]);
 const graphicGesture=useRef<{graphic:CompositionGraphic;next:CompositionGraphic;x:number;y:number;mode:AccessoryGestureMode;inverse:DOMMatrix}|undefined>(undefined);
 const gesture=useRef<{piece:CompositionPiece;next:CompositionPiece;x:number;y:number;mode:AccessoryGestureMode;inverse:DOMMatrix}|undefined>(undefined);
 function pointer(event:React.PointerEvent<SVGElement>){
  const svg=event.currentTarget.ownerSVGElement!,view=event.currentTarget.closest('[data-composition-view]') as SVGGraphicsElement;
  const inverse=view.getScreenCTM()!.inverse(),point=new DOMPoint(event.clientX,event.clientY).matrixTransform(inverse);
  svg.focus({preventScroll:true});svg.setPointerCapture(event.pointerId);return {inverse,x:point.x,y:point.y};
 }
 const start=(event:React.PointerEvent<SVGElement>,piece:CompositionPiece,mode:AccessoryGestureMode)=>{
  if(!onChange)return;event.preventDefault();event.stopPropagation();onSelect?.(piece.id);
  if(!compositionMovable(piece)){event.currentTarget.ownerSVGElement?.focus({preventScroll:true});return;}
  gesture.current={piece,next:piece,mode,...pointer(event)};setGhost(piece);
 };
 const startGraphic=(event:React.PointerEvent<SVGElement>,graphic:CompositionGraphic,mode:AccessoryGestureMode)=>{
  if(!onChangeGraphic)return;event.preventDefault();event.stopPropagation();onSelectGraphic?.(graphic.id);
  graphicGesture.current={graphic,next:graphic,mode,...pointer(event)};setGraphicGhost(graphic);
 };
 return <svg ref={svgRef} data-testid="composition-canvas" xmlns="http://www.w3.org/2000/svg" width={focusView?500:1500} height="760" viewBox={focusView?`${COMPOSITION_VIEWS.indexOf(focusView)*500} 0 500 760`:'0 0 1500 760'} className="composition-canvas"
  onPointerDown={()=>onDeselect?.()}
  onDragOver={e=>{if(onDrop&&!showNet){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>{
   if(!onDrop||showNet)return;e.preventDefault();const template=e.dataTransfer.getData('application/x-garment-template'),asset=e.dataTransfer.getData('application/x-garment-piece');if(!template)return;
   const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(e.currentTarget.getScreenCTM()!.inverse()),index=Math.max(0,Math.min(2,Math.floor(p.x/500)));onDrop(template,asset||null,COMPOSITION_VIEWS[index],p.x-index*500,p.y);
  }}
  onPointerMove={e=>{
   const gg=graphicGesture.current;if(gg){const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(gg.inverse),original=gg.graphic;
    const next=transformAccessory({...original,rotation:original.rotation??0},gg,pt,gg.mode,e.shiftKey),size=accessoryScale(original.width,original.height,next.width/original.width,10,5,300,300);
    gg.next={...original,x:Math.max(0,Math.min(500,next.x)),y:Math.max(65,Math.min(700,next.y)),rotation:next.rotation,...size};setGraphicGhost(gg.next);return;}
   const g=gesture.current;if(!g)return;const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(g.inverse),a=resolveCompositionPiece(g.piece,plan.elements),size=pieceDisplaySize(g.piece,a);
   const next=transformAccessory({...g.piece,...size},g,pt,g.mode,e.shiftKey),scaled=accessoryScale(g.piece.widthMm,g.piece.heightMm,next.width/size.width,1,1,3000,3000);
   g.next={...g.piece,x:Math.max(-1000,Math.min(1500,next.x)),y:Math.max(-1000,Math.min(1800,next.y)),rotation:next.rotation,widthMm:scaled.width,heightMm:scaled.height};setGhost(g.next);
  }} onPointerUp={e=>{if(gesture.current&&gesture.current.next!==gesture.current.piece)onChange?.(gesture.current.next);if(graphicGesture.current&&graphicGesture.current.next!==graphicGesture.current.graphic)onChangeGraphic?.(graphicGesture.current.next);gesture.current=undefined;graphicGesture.current=undefined;setGhost(undefined);setGraphicGhost(undefined);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
  onPointerCancel={()=>{gesture.current=undefined;graphicGesture.current=undefined;setGhost(undefined);setGraphicGhost(undefined);}}
  onKeyDown={e=>{
   if(!selected||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
   const step=e.shiftKey?10:1,dx=e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,dy=e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0;
   const graphic=plan.elements?.graphics.find(g=>g.id===selected),piece=plan.pieces.find(p=>p.id===selected);
   if(graphic&&onChangeGraphic){e.preventDefault();e.stopPropagation();onChangeGraphic({...graphic,x:Math.max(0,Math.min(500,graphic.x+dx)),y:Math.max(65,Math.min(700,graphic.y+dy))});}
   else if(piece&&onChange){e.preventDefault();e.stopPropagation();if(compositionMovable(piece))onChange({...piece,x:Math.max(-1000,Math.min(1500,piece.x+dx)),y:Math.max(-1000,Math.min(1800,piece.y+dy))});}
  }}
  tabIndex={onChange?0:undefined} aria-label="三视图裁片组合画布">
  <rect width="1500" height="760" fill="#fff"/>
  <metadata>{JSON.stringify({plan,mode:'creative-piece-layout',sourceCadModified:false,productionApproved:false,positionUnit:'drawing-pixel',dimensionUnit:'source-net-mm-relative-scale'})}</metadata>
  <defs><pattern id={`grid-${plan.id}`} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#e9ede9" strokeWidth=".6"/></pattern></defs>
  {COMPOSITION_VIEWS.map((view,index)=>(!focusView||view===focusView)&&<g key={view} data-composition-view={view} transform={`translate(${index*500} 0)`}>
   <rect width="500" height="760" fill={showGrid?`url(#grid-${plan.id})`:'#fff'}/>
   <text x="24" y="35" fontSize="16" fill="#33473b" fontFamily="Microsoft YaHei,sans-serif">{VIEW_LABELS[view]} / {view.toUpperCase()}</text>
   <path d="M250 65V700" stroke="#d3dcd5" strokeDasharray="5 7" strokeWidth=".7" pointerEvents="none"/>
   {plan.pieces.filter(p=>p.view===view&&p.visible).map(original=>{
    let asset;const candidate=ghost?.id===original.id?ghost:original;
    try{asset=resolveCompositionPiece(candidate,showNet?undefined:plan.elements);}catch{return <text key={candidate.id} x="24" y="80" fill="#af3c32">{candidate.name}：源裁片载入失败</text>;}
    const piece=anchorCompositionPiece(candidate,asset),color=compositionPieceColor(piece,asset,plan.elements);
    const size=pieceDisplaySize(piece,asset),b=showNet?asset.netBounds:asset.artBounds;
    const scaleX=size.width/b.width,scaleY=size.height/b.height;
    return <g key={piece.id} data-composition-piece={piece.id} data-asset-key={piece.assetKey} data-source-template={piece.source.templateId} data-source-piece-id={asset.sourceId} data-x={piece.x} data-y={piece.y} data-width-mm={piece.widthMm} data-height-mm={piece.heightMm}
      data-placement={compositionMovable(asset)?'movable':'fixed'} data-shoulder={plan.elements?.shoulder??'set-in'} transform={`translate(${piece.x} ${piece.y}) rotate(${piece.rotation})`} style={{cursor:onChange?(compositionMovable(asset)?'move':'pointer'):undefined,color}} onPointerDown={e=>start(e,piece,'move')}>
     <g transform={`scale(${piece.mirrored?-1:1} 1) translate(${-size.width/2} ${-size.height/2}) scale(${scaleX} ${scaleY}) translate(${-b.x} ${-b.y})`} pointerEvents="none">
      {showNet&&asset.netReferenceAvailable===false?<text x="0" y="0" fontSize="12" fill="#9a6940">此口袋净样待制版</text>:showNet?<><path d={asset.netPath} fill={piece.color} stroke="#263a2e" strokeWidth="1" vectorEffect="non-scaling-stroke"/>{asset.onFold&&<g transform={`translate(${2*(asset.foldAxisX??0)} 0) scale(-1 1)`}><path d={asset.netPath} fill={piece.color} stroke="#263a2e" strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}</>:<g dangerouslySetInnerHTML={{__html:compositionDecoratedMarkup(asset,piece,plan.elements,`art-${plan.id}-${piece.id}`)}}/>}
     </g>
     <rect x={-size.width/2} y={-size.height/2} width={size.width} height={size.height} fill="transparent" stroke={selected===piece.id?'#ef5274':'none'} strokeWidth="1.8" strokeDasharray="5 4" vectorEffect="non-scaling-stroke"/>
    </g>;
   })}
   {!showNet&&plan.elements?.graphics.filter(g=>g.view===view).map(original=>{
    const g=graphicGhost?.id===original.id?graphicGhost:original;
    return <g key={g.id} data-composition-graphic={g.id} transform={`translate(${g.x} ${g.y}) rotate(${g.rotation??0})`} style={{cursor:onChangeGraphic?'move':undefined}} onPointerDown={event=>startGraphic(event,g,'move')}><g pointerEvents="none" dangerouslySetInnerHTML={{__html:compositionGraphicMarkup(g)}}/><rect x={-g.width/2-3} y={-g.height/2-3} width={g.width+6} height={g.height+6} fill="transparent" stroke={selected===g.id?'#ef5274':'none'} strokeWidth="1" strokeDasharray="4 3"/></g>;
   })}
   {onChange&&plan.pieces.filter(p=>p.id===selected&&p.view===view&&p.visible&&compositionMovable(p)).map(p=>{const piece=ghost?.id===p.id?ghost:p,size=pieceDisplaySize(piece,resolveCompositionPiece(piece,plan.elements));return <AccessoryHandles key={p.id} frame={{...piece,...size}} unit={handleUnit} onStart={(event,mode)=>start(event,piece,mode)}/>;})}
   {!showNet&&onChangeGraphic&&plan.elements?.graphics.filter(g=>g.id===selected&&g.view===view).map(g=>{const graphic=graphicGhost?.id===g.id?graphicGhost:g;return <AccessoryHandles key={g.id} frame={{...graphic,rotation:graphic.rotation??0}} unit={handleUnit} onStart={(event,mode)=>startGraphic(event,graphic,mode)}/>;})}
   <path d="M0 744H500" stroke="#e4e9e5"/>
  </g>)}
  {!focusView&&<path d="M500 0V744M1000 0V744" stroke="#dce3de"/>}
 </svg>;
}

function AccessoryHandles({frame:f,unit:u,onStart}:{frame:AccessoryFrame;unit:number;onStart:(event:React.PointerEvent<SVGElement>,mode:AccessoryGestureMode)=>void}){
 return <g data-editor-handle="accessory-transform" transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}>
  <rect x={-f.width/2} y={-f.height/2} width={f.width} height={f.height} fill="none" stroke="#ef5274" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
  <path d={`M0 ${-f.height/2}V${-f.height/2-30*u}`} stroke="#ef5274" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
  <g data-accessory-handle="rotate" onPointerDown={e=>onStart(e,'rotate')} style={{cursor:'grab'}}><title>拖动旋转 · Shift 每次15°</title><circle cx="0" cy={-f.height/2-30*u} r={13*u} fill="transparent"/><circle cx="0" cy={-f.height/2-30*u} r={8*u} fill="#fff" stroke="#ef5274" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><text x="0" y={-f.height/2-30*u} textAnchor="middle" dominantBaseline="central" fontSize={12*u} fill="#c93860" pointerEvents="none">↻</text></g>
  {([[-1,-1],[1,-1],[-1,1],[1,1]] as const).map(([x,y])=><g key={`${x}/${y}`} data-accessory-handle="resize" data-corner={`${x}/${y}`} onPointerDown={e=>onStart(e,'resize')} style={{cursor:x===y?'nwse-resize':'nesw-resize'}}><title>拖动等比例缩放</title><rect x={x*(f.width/2+8*u)-13*u} y={y*(f.height/2+8*u)-13*u} width={26*u} height={26*u} fill="transparent"/><rect x={x*(f.width/2+8*u)-5*u} y={y*(f.height/2+8*u)-5*u} width={10*u} height={10*u} rx={2*u} fill="#fff" stroke="#ef5274" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></g>)}
 </g>;
}
