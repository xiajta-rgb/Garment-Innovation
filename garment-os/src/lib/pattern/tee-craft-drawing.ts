import type { CompositionCraft, CompositionElements } from '@/types/composition-elements';
const p=(n:number)=>Number(n.toFixed(6));

/** Source-informed drawing ratios. Does not create or approve cutting patterns. */
export function teeCraftDrawing(input:{neckline:CompositionElements['neckline'];craft:CompositionCraft;neckHalf:number;frontDrop:number;backDrop:number;bodyHeight:number;referenceLengthMm:number;neckColor:string}){
 const {neckline,craft:c,neckHalf:n,frontDrop:fd,backDrop:bd,bodyHeight:H,referenceLengthMm:mm,neckColor}=input;
 const h=c.collarHeightMm/mm,w=c.placketWidthMm/mm,trim=c.trimColor;
  const path=(d:string,op:string,fill='none',stroke='#263a30',width=.0016)=>`<path data-design-element="craft-detail" data-operation="${op}" d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
 const q=(drop:number)=>`M${-n} 0Q0 ${p(drop*2)} ${n} 0`;
 function collar(back:boolean){
  const drop=back?bd:fd;
  if(neckline==='stand')return path(`${q(drop)}L${n} ${-h}Q0 ${p(2*drop-h)} ${-n} ${-h}Z`,'stand-collar',neckColor)+path(`M0 ${drop-h}V${drop}`,'collar-centre-join');
  if(neckline==='polo'){
   // A commercial Polo has a visible knit stand that rises above the body
   // neckline, then two separate turn-down leaves.  The old path started at
   // y=0, exactly where the crew-neck shoulder points start, so it collapsed
   // into a Henley-like V at the browser scale.  Keep the upper stand edge
   // negative (above the HPS) and make the leaves end on either side of the
   // placket instead of meeting in one centre point.
   const standHalf=Math.max(.075,n*.48),standHeight=Math.min(.028,Math.max(.024,h*.42)),standBottom=Math.min(.020,Math.max(.014,drop+h*.04)),standBottomCenter=Math.max(standBottom+.011,2*drop+.003),standTop=-standHeight,
     leafDepth=Math.max(.074,h*1.28),leafPointY=drop+leafDepth,
     wing=Math.min(n*.98,Math.max(.130,n*.88)),point=Math.max(.032,w*1.08),
     standPath=`M${-standHalf} ${p(standTop)}Q0 ${p(standTop-.009)} ${standHalf} ${p(standTop)}L${standHalf} ${p(standBottom)}Q0 ${p(standBottomCenter)} ${-standHalf} ${p(standBottom)}Z`;
   const standBand=standPath;
   if(back)return path(standPath,'polo-back-collar-stand',neckColor)+path(`M0 ${p(standTop+.018)}V${p(standBottomCenter)}`,'polo-back-centre-seam','none','#354638',.00095);
   // The company Polo references use a knit collar with a narrow stand and
   // two distinct pointed leaves. Keep each leaf as its own filled piece so
   // the fold, join and edge remain readable in the three-view drawing.
   // A commercial polo collar is a shallow spread collar: the leaf starts
   // at the neck edge, runs almost to the shoulder side, then points inward
   // to the placket. The previous geometry pulled both leaves too far inward
   // and made a bow-tie shape in the flat view.
   const outerY=standTop+.009,innerY=standBottom+.008,tipY=leafPointY,tipInset=Math.max(.010,point*.42);
   const left=`M${-standHalf} ${p(standTop+.010)}Q${-wing} ${p(outerY)} ${-wing} ${p(outerY+.020)}Q${-point} ${p(tipY-.012)} ${-point} ${p(tipY)}L${-point+tipInset} ${p(tipY-.012)}Q${-point*.50} ${p(innerY)} ${-standHalf} ${p(standBottom)}Z`;
   const right=`M${standHalf} ${p(standTop+.010)}Q${wing} ${p(outerY)} ${wing} ${p(outerY+.020)}Q${point} ${p(tipY-.012)} ${point} ${p(tipY)}L${point-tipInset} ${p(tipY-.012)}Q${point*.50} ${p(innerY)} ${standHalf} ${p(standBottom)}Z`;
   const standEdge=path(`M${-standHalf} ${p(standTop)}Q0 ${p(standTop-.009)} ${standHalf} ${p(standTop)}M${-standHalf} ${p(standBottom)}Q0 ${p(standBottomCenter)} ${standHalf} ${p(standBottom)}`,'polo-front-collar-stand-edge','none','#354638',.0012);
   const bandTopEdge=path(`M${-standHalf} ${p(standTop+.015)}Q0 ${p(standTop+.006)} ${standHalf} ${p(standTop+.015)}`,'polo-collar-stand-rib','none','#354638',.0009);
   // Keep the stable catalogue marker for older tag combinations while the
   // visible geometry is now split into the stand and two leaf pieces.
   const legacyMarker=path(standPath,'polo-fold-collar','none','none',0);
   return path(standPath,'polo-front-collar-stand',c.trimColor)+legacyMarker+path(standBand,'polo-collar-stand-band','none','#354638',.0009)+bandTopEdge+path(left,'polo-collar-left',neckColor)+path(right,'polo-collar-right',neckColor)+standEdge+path(`M${-wing} ${p(outerY+.010)}Q${-point} ${p(tipY-.006)} ${-point} ${p(tipY)}`,'polo-collar-left-edge','none','#354638',.00105)+path(`M${wing} ${p(outerY+.010)}Q${point} ${p(tipY-.006)} ${point} ${p(tipY)}`,'polo-collar-right-edge','none','#354638',.00105)+path(`M${-point+tipInset} ${p(tipY-.012)}L${-point*.50} ${p(innerY)}M${point-tipInset} ${p(tipY-.012)}L${point*.50} ${p(innerY)}`,'polo-collar-centre-fold','none','#354638',.0009);
  }
  return '';
 }
 function opening(){
  if(c.opening==='none')return '';
  const start=neckline==='stand'?fd-h:neckline==='polo'?fd+Math.max(.080,h*1.25):fd-.006,end=c.opening==='full-zip'?H-.006:Math.max(fd+.06,start+c.openingLengthMm/mm),half=w/2;
  let result=path(`M${-half} ${start}H${half}V${end}H${-half}Z`,'placket-facing',trim);
  if(c.opening==='buttons'){
   result+=path(`M${-half+.003} ${start}V${end-.003}H${half-.003}V${start}`,'placket-topstitch');
   for(let i=0;i<3;i++){const y=start+(end-start)*(i+1)/4;result+=`<circle data-operation="placket-button" cx="0" cy="${p(y)}" r=".0045" fill="#d9d7cd" stroke="#263a30" stroke-width=".0012"/>`+path(`M-.007 ${y-.009}H.007`,'buttonhole', 'none','#48554d',.0009);}
  }else{
   result+=path(`M-.004 ${start}V${end}M.004 ${start}V${end}`,'zipper-tapes','none','#48554d',.002);
   for(let y=start+.009;y<end-.006;y+=.008)result+=path(`M-.003 ${p(y)}H.003`,'zipper-teeth','none','#263a30',.0015);
   result+=path(`M-.004 ${start+.01}L.005 ${start+.01}L.006 ${start+.031}L-.005 ${start+.031}Z`,'zipper-pull','#c6c8c4')+path(`M${-half} ${end}H${half}`,'zipper-end-stop');
  }
  return `<g data-craft-opening="${c.opening}">${result}</g>`;
 }
 const binding=(back:boolean)=>{const drop=back?bd:fd,width=c.bindingWidthMm/mm;return path(back||neckline!=='v'?q(drop):`M${-n} 0L0 ${fd}L${n} 0`,'neck-edge-binding','none',trim,width);};
 const tape=c.backNeckTape?path(q(bd),'back-neck-tape','none',trim,c.bindingWidthMm/mm):'';
  const sideCollar=neckline==='stand'?path(`M-.045 .015L-.045 ${-h}L.035 ${-h+.01}L.035 .025Z`,'side-stand-collar',neckColor):neckline==='polo'?path('M-.045 .015L-.060 .026L-.051 .056L.003 .074L.035 .025Z','side-polo-collar',neckColor)+path('M-.045 .018L-.051 .056L.003 .074','side-polo-collar-edge','none','#354638',.00105):'';
  return {collar,opening:opening(),binding,tape,sideCollar};
}
