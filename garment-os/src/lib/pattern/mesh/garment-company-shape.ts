import { companyStyleMaster } from '@/data/companyStyleMasters';
import { companyBodyWidth } from '../company-style';
import { createGarmentDisplay } from './garment-surface';
import type { GarmentAssembly3d,GarmentDisplay3d,GarmentSurface,GarmentSurfaceSettings } from '@/types/garment3d';
import type { XY,XYZ } from '@/types/pattern3d';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const mix=(a:XYZ,b:XYZ,t:number)=>a.map((v,k)=>v+(b[k]-v)*t) as XYZ;
const cache=new WeakMap<GarmentAssembly3d,Map<string,{model:GarmentAssembly3d;displacement:number}>>();
/** A company drawing support, not a cloth solve or a new production pattern.
 * Both 2D and this pose consume the same source-traced landmarks. UV/CAD,
 * triangle indices and seam identity stay in the original coordinate space. */
export function createCompanyGarmentIllustration(source:GarmentAssembly3d,masterId:string,settings?:GarmentSurfaceSettings):GarmentDisplay3d{
  const master=companyStyleMaster(masterId),shape=master.shape;
  if(!master.cadTemplateId||master.cadTemplateId!==source.templateId)throw Error('公司母版与当前裁片构型不匹配');
  let mapped=cache.get(source)?.get(masterId);
  if(!mapped){
    const refs=(id:string)=>source.seams.find(s=>s.id===id)!.path!.map(r=>{const s=source.surfaces.find(s=>s.id===r.surfaceId)!;return s.localMm[r.vertex];});
    const shoulder=refs('shoulder-right'),side=refs('side-right'),neckX=Math.min(...shoulder.map(p=>Math.abs(p[0]))),topY=Math.min(...shoulder.map(p=>p[1])),shoulderY=Math.max(...shoulder.map(p=>p[1])),underY=Math.min(...side.map(p=>p[1])),hemY=Math.max(...side.map(p=>p[1])),height=hemY-topY;
    if(!(height>0&&underY>shoulderY&&shoulderY>topY))throw Error('公司母版映射缺少可辨识的肩、腋下及下摆基准');
    const world=(p:XY,z=0):XYZ=>[p[0]*height,-topY-p[1]*height,z*height];
    const rowY=(y:number)=>y<=shoulderY?(y-topY)/(shoulderY-topY)*shape.shoulder[1]:y<=underY?shape.shoulder[1]+(y-shoulderY)/(underY-shoulderY)*(shape.armhole[2][1]-shape.shoulder[1]):shape.armhole[2][1]+(y-underY)/(hemY-underY)*(1-shape.armhole[2][1]);
    const bodyTargets=new Map<number,XYZ[]>();
    for(const s of source.surfaces.filter(s=>!s.sourceId.includes('sleeve'))){
      const polygon=s.boundary.map(i=>s.localMm[i]),back=s.sourceId.endsWith('.back'),neck=source.openings!.find(o=>o.role==='neck')!.edges.filter(e=>e.surfaceId===s.id).flatMap(e=>[s.localMm[e.a],s.localMm[e.b]]);
      const widthAt=(y:number)=>{
        let width=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if(y>=Math.min(a[1],b[1])-1e-7&&y<=Math.max(a[1],b[1])+1e-7){const t=clamp((y-a[1])/(b[1]-a[1]||1));width=Math.max(width,Math.abs(a[0]+(b[0]-a[0])*t));}}return width;
      };
      const neckAt=(x:number)=>{
        const samples=neck.map(p=>[Math.abs(p[0]),p[1]]).sort((a,b)=>a[0]-b[0]),b=samples.findIndex(p=>p[0]>=x),i=b<0?samples.length-1:b,a=samples[Math.max(0,i-1)],q=samples[i],t=clamp((x-a[0])/(q[0]-a[0]||1));return a[1]+(q[1]-a[1])*t;
      };
      for(const [i,p]of s.localMm.entries()){
        const ax=Math.abs(p[0]),y=rowY(p[1]),edge=widthAt(p[1]),u=clamp(ax/(edge||neckX));
        let x=companyBodyWidth(master,y)*Math.sin(u*Math.PI/2),yy=y;
        if(ax<=neckX+1e-6){const ny=neckAt(ax),fade=clamp((underY-p[1])/(underY-ny))**2,nx=ax/neckX*shape.neckHalf,nd=(back?shape.backDrop:shape.frontDrop)*(1-(ax/neckX)**2);x+=(nx-x)*fade;yy+=(nd-rowY(ny))*fade;}
        const shoulderLine=shape.shoulder[1]*(x-shape.neckHalf)/(shape.shoulder[0]-shape.neckHalf),v=clamp((yy-shoulderLine)/(shape.armhole[2][1]-shoulderLine)),z=(back?-1:1)*.10*Math.cos(u*Math.PI/2)*Math.sqrt(v*(2-v));
        const target=world([Math.sign(p[0])*x,yy],z),id=s.simulationIds[i],old=bodyTargets.get(id)??[];old.push(target);bodyTargets.set(id,old);
      }
    }
    const targets=new Map<number,XYZ>();for(const [id,points]of bodyTargets)targets.set(id,points[0].map((_,k)=>points.reduce((sum,p)=>sum+p[k],0)/points.length) as XYZ);
    for(const s of source.surfaces.filter(s=>s.sourceId.includes('sleeve'))){
      const cap=source.seams.find(c=>c.id===`cap-${s.copy===1?'right':'left'}`)!.path!.map(r=>({uv:s.localMm[r.vertex],target:targets.get(s.simulationIds[r.vertex])!})).sort((a,b)=>a.uv[0]-b.uv[0]);
      const bicepsHalf=Math.max(...cap.map(p=>Math.abs(p.uv[0]))),bicepsY=Math.max(...cap.map(p=>p.uv[1])),opening=source.openings!.find(o=>o.role==='sleeve-hem'&&o.edges[0].surfaceId===s.id)!,hem=opening.edges.map(e=>s.localMm[e.a]),hemY=Math.max(...hem.map(p=>p[1])),cuffHalf=Math.max(...hem.map(p=>Math.abs(p[0]))),sign=s.copy===1?1:-1;
      const outer=world([sign*shape.cuffOuter[0],shape.cuffOuter[1]]),inner=world([sign*shape.cuffInner[0],shape.cuffInner[1]]),center=mix(outer,inner,.5),radius=Math.hypot(...outer.map((v,k)=>(v-inner[k])/2));
      for(const [i,p]of s.localMm.entries()){
        const half=bicepsHalf+(cuffHalf-bicepsHalf)*clamp((p[1]-bicepsY)/(hemY-bicepsY)),u=Math.max(-1,Math.min(1,p[0]/half)),x=u*bicepsHalf,j=cap.findIndex(q=>q.uv[0]>=x),b=cap[j<0?cap.length-1:j],a=cap[Math.max(0,(j<0?cap.length-1:j)-1)],f=clamp((x-a.uv[0])/(b.uv[0]-a.uv[0]||1)),capY=a.uv[1]+(b.uv[1]-a.uv[1])*f,t=clamp((p[1]-capY)/(hemY-capY)),angle=u*Math.PI;
        const cuff=center.map((v,k)=>v+(outer[k]-center[k])*Math.cos(angle)+(k===2?radius*.8*Math.sin(angle):0)) as XYZ,id=s.simulationIds[i];
        if(!targets.has(id))targets.set(id,mix(mix(a.target,b.target,f),cuff,t));
      }
    }
    const displayCreases:Array<[number,number]>=[];
    for(const o of source.openings??[])for(const e of o.edges){const s=source.surfaces.find(s=>s.id===e.surfaceId)!;displayCreases.push([s.simulationIds[e.a],s.simulationIds[e.b]]);}
    for(const c of source.seams.filter(c=>c.path&&/^(cap|shoulder)-/.test(c.id)))for(let i=1;i<c.path!.length;i++){const ref=(j:number)=>{const r=c.path![j],s=source.surfaces.find(s=>s.id===r.surfaceId)!;return s.simulationIds[r.vertex];};displayCreases.push([ref(i-1),ref(i)]);}
    // Keep the affine source coordinate near hems so path-offset stitches
    // remain level after display subdivision of irregular source triangles.
    for(const s of source.surfaces){const ownHem=source.openings!.find(o=>['body-hem','sleeve-hem'].includes(o.role)&&o.edges.some(e=>e.surfaceId===s.id));if(!ownHem)continue;const y=Math.max(...ownHem.edges.filter(e=>e.surfaceId===s.id).map(e=>s.localMm[e.a][1]));for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){const a=s.triangles[t+k],b=s.triangles[t+(k+1)%3];if(s.localMm[a][1]>y-50&&s.localMm[b][1]>y-50)displayCreases.push([s.simulationIds[a],s.simulationIds[b]]);}}
    const pinned=new Set([...bodyTargets.keys(),...displayCreases.flat()]),adj=new Map<number,Set<number>>();
    for(const s of source.surfaces.filter(s=>s.sourceId.includes('sleeve')))for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){const a=s.simulationIds[s.triangles[t+k]],b=s.simulationIds[s.triangles[t+(k+1)%3]];if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a)!.add(b);adj.get(b)!.add(a);}
    // Remove triangulation ripples on the sleeve support. The cap, hem and
    // all shared body landmarks stay pinned; there is no independent seam motion.
    for(let pass=0;pass<16;pass++)for(const coefficient of [.45,-.47]){const changes=new Map<number,XYZ>();for(const [id,ns]of adj){if(pinned.has(id))continue;const p=targets.get(id)!;changes.set(id,p.map((v,k)=>v+coefficient*([...ns].reduce((sum,j)=>sum+targets.get(j)![k],0)/ns.size-v)) as XYZ);}for(const [id,p]of changes)targets.set(id,p);}
    const surfaces:GarmentSurface[]=source.surfaces.map(s=>({...s,positionsMm:s.simulationIds.map(id=>targets.get(id)!)}));
    if(surfaces.some(s=>s.positionsMm.some(p=>!p||p.some(v=>!Number.isFinite(v)))))throw Error('公司母版映射含无效坐标');
    const displacement=Math.max(...surfaces.flatMap((s,j)=>s.positionsMm.map((p,i)=>Math.hypot(...p.map((v,k)=>v-source.surfaces[j].positionsMm[i][k])))));
    mapped={model:{...source,surfaces,displayCreases},displacement};let entries=cache.get(source);if(!entries){entries=new Map();cache.set(source,entries);}entries.set(masterId,mapped);
  }
  return {...createGarmentDisplay(mapped.model,settings),source,illustration:{mode:'technical-illustration',fairingPasses:16,maxDisplacementMm:mapped.displacement,companyMasterId:master.id,companyMasterRevision:master.revision,sourceStyleCode:master.source.styleCode,proportionOnly:true}};
}
