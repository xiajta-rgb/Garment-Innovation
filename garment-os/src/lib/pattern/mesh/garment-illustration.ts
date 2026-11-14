import type { GarmentAssembly3d,GarmentDisplay3d,GarmentSurfaceSettings } from '@/types/garment3d';
import type { XYZ } from '@/types/pattern3d';
import { createGarmentDisplay } from './garment-surface';

const cache=new WeakMap<GarmentAssembly3d,{model:GarmentAssembly3d;maxDisplacementMm:number}>();
/** Non-shrinking fairing for a technical illustration, separate from the sewing
 * experiment and source CAD. Shared seam IDs are moved together. No drape claim. */
export function createGarmentIllustration(source:GarmentAssembly3d,settings?:GarmentSurfaceSettings):GarmentDisplay3d{
  let fair=cache.get(source);
  if(!fair){
    const ids=new Map<number,number>(),original:XYZ[]=[],surfaces=source.surfaces.map(s=>({...s,simulationIds:s.simulationIds.map((id,i)=>{if(!ids.has(id)){ids.set(id,original.length);original.push([...s.positionsMm[i]]);}return ids.get(id)!;})}));
    const neighbours=original.map(()=>new Set<number>()),edgeCounts=new Map<string,{a:number;b:number;count:number}>();
    for(const s of surfaces)for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){
      const a=s.simulationIds[s.triangles[t+k]],b=s.simulationIds[s.triangles[t+(k+1)%3]],key=[Math.min(a,b),Math.max(a,b)].join(':'),e=edgeCounts.get(key)??{a,b,count:0};e.count++;edgeCounts.set(key,e);neighbours[a].add(b);neighbours[b].add(a);
    }
    const boundary=original.map(()=>[] as number[]);for(const e of edgeCounts.values())if(e.count===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
    const adj=neighbours.map((n,i)=>boundary[i].length?boundary[i]:[...n]);
    const cleanBoundary=new Map<number,XYZ>();
    // Low Fourier modes preserve the authored loop's broad shape while
    // removing serrations from irregular seam stations. This is illustrative
    // boundary fairing, not a new manufacturing contour or a fabric solve.
    for(const opening of source.openings??[]){
      let total=0;const spans=opening.edges.map(e=>{const s=source.surfaces.find(s=>s.id===e.surfaceId)!,a=ids.get(s.simulationIds[e.a])!,b=ids.get(s.simulationIds[e.b])!,p=s.localMm[e.a],q=s.localMm[e.b],length=Math.hypot(p[0]-q[0],p[1]-q[1]),start=total;total+=length;return {a,b,start,length};});
      const n=256,samples=Array.from({length:n},(_,i)=>{const d=i*total/n,e=spans.find(e=>d<e.start+e.length)??spans.at(-1)!,t=(d-e.start)/e.length;return original[e.a].map((v,k)=>v+(original[e.b][k]-v)*t) as XYZ;});
      const mean=[0,1,2].map(k=>samples.reduce((s,p)=>s+p[k]/n,0)),modes=Array.from({length:opening.role==='neck'?3:1},(_,i)=>[0,1,2].map(k=>[0,1].map(sine=>samples.reduce((s,p,j)=>s+2*p[k]/n*(sine?Math.sin((i+1)*j*2*Math.PI/n):Math.cos((i+1)*j*2*Math.PI/n)),0))));
      for(const e of spans){const angle=e.start/total*2*Math.PI,p=mean.map((v,k)=>v+modes.reduce((s,mode,j)=>s+mode[k][0]*Math.cos((j+1)*angle)+mode[k][1]*Math.sin((j+1)*angle),0)) as XYZ;if(opening.role==='body-hem')p[1]=mean[1];cleanBoundary.set(e.a,p);}
      if(opening.role==='neck'){
        // All currently assembled templates declare round/scoop necklines.
        // Keep the separate front/back depths of the source pose: a single
        // planar ellipse would lift the front into a raised circular hole.
        // This support regularises the illustration only, never the CAD.
        const loop=spans.flatMap(e=>[original[e.a],original[e.b]]),lo=Math.min(...loop.map(p=>p[0])),hi=Math.max(...loop.map(p=>p[0])),cx=(lo+hi)/2,rx=(hi-lo)/2,top=Math.max(...loop.map(p=>p[1]));
        for(const back of [false,true]){
          const entries=opening.edges.filter(e=>source.surfaces.find(s=>s.id===e.surfaceId)!.sourceId.endsWith('.back')===back),points=entries.map(e=>original[ids.get(source.surfaces.find(s=>s.id===e.surfaceId)!.simulationIds[e.a])!]);
          const depth=top-Math.min(...points.map(p=>p[1])),rz=Math.max(...points.map(p=>Math.abs(p[2])));
          for(const e of entries){const id=ids.get(source.surfaces.find(s=>s.id===e.surfaceId)!.simulationIds[e.a])!,p=original[id],u=Math.max(-1,Math.min(1,(p[0]-cx)/rx)),r=Math.max(0,1-u*u);cleanBoundary.set(id,[p[0],top-depth*r,(back?-1:1)*rz*Math.sqrt(r)]);}
        }
      }
    }
    const displayCreases:Array<[number,number]>=[];
    for(const opening of source.openings??[])for(const e of opening.edges){const s=source.surfaces.find(s=>s.id===e.surfaceId)!;displayCreases.push([ids.get(s.simulationIds[e.a])!,ids.get(s.simulationIds[e.b])!]);}
    for(const seam of source.seams.filter(s=>s.id.startsWith('cap-'))){
      if(!seam.path)continue;const refs=seam.path.map(r=>{const s=source.surfaces.find(s=>s.id===r.surfaceId)!;return {id:ids.get(s.simulationIds[r.vertex])!,uv:s.localMm[r.vertex]};});let total=0;
      const spans=refs.slice(0,-1).map((p,i)=>{const q=refs[i+1],start=total,length=Math.hypot(q.uv[0]-p.uv[0],q.uv[1]-p.uv[1]);total+=length;displayCreases.push([p.id,q.id]);return {a:p.id,b:q.id,length,start};});
      const n=256,samples=Array.from({length:n},(_,i)=>{const d=i*total/n,e=spans.find(e=>d<e.start+e.length)??spans.at(-1)!,t=(d-e.start)/e.length;return original[e.a].map((v,k)=>v+(original[e.b][k]-v)*t) as XYZ;});
      const mean=[0,1,2].map(k=>samples.reduce((s,p)=>s+p[k]/n,0)),modes=Array.from({length:3},(_,i)=>[0,1,2].map(k=>[0,1].map(sine=>samples.reduce((s,p,j)=>s+2*p[k]/n*(sine?Math.sin((i+1)*j*2*Math.PI/n):Math.cos((i+1)*j*2*Math.PI/n)),0))));
      for(const e of spans){const angle=e.start/total*2*Math.PI;cleanBoundary.set(e.a,mean.map((v,k)=>v+modes.reduce((s,mode,j)=>s+mode[k][0]*Math.cos((j+1)*angle)+mode[k][1]*Math.sin((j+1)*angle),0)) as XYZ);}
    }
    for(const seam of source.seams.filter(s=>s.id.startsWith('shoulder-'))){
      if(!seam.path)continue;const refs=seam.path.map(r=>{const s=source.surfaces.find(s=>s.id===r.surfaceId)!;return {id:ids.get(s.simulationIds[r.vertex])!,uv:s.localMm[r.vertex]};}),first=refs[0],last=refs.at(-1)!,a=cleanBoundary.get(first.id)??original[first.id],b=cleanBoundary.get(last.id)??original[last.id],length=Math.hypot(last.uv[0]-first.uv[0],last.uv[1]-first.uv[1]);
      for(const [i,r]of refs.entries()){const t=Math.hypot(r.uv[0]-first.uv[0],r.uv[1]-first.uv[1])/length;cleanBoundary.set(r.id,a.map((v,k)=>v+(b[k]-v)*t) as XYZ);if(i)displayCreases.push([refs[i-1].id,r.id]);}
    }
    let points=original.map(p=>[...p] as XYZ);
    for(let iteration=0;iteration<32;iteration++)for(const coefficient of [.5,-.53]){
      const before=points;points=before.map((p,i)=>{const pinned=cleanBoundary.get(i);if(pinned)return [...pinned];const ns=adj[i];if(!ns.length)return p;return p.map((v,k)=>v+coefficient*(ns.reduce((sum,j)=>sum+before[j][k],0)/ns.length-v)) as XYZ;});
    }
    for(const opening of source.openings?.filter(o=>o.role==='body-hem')??[]){
      for(const e of opening.edges){const s=source.surfaces.find(s=>s.id===e.surfaceId)!,hemY=s.localMm[e.a][1],target=cleanBoundary.get(ids.get(s.simulationIds[e.a])!)!;
        for(let i=0;i<s.localMm.length;i++){const d=hemY-s.localMm[i][1];if(d>=0&&d<50){const id=ids.get(s.simulationIds[i])!,weight=1-d/50;points[id][1]=points[id][1]*(1-weight)+(target[1]+d)*weight;}}
      }
      // Preserve the affine height field near a horizontal hem when display
      // subdivision runs. Moving only its irregular original vertices would
      // otherwise turn a straight double-needle line into a wavy polyline.
      for(const surfaceId of new Set(opening.edges.map(e=>e.surfaceId))){
        const s=source.surfaces.find(s=>s.id===surfaceId)!,hemY=Math.max(...opening.edges.filter(e=>e.surfaceId===surfaceId).map(e=>s.localMm[e.a][1]));
        for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){
          const a=s.triangles[t+k],b=s.triangles[t+(k+1)%3];
          if(s.localMm[a][1]>hemY-50&&s.localMm[b][1]>hemY-50)displayCreases.push([ids.get(s.simulationIds[a])!,ids.get(s.simulationIds[b])!]);
        }
      }
    }
    // Keep the same overall envelope so the illustrative pose does not change
    // garment width/height/depth simply because its mesh was regularised.
    for(let k=0;k<3;k++){
      const min=Math.min(...original.map(p=>p[k])),max=Math.max(...original.map(p=>p[k])),lo=Math.min(...points.map(p=>p[k])),hi=Math.max(...points.map(p=>p[k]));
      if(hi-lo>1e-8)for(const p of points)p[k]=min+(p[k]-lo)*(max-min)/(hi-lo);
    }
    const maxDisplacementMm=Math.max(...points.map((p,i)=>Math.hypot(...p.map((v,k)=>v-original[i][k]))));
    fair={model:{...source,displayCreases,surfaces:surfaces.map(s=>({...s,positionsMm:s.simulationIds.map(id=>points[id])}))},maxDisplacementMm};cache.set(source,fair);
  }
  const display=createGarmentDisplay(fair.model,settings);
  return {...display,source,illustration:{mode:'technical-illustration',fairingPasses:32,maxDisplacementMm:fair.maxDisplacementMm}};
}
