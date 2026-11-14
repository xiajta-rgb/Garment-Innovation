import triangulate from 'cdt2d';
import type { XY,XYZ } from '@/types/pattern3d';
import type { PieceDesignSpec } from '@/types/piece-design';
import type { GarmentDisplay3d,GarmentDisplaySurface } from '@/types/garment3d';
import { garmentSurfaceMapper } from './mesh/garment-finish-geometry';

export const pointsPath=(points:XY[])=>`M${points.map(p=>p.map(v=>v.toFixed(3)).join(' ')).join('L')}Z`;
const cross=(a:XY,b:XY)=>a[0]*b[1]-a[1]*b[0];
const sub=(a:XY,b:XY):XY=>[a[0]-b[0],a[1]-b[1]];
/** Convex net pocket, source-mm drafting rule v1. Rounded corners are sampled at <= 0.1 mm chord error. */
export function pocketOutline(p:PieceDesignSpec['pocket']):XY[]{
  const w=p.widthMm,h=p.heightMm;
  if(p.kind==='pointed')return [[0,0],[w,0],[w,h-20],[w/2,h],[0,h-20]];
  if(p.kind!=='round')return [[0,0],[w,0],[w,h],[0,h]];
  const r=Math.min(25,w/4,h/4),points:XY[]=[[0,0],[w,0],[w,h-r]];
  for(let i=1;i<=16;i++){const a=i*Math.PI/32;points.push([w-r+r*Math.cos(a),h-r+r*Math.sin(a)]);}
  points.push([r,h]);
  for(let i=1;i<=16;i++){const a=Math.PI/2+i*Math.PI/32;points.push([r+r*Math.cos(a),h-r+r*Math.sin(a)]);}
  return points;
}
/** Offset each boundary by a declared allowance; top uses its independent fold depth. */
export function pocketCutOutline(net:XY[],allowance=6,topFold=20):XY[]{
  const lines=net.map((a,i)=>{const b=net[(i+1)%net.length],v=sub(b,a),len=Math.hypot(...v),d=i===0?topFold:allowance;return {p:[a[0]+v[1]/len*d,a[1]-v[0]/len*d] as XY,v};});
  return lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],den=cross(a.v,b.v);if(Math.abs(den)<1e-10)return b.p;const t=cross(sub(b.p,a.p),b.v)/den;return [a.p[0]+t*a.v[0],a.p[1]+t*a.v[1]];});
}
function inside(p:XY,poly:XY[]){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function distance(p:XY,a:XY,b:XY){const v=sub(b,a),t=Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(v[0]**2+v[1]**2||1)));return Math.hypot(p[0]-a[0]-t*v[0],p[1]-a[1]-t*v[1]);}
export function validatePocketPlacement(outline:XY[],front:XY[],clearanceMm=10){
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],n=Math.max(1,Math.ceil(Math.hypot(...sub(b,a))/2));
    for(let j=0;j<=n;j++){const p:XY=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n];if(!inside(p,front)||front.some((q,k)=>distance(p,q,front[(k+1)%front.length])<clearanceMm))throw Error('贴袋裁边超出前衣身可用区域，或距领口/袖窿/侧缝不足10mm；请调整袋位或尺寸。');}
  }
}
/** Map a real net pocket to the front CAD surface; never clamp an out-of-panel placement. */
export function attachDesignPocket(base:GarmentDisplay3d,polygon:XY[]):GarmentDisplay3d{
  const front=base.surfaces.find(s=>s.layer==='outer'&&s.sourceId.endsWith('.front'));
  if(!front)throw Error('没有可装接贴袋的前衣身');
  const map=garmentSurfaceMapper(front),points:XY[]=[],edges:number[][]=[];let topStations=0;
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],n=Math.max(1,Math.ceil(Math.hypot(...sub(b,a))/5));if(i===0)topStations=n;for(let j=0;j<n;j++)points.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  for(let i=0;i<points.length;i++)edges.push([i,(i+1)%points.length]);
  const boundaryCount=points.length;
  const minX=Math.min(...polygon.map(p=>p[0])),maxX=Math.max(...polygon.map(p=>p[0])),minY=Math.min(...polygon.map(p=>p[1])),maxY=Math.max(...polygon.map(p=>p[1]));
  // Interior stations follow the torso curvature too; a corner-only fan cuts
  // through the body and produces a false hole in the visible pocket.
  for(let x=minX+4;x<maxX;x+=4)for(let y=minY+4;y<maxY;y+=4)if(inside([x,y],polygon)&&polygon.every((a,i)=>distance([x,y],a,polygon[(i+1)%polygon.length])>.5))points.push([x,y]);
  const triangles=triangulate(points,edges,{interior:true,exterior:false}).flat(),positions:XYZ[]=[],normals:XYZ[]=[];
  for(const point of points){const mapped=map(point);if(mapped.errorMm>.25)throw Error('贴袋定位无法精确映射到前衣身，已停止生成。');positions.push(mapped.p.map((v,k)=>v+mapped.n[k]*1.5) as XYZ);normals.push(mapped.n);}
  const pocket:GarmentDisplaySurface={id:'design.patch-pocket',sourceId:'design.patch-pocket',sourceSurfaceId:front.sourceSurfaceId,copy:1,layer:'outer',localMm:points,uvMm:points,positionsMm:positions,renderNormals:normals,triangles,boundary:Array.from({length:boundaryCount},(_,i)=>i),simulationIds:points.map((_,i)=>-i-1),foldAxis:null,sourceHalfSign:0};
  return {...base,surfaces:[...base.surfaces,pocket],constructionLines:[...base.constructionLines??[],{id:'design.patch-pocket-attachment',kind:'seam',pointsMm:[...positions.slice(topStations,boundaryCount),positions[0]],closed:false},{id:'design.patch-pocket-open-top',kind:'fold',pointsMm:positions.slice(0,topStations+1),closed:false}]};
}
