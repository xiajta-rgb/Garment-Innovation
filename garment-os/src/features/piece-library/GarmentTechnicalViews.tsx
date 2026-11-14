import { useMemo } from 'react';
import { garmentTechnicalView,technicalDrawingSvg } from '@/lib/pattern/mesh/garment-technical-view';
import type { GarmentDisplay3d } from '@/types/garment3d';
const views=[['正面',0],['背面',180],['侧面',90]] as const;
export function GarmentTechnicalViews({model,onView,onExpand}:{model:GarmentDisplay3d;onView:(yaw:number)=>void;onExpand?:()=>void}){
  const projections=useMemo(()=>views.map(([,yaw])=>garmentTechnicalView(model,yaw,150,150)),[model]);
  return <div data-testid="garment-technical-views" style={{position:'absolute',right:12,bottom:12,width:360,background:'#f8fafbf2',border:'1px solid #d5dbe1',borderRadius:8,padding:6,color:'#455267',zIndex:2}}>
    <div style={{fontSize:11,display:'flex',justifyContent:'space-between',padding:'0 5px'}}><strong>款式投影 · 同一成衣</strong>{onExpand&&<button onClick={onExpand} style={{border:0,background:'none',cursor:'pointer',color:'#286585'}}>放大前后款式稿</button>}</div><div style={{display:'flex'}}>
      {views.map(([label,yaw],i)=><button key={label} aria-label={`联动${label}三视图`} onClick={()=>onView(yaw)} style={{width:'33.33%',padding:0,background:'transparent',border:0,cursor:'pointer',color:'inherit'}}><svg viewBox="0 0 150 150" style={{display:'block',width:'100%',height:120}} aria-label={`${label}成衣技术图`} dangerouslySetInnerHTML={{__html:technicalDrawingSvg(projections[i])}}/>
      <span style={{fontSize:11}}>{label}{yaw===90?' · 组装参考':''}</span></button>)}
    </div></div>;
}
