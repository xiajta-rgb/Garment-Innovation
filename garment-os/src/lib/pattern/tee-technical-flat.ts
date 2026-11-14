import { escapeSvg } from './mesh/garment-technical-view';
import { requireDesignMatrixReady } from '@/data/templateStructuralReview';
import { readTeeIntent,TEE_DESIGN_LABELS,teeDesignKey } from '@/application/tee-design-system';
import { readTeeBase } from '@/application/tee-matrix';
import type { TeeDesignCandidate,TeeDesignIntent } from '@/types/tee-design';
type View='front'|'back'|'side';
export const TEE_FLAT_VIEWBOX='-620 -75 1240 1050';
const ink='#303936',seam='#626b65';
const path=(d:string,fill='none',attrs='')=>`<path d="${d}" fill="${fill}" ${attrs}/>`;
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);};
/** Finished specification proposals, not cutting patterns or fitted-body projections. */
export function teeFlatSpecification(c:TeeDesignCandidate){
  const d=readTeeIntent(c.intent),m=readTeeBase(c.configuration).measurements;
  const width=Math.round(m.bust*({regular:1.12,boxy:1.28,oversized:1.4}[d.silhouette])/2);
  const length=Math.round(m.totalLength*({regular:1,boxy:.9,oversized:1.06}[d.silhouette]));
  const shoulderHalf=Math.min(width/2-12,m.shoulderWidth/2+(d.shoulder==='drop'?65:d.shoulder==='raglan'?15:0));
  return {widthMm:width,lengthMm:length,shoulderHalfMm:shoulderHalf,armholeDepthMm:d.shoulder==='drop'?265:d.silhouette==='oversized'?260:225,sleeveLengthMm:d.sleeve==='elbow'?280:d.sleeve==='turnup'?205:185,neckHalfMm:d.neckline==='v'?95:d.neckline==='mock'?87:90,frontNeckDepthMm:d.neckline==='v'?155:d.neckline==='mock'?40:78,sideDepthMm:Math.round(width*.42),basis:'finished-design-specification-proposal' as const,productionApproved:false};
}
function texture(d:TeeDesignIntent,id:string){
  const line=seam;
  const content=d.fabric==='waffle'?`<path d="M1 1H17V17H1Z M4 4H14V14H4Z" fill="none" stroke="${line}" stroke-width=".7"/><path d="M1 1L4 4M17 1L14 4M17 17L14 14M1 17L4 14" stroke="${line}" stroke-width=".4"/>`:d.fabric==='rib'?`<path d="M2 0V24M4 0V24M9 0V24" stroke="${line}" stroke-width=".75"/><path d="M6 0V24" stroke="#fff" stroke-width="1.4"/>`:d.fabric==='pique'?`<path d="M4 2l2 3-2 3-2-3Z M12 10l2 3-2 3-2-3Z" fill="${line}"/>`:d.fabric==='slub'?`<path d="M0 5h13M18 5h10M5 17h18M0 27h8M13 27h16" stroke="${line}" stroke-width=".7"/>`:'';
  const w=d.fabric==='rib'?12:d.fabric==='waffle'?18:d.fabric==='pique'?16:30,h=d.fabric==='rib'?24:d.fabric==='waffle'?18:d.fabric==='pique'?16:30;
  return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"><g opacity="${d.fabric==='rib'?'.27':'.2'}">${content}</g></pattern>`;
}
/** Smooth vector flats: silhouette, construction seams, stitching and fabric notation are separate layers. */
export function teeTechnicalFigure(c:TeeDesignCandidate,view:View,showTexture=true){
  requireDesignMatrixReady();
  const d=readTeeIntent(c.intent),s=teeFlatSpecification(c),half=s.widthMm/2,L=s.lengthMm,S=s.shoulderHalfMm,A=s.armholeDepthMm,N=s.neckHalfMm;
  const shoulderY=d.shoulder==='drop'?70:32,outerX=S+s.sleeveLengthMm*.87,outerY=shoulderY+s.sleeveLengthMm*.56,innerX=outerX-57,innerY=outerY+118;
  const neckDepth=view==='back'?22:s.frontNeckDepthMm,band=d.neckline==='mock'?36:17,uid=`tee-${hash(teeDesignKey(c))}-${view}`,pattern=uid+'-fabric',clip=uid+'-clip';
  const neck=(n:number,depth:number)=>d.neckline==='v'&&view==='front'?`L0 ${depth}L${n} 0`:`Q0 ${depth*2} ${n} 0`;
  const bottom=d.hem==='curved'?`L${half} ${L-42}Q${half*.55} ${L+8} 0 ${L+12}Q${-half*.55} ${L+8} ${-half} ${L-42}`:`L${half} ${L}H${-half}`;
  const outline=`M${N} 0L${S} ${shoulderY}L${outerX} ${outerY}L${innerX} ${innerY}L${half} ${A}${bottom}L${-half} ${A}L${-innerX} ${innerY}L${-outerX} ${outerY}L${-S} ${shoulderY}L${-N} 0${neck(N,neckDepth)}Z`;
  const armhole=(sign:number)=>`M${sign*S} ${shoulderY}C${sign*(S-30)} ${A*.46} ${sign*(half-22)} ${A*.8} ${sign*half} ${A}`;
  const raglan=(sign:number)=>`M${sign*N} 0Q${sign*(N+50)} ${A*.57} ${sign*half} ${A}`;
  const sleeveFill=(sign:number)=>`M${sign*(d.shoulder==='raglan'?N:S)} ${d.shoulder==='raglan'?0:shoulderY}L${sign*S} ${shoulderY}L${sign*outerX} ${outerY}L${sign*innerX} ${innerY}L${sign*half} ${A}`+(d.shoulder==='raglan'?`Q${sign*(N+50)} ${A*.57} ${sign*N} 0Z`:`C${sign*(half-22)} ${A*.8} ${sign*(S-30)} ${A*.46} ${sign*S} ${shoulderY}Z`);
  const sideHalf=s.sideDepthMm/2,sideOutline=`M${-sideHalf*.55} 8Q0 -13 ${sideHalf*.64} 20L${sideHalf} ${A}V${L-(d.hem==='curved'?30:0)}${d.hem==='curved'?`Q0 ${L+25} ${-sideHalf} ${L-30}`:`H${-sideHalf}`}V${A}Z`;
  const shape=view==='side'?sideOutline:outline,parts=[`<g data-flat-view="${view}" data-neckline="${d.neckline}" data-shoulder="${d.shoulder}" data-fabric="${d.fabric}" stroke="${ink}" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round"><defs>${texture(d,pattern)}<clipPath id="${clip}">${path(shape)}</clipPath></defs>`,path(shape,d.color,'data-flat-layer="silhouette"')];
  parts.push(`<g clip-path="url(#${clip})" data-flat-layer="component-colors">`);
  if(view!=='side'&&d.blocking==='sleeve')for(const sign of [-1,1])parts.push(path(sleeveFill(sign),d.accent,'stroke="none" data-flat-component="sleeve"'));
  if(d.blocking==='side')parts.push(view==='side'?path(`M-38 100H38V${L+50}H-38Z`,d.accent,'stroke="none" data-flat-component="side-panel"'):path(`M${half-52} ${A-25}H${half+30}V${L+60}H${half-52}Z M${-half-30} ${A-25}H${-half+52}V${L+60}H${-half-30}Z`,d.accent,'stroke="none" data-flat-component="side-panel"'));
  if(showTexture&&d.fabric!=='jersey')parts.push(path(shape,`url(#${pattern})`,'stroke="none" data-flat-layer="fabric-notation"'));
  parts.push('</g>');
  if(view==='side'){
    const cuffY=d.sleeve==='elbow'?338:260;
    const arm=`M-42 ${d.shoulder==='drop'?74:45}Q28 39 50 113L68 ${cuffY}H-59L-64 121Z`;
    parts.push(path(arm,d.blocking==='sleeve'?d.accent:d.color,'data-flat-component="sleeve"'));
    if(showTexture&&d.fabric!=='jersey')parts.push(`<defs><clipPath id="${uid}-arm">${path(arm)}</clipPath></defs><g clip-path="url(#${uid}-arm)">${path(arm,`url(#${pattern})`,'stroke="none"')}</g>`);
    parts.push(path(`M-57 ${cuffY-14}H66 M-57 ${cuffY-20}H65`,'none','stroke-width=".65" stroke-dasharray="3 2" data-flat-operation="sleeve-double-needle"'));
    if(d.sleeve==='turnup')parts.push(path(`M-59 ${cuffY-27}H67L68 ${cuffY}H-59Z`,d.color,'data-flat-operation="turned-cuff"'));
    if(d.shoulder==='raglan')parts.push(path('M-28 8Q21 48 48 108','none','stroke-width="1" data-flat-operation="raglan-seam"'));
    if(d.shoulder==='drop')parts.push(path('M-42 74Q0 57 40 86','none','stroke-width="1" data-flat-operation="dropped-armhole"'));
    if(d.neckline==='mock')parts.push(path(`M${-sideHalf*.55} 8V-24Q0 -40 ${sideHalf*.64} -16V20Q0 1 ${-sideHalf*.55} 8Z`,d.color,'data-flat-operation="mock-neck"'));
    if(d.hem==='split')parts.push(path(`M-7 ${L}L0 ${L-63}L7 ${L}`,'#fff','data-flat-operation="open-side-slit"'));
    else parts.push(path(`M0 ${A+5}V${L-18}`,'none','stroke-width=".8" data-flat-operation="side-seam"'));
  }else{
    for(const sign of [-1,1]){
      parts.push(path(d.shoulder==='raglan'?raglan(sign):armhole(sign),'none',`stroke="${seam}" stroke-width="1.05" data-flat-operation="${d.shoulder==='raglan'?'raglan-seam':d.shoulder==='drop'?'dropped-armhole':'set-in-armhole'}"`));
      if(d.shoulder!=='raglan')parts.push(path(`M${sign*N} 0L${sign*S} ${shoulderY}`,'none','stroke-width="1" data-flat-operation="shoulder-seam"'));
      const dx=-sign*8,dy=-11;
      parts.push(path(`M${sign*outerX+dx} ${outerY+dy}L${sign*innerX+dx} ${innerY+dy} M${sign*outerX+dx*1.5} ${outerY+dy*1.5}L${sign*innerX+dx*1.5} ${innerY+dy*1.5}`,'none','stroke-width=".6" stroke-dasharray="3 2" data-flat-operation="sleeve-double-needle"'));
      if(d.sleeve==='turnup')parts.push(path(`M${sign*outerX} ${outerY}L${sign*innerX} ${innerY}L${sign*innerX-sign*19} ${innerY-25}L${sign*outerX-sign*19} ${outerY-25}Z`,d.color,'data-flat-operation="turned-cuff"'));
    }
    const collar=`M${-N} 0${neck(N,neckDepth)}L${N+band} 6`+(d.neckline==='v'&&view==='front'?`L0 ${neckDepth+band+5}L${-N-band} 6Z`:`Q0 ${(neckDepth+band)*2} ${-N-band} 6Z`);
    parts.push(path(collar,d.blocking==='sleeve'?d.accent:d.color,`stroke-width="1.15" data-flat-operation="${d.neckline==='v'&&view==='front'?'v-neckband':'round-neckband'}"`));
    if(d.neckline==='v'&&view==='front')parts.push(path(`M0 ${neckDepth}V${neckDepth+band+5}`,'none','stroke-width=".8" data-flat-operation="v-band-mitre"'));
    if(d.neckline==='mock')parts.push(path(`M${-N} 0V-30Q0 -49 ${N} -30V0Q0 40 ${-N} 0Z`,d.color,'data-flat-operation="mock-neck"'));
    if(d.neckline==='henley'&&view==='front'){
      parts.push(path(`M-18 60H18V238H-18Z`,d.color,'stroke-width="1" data-flat-operation="henley-placket"'));
      for(const y of [109,158,207])parts.push(`<circle data-flat-operation="henley-button" cx="0" cy="${y}" r="4.4" fill="${ink}" stroke="none"/>`);
    }
    const pocket=c.configuration.pieceDesign!.pocket;
    if(view==='front'&&pocket.kind!=='none'){
      const x=pocket.xMm-pocket.widthMm/2,y=pocket.yMm,w=pocket.widthMm,h=pocket.heightMm;
      const lower=pocket.kind==='pointed'?`V${y+h-18}L${x+w/2} ${y+h}L${x} ${y+h-18}`:pocket.kind==='round'?`V${y+h-18}Q${x+w} ${y+h} ${x+w-18} ${y+h}H${x+18}Q${x} ${y+h} ${x} ${y+h-18}`:`V${y+h}H${x}`;
      parts.push(path(`M${x} ${y}H${x+w}${lower}Z`,d.blocking==='sleeve'?d.accent:d.color,'stroke-width="1.2" data-flat-operation="patch-pocket"'),path(`M${x+3} ${y+12}H${x+w-3}`,'none','stroke-width=".6" stroke-dasharray="3 2"'));
    }
    if(d.hem==='split')for(const sign of [-1,1])parts.push(path(`M${sign*half} ${L-61}L${sign*(half-5)} ${L}H${sign*half}`,'#fff','data-flat-operation="open-side-slit"'));
  }
  const hemLine=view==='side'?(d.hem==='curved'?`M${-sideHalf+5} ${L-43}Q0 ${L+2} ${sideHalf-5} ${L-43}`:`M${-sideHalf+4} ${L-15}H${sideHalf-4}`):d.hem==='curved'?`M${-half+5} ${L-55}Q0 ${L+37} ${half-5} ${L-55}`:`M${-half+5} ${L-16}H${half-5} M${-half+5} ${L-22}H${half-5}`;
  parts.push(path(hemLine,'none','stroke-width=".6" stroke-dasharray="3 2" data-flat-operation="hem-double-needle"'));
  parts.push('</g>');return parts.join('');
}
export function createTeeTechnicalDesign(c:TeeDesignCandidate,showTexture=true){
  const specification=teeFlatSpecification(c),views=Object.fromEntries((['front','back','side'] as const).map(view=>[view,teeTechnicalFigure(c,view,showTexture)]));
  const components=[{name:'前衣身',qty:1},{name:'后衣身',qty:1},{name:TEE_DESIGN_LABELS.shoulder[c.intent.shoulder]+'袖片',qty:2},{name:TEE_DESIGN_LABELS.neckline[c.intent.neckline]+'领部',qty:1},...(c.intent.neckline==='henley'?[{name:'门襟组件',qty:2}]:[]),...(c.intent.blocking==='side'?[{name:'身侧拼片',qty:2}]:[]),...(c.configuration.pieceDesign!.pocket.kind!=='none'?[{name:'胸贴袋',qty:1}]:[])];
  const metadata={schema:'garment-os/tee-technical-design/v1',configuration:readTeeBase(c.configuration),intent:readTeeIntent(c.intent),specification,components,coordinateSpace:'finished-design-specification-mm',patternStatus:'drafting-validation-pending',showFabricNotation:showTexture,fabric:{structure:c.intent.fabric,composition:null,weightGsm:null,gauge:null,notationOnly:true},productionApproved:false};
  const labels=['正面 / FRONT','背面 / BACK','右侧 / RIGHT SIDE'];
  const frameHeight=specification.lengthMm+160,pictureHeight=frameHeight*600/1240,labelY=100+pictureHeight+24,ruleY=labelY+40,height=ruleY+100;
  const threeViewSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="${height}" viewBox="0 0 1800 ${height}"><metadata>${escapeSvg(JSON.stringify(metadata))}</metadata><rect width="1800" height="${height}" fill="white"/><text x="52" y="48" font-family="sans-serif" font-size="21" fill="${ink}">${escapeSvg(c.name)}</text>${(['front','back','side'] as const).map((v,i)=>`<svg x="${i*600}" y="100" width="600" height="${pictureHeight}" viewBox="-620 -75 1240 ${frameHeight}">${views[v]}</svg><text x="${i*600+300}" y="${labelY}" text-anchor="middle" font-family="sans-serif" font-size="17" fill="${seam}">${labels[i]}</text>`).join('')}<path d="M52 ${ruleY}H1748" stroke="#dde2dc"/><text x="52" y="${ruleY+37}" font-family="sans-serif" font-size="15" fill="${seam}">${escapeSvg(TEE_DESIGN_LABELS.silhouette[c.intent.silhouette]+' / '+TEE_DESIGN_LABELS.fabric[c.intent.fabric]+' / '+TEE_DESIGN_LABELS.hem[c.intent.hem])} · 技术款式设计 / 制版待验证</text><text x="52" y="${ruleY+71}" font-family="sans-serif" font-size="13" fill="#8c968d">面料组织为示意，不代表纱支、克重或材料实测；此图不是裁剪纸样。</text></svg>`;
  return {views,threeViewSvg,metadata,specification,components};
}
export type TeeTechnicalDesign=ReturnType<typeof createTeeTechnicalDesign>;
