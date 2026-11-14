import type { CompositionDetails } from '@/types/composition-elements';
import type { XY } from '@/types/pattern3d';

/** Source-informed finished-style details. All coordinates are drawing ratios, not net patterns. */
export function teeDetailDrawing(d:CompositionDetails,input:{H:number;hemHalf:number;depth:number;underarm:XY;neckHalf:number;referenceLengthMm:number;cuffBandPath:string;sleevePath:string;bodyPath:string;cuffColor?:string}){
 const {H,hemHalf:b,depth,underarm,neckHalf:n,referenceLengthMm:mm}=input;
 const path=(d:string,op:string,fill='none',stroke='#263a30',width=.0016)=>`<path data-design-element="craft-detail" data-operation="${op}" d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
 const rib=(x:number,y:number,w:number,h:number,op:string)=>`<g data-operation="${op}">${path(`M${x} ${y}h${w}v${h}h${-w}Z`,op+'-band',d.panelColor)}${Array.from({length:Math.ceil(w/.012)},(_,i)=>path(`M${x+(i+.5)*.012} ${y}v${h}`,op+'-wale','none','#657166',.0008)).join('')}</g>`;
 function clipped(markup:string,shape:string,id:string){return `<svg overflow="visible"><defs><clipPath id="${id}"><path d="${shape}"/></clipPath></defs><g clip-path="url(#${id})">${markup}</g></svg>`;}
 function body(back:boolean){
  let out='';const h=d.hemHeightMm/mm;
  if(d.hemFinish==='rib')out+=clipped(rib(-b-.02,H-h,b*2+.04,h+.02,'hem-rib').replace('data-design-element="craft-detail"','data-design-element="hem-contrast"'),input.bodyPath,'detail-body-clip');
  if(d.panel!=='none'){
   const y=Math.max(underarm[1]*.5,d.panelDepthMm/mm);
   const shape=d.panel==='yoke'?`M${-b-.2} -.1H${b+.2}V${y}Q0 ${y+.06} ${-b-.2} ${y}Z`:`M${underarm[0]-.04} ${underarm[1]}Q${b*.68} ${H*.65} ${b*.8} ${H+.03}H${b+.1}V${underarm[1]}Z M${-underarm[0]+.04} ${underarm[1]}Q${-b*.68} ${H*.65} ${-b*.8} ${H+.03}H${-b-.1}V${underarm[1]}Z`;
   out+=clipped(path(shape,d.panel==='yoke'?'yoke-panel':'side-panel',d.panelColor),input.bodyPath,'detail-panel-clip');
  }
  if(d.hemFinish==='side-slit'){
   const top=H-d.slitHeightMm/mm;
   for(const sign of [-1,1]){const x=b*sign;out+=path(`M${x} ${top}V${H+.008}H${x-sign*.014}Z`,'side-slit-cutout','#fff','#fff',.003)+path(`M${x-sign*.014} ${H}L${x} ${top}`,'side-slit-edge')+path(`M${x-sign*.015} ${top-.004}h${sign*.014}`,'slit-bartack');}
  }
  if(back&&d.hood!=='none'){
   const h=d.hoodHeightMm/mm*.55,w=n+.055;
   out+=path(`M${-n} 0Q${-w-.045} ${h*.6} ${-w*.6} ${h}Q0 ${h+.035} ${w*.6} ${h}Q${w+.045} ${h*.6} ${n} 0Q0 .06 ${-n} 0Z`,'hood-back', 'currentColor');
   if(d.hood==='three-piece')for(const sign of [-1,1])out+=path(`M${sign*.035} .025Q${sign*.065} ${h*.6} ${sign*.032} ${h+.02}`,'hood-three-panel-seam');
   else out+=path(`M0 .025V${h+.025}`,'hood-centre-seam');
  }
  return out;
 }
 function hoodFront(){
  if(d.hood==='none')return '';
  const h=d.hoodHeightMm/mm*.38,w=n+.03;
  let out=path(`M${-n} 0Q${-w-.03} ${h*.5} ${-w*.7} ${h}L0 ${h+.04}L${w*.7} ${h}Q${w+.03} ${h*.5} ${n} 0Q${n*.5} ${h*.52} 0 ${h*.75}Q${-n*.5} ${h*.52} ${-n} 0Z`,'hood-front-opening','currentColor');
  out+=path(`M${-n-.006} .01Q${-w} ${h*.55} ${-w*.65} ${h-.012}L0 ${h+.025}L${w*.65} ${h-.012}Q${w} ${h*.55} ${n+.006} .01`,'hood-mouth-facing');
  if(d.drawcord){out+=`<g data-operation="hood-drawcord">${[-1,1].map(sign=>`<circle data-operation="hood-eyelet" cx="${sign*.035}" cy="${h+.005}" r=".006" fill="#d4d5ce" stroke="#263a30" stroke-width=".0016"/>`+path(`M${sign*.035} ${h+.005}Q${sign*.05} ${h+.09} ${sign*.045} ${h+.15}`,'hood-cord','none','#c6bba0',.004)+path(`M${sign*.045} ${h+.145}v.014`,'cord-end','none','#263a30',.006)).join('')}</g>`;}
  return out;
 }
 const side=()=>{
  let out='';
  if(d.hemFinish==='rib')out+=rib(-depth,H-d.hemHeightMm/mm,depth*2,d.hemHeightMm/mm,'side-hem-rib').replace('data-design-element="craft-detail"','data-design-element="hem-contrast"');
  if(d.hemFinish==='side-slit')out+=path(`M.004 ${H+.008}V${H-d.slitHeightMm/mm}H.02V${H+.008}`,'side-slit','#fff')+path(`M-.003 ${H-d.slitHeightMm/mm-.004}H.027`,'slit-bartack');
  if(d.panel==='yoke'){const y=Math.max(underarm[1]*.5,d.panelDepthMm/mm);out+=clipped(path(`M${-depth-.03} .01H${depth+.03}V${y}Q0 ${y+.025} ${-depth-.03} ${y}Z`,'side-yoke-panel',d.panelColor),`M-.045 .01Q-.10 .04 ${-depth} .14L${-depth} ${H}H${depth}V.32Q${depth} .13 .055 .06L.035 .015Z`,'detail-side-panel-clip');}
  if(d.panel==='side')out+=path(`M-.045 .31Q-.06 ${H*.68} -.045 ${H}H.05Q.065 ${H*.68} .05 .31Z`,'side-panel',d.panelColor);
  if(d.hood!=='none'){const h=d.hoodHeightMm/mm*.55;out+=path(`M-.045 .015Q-.20 .04 -.20 ${h*.75}Q-.14 ${h+.04} -.055 ${h+.02}L.035 .025Q-.015 .025 -.045 .015Z`,'hood-side','currentColor')+path(`M-.045 .015Q-.105 ${h*.65} -.055 ${h+.02}`,'hood-side-opening');}
  return out;
 };
 const points=input.cuffBandPath.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)/g)?.map(Number)??[];
 const cuffRibs=Array.from({length:32},(_,i)=>{const t=(i+.5)/32,x=points[0]+(points[2]-points[0])*t,y=points[1]+(points[3]-points[1])*t,tx=points[6]+(points[4]-points[6])*t,ty=points[7]+(points[5]-points[7])*t;return path(`M${x} ${y}L${tx} ${ty}`,'cuff-rib-wale','none','#657166',.0008);}).join('');
 const cuff=d.cuffFinish==='rib'?clipped(path(input.cuffBandPath,'cuff-rib-band',input.cuffColor??d.panelColor).replace('data-design-element="craft-detail"','data-design-element="cuff-contrast"')+cuffRibs,input.cuffBandPath,'detail-cuff-clip'):'';
 return {body,hoodFront,side,cuff:clipped(cuff,input.sleevePath,'detail-sleeve-clip')};
}
