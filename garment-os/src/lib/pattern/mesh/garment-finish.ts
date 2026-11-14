import type { GarmentAppearance,GarmentAssembly3d,GarmentDisplay3d,GarmentDisplaySurface } from '@/types/garment3d';
import type { XYZ } from '@/types/pattern3d';
import { createGarmentIllustration } from './garment-illustration';
import { createCompanyGarmentIllustration } from './garment-company-shape';
import { DEFAULT_GARMENT_SURFACE } from './garment-surface';
import { DEFAULT_GARMENT_FINISH,garmentFinishPlan } from './garment-finish-plan';
import { add,sub,cross,unit,detailSurface,openingSampler,solidStrip,stitchGeometry } from './garment-finish-geometry';

const cache=new WeakMap<GarmentAssembly3d,Map<string,GarmentDisplay3d>>();
/** Finished technical illustration. CAD-net generation and material simulation
 * remain independent; the trim plan is an explicitly editable design example. */
export function createFinishedGarment(source:GarmentAssembly3d,appearance:Pick<GarmentAppearance,'surface'|'finish'|'companyMasterId'>={}):GarmentDisplay3d{
  const surfaceSettings=appearance.surface??DEFAULT_GARMENT_SURFACE,settings=appearance.finish??DEFAULT_GARMENT_FINISH,key=JSON.stringify([surfaceSettings,settings,appearance.companyMasterId]),old=cache.get(source)?.get(key);if(old)return old;
  const base=appearance.companyMasterId?createCompanyGarmentIllustration(source,appearance.companyMasterId,surfaceSettings):createGarmentIllustration(source,surfaceSettings),plan=garmentFinishPlan(source,settings),surfaces=[...base.surfaces],lines:NonNullable<GarmentDisplay3d['constructionLines']>=[];
  const append=(surface:GarmentDisplaySurface)=>{if(surface.positionsMm.some(p=>p.some(v=>!Number.isFinite(v))))throw Error('工艺几何含无效坐标');surfaces.push(surface);};
  if(settings.enabled){
    for(const opening of source.openings??[]){
      const sample=openingSampler(opening,base.surfaces),owner=opening.edges[0].surfaceId;
      if(opening.role==='neck'&&plan.neckband){
        const band=plan.neckband,n=Math.ceil(sample.total/.75),samples=Array.from({length:n+1},(_,i)=>sample.at(i*sample.total/n));
        // Fit one loop frame rather than inheriting front/back cloth normals.
        // Their rapid change at a shoulder otherwise flips the rib into spikes.
        const center=samples.slice(0,n).reduce((sum,s)=>add(sum,s.p,1/n),[0,0,0] as XYZ);
        let plane=unit(samples.slice(0,n).reduce((sum,s,i)=>add(sum,cross(sub(s.p,center),sub(samples[(i+1)%n].p,center))),[0,0,0] as XYZ));
        if(plane[1]<0)plane=plane.map(v=>-v) as XYZ;
        for(let i=0;i<n;i++){
          const s=samples[i],tangent=unit(sub(samples[(i+4)%n].p,samples[(i+n-4)%n].p));
          let inward=unit(cross(plane,tangent));if(inward.reduce((sum,v,k)=>sum+v*(center[k]-s.p[k]),0)<0)inward=inward.map(v=>-v) as XYZ;
          let normal=unit(cross(tangent,inward));if(normal.reduce((sum,v,k)=>sum+v*plane[k],0)<0)normal=normal.map(v=>-v) as XYZ;
          s.out=inward;s.n=normal;
        }
        samples[n]={...samples[0],distance:sample.total};
        const neck=detailSurface(band.id,owner,'rib','对折罗纹领条');
        append(solidStrip(neck,samples,settings.neckWidthMm,1.2,(s,t)=>{
          const ridge=.13*Math.cos(2*Math.PI*s.distance/sample.total*Math.max(1,Math.round(band.netLengthMm/1.5)))*Math.sin(Math.PI*t);
          return add(add(s.p,s.out,settings.neckWidthMm*t),s.n,.2+ridge);
        },(distance,t,inside)=>[settings.seamAllowanceMm+distance/sample.total*band.netLengthMm,settings.seamAllowanceMm+settings.neckWidthMm*(inside?2-t:t)]));
        lines.push({id:'neckband-fold',kind:'fold',closed:true,pointsMm:samples.map(s=>add(s.p,s.out,settings.neckWidthMm))});
        append(stitchGeometry(detailSurface('neckband-topstitch',owner,'thread','领口压线'),sample.total,settings.stitchPitchMm,d=>sample.at(d,2)));
        lines.push({id:'neckband-insertion',kind:'stitch',closed:true,pointsMm:samples.map(s=>sample.at(s.distance,2).p)});
      }
      const hem=plan.hems.find(h=>h.openingId===opening.id);if(!hem)continue;
      const n=Math.ceil(sample.total/3),samples=Array.from({length:n+1},(_,i)=>sample.at(i*sample.total/n)),label=opening.role==='body-hem'?'下摆':'袖口';
      append(solidStrip(detailSurface(`${opening.id}-turnback`,owner,'turnback',`${label}内折层`),samples,hem.depthMm,.7,(s,t)=>{
        const q=sample.at(s.distance,hem.depthMm*t);return add(q.p,q.n,-1.2);
      },(distance,t)=>[distance,t*hem.depthMm]));
      for(const [row,inset]of [hem.depthMm-3,hem.depthMm-3-settings.needleGaugeMm].entries()){
        append(stitchGeometry(detailSurface(`${opening.id}-needle-${row+1}`,owner,'thread',`${label}双针 ${row+1}`),sample.total,settings.stitchPitchMm,d=>sample.at(d,inset)));
        lines.push({id:`${opening.id}-needle-${row+1}`,kind:'stitch',closed:true,pointsMm:samples.map(s=>sample.at(s.distance,inset).p)});
      }
    }
    for(const seam of source.seams.filter(s=>/^cap-|^shoulder-/.test(s.id))){
      if(!seam.path||seam.path.length<2)continue;
      const points=seam.path.map(ref=>{const s=base.surfaces.find(s=>s.sourceSurfaceId===ref.surfaceId&&s.layer==='outer')!;return {p:s.positionsMm[ref.vertex],n:s.renderNormals[ref.vertex],uv:s.uvMm[ref.vertex]};});
      let total=0;const spans=points.slice(0,-1).map((p,i)=>{const q=points[i+1],length=Math.hypot(q.uv[0]-p.uv[0],q.uv[1]-p.uv[1]),start=total;total+=length;return {p,q,length,start};}).filter(s=>s.length>1e-7);
      const at=(d:number)=>{const s=spans.find(s=>d<=s.start+s.length)??spans.at(-1)!,t=Math.max(0,Math.min(1,(d-s.start)/s.length));return {p:add(s.p.p,sub(s.q.p,s.p.p),t),n:unit(add(s.p.n,sub(s.q.n,s.p.n),t)),out:[0,0,0] as XYZ,uv:[s.p.uv[0]+(s.q.uv[0]-s.p.uv[0])*t,s.p.uv[1]+(s.q.uv[1]-s.p.uv[1])*t] as [number,number],distance:d};};
      append(stitchGeometry(detailSurface(`${seam.id}-thread`,seam.path[0].surfaceId,'thread',seam.id.startsWith('cap')?'装袖接缝':'肩缝'),total,settings.stitchPitchMm,at));
      lines.push({id:seam.id,kind:'seam',closed:seam.id.startsWith('cap'),pointsMm:points.map(p=>p.p)});
    }
  }
  const result={...base,surfaces,finishPlan:plan,constructionLines:lines,metrics:{...base.metrics,renderTriangles:surfaces.reduce((sum,s)=>sum+s.triangles.length/3,0)}};
  let entries=cache.get(source);if(!entries){entries=new Map();cache.set(source,entries);}if(entries.size>=3)entries.delete(entries.keys().next().value!);entries.set(key,result);return result;
}

export function garmentDetailColor(surface:GarmentDisplaySurface,color:string){
  const factor=surface.detail?.kind==='thread'?.52:surface.detail?.kind==='rib'?.84:surface.detail?.kind==='turnback'?.9:1;
  return `#${[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*factor).toString(16).padStart(2,'0')).join('')}`;
}
