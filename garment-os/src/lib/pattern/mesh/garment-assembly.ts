import cdt2d from 'cdt2d';
import { edgePoint,reflect,sampleEdge } from './panel-mesh';
import { edgeArcLength,edgeParameterAtLength } from './edge-arclength';
import type { AssemblyEdge } from '@/types/assembly';
import type { PanelMesh,PatternMesh3d,XY,XYZ } from '@/types/pattern3d';
import type { GarmentAssembly3d,GarmentSurface } from '@/types/garment3d';
import { garmentOpenings } from './garment-openings';
import { supportsGarmentAssembly } from '@/data/templateCapabilities';
export { supportsGarmentAssembly } from '@/data/templateCapabilities';

type Trace={sourceMm:XY;localMm:XY;sourceEdge:string;t:number;mirrored:boolean};
type Port={panel:string;boundary:string;mirror?:boolean;reverse?:boolean};
type Stitch={id:string;join:string;a:Port[];b:Port[]};
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((n,k)=>n-b[k]));
const key=(p:XY)=>p.map(v=>Math.round(v*1e7)).join(':');
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const cross=(a:XY,b:XY,c:XY)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

function plan(model:PatternMesh3d):Stitch[]{
  const front=model.panels.find(p=>p.sourceId.endsWith('.front'))!,back=model.panels.find(p=>p.sourceId.endsWith('.back'))!;
  const sleeve=model.panels.filter(p=>/sleeve/.test(p.sourceId)),out:Stitch[]=[];
  for(const [side,mirror] of [['right',false],['left',true]] as const){
    for(const boundary of ['side','shoulder'])out.push({id:`${boundary}-${side}`,join:boundary==='side'?'sides':'shoulders',
      a:[{panel:front.id,boundary,mirror}],b:[{panel:back.id,boundary,mirror}]});
    const s=sleeve[mirror?1:0];if(!s)continue;
    out.push({id:`underarm-${side}`,join:'underarms',a:[{panel:s.id,boundary:'underarm-left'}],b:[{panel:s.id,boundary:'underarm-right',reverse:true}]},
      {id:`cap-${side}`,join:`sleevecap-${mirror?'left':'right'}`,a:[{panel:s.id,boundary:'cap'}],
        b:[{panel:front.id,boundary:'armhole',mirror},{panel:back.id,boundary:'armhole',mirror,reverse:true}]});
  }
  return out;
}

/** Ordered stations from explicit source assembly boundaries, never nearest-edge guessing. */
function chain(model:PatternMesh3d,ports:Port[]){
  const segments:Array<{panel:PanelMesh;edge:AssemblyEdge;from:Trace;to:Trace;start:number;length:number}>=[];
  let total=0;const portStarts:number[]=[];
  for(const port of ports){
    portStarts.push(total);
    const panel=model.panels.find(p=>p.id===port.panel)!,boundary=model.sourceAssembly.boundaries.find(b=>b.piece===panel.sourceId&&b.id===port.boundary);
    if(!boundary)throw new Error(`缺少组装配缝边界 ${port.panel}/${port.boundary}`);
    let traces:Trace[]=[];
    for(const id of boundary.edgeIds){
      const edge=panel.sourceEdges.find(e=>e.id===id)!;
      const fold=model.sourceAssembly.boundaries.find(b=>b.piece===panel.sourceId&&b.disposition==='fold');
      const axis=fold?panel.sourceEdges.find(e=>e.id===fold.edgeIds[0]):undefined;
      traces.push(...sampleEdge(edge).map(({t,point})=>({sourceMm:point,localMm:port.mirror&&axis?reflect(point,[axis.from.x,axis.from.y],[axis.to.x,axis.to.y]):point,sourceEdge:id,t,mirrored:!!port.mirror})));
    }
    if(port.reverse)traces=traces.reverse();
    for(let i=1;i<traces.length;i++){
      if(traces[i-1].sourceEdge!==traces[i].sourceEdge)continue;
      const edge=panel.sourceEdges.find(e=>e.id===traces[i].sourceEdge)!,length=edgeArcLength(edge,traces[i-1].t,traces[i].t);if(length<1e-8)continue;
      segments.push({panel,edge,from:traces[i-1],to:traces[i],start:total,length});total+=length;
    }
  }
  if(total<1)throw new Error('组装配缝长度无效');
  const at=(fraction:number)=>{
    const target=clamp(fraction)*total,segment=segments.find(s=>target<=s.start+s.length+1e-9)??segments.at(-1)!;
    const edge=segment.edge,t=edgeParameterAtLength(edge,segment.from.t,segment.to.t,Math.max(0,Math.min(segment.length,target-segment.start)),segment.length);
    const sourceMm=edgePoint(edge,t);let localMm=sourceMm;
    if(segment.from.mirrored){const fold=model.sourceAssembly.boundaries.find(b=>b.piece===segment.panel.sourceId&&b.disposition==='fold')!,axis=segment.panel.sourceEdges.find(e=>e.id===fold.edgeIds[0])!;localMm=reflect(sourceMm,[axis.from.x,axis.from.y],[axis.to.x,axis.to.y]);}
    return {panel:segment.panel.id,trace:{...segment.from,t,sourceMm,localMm}};
  };
  return {total,at,portFractions:[0,1,...portStarts.map(start=>start/total)]};
}

function inside(p:XY,polygon:XY[]){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
const segmentDistance=(p:XY,a:XY,b:XY)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1));return distance(p,[a[0]+t*dx,a[1]+t*dy]);};

function remesh(panel:PanelMesh,extra:Trace[],sewnEdges:Set<string>):GarmentSurface{
  // Preserve the actual boundary traversal, including the reflected half. Add all
  // paired seam stations before triangulation so stitches are real mesh vertices.
  const groups:Array<{edge:string;mirror:boolean;traces:Trace[]}>=[];
  for(const v of panel.vertices){let group=groups.at(-1);if(!group||group.edge!==v.sourceEdge||group.mirror!==v.mirrored){group={edge:v.sourceEdge,mirror:v.mirrored,traces:[]};groups.push(group);}group.traces.push(v);}
  const localMm:XY[]=[],boundarySourceEdges:string[]=[],seen=new Set<string>();
  for(const group of groups){
    // Sewn boundaries use only their shared arclength stations. Independent
    // adaptive curve points must not create unmatched seam vertices/slivers.
    const traces=[...(sewnEdges.has(`${group.edge}:${group.mirror}`)?[]:group.traces),...extra.filter(v=>v.sourceEdge===group.edge&&v.mirrored===group.mirror)].sort((a,b)=>(a.t-b.t)*(group.mirror?-1:1));
    for(const v of traces)if(!seen.has(key(v.localMm))){seen.add(key(v.localMm));if(!localMm.length||distance(localMm.at(-1)!,v.localMm)>=1e-5){localMm.push([...v.localMm]);boundarySourceEdges.push(v.sourceEdge);}}
  }
  if(distance(localMm[0],localMm.at(-1)!)<1e-5){localMm.pop();boundarySourceEdges.pop();}
  const boundary=localMm.map((_,i)=>i),edges=boundary.map((i)=>[i,(i+1)%boundary.length]);
  const min=[0,1].map(k=>Math.min(...localMm.map(p=>p[k]))),max=[0,1].map(k=>Math.max(...localMm.map(p=>p[k]))),polygon=[...localMm];
  const step=24;
  for(let y=min[1]+step*.63;y<max[1];y+=step*Math.sqrt(3)/2)for(let x=min[0]+step*.43+Math.round(y/step)%2*step/2;x<max[0];x+=step){
    const p:XY=[x,y];if(inside(p,polygon)&&polygon.every((a,i)=>segmentDistance(p,a,polygon[(i+1)%polygon.length])>.8))localMm.push(p);
  }
  const triangles=cdt2d(localMm,edges,{interior:true,exterior:false,delaunay:true}).filter(t=>Math.abs(cross(localMm[t[0]],localMm[t[1]],localMm[t[2]]))>1e-8).flat();
  if(!triangles.length)throw new Error('成衣曲面内部网格生成失败');
  return {id:panel.id,sourceId:panel.sourceId,copy:panel.copy,localMm,uvMm:localMm.map(p=>[...p]),triangles,boundary,boundarySourceEdges,positionsMm:[],simulationIds:[],foldAxis:null,sourceHalfSign:0};
}

/** Geometric sewing/relaxation preview, not a calibrated textile simulation.
 * cdt2d supplies constrained Delaunay internal meshes; source joins supply the
 * stitch graph. Distance projection follows the PBD method; pose tethers are
 * display supports, not a body scan or measured material constitutive model.
 */
export function assembleGarment(model:PatternMesh3d):GarmentAssembly3d{
  if(model.unit!=='mm'||!model.sourceAssembly.integrityPass||model.sourceAssembly.status==='blocked')throw new Error('源裁片装配检查未通过');
  if(!supportsGarmentAssembly(model.templateId))throw new Error('此款的三维配缝规则尚未接通，请选择基型、针织上衣或包边背心范例。');
  const stitches=plan(model),extras=new Map(model.panels.map(p=>[p.id,[] as Trace[]])),sewnEdges=new Map(model.panels.map(p=>[p.id,new Set<string>()]));
  for(const stitch of stitches)for(const port of [...stitch.a,...stitch.b]){
    const panel=model.panels.find(p=>p.id===port.panel)!,boundary=model.sourceAssembly.boundaries.find(b=>b.piece===panel.sourceId&&b.id===port.boundary)!;
    for(const edge of boundary.edgeIds)sewnEdges.get(port.panel)!.add(`${edge}:${!!port.mirror}`);
  }
  const pairs=stitches.map(stitch=>{
    const a=chain(model,stitch.a),b=chain(model,stitch.b),knots=[...new Set([...a.portFractions,...b.portFractions])].sort((x,y)=>x-y),fractions:number[]=[];
    const append=(from:number,to:number,depth=0)=>{
      const flat=[a,b].every(c=>{const p=c.at(from).trace.localMm,q=c.at(to).trace.localMm;return [.25,.5,.75].every(t=>segmentDistance(c.at(from+(to-from)*t).trace.localMm,p,q)<=.05);});
      if(flat){fractions.push(from);return;}if(depth>=16)throw Error('配缝曲率采样未收敛');const mid=(from+to)/2;append(from,mid,depth+1);append(mid,to,depth+1);
    };
    for(let i=1;i<knots.length;i++){const start=knots[i-1],span=knots[i]-start,n=Math.max(1,Math.ceil(Math.max(a.total,b.total)*span/8));for(let j=0;j<n;j++)append(start+span*j/n,start+span*(j+1)/n);}fractions.push(1);
    return {stitch,stations:fractions.map(f=>{const sa=a.at(f),sb=b.at(f);extras.get(sa.panel)!.push(sa.trace);extras.get(sb.panel)!.push(sb.trace);return [sa,sb] as const;})};
  });
  const panels=model.panels.filter(p=>p.sourceId.endsWith('.front')||p.sourceId.endsWith('.back')||/sleeve/.test(p.sourceId));
  const surfaces=panels.map(p=>remesh(p,extras.get(p.id)!,sewnEdges.get(p.id)!));
  let maxBoundaryDeviationMm=0;
  for(const surface of surfaces){const original=panels.find(p=>p.id===surface.id)!.vertices.map(v=>v.localMm),polygon=surface.boundary.map(i=>surface.localMm[i]);
    for(const [points,outline]of [[original,polygon],[polygon,original]])for(const p of points)maxBoundaryDeviationMm=Math.max(maxBoundaryDeviationMm,Math.min(...outline.map((a,i)=>segmentDistance(p,a,outline[(i+1)%outline.length]))));
  }
  if(maxBoundaryDeviationMm>.5)throw Error('组装网格与源采样轮廓偏离超过0.5mm');
  for(const surface of surfaces){const panel=panels.find(p=>p.id===surface.id)!;if(!panel.unfolded)continue;const fold=model.sourceAssembly.boundaries.find(b=>b.piece===panel.sourceId&&b.disposition==='fold')!,edge=panel.sourceEdges.find(e=>e.id===fold.edgeIds[0])!;
    surface.foldAxis=[[edge.from.x,edge.from.y],[edge.to.x,edge.to.y]];const v=panel.vertices.find(v=>!v.mirrored&&Math.abs(cross(surface.foldAxis![0],surface.foldAxis![1],v.localMm))>1e-6)!;surface.sourceHalfSign=Math.sign(cross(surface.foldAxis[0],surface.foldAxis[1],v.localMm));}
  let maxBoundarySnapMm=0;
  const stationIndex=(id:string,point:XY)=>{const surface=surfaces.find(s=>s.id===id)!;let best=-1,d=Infinity;for(const i of surface.boundary){const gap=distance(point,surface.localMm[i]);if(gap<d){d=gap;best=i;}}if(d>1e-4)throw new Error(`配缝站位超出网格边界：${id}`);maxBoundarySnapMm=Math.max(maxBoundarySnapMm,d);return best;};
  let count=0;for(const surface of surfaces){surface.simulationIds=surface.localMm.map(()=>count++);}
  const parents=Array.from({length:count},(_,i)=>i),root=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const seams=pairs.map(({stitch,stations})=>{
    const seamPairs:Array<[number,number]>=[],path:Array<{surfaceId:string;vertex:number}>=[];
    for(const [a,b]of stations){
      const ai=stationIndex(a.panel,a.trace.localMm),bi=stationIndex(b.panel,b.trace.localMm);
      const sa=surfaces.find(s=>s.id===a.panel)!,sb=surfaces.find(s=>s.id===b.panel)!;
      parents[root(sb.simulationIds[bi])]=root(sa.simulationIds[ai]);seamPairs.push([sa.simulationIds[ai],sb.simulationIds[bi]]);
      path.push({surfaceId:sa.id,vertex:ai});
    }
    return {id:stitch.id,sourceJoinId:stitch.join,aPanels:[...new Set(stitch.a.map(p=>p.panel))],bPanels:[...new Set(stitch.b.map(p=>p.panel))],pairs:seamPairs,maxGapMm:0,path};
  });
  const front=surfaces.find(s=>s.sourceId.endsWith('.front'))!,frontPanel=panels.find(p=>p.id===front.id)!;
  const side=model.sourceAssembly.boundaries.find(b=>b.piece===front.sourceId&&b.id==='side')!,sideEdges=side.edgeIds.map(id=>frontPanel.sourceEdges.find(e=>e.id===id)!);
  const shoulder=model.sourceAssembly.boundaries.find(b=>b.piece===front.sourceId&&b.id==='shoulder')!,shoulderEdge=frontPanel.sourceEdges.find(e=>e.id===shoulder.edgeIds[0])!;
  const underarmY=sideEdges.at(-1)!.to.y,topShoulder=shoulderEdge.from,neckShoulder=shoulderEdge.to;
  const widthAt=(y:number)=>{const edge=sideEdges.find(e=>y>=Math.min(e.from.y,e.to.y)&&y<=Math.max(e.from.y,e.to.y));if(!edge)return y<underarmY?sideEdges.at(-1)!.to.x:sideEdges[0].from.x;let lo=0,hi=1;for(let i=0;i<25;i++){const t=(lo+hi)/2,py=edgePoint(edge,t)[1];if((edge.to.y>edge.from.y)===(py<y))lo=t;else hi=t;}return edgePoint(edge,(lo+hi)/2)[0];};
  const bodyPose=(p:XY,back:boolean):XYZ=>{
    const width=widthAt(p[1]),a=p[0]/width*Math.PI/2;
    const shoulderY=neckShoulder.y+(topShoulder.y-neckShoulder.y)*(Math.abs(p[0])-neckShoulder.x)/(topShoulder.x-neckShoulder.x);
    const blend=clamp((p[1]-shoulderY)/Math.max(30,underarmY-shoulderY)),lateral=blend*blend*(3-2*blend),round=Math.sqrt(blend*(2-blend));
    // A shallow elliptical torso with a rounded shoulder transition is an
    // illustration support, not measured body geometry. A circular tube with
    // linear depth collapsed the shoulders into a cone in the side view and
    // narrowed the front silhouette to 2/PI of the source panel width.
    return [(1-lateral)*p[0]+lateral*width*.87*Math.sin(a),-p[1],(back?-1:1)*round*width*.4*Math.cos(a)];
  };
  const sleevePoses=new Map<string,(p:XY)=>XYZ>(),backId=surfaces.find(s=>s.sourceId.endsWith('.back'))!.id;
  for(const surface of surfaces.filter(s=>/sleeve/.test(s.sourceId))){
    const panel=panels.find(p=>p.id===surface.id)!,under=model.sourceAssembly.boundaries.find(b=>b.piece===surface.sourceId&&b.id==='underarm-right')!,edge=panel.sourceEdges.find(e=>e.id===under.edgeIds[0])!;
    const cap=pairs.find(p=>p.stitch.id===`cap-${surface.copy===1?'right':'left'}`)!;
    const samples=cap.stations.map(([a,b])=>({point:a.trace.localMm,world:bodyPose(b.trace.localMm,b.panel===backId)})).sort((a,b)=>a.point[0]-b.point[0]);
    const bicepsHalf=Math.abs(edge.to.x),cuffHalf=Math.abs(edge.from.x),bicepsY=edge.to.y,hemY=edge.from.y,length=hemY-bicepsY;
    const at=(u:number)=>{const x=Math.max(-1,Math.min(1,u))*bicepsHalf,i=samples.findIndex(p=>p.point[0]>=x),b=samples[Math.max(0,i<0?samples.length-1:i)],a=samples[Math.max(0,(i<0?samples.length-1:i)-1)],t=clamp((x-a.point[0])/(b.point[0]-a.point[0]||1));
      return {y:a.point[1]+(b.point[1]-a.point[1])*t,world:a.world.map((v,k)=>v+(b.world[k]-v)*t) as XYZ};};
    const center:XYZ=[0,0,0],n=64;for(let i=0;i<n;i++){const q=at(-1+2*i/n).world;for(let k=0;k<3;k++)center[k]+=q[k]/n;}
    const sideSign=surface.copy===1?1:-1,axialLength=length+(bicepsY-Math.min(...samples.map(p=>p.point[1])))*.5;
    // Design-sheet neutral pose: long sleeves hang with a small clearance from
    // the torso; short sleeves remain readable. This changes the pose, not CAD.
    const angle=(length>240?68:48)*Math.PI/180,axis:XYZ=[sideSign*Math.cos(angle),-Math.sin(angle),0],up:XYZ=[sideSign*Math.sin(angle),Math.cos(angle),0],radius=cuffHalf/Math.PI;
    const cuffCenter=center.map((v,k)=>v+axis[k]*axialLength) as XYZ;
    // The cap starts on its authored armhole chain. Extend towards a cuff ring
    // instead of seeding a separate cylinder that crosses the torso and folds
    // the cap inwards before relaxation. This remains a geometric pose support.
    sleevePoses.set(surface.id,p=>{const half=bicepsHalf+(cuffHalf-bicepsHalf)*clamp((p[1]-bicepsY)/(length||1)),u=Math.max(-1,Math.min(1,p[0]/half)),q=at(u),t=clamp((p[1]-q.y)/(hemY-q.y)),angle=u*Math.PI;
      const cuff=cuffCenter.map((v,k)=>v+up[k]*radius*Math.cos(angle)+(k===2?radius*Math.sin(angle):0));return q.world.map((v,k)=>v+(cuff[k]-v)*t) as XYZ;});
  }
  const initial:Array<XYZ>=Array.from({length:count},()=>[0,0,0]),weights=new Float64Array(count);
  for(const surface of surfaces)for(let i=0;i<surface.localMm.length;i++){
    const p=surface.localMm[i];let pose:XYZ;
    if(!/sleeve/.test(surface.sourceId))pose=bodyPose(p,surface.sourceId.endsWith('.back'));
    else pose=sleevePoses.get(surface.id)!(p);
    const id=root(surface.simulationIds[i]);for(let k=0;k<3;k++)initial[id][k]+=pose[k];weights[id]++;
  }
  for(let i=0;i<count;i++)if(weights[i])for(let k=0;k<3;k++)initial[i][k]/=weights[i];
  const positions=initial.map(p=>[...p] as XYZ),constraints:Array<{a:number;b:number;rest:number;stiffness:number}>=[],dedupe=new Set<string>();
  for(const surface of surfaces){
    const adj=new Map<string,{a:number;b:number;opposite:number}>();
    for(let t=0;t<surface.triangles.length;t+=3)for(let j=0;j<3;j++){
      const a=surface.triangles[t+j],b=surface.triangles[t+(j+1)%3],opposite=surface.triangles[t+(j+2)%3],ia=root(surface.simulationIds[a]),ib=root(surface.simulationIds[b]);
      if(ia===ib)continue;const edgeKey=[Math.min(ia,ib),Math.max(ia,ib)].join(':');
      if(!dedupe.has(edgeKey)){dedupe.add(edgeKey);constraints.push({a:ia,b:ib,rest:distance(surface.localMm[a],surface.localMm[b]),stiffness:.8});}
      const localKey=[Math.min(a,b),Math.max(a,b)].join(':'),previous=adj.get(localKey);
      if(previous){const ic=root(surface.simulationIds[previous.opposite]),id=root(surface.simulationIds[opposite]);if(ic!==id)constraints.push({a:ic,b:id,rest:distance(initial[ic],initial[id]),stiffness:.015});}
      else adj.set(localKey,{a,b,opposite});
    }
  }
  const iterations=300;
  for(let iteration=0;iteration<iterations;iteration++){
    for(let i=0;i<count;i++)if(weights[i])for(let k=0;k<3;k++)positions[i][k]+=(initial[i][k]-positions[i][k])*.0007;
    for(const c of constraints){const a=positions[c.a],b=positions[c.b],d=distance(a,b);if(d<1e-10)continue;const factor=(d-c.rest)/d*.5*c.stiffness;for(let k=0;k<3;k++){const delta=(b[k]-a[k])*factor;a[k]+=delta;b[k]-=delta;}}
  }
  const strain:number[]=[];
  let areaError=0;
  for(const surface of surfaces){surface.simulationIds=surface.simulationIds.map(root);surface.positionsMm=surface.simulationIds.map(id=>[...positions[id]]);surface.triangles=Array.from({length:surface.triangles.length/3},(_,i)=>surface.triangles.slice(i*3,i*3+3)).filter(ids=>new Set(ids.map(i=>surface.simulationIds[i])).size===3).flat();const panel=panels.find(p=>p.id===surface.id)!;
    let area=0;for(let t=0;t<surface.triangles.length;t+=3)area+=Math.abs(cross(...surface.triangles.slice(t,t+3).map(i=>surface.localMm[i]) as [XY,XY,XY]))/2;
    areaError=Math.max(areaError,Math.abs(area-panel.metrics.polygonAreaMm2)/panel.metrics.polygonAreaMm2);
    // Each source panel owns its rest lengths, including both sides of a seam.
    // Solver deduplication must not hide the other panel's deformation.
    const measured=new Set<string>();for(let t=0;t<surface.triangles.length;t+=3)for(let k=0;k<3;k++){
      const a=surface.triangles[t+k],b=surface.triangles[t+(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');if(measured.has(key))continue;measured.add(key);
      strain.push(Math.abs(distance(surface.positionsMm[a],surface.positionsMm[b])/distance(surface.localMm[a],surface.localMm[b])-1));
    }
  }
  strain.sort((a,b)=>a-b);
  if(surfaces.some(s=>s.positionsMm.some(p=>p.some(v=>!Number.isFinite(v))))||areaError>.001)throw new Error('三维组装坐标或源面积检查未通过');
  const edgeCounts=new Map<string,number>(),adj=new Map<number,Set<number>>();
  for(const s of surfaces)for(let t=0;t<s.triangles.length;t+=3)for(let j=0;j<3;j++){const a=s.simulationIds[s.triangles[t+j]],b=s.simulationIds[s.triangles[t+(j+1)%3]],k=[Math.min(a,b),Math.max(a,b)].join(':');edgeCounts.set(k,(edgeCounts.get(k)??0)+1);if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a)!.add(b);adj.get(b)!.add(a);}
  const components=(graph:Map<number,Set<number>>)=>{let n=0;const seen=new Set<number>();for(const id of graph.keys())if(!seen.has(id)){n++;const stack=[id];while(stack.length){const next=stack.pop()!;if(seen.has(next))continue;seen.add(next);for(const neighbour of graph.get(next)??[])stack.push(neighbour);}}return n;};
  const open=new Map<number,Set<number>>();for(const [k,n]of edgeCounts)if(n===1){const [a,b]=k.split(':').map(Number);if(!open.has(a))open.set(a,new Set());if(!open.has(b))open.set(b,new Set());open.get(a)!.add(b);open.get(b)!.add(a);}
  const maxSeamGapMm=Math.max(0,...seams.map(s=>{s.maxGapMm=Math.max(...s.pairs.map(([a,b])=>distance(positions[root(a)],positions[root(b)])));return s.maxGapMm;}));
  const connectedComponents=components(adj),nonManifoldEdges=[...edgeCounts.values()].filter(n=>n>2).length,boundaryLoops=components(open);
  if(connectedComponents!==1||nonManifoldEdges||boundaryLoops!==4)throw new Error('成衣连接拓扑不完整，已阻断显示');
  return {schema:'garment-os/garment-assembly/v1',templateId:model.templateId,unit:'mm',stage:'seam-constrained-preview',surfaces,seams,openings:garmentOpenings(model,surfaces),sourcePanelCount:model.panels.length,
    unassembledPanelIds:model.panels.filter(p=>!panels.includes(p)).map(p=>p.id),quality:{vertices:surfaces.reduce((n,s)=>n+s.localMm.length,0),triangles:surfaces.reduce((n,s)=>n+s.triangles.length/3,0),iterations,strainP95:strain[Math.floor(strain.length*.95)]??0,maxStrain:strain.at(-1)??0,maxSeamGapMm,connectedComponents,remeshAreaErrorRatio:areaError,nonManifoldEdges,boundaryLoops,maxBoundarySnapMm,maxBoundaryDeviationMm},
    pending:['当前为配缝约束与姿态支撑下的组装预览，未标定面料物性、人体碰撞、自碰撞或重力垂坠。','源二维净样与UV保留毫米坐标；显示曲面存在形变，实际形变指标单独列出，不能按三维表面反写生产尺寸。',...(model.templateId==='bound-tank'?['三条四折包条尚缺完成态规则，本次只缝合前后衣身，未将包条冒充已装配。']:['领口/下摆的工艺翻折、缝份和实测布厚未标定；显示布厚由表面设置单独控制。'])],drapeValidated:false,productionApproved:false};
}
