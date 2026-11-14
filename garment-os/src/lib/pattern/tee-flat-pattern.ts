import type { StandardDraft,StandardPiece } from './reference/standard';
import type { PieceDesignSpec } from '@/types/piece-design';
import { flattenSvgPathD } from './geometry';
import { pocketOutline,pointsPath } from './piece-design-pocket';
import { escapeSvg } from './mesh/garment-technical-view';

type Point={x:number;y:number};
export interface FlatMeasure {id:string;label:string;valueMm:number;definition:string}
const n=(v:number)=>Number(v.toFixed(3));
function point(p:StandardPiece,key:string):Point{
  const v=p.points[key];if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.y))throw Error(`版型量点缺失：${p.id}/${key}`);return v;
}
function widthAt(p:StandardPiece,y:number){
  const side=p.sourcePaths.sideSeam;if(!side)throw Error('缺少源侧缝，不能推算平量胸宽');
  const samples=flattenSvgPathD(side.data,256),hits:number[]=[];
  for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if((y-a.y)*(y-b.y)<=0&&Math.abs(a.y-b.y)>1e-9)hits.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));}
  if(!hits.length)throw Error('胸宽量线超出源侧缝，不能以人体胸围替代');return Math.max(...hits)*2;
}
/** Net geometry only: no seam allowances, projected widths or body-measurement substitutions. */
export function teeFlatSpecification(source:StandardDraft,bodyChestMm:number){
  if(source.engine!=='teagan')throw Error('平铺版型仅接入配套 Teagan');
  const get=(id:string)=>{const p=source.pieces.find(p=>p.id===`teagan.${id}`);if(!p)throw Error(`缺少配套裁片 ${id}`);return p;};
  const front=get('front'),back=get('back'),sleeve=get('sleeve');
  if(!Number.isFinite(bodyChestMm)||bodyChestMm<=0)throw Error('人体胸围无效，不能核对净松量');
  const f=front.points,b=back.points,s=sleeve.points;
  for(const [p,keys]of [[front,['neck','shoulder','armhole','hem','cfHem','cfNeck']],[back,['neck','shoulder','armhole','hem','cfHem','cbNeck']],[sleeve,['top','hemLeft','hemRight','bicepsLeft','bicepsRight']]] as const)for(const key of keys)point(p,key);
  const frontChest=widthAt(front,f.armhole.y+20),backChest=widthAt(back,b.armhole.y+20);
  const rows:FlatMeasure[]=[
    {id:'front-length',label:'前衣长',valueMm:f.cfHem.y-f.neck.y,definition:'新领口肩颈点至前中下摆，垂直净长；不含领条'},
    {id:'back-length',label:'后衣长',valueMm:b.cfHem.y-b.neck.y,definition:'新领口肩颈点至后中下摆，垂直净长；不含领条'},
    {id:'front-chest',label:'前身胸宽',valueMm:frontChest,definition:'前袖窿底下20 mm，侧缝至侧缝，单面平量'},
    {id:'back-chest',label:'后身胸宽',valueMm:backChest,definition:'后袖窿底下20 mm，侧缝至侧缝，单面平量'},
    {id:'chest-circumference',label:'衣身净胸围',valueMm:frontChest+backChest,definition:'前身胸宽＋后身胸宽，整圈；不是人体胸围'},
    {id:'chest-ease',label:'胸围净松量',valueMm:frontChest+backChest-bodyChestMm,definition:`源净胸围减当前人体胸围 ${bodyChestMm.toFixed(1)} mm；不等于面料拉伸量`},
    {id:'shoulder',label:'肩宽',valueMm:2*f.shoulder.x,definition:'左右装袖肩点之间水平距离；沿肩缝量长另计'},
    {id:'hem',label:'前下摆宽',valueMm:2*f.hem.x,definition:'前衣身下摆，单面平量，不含折边缝份'},
    {id:'neck-width',label:'领窝宽',valueMm:2*f.neck.x,definition:'左右领窝装领点间水平宽；不是领条完成后净开口'},
    {id:'front-neck-depth',label:'前领深',valueMm:f.cfNeck.y-f.neck.y,definition:'装领点水平线至前中领窝，垂直净深'},
    {id:'back-neck-depth',label:'后领深',valueMm:b.cbNeck.y-b.neck.y,definition:'装领点水平线至后中领窝，垂直净深'},
    {id:'armhole-depth',label:'袖窿深',valueMm:f.armhole.y-f.neck.y,definition:'新领口肩颈点水平线至袖窿底，垂直净深'},
    {id:'sleeve-length',label:'袖中长',valueMm:s.hemLeft.y-s.top.y,definition:'袖山最高点至袖口，沿源袖片纵向净长；不是人体肩腕长'},
    {id:'cuff',label:'袖口平宽',valueMm:Math.hypot(s.hemRight.x-s.hemLeft.x,s.hemRight.y-s.hemLeft.y)/2,definition:'源袖口净边长÷2，缝合后单面平量'},
  ];
  if(rows.some(r=>!Number.isFinite(r.valueMm)||(r.id!=='chest-ease'&&r.valueMm<=0)))throw Error('版型量点次序或数值无效');
  return {schema:'garment-os/tee-flat-spec/v1',unit:'mm',basis:'source-net-pattern',chestStationBelowArmholeMm:20,rows:rows.map(r=>({...r,valueMm:n(r.valueMm)})),productionApproved:false as const};
}
export type TeeFlatSpecification=ReturnType<typeof teeFlatSpecification>;

export function teeFlatDrawingScale(source:StandardDraft,design:PieceDesignSpec,preferred=.68){
  if(!Number.isFinite(preferred)||preferred<=0)throw Error('绘图比例无效');
  const views=[teeFlatFigure(source,design),teeFlatFigure(source,design,true)];
  return Math.min(preferred,440/Math.max(...views.map(v=>v.maxX-v.minX)),340/Math.max(...views.map(v=>v.maxY-v.minY)));
}

function command(e:StandardPiece['edges'][number],reverse=false,mirror=false){
  const xy=(p:Point)=>`${n(mirror?-p.x:p.x)} ${n(p.y)}`,to=reverse?e.from:e.to;
  return e.kind==='curve'?`C${xy(reverse?e.cp2!:e.cp1!)} ${xy(reverse?e.cp1!:e.cp2!)} ${xy(to)}`:`L${xy(to)}`;
}
/** Reflect only the source half-pattern around its declared centre line. Cubics stay cubics. */
export function unfoldedTeeBody(p:StandardPiece){
  const center=point(p,'cfHem');if(Math.abs(center.x)>.001||!p.onFold)throw Error('衣身缺少已声明的前后中对折轴');
  const edges=p.edges.filter(e=>!(Math.abs(e.from.x)<1e-8&&Math.abs(e.to.x)<1e-8));
  if(!edges.length)throw Error('没有源净边');
  return `M${n(edges[0].from.x)} ${n(edges[0].from.y)}${edges.map(e=>command(e)).join('')}${edges.slice().reverse().map(e=>command(e,true,true)).join('')}Z`;
}

/** Technical illustration: exact bodice; sleeve top length and opening preserved.
 * Cap is spread to the actual armhole, not a new sleeve pattern or a drape simulation. */
export function teeFlatFigure(source:StandardDraft,design:PieceDesignSpec,back=false){
  const body=source.pieces.find(p=>p.id===`teagan.${back?'back':'front'}`)!,s=source.pieces.find(p=>p.id==='teagan.sleeve')!.points,p=body.points;
  const length=s.hemLeft.y-s.top.y,cuff=(s.hemRight.x-s.hemLeft.x)/2,cap=s.bicepsRight.y-s.top.y,bicep=(s.bicepsRight.x-s.bicepsLeft.x)/2;
  const a=p.shoulder,b=p.armhole,angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(bicep,cap),u={x:Math.cos(angle),y:Math.sin(angle)},v={x:-u.y,y:u.x};
  const top={x:a.x+length*u.x,y:a.y+length*u.y},bottom={x:top.x+cuff*v.x,y:top.y+cuff*v.y};
  if(top.x<=a.x||bottom.x<=b.x)throw Error('当前袖片无法摊平为短T示意，请核对袖长与袖口');
  const start=body.edges.findIndex(e=>Math.hypot(e.from.x-b.x,e.from.y-b.y)<.001);
  const end=body.edges.findIndex(e=>Math.hypot(e.to.x-a.x,e.to.y-a.y)<.001);
  if(start<0||end<start)throw Error('缺少可配套的源袖窿曲线');
  const sleevePath=`M${n(a.x)} ${n(a.y)}L${n(top.x)} ${n(top.y)}L${n(bottom.x)} ${n(bottom.y)}L${n(b.x)} ${n(b.y)}${body.edges.slice(start,end+1).map(e=>command(e)).join('')}Z`;
  const paint=(id:string,path:string,color:string)=>`<path data-source-piece="${id}" d="${path}" fill="${escapeSvg(color)}" stroke="none"/>`;
  const stroke=(path:string)=>`<path d="${path}" fill="none" stroke="#303a3a" stroke-width="1.8"/>`;
  const sleeve=`${paint('teagan.sleeve',sleevePath,design.colors.sleeve)}${stroke(sleevePath)}`;
  const bodyPath=unfoldedTeeBody(body);
  // Isolate the declared neck cubic, not adjacent armhole/shoulder samples.
  const neckEdges=body.edges.filter(e=>e.kind==='curve'&&e.to.x===0);
  if(neckEdges.length!==1)throw Error('领窝净边未能唯一定位');
  const edge=neckEdges[0],half=flattenSvgPathD(`M${edge.from.x} ${edge.from.y}${command(edge)}`,128);
  const opening=[...half.map(q=>({x:-q.x,y:q.y})),...half.slice().reverse().slice(1)];
  const inner=opening.map((q,i)=>{const before=opening[Math.max(0,i-1)],after=opening[Math.min(opening.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy);return [q.x+dy/len*design.neckWidthMm,q.y-dx/len*design.neckWidthMm] as [number,number];});
  const bandPath=pointsPath([...opening.map(q=>[q.x,q.y] as [number,number]),...inner.reverse()]);
  const pocket=design.pocket.kind==='none'||back?'':pointsPath([...pocketOutline(design.pocket),pocketOutline(design.pocket)[0]].map(q=>[q[0]+design.pocket.xMm-design.pocket.widthMm/2,q[1]+p.neck.y+design.pocket.yMm]));
  const line=(id:string,x1:number,y1:number,x2:number,y2:number)=>`<path data-flat-measure="${id}" d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}"/><text stroke="none" x="${n((x1+x2)/2+8)}" y="${n((y1+y2)/2-8)}">${id}</text>`;
  const chestY=p.armhole.y+20,chest=widthAt(body,chestY),annotations=`<g data-flat-dimensions="true" fill="#597467" stroke="#80958c" stroke-width="1" stroke-dasharray="5 5" font-size="17" font-family="sans-serif">${line('A',-p.hem.x-36,p.neck.y,-p.hem.x-36,p.cfHem.y)}${line('B',-chest/2,chestY,chest/2,chestY)}${line('C',-p.shoulder.x,p.shoulder.y-24,p.shoulder.x,p.shoulder.y-24)}${line('D',a.x,a.y,top.x,top.y)}${line('E',top.x,top.y,bottom.x,bottom.y)}</g>`;
  // No texture or mesh fragments in this structural line layer.
  const svg=`<g data-flat-geometry="${back?'back':'front'}" stroke-linejoin="round" stroke-linecap="round">${sleeve}<g transform="scale(-1 1)">${sleeve}</g>${paint(body.id,bodyPath,back?design.colors.back:design.colors.front)}${stroke(bodyPath)}${paint('design.neckband',bandPath,design.colors.neckband)}${stroke(bandPath)}${design.pocket.kind==='none'?'':paint('design.patch-pocket',pocket,design.colors.pocket)}${pocket?stroke(pocket):''}${annotations}</g>`;
  return {svg,minX:-Math.max(top.x,bottom.x,p.hem.x+60),maxX:Math.max(top.x,bottom.x,p.hem.x+60),minY:p.neck.y-design.neckWidthMm,maxY:Math.max(p.cfHem.y,top.y,bottom.y),hemY:p.cfHem.y,hpsY:p.neck.y,sleeveDisplay:{angleDeg:n(angle*180/Math.PI),top,openingEnd:bottom,cap:'spread-to-source-armhole',sourceCadModified:false}};
}
