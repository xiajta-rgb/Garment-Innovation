import type { CompanyStyleDraft,CompanyStyleMaster } from '@/types/company-style';
import type { XY } from '@/types/pattern3d';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { escapeSvg } from './mesh/garment-technical-view';
import { exportStyleThreeViewSvg } from './style-variation-drawing';

const p=(v:XY)=>v.map(n=>n.toFixed(5)).join(' ');
const mirror=(v:XY):XY=>[-v[0],v[1]];
const blend=(a:XY,b:XY,t:number):XY=>a.map((v,k)=>v+(b[k]-v)*t) as XY;
export function companyBodyPath(m:CompanyStyleMaster,view:'front'|'back'){
  const s=m.shape,n:XY=[s.neckHalf,0],h:XY=[s.hemHalf,1],a=s.armhole[2],drop=view==='front'?s.frontDrop:s.backDrop;
  return 'M'+p(n)+'L'+p(s.shoulder)+'C'+s.armhole.map(p).join(' ')+'L'+p(h)+'L'+p(mirror(h))+'L'+p(mirror(a))+'C'+[s.armhole[1],s.armhole[0],s.shoulder].map(v=>p(mirror(v))).join(' ')+'L'+p(mirror(n))+'Q0 '+(2*drop)+' '+p(n)+'Z';
}
export function companySleevePath(m:CompanyStyleMaster,left=false){
  const s=m.shape,pt=(a:XY)=>p(left?mirror(a):a);
  return 'M'+pt(s.shoulder)+'L'+pt(s.cuffOuter)+'L'+pt(s.cuffInner)+'L'+pt(s.armhole[2])+'C'+[s.armhole[1],s.armhole[0],s.shoulder].map(pt).join(' ')+'Z';
}
const ink='#18211c',detail='#354638';
export function companyStyleFigure(m:CompanyStyleMaster,d:CompanyStyleDraft,view:'front'|'back',outlineOnly=false){
  const s=m.shape,sw='.0022',fill=outlineOnly?'none':d.color,parts=['<g data-company-master="'+m.id+'" data-company-view="'+view+'" stroke="'+ink+'" stroke-width="'+sw+'" stroke-linejoin="round" stroke-linecap="round">'];
  parts.push('<path data-part="sleeve-left" d="'+companySleevePath(m,true)+'" fill="'+fill+'"/><path data-part="sleeve-right" d="'+companySleevePath(m)+'" fill="'+fill+'"/>');
  if(!outlineOnly&&view==='front'&&m.kind!=='pullover-hoodie')parts.push('<path data-part="back-neck-facing" d="M'+p([-s.neckHalf,0])+'Q0 '+(2*s.backDrop)+' '+p([s.neckHalf,0])+'Q0 '+(2*s.frontDrop)+' '+p([-s.neckHalf,0])+'Z" fill="'+d.color+'"/>');
  parts.push('<path data-part="body" d="'+companyBodyPath(m,view)+'" fill="'+fill+'"/>');
  if(outlineOnly)return parts.join('')+'</g>';
  if(!d.finish.enabled&&['short-tee','long-tee'].includes(m.kind))return parts.join('')+'</g>';
  const ribbed=m.kind==='crew-sweatshirt'||m.kind==='pullover-hoodie',drop=view==='front'?s.frontDrop:s.backDrop,band=.032*d.finish.neckWidthMm/m.finish.neckWidthMm;
  if(m.kind!=='pullover-hoodie'){
    const outer='M'+p([-s.neckHalf,0])+'Q0 '+(2*drop)+' '+p([s.neckHalf,0]),inner='M'+p([-s.neckHalf+band,.004])+'Q0 '+(2*Math.max(.003,drop-band))+' '+p([s.neckHalf-band,.004]);
    parts.push('<path data-operation="neckband" d="'+outer+'L'+p([s.neckHalf-band,.004])+'Q0 '+(2*Math.max(.003,drop-band))+' '+p([-s.neckHalf+band,.004])+'Z" fill="'+d.color+'"/><path d="'+inner+'" fill="none"/>');
    for(let i=0;i<=70;i++){const u=-1+2*i/70,x=s.neckHalf*u,y=drop*(1-u*u),xi=(s.neckHalf-band)*u,yi=Math.max(.003,drop-band)*(1-u*u)+.004;parts.push('<path d="M'+p([x,y])+'L'+p([xi,yi])+'" stroke-width=".0009"/>');}
    if(view==='front')for(let i=0;i<=70;i++){const u=-1+2*i/70;parts.push('<path data-operation="back-neck-rib" d="M'+p([s.neckHalf*u,s.backDrop*(1-u*u)])+'L'+p([(s.neckHalf-band)*u,(s.backDrop+band*.7)*(1-u*u)+.004])+'" stroke-width=".001"/>');}
  }else{
    if(view==='front')parts.push('<path data-operation="hood" d="M-.16 .05C-.27 -.02 -.27 -.16 -.13 -.17L.13 -.17C.27 -.16 .27 -.02 .16 .05Q0 .12 -.16 .05Z" fill="'+d.color+'"/><path d="M-.13 -.17Q-.12 -.015 0 .075Q.12 -.015 .13 -.17M-.11 -.17Q-.10 -.02 .025 .07M.11 -.17Q.10 -.02 -.025 .07" fill="none"/><path data-operation="drawcord" d="M-.045 .07L-.047 .29M.045 .07L.047 .29" fill="none" stroke-width=".003"/><path data-operation="pocket" d="M-.19 .58L.19 .58L.25 .85Q0 .9 -.25 .85Z M-.19 .60L-.25 .80 M.19 .60L.25 .80" fill="'+d.color+'"/>');
    else parts.push('<path data-operation="hood-back" d="M-.16 -.01C-.22 -.12 -.19 -.17 -.12 -.17L.12 -.17C.19 -.17 .22 -.12 .16 -.01L.13 .13Q0 .22 -.13 .13Z" fill="'+d.color+'"/><path d="M0 -.17V.17" fill="none"/>');
  }
  for(const left of [false,true]){
    const a=left?mirror(s.cuffOuter):s.cuffOuter,b=left?mirror(s.cuffInner):s.cuffInner,capA=left?mirror(s.shoulder):s.shoulder,capB=left?mirror(s.armhole[2]):s.armhole[2],v=blend(capA,capB,.5),hem=ribbed?.10:.03*d.finish.sleeveHemMm/m.finish.sleeveHemMm;
    const center=blend(a,b,.5),length=Math.hypot(v[0]-center[0],v[1]-center[1]),t=hem/length,innerA=blend(a,capA,t),innerB=blend(b,capB,t);
    if(ribbed){
      parts.push('<path data-operation="rib-cuff" d="M'+p(a)+'L'+p(b)+'L'+p(innerB)+'L'+p(innerA)+'Z" fill="'+d.color+'"/>');
      for(let i=0;i<30;i++)parts.push('<path d="M'+p(blend(a,b,i/30))+'L'+p(blend(innerA,innerB,i/30))+'" stroke-width=".0009"/>');
    }else for(const k of [0,1]){const r=k*d.finish.needleGaugeMm/700,aa=blend(a,capA,(hem-r)/length),bb=blend(b,capB,(hem-r)/length);parts.push('<path data-operation="sleeve-double-needle" d="M'+p(aa)+'L'+p(bb)+'" fill="none" stroke-dasharray=".004 .003" stroke-width=".002"/>');}
  }
  const hem=ribbed?.11:.03*d.finish.bodyHemMm/m.finish.bodyHemMm;
  if(ribbed){
    parts.push('<path data-operation="rib-hem" d="M'+p([-s.hemHalf,1-hem])+'H'+s.hemHalf+'V1H'+(-s.hemHalf)+'Z" fill="'+d.color+'"/>');
    for(let i=0;i<95;i++){const x=-s.hemHalf+2*s.hemHalf*i/95;parts.push('<path d="M'+x+' 1v-'+hem+'" stroke-width=".0009"/>');}
  }else for(const offset of [hem,hem-d.finish.needleGaugeMm/700])parts.push('<path data-operation="body-double-needle" d="M'+p([-s.hemHalf,1-offset])+'H'+s.hemHalf+'" fill="none" stroke-dasharray=".004 .003" stroke-width=".002"/>');
  return parts.join('')+'</g>';
}
export function exportCompanyStyleSvg(d:CompanyStyleDraft){
  if(d.design)return exportStyleThreeViewSvg(d);
  const m=companyStyleMaster(d.masterId),s=m.shape,long=m.kind==='long-tee',figureScale=long?365:Math.min(465/(2*Math.max(s.cuffOuter[0],s.hemHalf)),535/(Math.max(s.cuffInner[1],1)+(m.kind==='pullover-hoodie'?.17:0))),top=205+(m.kind==='pullover-hoodie'?.17*figureScale:0),font='Microsoft YaHei, sans-serif';
  const parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1060" viewBox="0 0 1500 1060" aria-label="公司设计稿"><rect x="8" y="8" width="1484" height="1044" rx="12" fill="#fff" stroke="#a8a8a8" stroke-width="5"/><g font-family="'+font+'"><path d="M20 20H1480V74H20Z" fill="#506c38"/><text x="50" y="58" font-size="31" fill="#fff" font-weight="600">设计稿</text><text x="1454" y="57" text-anchor="end" font-size="27" fill="#fff" font-weight="600">LASEN</text><path d="M1120 80V1032" stroke="#aaa" stroke-width="4"/>'];
  parts.push('<text font-family="'+font+'" x="'+(long?350:270)+'" y="145" text-anchor="middle" font-size="20">正面</text><text font-family="'+font+'" x="'+(long?760:810)+'" y="'+(long?430:145)+'" text-anchor="middle" font-size="20">反面</text>');
  parts.push('<metadata>'+escapeSvg(JSON.stringify({draft:d,source:m.source,productionApproved:false}))+'</metadata>');
  for(const [i,view]of (['front','back'] as const).entries())parts.push('<g transform="translate('+(long?(i?760:350):(i?810:270))+' '+(long?(i?460:205):top)+') scale('+figureScale+')">'+companyStyleFigure(m,d,view)+'</g>');
  const rows=[['款号',d.styleCode||'待填写'],['品名',d.name],['参考母版',m.source.styleCode],['面料',d.fabric||'待确认'],['成分',d.composition||'待确认'],['克重',d.weight||'待确认'],['版型','常规直身 / 微落肩'],['图稿状态','母版派生设计草案']];
  rows.forEach(([k,v],i)=>{const y=110+i*85;parts.push('<rect x="1125" y="'+(y-26)+'" width="350" height="78" fill="'+(i%2?'#fff':'#f1f1ef')+'"/><text x="1140" y="'+y+'" font-size="16" font-weight="600">'+k+'：</text>'+wrappedText(v,1140,y+25,14,320,2));});
  const red='#d33129',note=(x:number,y:number,text:string,anchor:XY)=>'<g fill="'+red+'" stroke="'+red+'" stroke-width="1"><text x="'+x+'" y="'+y+'" font-size="15" stroke="none">'+escapeSvg(text)+'</text><path d="M'+(x+20)+' '+(y+8)+'H'+anchor[0]+'V'+anchor[1]+'" fill="none"/></g>';
  parts.push(note(50,180,m.kind==='pullover-hoodie'?'交叉帽襟 / 双层帽 / 帽绳':d.finish.neckWidthMm+'mm 罗纹领', [long?350:270,top+figureScale*s.frontDrop]));
  parts.push(note(50,long?640:805,(m.kind.includes('sweatshirt')||m.kind==='pullover-hoodie')?'袖口、下摆55mm高罗纹':d.finish.bodyHemMm+'mm 下摆坎车 / 双针间距'+d.finish.needleGaugeMm+'mm',[long?350:270,top+figureScale*.98]));
  parts.push(note(long?560:655,long?165:180,m.kind==='short-tee'?'后领10mm本布包边 / 后领整圈压线2mm':m.kind==='long-tee'?'后领8mm本布包边 / 边压1mm':'后领10mm织带包缝',[long?760:810,(long?460:top)+figureScale*s.backDrop]));
  parts.push('<text x="52" y="876" fill="'+detail+'" font-size="16">基本版型沿用公司母版，差异以领型、袖型、口袋、颜色及工艺版本管理。</text><text x="52" y="913" fill="#777" font-size="13">参考 '+escapeSvg(m.source.styleCode)+' · 图稿比例取自原图；不是从图片推算毫米净样。</text>'+wrappedText(d.notes||'后领包边与标识位置沿用原稿要求，后续工艺和材料需单独核对。',52,947,13,1010,3)+'<text x="1140" y="865" font-size="14" fill="#6c745f">原稿工艺参考</text>');
  m.knownFinishes.slice(0,4).forEach((t,i)=>parts.push(wrappedText(t,1140,892+i*29,11,320,2)));
  parts.push('<text x="52" y="1014" font-size="12" fill="#8a6549">来源可追溯 · 设计草案 · 当前裁片关联 '+(m.cadTemplateId?'已接通参考方法，需同款净样核对':'待建立，禁止用其他构型替代')+'</text></g></svg>');
  return parts.join('');
}

function wrappedText(value:string,x:number,y:number,size:number,width:number,maxLines:number){
  const lines:string[]=[];let line='',used=0;
  for(const c of value){const w=size*(c.charCodeAt(0)>255?1:.57);if(used+w>width&&line){lines.push(line);line='';used=0;}line+=c;used+=w;}if(line)lines.push(line);
  const visible=lines.slice(0,maxLines);if(lines.length>maxLines)visible[maxLines-1]=visible[maxLines-1].slice(0,-1)+'…';
  return '<text x="'+x+'" y="'+y+'" font-size="'+size+'">'+visible.map((t,i)=>'<tspan x="'+x+'" dy="'+(i?size+4:0)+'">'+escapeSvg(t)+'</tspan>').join('')+'</text>';
}
