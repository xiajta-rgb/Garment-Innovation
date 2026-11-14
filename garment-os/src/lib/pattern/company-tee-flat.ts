import { teeDetailDrawing } from './tee-detail-drawing';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { draftStandard } from './reference/standard';
import { teeFlatSpecification } from './tee-flat-pattern';
import { pocketOutline,pointsPath } from './piece-design-pocket';
import { escapeSvg } from './mesh/garment-technical-view';
import { teeStyleContour } from './tee-style-contour';
import { teeCraftDrawing } from './tee-craft-drawing';
import { DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_DETAILS } from './composition-elements';
import type { CompositionCraft, CompositionElements } from '@/types/composition-elements';
import type { TeeFlatSpecification } from './tee-flat-pattern';
import type { DesignConfiguration } from '@/types/design';
import type { XY } from '@/types/pattern3d';

export const COMPANY_TEE_GUIDE_ID='company-cot25m002';
const p=(v:XY)=>v.map(n=>Number(n.toFixed(6))).join(' ');
const mix=(a:XY,b:XY,t:number):XY=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const mirror=(a:XY):XY=>[-a[0],a[1]];
const value=(s:TeeFlatSpecification,id:string)=>{const v=s.rows.find(r=>r.id===id)?.valueMm;if(v===undefined||!Number.isFinite(v))throw Error('款式图缺少参考量点：'+id);return v;};
function split(c:[XY,XY,XY,XY],t:number){
 const a=mix(c[0],c[1],t),b=mix(c[1],c[2],t),d=mix(c[2],c[3],t),e=mix(a,b,t),f=mix(b,d,t),g=mix(e,f,t);
 return [[c[0],a,e,g],[g,f,d,c[3]]] as [[XY,XY,XY,XY],[XY,XY,XY,XY]];
}

/** Company artwork is a drawing guide. Relative edits never assert same-style CAD. */
export interface TeeIllustrationOptions {shoulder?:'set-in'|'raglan'|'drop';neckline?:CompositionElements['neckline'];craft?:CompositionCraft;details?:CompositionElements['details'];cuffColor?:string;neckColor?:string}
export function companyTeeDrawing(c:DesignConfiguration,spec:TeeFlatSpecification,options:TeeIllustrationOptions={}){
 const master=companyStyleMaster(COMPANY_TEE_GUIDE_ID),s=master.shape,d=c.pieceDesign;
 if(!d)throw Error('缺少款式配色及袋位');
 const ref=getReferenceMeasurements(c.gender,c.standardSize),base=draftStandard(c.activePatternId,ref,'regular',undefined),baseSpec=teeFlatSpecification(base,ref.bust);
 const ratios={shoulder:value(spec,'shoulder')/value(baseSpec,'shoulder'),armhole:value(spec,'armhole-depth')/value(baseSpec,'armhole-depth'),length:c.measurements.totalLength/ref.totalLength,chest:value(spec,'front-chest')/value(baseSpec,'front-chest'),hem:value(spec,'hem')/value(baseSpec,'hem'),neckWidth:value(spec,'neck-width')/value(baseSpec,'neck-width'),frontDepth:value(spec,'front-neck-depth')/value(baseSpec,'front-neck-depth'),backDepth:value(spec,'back-neck-depth')/value(baseSpec,'back-neck-depth'),sleeve:value(spec,'sleeve-length')/value(baseSpec,'sleeve-length'),cuff:value(spec,'cuff')/value(baseSpec,'cuff')};
 if(Object.values(ratios).some(n=>!Number.isFinite(n)||n<=0))throw Error('款式图相对变化无效');
 const neck:XY=[s.neckHalf*ratios.neckWidth,0],outerShoulder:XY=[s.shoulder[0]*ratios.shoulder,s.shoulder[1]],underarm:XY=[s.armhole[2][0]*ratios.chest,s.armhole[2][1]*ratios.armhole],hem:XY=[s.hemHalf*ratios.hem,ratios.length];
 // Rounded shoulder follows the source drawing's shoulder arc. Only the internal
 // seam moves inward for a set-in derivative; the micro-drop CAD link stays absent.
 const shoulderCurve:[XY,XY,XY,XY]=[neck,[126/601*ratios.shoulder,8/601],[170/601*ratios.shoulder,35/601],outerShoulder];
 const family=options.shoulder??'set-in';
 let lo=0,hi=1;const target=family==='drop'?outerShoulder[0]-.025:Math.max(neck[0]+.025,s.armhole[2][0]*1.08*ratios.shoulder);
 for(let i=0;i<35;i++){const t=(lo+hi)/2;if(split(shoulderCurve,t)[0][3][0]<target)lo=t;else hi=t;}
 let [bodyShoulder,sleeveShoulder]=split(shoulderCurve,(lo+hi)/2);
 if(family==='raglan'){bodyShoulder=[neck,neck,neck,neck];sleeveShoulder=shoulderCurve;}
 const shoulder=bodyShoulder[3];
 const armhole:[XY,XY,XY,XY]=family==='raglan'?[neck,[neck[0]+.04,.145*ratios.armhole],[underarm[0]-.045,underarm[1]-.08],underarm]:family==='drop'?[shoulder,[shoulder[0]-.008,shoulder[1]+.12],[underarm[0]+.02,underarm[1]-.06],underarm]:[shoulder,[s.armhole[0][0]*ratios.chest,s.armhole[0][1]*ratios.armhole],[s.armhole[1][0]*ratios.chest,s.armhole[1][1]*ratios.armhole],underarm];
 const sourceCuffCenter=mix(s.cuffOuter,s.cuffInner,.5),sourceRoot=mix(s.shoulder,s.armhole[2],.5),direction:XY=[sourceCuffCenter[0]-sourceRoot[0],sourceCuffCenter[1]-sourceRoot[1]];
 const root=mix(outerShoulder,underarm,.5),cuffCenter:XY=[root[0]+direction[0]*ratios.sleeve,root[1]+direction[1]*ratios.sleeve],halfCuff:XY=[(s.cuffOuter[0]-s.cuffInner[0])/2*ratios.cuff,(s.cuffOuter[1]-s.cuffInner[1])/2*ratios.cuff];
 const cuffOuter:XY=[cuffCenter[0]+halfCuff[0],cuffCenter[1]+halfCuff[1]],cuffInner:XY=[cuffCenter[0]-halfCuff[0],cuffCenter[1]-halfCuff[1]];
 const contour=teeStyleContour({bodyShoulder,sleeveShoulder,armhole,hem,cuffOuter,cuffInner,cuffBandHeight:options.details?.cuffFinish==='rib'?options.details.cuffHeightMm/ref.totalLength:undefined});
 const ink='#18211c',detail='#48554d',backDrop=s.backDrop*ratios.backDepth,
   // Polo collars sit on a shallower front neckline than the crew reference.
   // Reusing the full crew drop pushes the collar leaves and placket down into
   // the chest, which is the mismatch visible in the company references.
   // The company Polo references keep the front neckline close to the HPS;
   // the collar stand and leaf provide the visible depth. A crew-neck drop
   // here makes the whole Polo assembly fall into the chest and disconnects
   // the placket from the stand. Keep the derivative shallow and bounded.
   frontDrop=options.neckline==='polo'?Math.max(.028,s.frontDrop*ratios.frontDepth*.34):options.neckline==='v'?Math.max(.22,s.frontDrop*ratios.frontDepth):options.neckline==='stand'?Math.max(.045,backDrop*1.5):s.frontDrop*ratios.frontDepth,
   band=.032*d.neckWidthMm/master.finish.neckWidthMm;
 const paint=(id:string,path:string,color:string,extra='')=>`<path data-source-piece="${id}" d="${path}" fill="${escapeSvg(color)}" stroke="none" ${extra}/>`;
 const line=(path:string,operation:string,width=.0017,extra='')=>`<path data-operation="${operation}" d="${path}" fill="none" stroke="${ink}" stroke-width="${width}" ${extra}/>`;
 const outline=(path:string)=>line(path,'style-outline',.0018);
 const topstitch=(path:string,operation:string,color:string)=>{
  const hex=/^#([0-9a-f]{6})$/i.exec(color)?.[1],rgb=hex?[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)):null;
  const dark=rgb?(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])<105:false;
  const thread=rgb?'#'+rgb.map(v=>Math.round(dark?v+(255-v)*.30:v*.45).toString(16).padStart(2,'0')).join(''):detail;
  return `<path data-operation="${operation}" d="${path}" fill="none" stroke="${thread}" stroke-width=".0011"/>`;
 };
 const necklace=(drop:number,n=neck[0],y=0)=>options.neckline==='v'&&drop===frontDrop?`M${p([-n,y])}L0 ${drop+y}L${p([n,y])}`:`M${p([-n,y])}Q0 ${2*drop+y} ${p([n,y])}`;
 const bandPath=(drop:number)=>necklace(drop)+(options.neckline==='v'&&drop===frontDrop?`L${p([neck[0]-band,.003])}L0 ${drop-band}L${p([-neck[0]+band,.003])}Z`:`L${p([neck[0]-band,.003])}Q0 ${2*Math.max(.003,drop-band)+.003} ${p([-neck[0]+band,.003])}Z`);
 const ribMarkup=(drop:number)=>Array.from({length:44},(_,i)=>{
  const u=-1+2*(i+1)/45,profile=options.neckline==='v'&&drop===frontDrop?1-Math.abs(u):1-u*u,x=neck[0]*u,y=drop*profile,xi=(neck[0]-band)*u,yi=Math.max(.003,drop-band)*profile+.003;
  return line(`M${p([x,y])}L${p([xi,yi])}`,'neck-rib',.00065);
 }).join('');
 const H=hem[1],craft={...DEFAULT_COMPOSITION_CRAFT,...options.craft},craftDrawing=teeCraftDrawing({neckline:options.neckline??'crew',craft,neckHalf:neck[0],frontDrop,backDrop,bodyHeight:H,referenceLengthMm:ref.totalLength,neckColor:options.neckColor??d.colors.neckband});
 const figures=(['front','back'] as const).map(view=>{
  const back=view==='back',drop=back?backDrop:frontDrop,body=contour.bodyPath(drop),bodyColor=back?d.colors.back:d.colors.front,parts=[`<g data-company-tee-view="${view}" stroke-linejoin="round" stroke-linecap="round">`];
  // An opaque drawing underlay prevents antialiasing cracks between adjacent fills.
  // It carries no piece identity; the actual source-piece fills remain separate.
  parts.push(`<path data-contour-underlay="${view}" d="${contour.outsidePath}Q0 ${2*drop} ${p(neck)}Z" fill="${escapeSvg(bodyColor)}" stroke="none"/>`);
  const sleeve=paint('teagan.sleeve',contour.sleevePath,d.colors.sleeve);
  parts.push(sleeve,`<g transform="scale(-1 1)">${sleeve}</g>`);
  if(!back){
   const facing=necklace(backDrop)+`L${p(neck)}Q0 ${2*frontDrop} ${p(mirror(neck))}Z`;
   parts.push(paint('teagan.back',facing,d.colors.back),outline(facing),paint('design.neckband',bandPath(backDrop),d.colors.neckband),line(necklace(backDrop+band*.35),'back-neck-binding',.0015));
  }
  parts.push(paint(back?'teagan.back':'teagan.front',body,bodyColor));
  if(options.neckline==='polo')parts.push(craftDrawing.collar(back));
  else parts.push(paint('design.neckband',bandPath(drop),d.colors.neckband),outline(bandPath(drop)));
  if(!back&&options.neckline==='polo')parts.push(craftDrawing.opening);
  parts.push(line(contour.armholePath,'armhole-seam'),`<g transform="scale(-1 1)">${line(contour.armholePath,'armhole-seam')}</g>`);
  parts.push(line(contour.outsidePath,'garment-contour',.0032));
  for(let i=1;i<45;i++){
   const u=-1+2*i/45,x=neck[0]*u,y=drop*(1-u*u),xi=(neck[0]-band)*u,yi=Math.max(.003,drop-band)*(1-u*u)+.003;
   parts.push(line(`M${p([x,y])}L${p([xi,yi])}`,'neck-rib',.00065));
  }
  for(const path of contour.hemStitches)parts.push(topstitch(path,'body-double-needle',bodyColor));
  for(const stitch of contour.cuffStitches)for(const path of [stitch.right,stitch.left])parts.push(topstitch(path,'sleeve-double-needle',d.colors.sleeve));
  const pocket=back||d.pocket.kind==='none'?'':pointsPath([...pocketOutline(d.pocket),pocketOutline(d.pocket)[0]].map(q=>[(q[0]+d.pocket.xMm-d.pocket.widthMm/2)/ref.totalLength,(q[1]+d.pocket.yMm)/ref.totalLength]));
  if(d.pocket.kind!=='none')parts.push(paint('design.patch-pocket',pocket,d.colors.pocket));
  if(pocket)parts.push(outline(pocket),line(`M${p([(d.pocket.xMm-d.pocket.widthMm/2)/ref.totalLength,(d.pocket.yMm+12)/ref.totalLength])}h${d.pocket.widthMm/ref.totalLength}`,'pocket-topstitch',.00125));
  parts.push('</g>');return parts.join('');
 });
 // No company side artwork exists. This explicit supplement has a closed sleeve
 // profile and a cuff edge, rather than the old uncalibrated mesh's oval opening.
 const depth=.115*ratios.chest,sleeveY=Math.min(H-.12,cuffCenter[1]),sideBody=`M${p([-.045,.01])}Q${p([-.10,.04])} ${p([-depth,.14])}C${p([-depth-.01,.37])} ${p([-depth+.006,H-.16])} ${p([-depth,H-.006])}Q${p([-depth,H])} ${p([-depth+.005,H+.0005])}Q0 ${H+.0115} ${p([depth-.005,H+.0005])}Q${p([depth,H])} ${p([depth,H-.006])}C${p([depth-.006,H-.16])} ${p([depth+.012,.44])} ${p([depth+.012,.32])}Q${p([depth,.13])} .055 .06Q.042 .025 .035 .015Z`;
 const sideSleeve=`M-.035 .065Q.075 .085 .09 .20L${p([.095,sleeveY])}Q.025 ${sleeveY+.014} -.06 ${sleeveY-.018}L-.065 .20Q-.07 .10 -.035 .065Z`;
 const side=`<g data-company-tee-view="side" stroke-linejoin="round" stroke-linecap="round">${paint('teagan.front',sideBody,d.colors.front)}${line(sideBody,'garment-contour',.0032)}${paint('teagan.sleeve',sideSleeve,d.colors.sleeve)}${line(sideSleeve,'sleeve-contour',.0025)}${[.028,.034].map(offset=>topstitch(`M-.06 ${sleeveY-.018-offset}Q.025 ${sleeveY+.014-offset} .094 ${sleeveY-offset}`,'side-cuff',d.colors.sleeve)).join('')}${[.028,.034].map(offset=>topstitch(`M${p([-depth+.001,H-offset])}Q0 ${H+.012-offset} ${p([depth-.001,H-offset])}`,'side-hem',d.colors.front)).join('')}${line(`M.015 ${sleeveY+.01}Q.007 ${H*.7} .012 ${H+.0059}`,'side-seam',.0017)}${options.neckline==='polo'?craftDrawing.sideCollar:''}${line('M-.045 .015L.035 .025','side-neck',.0018)}</g>`;
 const maxX=Math.max(cuffOuter[0],cuffInner[0],hem[0]),height=Math.max(H+.014,cuffOuter[1],cuffInner[1]);
 const scale=Math.min(440/(2*maxX),490/height);
 const provenance={masterId:master.id,source:master.source,coordinateSpace:'company-drawing-ratio',method:'source-guided-garment-style-illustration',shoulder:family==='set-in'?'set-in-derivative':`${family}-design-proposal`,sourceShoulder:'micro-drop',neckline:options.neckline??'crew',opening:craft.opening,neckFinish:craft.neckFinish,sameStyleCad:false,sideView:'design-supplement-no-source-artwork',relativeEdits:ratios,landmarks:{neck,frontDrop,backDrop,shoulder,outerShoulder,underarm,hem,cuffOuter,cuffInner},scalePixelsPerDrawingUnit:scale};
 // Editable artwork keeps its drawing coordinate space; CAD dimensions stay separate.
 const bodyHalf=Math.max(hem[0],shoulder[0]),sleeveMinX=Math.min(underarm[0],shoulder[0],cuffInner[0]),sleeveMinY=shoulder[1],sleeveMaxY=Math.max(cuffInner[1],cuffOuter[1]);
 const baseNeckline=options.neckline==='v'?'v':'crew';
 const editableParts=[
  ...(['front','back'] as const).flatMap(view=>{
   const drop=view==='front'?frontDrop:backDrop,color=view==='front'?d.colors.front:d.colors.back;
   return [
    {key:`body-${view}`,sourceId:`teagan.${view}`,name:view==='front'?'前衣身':'后衣身',view,markup:paint(`teagan.${view}`,contour.bodyPath(drop,view==='front'?baseNeckline:undefined),color)+outline(contour.bodyPath(drop,view==='front'?baseNeckline:undefined))+contour.hemStitches.map(p=>topstitch(p,'body-double-needle',color)).join(''),bounds:{x:-bodyHalf,y:0,width:bodyHalf*2,height:H+.007}},
    {key:`neck-${view}`,sourceId:'t-shirt.finish.neckband',name:options.neckline==='polo'?(view==='front'?'Polo前领座 + 翻领':'Polo后领座'):view==='front'?'前领圈':'后领圈',view,markup:paint('design.neckband',bandPath(drop),d.colors.neckband)+outline(bandPath(drop))+ribMarkup(drop),bounds:{x:-neck[0],y:0,width:neck[0]*2,height:drop}},
   ];
  }),
  {key:'sleeve',sourceId:'teagan.sleeve',name:'装袖短袖',view:'front' as const,markup:paint('teagan.sleeve',contour.sleevePath,d.colors.sleeve)+(options.cuffColor?`<svg x="${sleeveMinX-.02}" y="${sleeveMinY-.02}" width="${Math.max(cuffOuter[0],outerShoulder[0])-sleeveMinX+.04}" height="${sleeveMaxY-sleeveMinY+.04}" viewBox="${sleeveMinX-.02} ${sleeveMinY-.02} ${Math.max(cuffOuter[0],outerShoulder[0])-sleeveMinX+.04} ${sleeveMaxY-sleeveMinY+.04}"><defs><clipPath id="cuff-piece-clip">${paint('clip',contour.sleevePath,'#fff')}</clipPath></defs><path data-design-element="cuff-contrast" d="${contour.cuffBandPath}" fill="${escapeSvg(options.cuffColor)}" clip-path="url(#cuff-piece-clip)"/></svg>`:'')+outline(contour.sleevePath)+contour.cuffStitches.map(s=>topstitch(s.right,'sleeve-double-needle',d.colors.sleeve)).join(''),bounds:{x:sleeveMinX,y:sleeveMinY,width:Math.max(cuffOuter[0],outerShoulder[0])-sleeveMinX,height:sleeveMaxY-sleeveMinY}},
  {key:'facing',sourceId:'teagan.back',name:'后领内侧',view:'front' as const,markup:paint('teagan.back',necklace(backDrop)+`L${p(neck)}Q0 ${2*frontDrop} ${p(mirror(neck))}Z`,d.colors.back),bounds:{x:-neck[0],y:0,width:neck[0]*2,height:frontDrop}},
  {key:'side-body',sourceId:'teagan.front',name:'衣身侧面示意',view:'side' as const,markup:paint('teagan.front',sideBody,d.colors.front)+outline(sideBody)+(options.neckColor?`<path data-design-element="neck-contrast" d="M-.045 .015L.035 .025L.05 .05L-.055 .04Z" fill="${escapeSvg(options.neckColor)}"/>`:'')+[.028,.034].map(o=>topstitch(`M${p([-depth+.001,H-o])}Q0 ${H+.012-o} ${p([depth-.001,H-o])}`,'side-hem',d.colors.front)).join(''),bounds:{x:-depth-.012,y:.01,width:depth*2+.024,height:H+.006-.01}},
  {key:'side-sleeve',sourceId:'teagan.sleeve',name:'袖片侧面示意',view:'side' as const,markup:paint('teagan.sleeve',sideSleeve,d.colors.sleeve)+(options.cuffColor?`<path data-design-element="cuff-contrast" d="M-.06 ${sleeveY-.018}Q.025 ${sleeveY+.014} .095 ${sleeveY}L.095 ${sleeveY-.055}Q.025 ${sleeveY-.041} -.061 ${sleeveY-.073}Z" fill="${escapeSvg(options.cuffColor)}"/>`:'')+outline(sideSleeve)+(family==='raglan'?line('M-.035 .065Q-.01 .13 -.065 .20','raglan-side-seam',.0016):''),bounds:{x:-.07,y:.065,width:.165,height:sleeveY+.014-.065}},
 ];
 if(options.craft||['henley','polo','stand'].includes(options.neckline??'')){
  // A Polo collar remains a separate visible component even when the designer
  // has not selected a contrast colour. Falling back to the stored neckband
  // colour keeps the collar distinguishable from the body fill.
  const neckline=options.neckline??'crew',drawing=craftDrawing;
  for(const part of editableParts){
   if(part.key.startsWith('neck-')){
    const back=part.key==='neck-back';
     if(neckline==='stand'||neckline==='polo'){
     part.markup=drawing.collar(back);
     const h=craft.collarHeightMm/ref.totalLength;
     // Polo artwork includes the raised stand and turned-down leaves above
     // the original crew-neck bounds. Keep that full envelope in the fixed
     // neck slot so the browser does not scale the collar down into a Henley.
     const bounds=neckline==='polo'?{y:-.035,height:(back?backDrop:frontDrop)+h+.17}:{y:-h,height:(back?backDrop:frontDrop)+h+.08};
     part.bounds={...part.bounds,...bounds};
    }else if(craft.neckFinish==='binding')part.markup=drawing.binding(back);
    if(!back)part.markup+=drawing.opening;
   }
   if(part.key==='facing')part.markup+=drawing.tape;
   if(part.key==='side-body')part.markup+=drawing.sideCollar;
   if(craft.seamFinish!=='plain'&&['sleeve','side-sleeve'].includes(part.key)){
    const path=part.key==='sleeve'?contour.armholePath:family==='raglan'?'M-.035 .065Q-.01 .13 -.065 .20':'M-.035 .065Q-.065 .12 -.065 .20';
    part.markup+=`<path data-operation="${craft.seamFinish==='piping'?'seam-piping':'seam-topstitch'}" d="${path}" fill="none" stroke="${escapeSvg(craft.trimColor)}" stroke-width="${craft.seamFinish==='piping'?.005:.0012}"/>`;
   }
  }
 }
 if(options.details){
  const settings={...DEFAULT_COMPOSITION_DETAILS,...options.details};
  for(const part of editableParts){
   const back=part.key==='body-back',extra=teeDetailDrawing(settings,{H,hemHalf:hem[0],depth,underarm,neckHalf:neck[0],referenceLengthMm:ref.totalLength,cuffBandPath:contour.cuffBandPath,sleevePath:contour.sleevePath,cuffColor:options.cuffColor,bodyPath:contour.bodyPath(back?backDrop:frontDrop,back?undefined:baseNeckline)});
   if(part.key.startsWith('body-')){if(settings.hemFinish==='rib')part.markup=part.markup.replace(/<path[^>]*data-operation="body-double-needle"[^>]*\/>/g,'');part.markup+=extra.body(back);}
   if(part.key==='sleeve'&&settings.cuffFinish==='rib'){part.markup=part.markup.replace(/<path[^>]*data-operation="sleeve-double-needle"[^>]*\/>/g,'');part.markup+=extra.cuff;}
   if(part.key==='side-body')part.markup+=extra.side();
   if(part.key==='side-sleeve'&&settings.cuffFinish==='rib')part.markup+=`<path data-design-element="cuff-contrast" data-operation="side-cuff-rib" d="M-.06 ${sleeveY-.018}Q.025 ${sleeveY+.014} .095 ${sleeveY}L.095 ${sleeveY-settings.cuffHeightMm/ref.totalLength}Q.025 ${sleeveY+.014-settings.cuffHeightMm/ref.totalLength} -.061 ${sleeveY-.018-settings.cuffHeightMm/ref.totalLength}Z" fill="${options.cuffColor??settings.panelColor}" stroke="#263a30" stroke-width=".0016"/>`;
   if(settings.hood!=='none'&&part.key==='neck-front'){const opening=part.markup.match(/<g data-craft-opening="[^"]*">[\s\S]*<\/g>$/)?.[0]??'';part.markup=extra.hoodFront()+opening;}
   if(settings.hood!=='none'&&part.key==='neck-back')part.markup='';
  }
 }

 return {figures:[...figures,side],scale,provenance,ink,detail,editableParts};
}
export type CompanyTeeDrawing=ReturnType<typeof companyTeeDrawing>;
export function companyTeeDrawingSvg(d:CompanyTeeDrawing,metadata:object,sharedScale=d.scale){
 const scale=Math.min(sharedScale,d.scale),top=105;
 const neckline=d.provenance.neckline, shoulder=d.provenance.shoulder, opening=d.provenance.opening;
 const neckLabel=neckline==='polo'?'Polo翻领 · 独立领座':neckline==='stand'?'立领':neckline==='v'?'V领':neckline==='henley'?'亨利领':'圆领';
 const openingLabel=opening==='buttons'?'短纽扣门襟':opening==='quarter-zip'?'半开拉链门襟':opening==='full-zip'?'全开拉链':'无门襟';
 const shoulderLabel=shoulder.includes('raglan')?'插肩袖':shoulder.includes('drop')?'落肩袖':'装袖';
 const footer=neckline==='polo'?`${neckLabel} · ${openingLabel} · ${shoulderLabel} · 前后领座与左右翻领独立表达`:`${neckLabel} · ${shoulderLabel} · 前后领圈 · 袖口及下摆双压线`;
 const note=neckline==='polo'?'领座、翻领、门襟为独立结构；比例参照公司 L22M664 / LT25M1354，纸样对应待验证。':`款式比例参照公司原稿；当前为${shoulderLabel}派生，纸样对应待验证。侧面为设计补充。`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="720" viewBox="0 0 1500 720"><metadata>${escapeSvg(JSON.stringify({...metadata,styleGuide:{...d.provenance,scalePixelsPerDrawingUnit:scale}}))}</metadata><rect width="1500" height="720" fill="#fff"/><g font-family="Microsoft YaHei,sans-serif" fill="${d.ink}"><text x="34" y="32" font-size="17">公司设计稿绘图规范 · COT25M002 参照</text><text x="1466" y="32" text-anchor="end" font-size="13" fill="#6d7971">当前：${neckLabel} · ${shoulderLabel}</text>${(['front','back','side'] as const).map((view,i)=>`<g data-piece-design-view="${view}"><text x="${250+i*500}" y="75" text-anchor="middle" font-size="16">${{front:'正面 / FRONT',back:'背面 / BACK',side:'侧面补充 / SIDE'}[view]}</text><g transform="translate(${250+i*500} ${top}) scale(${scale})">${d.figures[i]}</g></g>`).join('')}<path d="M34 637H1466" stroke="#e1e5e0"/><text x="34" y="665" font-size="14">${footer}</text><text x="34" y="694" font-size="12" fill="#77827a">${note}</text></g></svg>`;
}
