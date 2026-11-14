import type { GarmentDisplay3d } from '@/types/garment3d';
import type { XY } from '@/types/pattern3d';
import { escapeSvg,garmentTechnicalView,technicalDrawingSvg } from './garment-technical-view';
import type { GarmentTechnicalView } from './garment-technical-view';

export interface GarmentCallout {number:number;viewIndex:number;anchor:XY;marker:XY;label:string;detail:string;operationIds:string[]}
const nearest=(points:XY[],target:XY)=>points.reduce((a,b)=>Math.hypot(a[0]-target[0],a[1]-target[1])<Math.hypot(b[0]-target[0],b[1]-target[1])?a:b);
/** Two primary garment drawings, with callouts anchored to visible operations.
 * The side projection remains a separate assembly reference. */
export function garmentFashionSheet(model:GarmentDisplay3d){
  const views=[0,180].map(yaw=>garmentTechnicalView(model,yaw,560,590)),notes:GarmentCallout[]=[],plan=model.finishPlan;
  const add=(viewIndex:number,ids:string[],target:XY,offset:XY,label:string,detail:string)=>{
    const lines=views[viewIndex].lines.filter(l=>ids.includes(l.id)&&l.path),points=lines.flatMap(l=>l.points);if(!points.length)return;
    const anchor=nearest(points,target),marker=anchor.map((v,k)=>Math.max(18,Math.min((k?590:560)-18,v+offset[k]))) as XY;
    notes.push({number:notes.length+1,viewIndex,anchor,marker,label,detail,operationIds:lines.map(l=>l.id)});
  };
  if(plan?.settings.enabled){
    const s=plan.settings;
    if(plan.neckband)add(0,['neckband-fold'],[280,590],[-100,-85],'对折罗纹领 · 成品宽 '+s.neckWidthMm+' mm','净长比例 '+s.neckRatio.toFixed(2)+'；材料伸长与回复待确认');
    add(0,views[0].lines.filter(l=>/^sleeve-hem-.*-needle-1$/.test(l.id)).map(l=>l.id),[560,590],[35,36],'袖口折深 '+s.sleeveHemMm+' mm','双针间距 '+s.needleGaugeMm+' mm');
    add(0,views[0].lines.filter(l=>/^body-hem-.*-needle-1$/.test(l.id)).map(l=>l.id),[280,590],[0,46],'下摆折深 '+s.bodyHemMm+' mm','双针间距 '+s.needleGaugeMm+' mm；针距 '+s.stitchPitchMm+' mm');
    add(1,views[1].lines.filter(l=>l.kind==='seam'&&l.id.startsWith('cap-')).map(l=>l.id),[0,180],[-40,-35],'装袖与肩缝','结构缝来自源裁片的配缝路径');
  }
  return {views,notes};
}
export function calloutSvg(note:GarmentCallout){
  const [x,y]=note.marker,[ax,ay]=note.anchor;
  return '<g data-callout="'+note.number+'" data-operations="'+escapeSvg(note.operationIds.join(' '))+'" fill="none" stroke="#b04938" stroke-width=".9"><path d="M'+ax+' '+ay+'L'+x+' '+ay+'L'+x+' '+y+'"/><circle cx="'+ax+'" cy="'+ay+'" r="2" fill="#b04938"/><circle cx="'+x+'" cy="'+y+'" r="10" fill="#fff"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-size="12" stroke="none" fill="#9c3c2c">'+note.number+'</text></g>';
}
export function exportGarmentFashionSvg(model:GarmentDisplay3d,sheet=garmentFashionSheet(model)){
  const parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="920" viewBox="0 0 1200 920" role="img" aria-label="成衣前后款式稿"><rect width="1200" height="920" fill="#fff"/><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" fill="#26313c"><text x="36" y="43" font-size="25" font-weight="600">成衣款式稿</text><text x="36" y="70" font-size="12" fill="#6b7480">同一三维完成态投影 · 前后同尺度 · 当前工艺设定</text><text x="1164" y="43" text-anchor="end" font-size="14">'+escapeSvg(model.templateId)+'</text><text x="1164" y="68" text-anchor="end" font-size="12" fill="#98633d">设计草案 · 材料未标定</text><path d="M36 88H1164" stroke="#d8dde2"/>'];
  sheet.views.forEach((view:GarmentTechnicalView,i:number)=>{
    parts.push('<g transform="translate('+(i?620:20)+' 120)"><text x="280" y="0" text-anchor="middle" font-size="15">'+(i?'背面 / BACK':'正面 / FRONT')+'</text>'+technicalDrawingSvg(view)+sheet.notes.filter(n=>n.viewIndex===i).map(calloutSvg).join('')+'</g>');
  });
  parts.push('<path d="M36 744H1164" stroke="#d8dde2"/>');
  if(!sheet.notes.length)parts.push('<text x="36" y="786" font-size="14">当前已关闭工艺显示；未添加工艺标注。</text>');
  sheet.notes.forEach((n,i)=>{const x=36+i*286;parts.push('<g transform="translate('+x+' 778)"><text font-size="13" font-weight="600" fill="#9c3c2c">'+n.number+'  '+escapeSvg(n.label)+'</text><text y="25" font-size="11" fill="#5c6671">'+escapeSvg(n.detail)+'</text></g>');});
  parts.push('<path d="M36 838H1164" stroke="#d8dde2"/><path d="M36 865H70" stroke="#252b32" stroke-width="1.2"/><text x="80" y="869" font-size="11">外轮廓</text><path d="M200 865H234" stroke="#353c44" stroke-width=".8"/><text x="244" y="869" font-size="11">结构缝</text><path d="M364 865H398" stroke="#59616b" stroke-width=".55" stroke-dasharray="2.4 1.8"/><text x="408" y="869" font-size="11">双针 / 压线</text><text x="36" y="900" font-size="11" fill="#6b7480">用于款式与工艺沟通，非裁剪图纸。后领包边、商标及实际材料需另行定义；物理试衣与生产未验收。</text></g></svg>');
  return parts.join('');
}
