import type { GarmentAssembly3d,GarmentDisplay3d,GarmentDisplaySurface,GarmentSurface,GarmentSurfaceSettings } from '@/types/garment3d';
import type { XY,XYZ } from '@/types/pattern3d';

export const DEFAULT_GARMENT_SURFACE:GarmentSurfaceSettings={subdivision:1,thicknessMm:.8,roundedEdges:true};
type Face={owner:number;ids:[number,number,number]};
type Edge={a:number;b:number;faces:Array<{face:number;forward:boolean;opposite:number}>};
type Topology={points:XYZ[];faces:Face[];edges:Map<string,Edge>;neighbours:Array<Set<number>>};
const edgeKey=(a:number,b:number)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
const add=(a:XYZ,b:XYZ,scale=1):XYZ=>a.map((v,k)=>v+b[k]*scale) as XYZ;
const sub=(a:XYZ,b:XYZ):XYZ=>a.map((v,k)=>v-b[k]) as XYZ;
const mul=(a:XYZ,s:number):XYZ=>a.map(v=>v*s) as XYZ;
const cross=(a:XYZ,b:XYZ):XYZ=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:XYZ):XYZ=>{const length=Math.hypot(...a);if(length<1e-12)throw Error('曲面法线退化，已阻断精细显示');return mul(a,1/length);};

function topology(surfaces:GarmentSurface[],points:XYZ[]):Topology{
  const faces:Face[]=[],edges=new Map<string,Edge>(),neighbours=points.map(()=>new Set<number>());
  for(const [owner,surface] of surfaces.entries())for(let i=0;i<surface.triangles.length;i+=3){
    const ids=surface.triangles.slice(i,i+3).map(j=>surface.simulationIds[j]) as Face['ids'],face=faces.length;
    if(new Set(ids).size!==3)throw Error('显示网格含退化连接');faces.push({owner,ids});
    for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=edgeKey(a,b);let edge=edges.get(key);
      if(!edge){edge={a,b,faces:[]};edges.set(key,edge);}edge.faces.push({face,forward:a<b,opposite:ids[(k+2)%3]});
      if(edge.faces.length>2)throw Error('显示网格非流形');neighbours[a].add(b);neighbours[b].add(a);
    }
  }
  return {points,faces,edges,neighbours};
}

/** Orient through physical seam IDs, while retaining independent UV islands. */
function orient(surfaces:GarmentSurface[],mesh:Topology){
  const neighbours=mesh.faces.map(()=>[] as Array<[number,boolean]>);
  for(const edge of mesh.edges.values())if(edge.faces.length===2){const [a,b]=edge.faces,same=a.forward===b.forward;neighbours[a.face].push([b.face,same]);neighbours[b.face].push([a.face,same]);}
  const flips:Array<boolean|undefined>=mesh.faces.map(()=>undefined);
  for(let seed=0;seed<flips.length;seed++)if(flips[seed]===undefined){flips[seed]=false;const stack=[seed];while(stack.length){const next=stack.pop()!;for(const [j,same]of neighbours[next]){const expected=flips[next]!==same;if(flips[j]===undefined){flips[j]=expected;stack.push(j);}else if(flips[j]!==expected)throw Error('曲面方向不一致');}}}
  let frontZ=0;
  for(const [i,face]of mesh.faces.entries())if(surfaces[face.owner].sourceId.endsWith('.front')){
    const [a,b,c]=face.ids.map(j=>mesh.points[j]),normal=cross(sub(b,a),sub(c,a));frontZ+=normal[2]*(flips[i]?-1:1);
  }
  let face=0;for(const surface of surfaces)for(let t=0;t<surface.triangles.length;t+=3){if(flips[face++]!==(frontZ<0))[surface.triangles[t+1],surface.triangles[t+2]]=[surface.triangles[t+2],surface.triangles[t+1]];}
}

function refine(surfaces:GarmentSurface[],mesh:Topology,creases:Set<string>){
  const boundary=mesh.points.map(()=>[] as number[]);
  for(const edge of mesh.edges.values())if(edge.faces.length===1){boundary[edge.a].push(edge.b);boundary[edge.b].push(edge.a);}
  const points=mesh.points.map((p,i)=>{
    const ends=boundary[i];if(ends.length){if(ends.length!==2)throw Error('开口边界不是闭合环');return add(mul(p,.75),mul(add(mesh.points[ends[0]],mesh.points[ends[1]]),.125));}
    const ns=[...mesh.neighbours[i]],n=ns.length;if(n<3)throw Error('曲面顶点连接不足');const beta=n===3?3/16:3/(8*n);
    return ns.reduce((sum,j)=>add(sum,mesh.points[j],beta),mul(p,1-n*beta));
  });
  for(const edge of creases){const [a,b]=edge.split(':').map(Number);points[a]=[...mesh.points[a]];points[b]=[...mesh.points[b]];}
  const mids=new Map<string,number>();
  for(const [key,edge]of mesh.edges){
    let p=mul(add(mesh.points[edge.a],mesh.points[edge.b]),.5);
    if(edge.faces.length===2&&!creases.has(key))p=add(mul(add(mesh.points[edge.a],mesh.points[edge.b]),3/8),mul(add(mesh.points[edge.faces[0].opposite],mesh.points[edge.faces[1].opposite]),1/8));
    mids.set(key,points.length);points.push(p);
  }
  const nextCreases=[...creases].flatMap(key=>{const [a,b]=key.split(':').map(Number),mid=mids.get(key);return mid===undefined?[]:[edgeKey(a,mid),edgeKey(mid,b)];});creases.clear();for(const key of nextCreases)creases.add(key);
  for(const surface of surfaces){
    const localMids=new Map<string,number>(),triangles:number[]=[];
    const midpoint=(a:number,b:number)=>{const key=edgeKey(a,b),old=localMids.get(key);if(old!==undefined)return old;
      const index=surface.uvMm.length,uv=surface.uvMm[a].map((v,k)=>(v+surface.uvMm[b][k])/2) as XY;
      surface.uvMm.push(uv);surface.localMm.push([...uv]);surface.simulationIds.push(mids.get(edgeKey(surface.simulationIds[a],surface.simulationIds[b]))!);localMids.set(key,index);return index;};
    for(let t=0;t<surface.triangles.length;t+=3){const [a,b,c]=surface.triangles.slice(t,t+3),ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangles.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
    surface.triangles=triangles;surface.positionsMm=surface.simulationIds.map(id=>points[id]);
  }
  return topology(surfaces,points);
}

const cache=new WeakMap<GarmentAssembly3d,Map<string,GarmentDisplay3d>>();
/** Loop display subdivision and solid cloth shell. Never writes to source CAD or solver state. */
export function createGarmentDisplay(source:GarmentAssembly3d,options:GarmentSurfaceSettings=DEFAULT_GARMENT_SURFACE):GarmentDisplay3d{
  if(![0,1,2].includes(options.subdivision)||!Number.isFinite(options.thicknessMm)||options.thicknessMm<0||options.thicknessMm>5)throw Error('显示布厚须为0–5mm，细分为0–2级');
  const settings={...options},key=JSON.stringify(settings),cached=cache.get(source)?.get(key);if(cached)return cached;
  const ids=new Map<number,number>(),points:XYZ[]=[],surfaces=source.surfaces.map(s=>({...s,localMm:s.localMm.map(p=>[...p] as XY),uvMm:s.uvMm.map(p=>[...p] as XY),triangles:[...s.triangles],boundary:[...s.boundary],
    simulationIds:s.simulationIds.map((id,i)=>{if(!ids.has(id)){ids.set(id,points.length);points.push([...s.positionsMm[i]]);}return ids.get(id)!;}),positionsMm:[] as XYZ[]}));
  for(const s of surfaces)s.positionsMm=s.simulationIds.map(id=>points[id]);
  const original=points.map(p=>[...p] as XYZ),first=topology(surfaces,points),originalBoundary=new Set<number>();
  for(const e of first.edges.values())if(e.faces.length===1){originalBoundary.add(e.a);originalBoundary.add(e.b);}
  orient(surfaces,first);let mesh=topology(surfaces,points);
  const creases=new Set((source.displayCreases??[]).map(([a,b])=>edgeKey(ids.get(a)!,ids.get(b)!)));
  for(let i=0;i<settings.subdivision;i++){
    mesh=refine(surfaces,mesh,creases);
    // Application display guard, not a manufacturing tolerance: keep original
    // control stations within 2mm, and opening boundaries within 1mm.
    for(let j=0;j<original.length;j++){const delta=sub(mesh.points[j],original[j]),length=Math.hypot(...delta),limit=originalBoundary.has(j)?1:2;if(length>limit)mesh.points[j]=add(original[j],delta,limit/length);}
    for(const surface of surfaces)surface.positionsMm=surface.simulationIds.map(id=>mesh.points[id]);
  }
  const sums:XYZ[]=mesh.points.map(()=>[0,0,0]);
  for(const face of mesh.faces){const [a,b,c]=face.ids.map(id=>mesh.points[id]),normal=cross(sub(b,a),sub(c,a));for(const id of face.ids)sums[id]=add(sums[id],normal);}
  const normals=sums.map(unit),open=[...mesh.edges.values()].filter(e=>e.faces.length===1),outward:XYZ[]=mesh.points.map(()=>[0,0,0]);
  for(const e of open){const direction=unit(sub(mesh.points[e.b],mesh.points[e.a]));for(const id of [e.a,e.b])outward[id]=add(outward[id],cross(direction,normals[id]));}
  for(const id of new Set(open.flatMap(e=>[e.a,e.b])))outward[id]=unit(outward[id]);
  const half=settings.thicknessMm/2,display:GarmentDisplaySurface[]=[];
  for(const surface of surfaces){
    const outer:GarmentDisplaySurface={...surface,sourceSurfaceId:surface.id,layer:'outer',positionsMm:surface.simulationIds.map(id=>add(mesh.points[id],normals[id],half)),renderNormals:surface.simulationIds.map(id=>normals[id])};display.push(outer);
    if(!half)continue;
    display.push({...surface,id:`${surface.id}/inside`,sourceSurfaceId:surface.id,layer:'inner',positionsMm:surface.simulationIds.map(id=>add(mesh.points[id],normals[id],-half)),simulationIds:surface.simulationIds.map(id=>id+mesh.points.length),triangles:surface.triangles.map((v,i,a)=>i%3===1?a[i+1]:i%3===2?a[i-1]:v),renderNormals:surface.simulationIds.map(id=>mul(normals[id],-1))});
  }
  const boundaryIds=[...new Set(open.flatMap(e=>[e.a,e.b]))],boundaryIndex=new Map(boundaryIds.map((id,i)=>[id,i])),steps=settings.roundedEdges?4:1;
  if(half)for(const [owner,surface]of surfaces.entries()){
    const rim:GarmentDisplaySurface={...surface,id:`${surface.id}/edge`,sourceSurfaceId:surface.id,layer:'rim',localMm:[],uvMm:[],positionsMm:[],simulationIds:[],triangles:[],boundary:[],renderNormals:[]},vertices=new Map<string,number>();
    const localByGlobal=new Map<number,number>();for(const i of surface.triangles)if(!localByGlobal.has(surface.simulationIds[i]))localByGlobal.set(surface.simulationIds[i],i);
    const vertex=(id:number,j:number)=>{const key=`${id}:${j}`,old=vertices.get(key);if(old!==undefined)return old;const index=rim.positionsMm.length,angle=j*Math.PI/steps,co= settings.roundedEdges?Math.sin(angle):0;
      const normal=j===0?normals[id]:j===steps?mul(normals[id],-1):add(mul(normals[id],Math.cos(angle)),outward[id],co),uv=surface.uvMm[localByGlobal.get(id)!];
      // Reuse the exact endpoint operation, avoiding sin(PI) seams at the rim.
      rim.positionsMm.push(j===0||j===steps?add(mesh.points[id],normals[id],j===0?half:-half):add(mesh.points[id],normal,half));rim.renderNormals.push(settings.roundedEdges?unit(normal):outward[id]);rim.uvMm.push([...uv]);rim.localMm.push([...uv]);
      rim.simulationIds.push(j===0?id:j===steps?id+mesh.points.length:2*mesh.points.length+boundaryIndex.get(id)!*(steps-1)+j-1);vertices.set(key,index);return index;};
    for(const e of open)if(mesh.faces[e.faces[0].face].owner===owner)for(let j=0;j<steps;j++){const a=vertex(e.a,j),b=vertex(e.b,j),c=vertex(e.a,j+1),d=vertex(e.b,j+1);rim.triangles.push(a,c,b,b,c,d);}
    if(rim.triangles.length)display.push(rim);
  }
  if(half){
    const incidence=new Map<string,{count:number;direction:number}>();
    for(const s of display)for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){const a=s.simulationIds[s.triangles[t+k]],b=s.simulationIds[s.triangles[t+(k+1)%3]],key=edgeKey(a,b),value=incidence.get(key)??{count:0,direction:0};value.count++;value.direction+=a<b?1:-1;incidence.set(key,value);}
    if([...incidence.values()].some(e=>e.count!==2||e.direction!==0))throw Error('布厚侧壁未闭合或方向不一致');
  }
  const displacement=original.map((p,i)=>Math.hypot(...sub(mesh.points[i],p))),result:GarmentDisplay3d={templateId:source.templateId,source,surfaces:display,settings,
    metrics:{controlTriangles:source.quality.triangles,renderTriangles:display.reduce((n,s)=>n+s.triangles.length/3,0),boundaryEdges:open.length,maxControlDisplacementMm:Math.max(...displacement),maxBoundaryDisplacementMm:Math.max(0,...[...originalBoundary].map(i=>displacement[i])),closedShell:half>0}};
  let entries=cache.get(source);if(!entries){entries=new Map();cache.set(source,entries);}if(entries.size>=3)entries.delete(entries.keys().next().value!);entries.set(key,result);return result;
}
