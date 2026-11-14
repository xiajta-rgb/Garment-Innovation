import type { GarmentOpening,GarmentPathEdge,GarmentSurface } from '@/types/garment3d';
import type { PatternMesh3d } from '@/types/pattern3d';
import { edgeArcLength } from './edge-arclength';
const key=(a:number,b:number)=>[Math.min(a,b),Math.max(a,b)].join(':');
/** Open loops inherit explicit CAD boundary roles; no world-height guessing. */
export function garmentOpenings(source:PatternMesh3d,surfaces:GarmentSurface[]):GarmentOpening[]{
  const incidence=new Map<string,Array<GarmentPathEdge>>();
  for(const s of surfaces)for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){
    const a=s.triangles[t+k],b=s.triangles[t+(k+1)%3],id=key(s.simulationIds[a],s.simulationIds[b]);
    incidence.set(id,[...(incidence.get(id)??[]),{surfaceId:s.id,a,b,inside:s.triangles[t+(k+2)%3]}]);
  }
  const open=new Map([...incidence].filter(([,es])=>es.length===1).map(([id,es])=>[id,es[0]])),loops:GarmentOpening[]=[];
  const surface=(id:string)=>surfaces.find(s=>s.id===id)!;
  while(open.size){
    const first=open.values().next().value!,start=surface(first.surfaceId).simulationIds[first.a],edges:GarmentPathEdge[]=[];let current=start;
    do{
      const entry=[...open].find(([,e])=>{const s=surface(e.surfaceId);return s.simulationIds[e.a]===current||s.simulationIds[e.b]===current;});
      if(!entry)throw Error('开口边界无法闭合');const [id,e]=entry,s=surface(e.surfaceId),edge=s.simulationIds[e.a]===current?e:{...e,a:e.b,b:e.a};
      open.delete(id);edges.push(edge);current=s.simulationIds[edge.b];
    }while(current!==start);
    const roles=new Set<GarmentOpening['role']>(),refs=new Map<string,{piece:string;boundary:string;sides:Set<string>}>();
    for(const e of edges){const s=surface(e.surfaceId);for(const i of [e.a,e.b]){
      const edgeId=s.boundarySourceEdges?.[i],b=source.sourceAssembly.boundaries.find(b=>b.piece===s.sourceId&&b.edgeIds.includes(edgeId??'')&&(['neckline','hem','armhole'].includes(b.role)||(b.role==='binding-insertion'&&['neck','armhole'].includes(b.id))));
      if(!b)continue;const role=b.role==='neckline'||b.id==='neck'?'neck':b.role==='armhole'||b.id==='armhole'?'armhole':/sleeve/.test(s.sourceId)?'sleeve-hem':'body-hem';roles.add(role);
      const k=`${s.sourceId}/${b.id}`,ref=refs.get(k)??{piece:s.sourceId,boundary:b.id,sides:new Set<string>()},p=s.localMm[i],axis=s.foldAxis;
      const half=axis?Math.sign(((axis[1][0]-axis[0][0])*(p[1]-axis[0][1])-(axis[1][1]-axis[0][1])*(p[0]-axis[0][0]))*s.sourceHalfSign):1;
      if(half)ref.sides.add(String(half));refs.set(k,ref);
    }}
    if(roles.size!==1)throw Error('开口没有唯一源裁片部位身份');const role=[...roles][0],sourceBoundaries=[...refs.values()].map(r=>({piece:r.piece,boundary:r.boundary,runs:r.sides.size||1}));
    if(role==='neck'){
      const backCenter=edges.findIndex(e=>{const s=surface(e.surfaceId),axis=s.foldAxis,p=s.localMm[e.a];return s.sourceId.endsWith('.back')&&axis&&Math.abs((axis[1][0]-axis[0][0])*(p[1]-axis[0][1])-(axis[1][1]-axis[0][1])*(p[0]-axis[0][0]))<1e-5;});
      if(backCenter>=0)edges.push(...edges.splice(0,backCenter));
    }
    const sourceLengthMm=sourceBoundaries.reduce((sum,r)=>{const p=source.panels.find(p=>p.sourceId===r.piece)!,b=source.sourceAssembly.boundaries.find(b=>b.piece===r.piece&&b.id===r.boundary)!;return sum+r.runs*b.edgeIds.reduce((n,id)=>n+edgeArcLength(p.sourceEdges.find(e=>e.id===id)!),0);},0);
    loops.push({id:`${role}-${loops.filter(l=>l.role===role).length+1}`,role,edges,sourceLengthMm,sourceBoundaries});
  }
  return loops;
}
