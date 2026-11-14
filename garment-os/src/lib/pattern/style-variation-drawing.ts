import { escapeSvg } from './mesh/garment-technical-view';
import { resolvedStyleVariation,styleVariationSummary,variationDrawingMaster } from './style-variation';
import type { CompanyStyleDraft } from '@/types/company-style';
import type { XY } from '@/types/pattern3d';
type View='front'|'back'|'side';
const p=(v:XY)=>v.map(n=>n.toFixed(5)).join(' '),mirror=(v:XY):XY=>[-v[0],v[1]];
const ink='#29352f',path=(d:string,fill='none',extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;

export function styleVariationFigure(d:CompanyStyleDraft,view:View){
 const m=variationDrawingMaster(d),{v,neck,sleeve,pocket,hem}=resolvedStyleVariation(d),s=m.shape;
 const height=v.length==='cropped'?.80:v.length==='longline'?1.17:1,hw=s.hemHalf;
 const drop=neck==='quarter-zip'?s.backDrop:view==='back'?s.backDrop:neck==='v'?Math.max(.23,s.frontDrop):s.frontDrop;
 const ribCuffs=(m.kind==='crew-sweatshirt'||m.kind==='pullover-hoodie')&&sleeve==='long';
 const closeNeck=neck==='v'&&view==='front'?`L0 ${drop}L${p([s.neckHalf,0])}`:`Q0 ${2*drop} ${p([s.neckHalf,0])}`;
 const bottom=hem==='curved'?`L${hw} ${height-.035}Q0 ${height+.075} ${-hw} ${height-.035}`:`L${hw} ${height}H${-hw}`;
 const body=`M${p([s.neckHalf,0])}L${p(s.shoulder)}C${s.armhole.map(p).join(' ')}${bottom}L${p(mirror(s.armhole[2]))}C${[s.armhole[1],s.armhole[0],s.shoulder].map(q=>p(mirror(q))).join(' ')}L${p([-s.neckHalf,0])}${closeNeck}Z`;
 const side=`M-.08 .025Q0 -.005 .09 .06L.15 .23Q.17 .48 .13 ${height-.04}L.11 ${height}H-.11Q-.15 .55 -.12 .23Z`;
 const clip=`design-${m.id}-${view}`,a=v.accentColor,parts=[`<g data-company-master="${m.id}" data-company-view="${view}" data-design-view="${view}" stroke="${ink}" stroke-width=".0026" stroke-linejoin="round" stroke-linecap="round"><defs><clipPath id="${clip}">${path(view==='side'?side:body,d.color)}</clipPath></defs>`];
 if(view!=='side'&&sleeve!=='sleeveless')for(const left of [false,true]){
  const q=(v:XY)=>p(left?mirror(v):v),sl=`M${q(s.shoulder)}L${q(s.cuffOuter)}L${q(s.cuffInner)}L${q(s.armhole[2])}C${[s.armhole[1],s.armhole[0],s.shoulder].map(q).join(' ')}Z`;
  parts.push(path(sl,v.blocking==='sleeves'?a:d.color,`data-part="sleeve-${left?'left':'right'}" data-design-feature="sleeve:${sleeve}"`));
  const aa=s.cuffOuter.map((n,k)=>n+(s.shoulder[k]-n)*.06) as XY,bb=s.cuffInner.map((n,k)=>n+(s.armhole[2][k]-n)*.06) as XY;
  if(ribCuffs){
   parts.push(path(`M${q(s.cuffOuter)}L${q(s.cuffInner)}L${q(bb)}L${q(aa)}Z`,d.color,'data-operation="rib-cuff"'));
   for(let i=1;i<18;i++){const t=i/18,at=s.cuffOuter.map((n,k)=>n+(s.cuffInner[k]-n)*t) as XY,bt=aa.map((n,k)=>n+(bb[k]-n)*t) as XY;parts.push(path(`M${q(at)}L${q(bt)}`,'none','stroke-width=".001"'));}
  }else parts.push(path(`M${q(aa)}L${q(bb)}`,'none','stroke-dasharray=".006 .004" stroke-width=".0017"'));
 }
 parts.push(path(view==='side'?side:body,d.color,`data-part="body" data-design-feature="body:${v.fit}:${v.length}:${hem}"`));
 if(view!=='side')parts.push(`<path data-operation="sleeve-join" d="M${p(s.shoulder)}C${s.armhole.map(p).join(' ')} M${p(mirror(s.shoulder))}C${s.armhole.map(q=>p(mirror(q))).join(' ')}" fill="none" stroke-width=".0018"/>`);
 parts.push(`<g clip-path="url(#${clip})" data-design-feature="blocking:${v.blocking}">`);
 if(v.blocking==='chest-panel')parts.push(path(`M-1 .27H1V.46H-1Z`,a));
 if(v.blocking==='side-panel')parts.push(view==='side'?path(`M-.07 0H.07V${height+.1}H-.07Z`,a):path(`M${-hw-.05} .20H${-hw+.075}V${height+.1}H${-hw-.05}Z M${hw-.075} .20H${hw+.05}V${height+.1}H${hw-.075}Z`,a));
 if(hem==='rib'){
  parts.push(path(`M-1 ${height-.11}H1V${height+.1}H-1Z`,v.blocking==='none'?d.color:a,'data-operation="rib-hem"'));
  for(let x=-hw;x<=hw;x+=.009)parts.push(path(`M${x} ${height-.11}V${height+.04}`,'none','stroke-width=".001"'));
 }else parts.push(path(hem==='curved'?`M${-hw} ${height-.055}Q0 ${height+.052} ${hw} ${height-.055}`:`M-1 ${height-.022}H1 M-1 ${height-.031}H1`,'none','stroke-dasharray=".005 .004" stroke-width=".0014" data-operation="body-double-needle"'));
 parts.push('</g>');
 if(view==='side'){
  if(sleeve!=='sleeveless'){
   const y=(s.cuffOuter[1]+s.cuffInner[1])/2;
   parts.push(path(`M-.045 .10Q.09 .08 .10 .24L.12 ${y}H.015L-.07 .24Z`,v.blocking==='sleeves'?a:d.color,`data-design-feature="sleeve:${sleeve}"`));
   if(ribCuffs){parts.push(path(`M.015 ${y-.05}H.12V${y}H.015Z`,d.color,'data-operation="rib-cuff"'));for(let x=.02;x<.12;x+=.008)parts.push(path(`M${x} ${y-.05}V${y}`,'none','stroke-width=".001"'));}
   else parts.push(path(`M.015 ${y-.02}H.12`,'none','stroke-dasharray=".005 .004" stroke-width=".0014"'));
  }
  if(neck==='hood')parts.push(path('M-.09 .08C-.26 .02 -.26 -.20 -.10 -.22Q.07 -.23 .12 -.06L.05 .10Z',d.color,'data-operation="hood-side"'));
  if(neck==='polo')parts.push(path('M-.08 .03L.09 .02L.16 .12L.055 .075Z',a,'data-operation="polo-collar"'));
  if(neck==='quarter-zip')parts.push(path('M-.08 .025L-.08 -.075Q.015 -.10 .09 -.05L.09 .06Z',v.blocking==='collar'?a:d.color,'data-operation="zip-collar-side" data-design-feature="neck:quarter-zip"'));
  if(pocket==='zip-side')parts.push(path(`M.12 ${height-.36}L.105 ${height-.15} M.126 ${height-.36}L.111 ${height-.15}`,'none','data-operation="zip-pocket-side" data-design-feature="pocket:zip-side"'));
  else if(pocket!=='none')parts.push(path(pocket==='kangaroo'?`M.115 ${height-.35}L.15 ${height-.32}V${height-.13}H.12Z`:'M.13 .28L.16 .29V.39H.13Z',d.color,`data-operation="pocket-side" data-design-feature="pocket:${pocket}"`));
  if(hem==='split')parts.push(path(`M.115 ${height-.13}V${height}`,'none','data-operation="side-slit"'));
  parts.push(path(`M-.11 .30Q-.14 .6 -.11 ${height}`,'none','stroke-dasharray=".006 .004" stroke-width=".0016"'));
 }else{
  const nh=s.neckHalf,band=.032*d.finish.neckWidthMm/m.finish.neckWidthMm;
  if(neck==='crew'||neck==='v'){
   const outer=`M${p([-nh,0])}`+(neck==='v'&&view==='front'?`L0 ${drop}L${p([nh,0])}`:`Q0 ${2*drop} ${p([nh,0])}`);
   const inner=neck==='v'&&view==='front'?`L${p([nh-band,.008])}L0 ${drop-band}L${p([-nh+band,.008])}Z`:`L${p([nh-band,.004])}Q0 ${2*Math.max(.003,drop-band)} ${p([-nh+band,.004])}Z`;
   parts.push(path(outer+inner,v.blocking==='sleeves'?a:d.color,`data-operation="neckband" data-design-feature="neck:${neck}"`));
  }else if(neck==='polo'){
   // Keep the same commercial construction used in the company flat: a
   // raised stand above the neckline, with two separated turn-down leaves
   // whose points stop on either side of the placket.
   const standHalf=Math.max(.075,nh*.48),standTop=-.026,standBottom=.018,standBottomCenter=Math.max(.035,2*drop+.003),wing=Math.min(nh*.98,.145),point=.036,tipY=drop+.092,tipInset=.015;
   if(view==='front'){
    const stand=`M${-standHalf} ${standTop}Q0 ${standTop-.010} ${standHalf} ${standTop}L${standHalf} ${standBottom}Q0 ${standBottomCenter} ${-standHalf} ${standBottom}Z`;
    const left=`M${-standHalf} ${standTop+.004}Q${-wing} ${standTop+.012} ${-wing} ${standTop+.032}Q${-point} ${tipY-.012} ${-point} ${tipY}L${-point+tipInset} ${tipY-.016}Q${-point*.50} ${standBottom} ${-standHalf} ${standBottom}Z`;
    const right=`M${standHalf} ${standTop+.004}Q${wing} ${standTop+.012} ${wing} ${standTop+.032}Q${point} ${tipY-.012} ${point} ${tipY}L${point-tipInset} ${tipY-.016}Q${point*.50} ${standBottom} ${standHalf} ${standBottom}Z`;
    parts.push(path(stand,a,'data-operation="polo-front-collar-stand" data-design-feature="neck:polo"'),path(left,a,'data-operation="polo-collar-left" data-design-feature="neck:polo"'),path(right,a,'data-operation="polo-collar-right" data-design-feature="neck:polo"'),path(`M${-wing} ${standTop+.024}Q${-point} ${tipY-.008} ${-point} ${tipY}`,'none','data-operation="polo-collar-left-edge" stroke-width=".0018"'),path(`M${wing} ${standTop+.024}Q${point} ${tipY-.008} ${point} ${tipY}`,'none','data-operation="polo-collar-right-edge" stroke-width=".0018"'),path(`M${-point+tipInset} ${tipY-.016}L${-point*.72} ${standBottom+.008}M${point-tipInset} ${tipY-.016}L${point*.72} ${standBottom+.008}`,'none','data-operation="polo-collar-centre-fold" stroke-width=".0014"'));
   }else parts.push(path(`M${-standHalf} ${standTop}Q0 ${standTop-.010} ${standHalf} ${standTop}L${standHalf} ${standBottom+.018}Q0 ${standBottomCenter+.012} ${-standHalf} ${standBottom+.018}Z`,a,'data-operation="polo-back-collar-stand" data-design-feature="neck:polo"'));
   if(view==='front'){
    parts.push(path(`M-.025 ${tipY-.006}H.025V${tipY+.14}H-.025Z`,a,'data-operation="placket"'));
    for(const y of [tipY+.014,tipY+.074])parts.push(`<circle cx="0" cy="${y}" r=".005" fill="${ink}"/>`);
   }
  }else if(neck==='quarter-zip'){
   parts.push(path(`M${-nh} .005V-.095Q0 -.13 ${nh} -.095V.005Q0 ${2*drop} ${-nh} .005Z`,v.blocking==='collar'?a:d.color,'data-operation="zip-collar" data-design-feature="neck:quarter-zip"'));
   if(view==='front'){
    parts.push(path('M-.012 -.105V.33H.012V-.105','none','data-operation="quarter-zip"'));
    for(let y=-.09;y<.32;y+=.012)parts.push(path(`M-.009 ${y}H.009`,'none','stroke-width=".0018"'));
    parts.push(path('M0 -.06V-.015L.012 -.005L.024 -.045Z',d.color,'data-operation="zip-pull"'));
   }
  }else{
   parts.push(path(view==='front'?'M-.16 .05C-.29 -.01 -.27 -.20 -.13 -.21H.13C.27 -.20 .29 -.01 .16 .05Q0 .14 -.16 .05Z':'M-.16 .02C-.25 -.12 -.22 -.23 0 -.23C.22 -.23 .25 -.12 .16 .02L.13 .16Q0 .23 -.13 .16Z',d.color,`data-operation="${view==='front'?'hood':'hood-back'}" data-design-feature="neck:hood"`));
   parts.push(path(view==='front'?'M-.13 -.21Q-.10 -.02 .025 .07 M.13 -.21Q.10 -.02 -.025 .07 M-.045 .08V.27 M.045 .08V.27':'M0 -.23V.18'));
  }
  if(view==='front'&&pocket!=='none'){
   if(pocket==='zip-side')for(const sign of [-1,1]){
    const x=sign*(hw-.035);parts.push(path(`M${x} ${height-.36}L${x-sign*.02} ${height-.15} M${x+sign*.006} ${height-.36}L${x-sign*.014} ${height-.15}`,'none','data-operation="zip-pocket" data-design-feature="pocket:zip-side"'));
   }else if(pocket==='kangaroo')parts.push(path(`M-.17 ${height-.37}H.17L.23 ${height-.15}Q0 ${height-.10} -.23 ${height-.15}Z M-.17 ${height-.35}L-.22 ${height-.18} M.17 ${height-.35}L.22 ${height-.18}`,d.color,'data-operation="pocket" data-design-feature="pocket:kangaroo"'));
   else for(const x of pocket==='double-chest'?[-.19,.07]:[.07])parts.push(path(`M${x} .28H${x+.12}V.40L${x+.06} .43L${x} .40Z M${x} .30H${x+.12}`,d.color,`data-operation="pocket" data-design-feature="pocket:${pocket}"`));
  }
  if(v.graphic===view||v.graphic==='front-back')parts.push(`<g data-operation="graphic" data-design-feature="graphic:${view}" fill="${a}" stroke="none"><circle cx="0" cy=".51" r=".083"/><path d="M-.10 .60L0 .48L.10 .60Z" fill="${ink}"/><path d="M-.10 .63H.10V.642H-.10Z"/></g>`);
  if(hem==='split')parts.push(path(`M${hw-.012} ${height-.10}V${height-.008} M${-hw+.012} ${height-.10}V${height-.008}`,'none','data-operation="side-slit" stroke-width=".002"'));
 }
 return parts.join('')+'</g>';
}

export function exportStyleThreeViewSvg(d:CompanyStyleDraft,clean=false){
 const m=variationDrawingMaster(d),{neck,sleeve}=resolvedStyleVariation(d),height=d.design?.length==='cropped'?.8:d.design?.length==='longline'?1.17:1;
 const maxX=sleeve==='sleeveless'?m.shape.hemHalf:Math.max(m.shape.cuffOuter[0],m.shape.cuffInner[0],m.shape.hemHalf),scale=Math.min(430/(2*maxX),550/(Math.max(height,m.shape.cuffInner[1])+(neck==='hood'?.25:0))),top=150+(neck==='hood'?scale*.24:0);
 const meta={schema:'garment-os/style-three-view/v1',source:m.source,draft:d,sideView:'design-proposal',coordinateSpace:'drawing-ratio',productionApproved:false};
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="900" viewBox="0 0 1680 900" aria-label="二维创作三视图"><metadata>${escapeSvg(JSON.stringify(meta))}</metadata><rect width="1680" height="900" fill="#fff"/><g font-family="Microsoft YaHei,sans-serif" fill="${ink}">${clean?'':`<text x="48" y="48" font-size="25" font-weight="600">${escapeSvg(d.name)} · 三视图创作</text><text x="48" y="80" fill="#68766e" font-size="14">${escapeSvg(d.styleCode||'未编款号')} / 母版 ${escapeSvg(m.source.styleCode)} · 设计草案</text>`}${(['front','back','side'] as const).map((view,i)=>`<g transform="translate(${280+i*560} ${top}) scale(${scale})">${styleVariationFigure(d,view)}</g><text x="${280+i*560}" y="${clean?65:112}" text-anchor="middle" font-size="19">${{front:'正面 / FRONT',back:'背面 / BACK',side:'右侧 / RIGHT SIDE'}[view]}</text>`).join('')}${clean?'':`<path d="M48 770H1632" stroke="#d9dfda"/><text x="48" y="810" font-size="16">${escapeSvg(styleVariationSummary(d).join(' · ')||'沿用公司母版，选择右侧改款选项开始创作')}</text><text x="48" y="850" fill="#768279" font-size="13">正背侧共享当前设计设定与绘图比例 · 侧视为设计补充 · 款式示意，非毫米裁剪图</text>`}</g></svg>`;
}
