import type { GarmentDisplaySurface,GarmentOpening } from '@/types/garment3d';
import type { XY,XYZ } from '@/types/pattern3d';
export const add=(a:XYZ,b:XYZ,s=1)=>a.map((v,k)=>v+b[k]*s) as XYZ;
export const sub=(a:XYZ,b:XYZ)=>a.map((v,k)=>v-b[k]) as XYZ;
export const cross=(a:XYZ,b:XYZ):XYZ=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=(v:XYZ):XYZ=>{const n=Math.hypot(...v);return n>1e-10?v.map(x=>x/n) as XYZ:[0,0,1];};
type Sample={p:XYZ;n:XYZ;out:XYZ;uv:XY;distance:number};

/** Grid-indexed inverse UV lookup onto the actual displayed triangulation. */
export function garmentSurfaceMapper(surface:GarmentDisplaySurface){
  const cells=new Map<string,number[]>(),cell=24;
  for(let t=0;t<surface.triangles.length;t+=3){const ps=surface.triangles.slice(t,t+3).map(i=>surface.uvMm[i]),min=[0,1].map(k=>Math.floor(Math.min(...ps.map(p=>p[k]))/cell)),max=[0,1].map(k=>Math.floor(Math.max(...ps.map(p=>p[k]))/cell));
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++){const key=`${x}:${y}`,ts=cells.get(key)??[];ts.push(t);cells.set(key,ts);}}
  return (point:XY)=>{
    const x=Math.floor(point[0]/cell),y=Math.floor(point[1]/cell),candidates=new Set<number>();
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const t of cells.get(`${x+dx}:${y+dy}`)??[])candidates.add(t);
    let best:{indices:number[];weights:number[];uv:XY;error:number}|undefined;
    for(const t of candidates){const indices=surface.triangles.slice(t,t+3),[a,b,c]=indices.map(i=>surface.uvMm[i]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;
      const u=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/den,v=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/den;
      if(Math.min(u,v,1-u-v)>=-1e-7){best={indices,weights:[u,v,1-u-v],uv:point,error:0};break;}
      for(let k=0;k<3;k++){const p=[a,b,c][k],q=[a,b,c][(k+1)%3],dx=q[0]-p[0],dy=q[1]-p[1],f=Math.max(0,Math.min(1,((point[0]-p[0])*dx+(point[1]-p[1])*dy)/(dx*dx+dy*dy))),uv:XY=[p[0]+f*dx,p[1]+f*dy],error=Math.hypot(uv[0]-point[0],uv[1]-point[1]);
        if(!best||error<best.error){const weights=[0,0,0];weights[k]=1-f;weights[(k+1)%3]=f;best={indices,weights,uv,error};}}
    }
    if(!best)throw Error('工艺线无法映射到源裁片');
    const blend=(data:XYZ[])=>[0,1,2].map(k=>best!.indices.reduce((sum,id,j)=>sum+data[id][k]*best!.weights[j],0)) as XYZ;
    return {p:blend(surface.positionsMm),n:unit(blend(surface.renderNormals)),uv:best.uv,errorMm:best.error};
  };
}

/** Sample explicit CAD opening intervals in source-mm distance order. */
export function openingSampler(opening:GarmentOpening,surfaces:GarmentDisplaySurface[]){
  const entries=opening.edges.map(e=>{const s=surfaces.find(s=>s.sourceSurfaceId===e.surfaceId&&s.layer==='outer')!;
    if(!s)throw Error('工艺开口缺少衣身曲面');const a=s.uvMm[e.a],b=s.uvMm[e.b],c=s.uvMm[e.inside],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),sign=Math.sign(-dy*(c[0]-a[0])+dx*(c[1]-a[1])),inward:XY=[-dy/length*sign,dx/length*sign];
    return {s,a,b,c,length,inward};});
  const maps=new Map<string,ReturnType<typeof garmentSurfaceMapper>>();for(const e of entries)if(!maps.has(e.s.id))maps.set(e.s.id,garmentSurfaceMapper(e.s));let total=0;
  const endpointNormals=new Map<string,XY>();
  const uvKey=(id:string,p:XY)=>`${id}/${p[0].toFixed(6)}:${p[1].toFixed(6)}`;
  for(const e of entries)for(const p of [e.a,e.b]){const key=uvKey(e.s.id,p),n=endpointNormals.get(key)??[0,0];endpointNormals.set(key,[n[0]+e.inward[0],n[1]+e.inward[1]]);}
  const spans=entries.map(e=>{const start=total;total+=e.length;const map=maps.get(e.s.id)!;return {...e,start,tangent:sub(map(e.b).p,map(e.a).p),inside:map(e.c).p,na:endpointNormals.get(uvKey(e.s.id,e.a))!,nb:endpointNormals.get(uvKey(e.s.id,e.b))!};});
  const at=(distance:number,inset=0):Sample=>{
    const target=((distance%total)+total)%total,e=spans.find(e=>target<e.start+e.length)??spans.at(-1)!,f=Math.max(0,Math.min(1,(target-e.start)/e.length)),uv:XY=[e.a[0]+(e.b[0]-e.a[0])*f,e.a[1]+(e.b[1]-e.a[1])*f],map=maps.get(e.s.id)!,base=map(uv),inward=e.na.map((v,k)=>v+(e.nb[k]-v)*f),length=Math.hypot(...inward),point=inset?map([uv[0]+inward[0]/length*inset,uv[1]+inward[1]/length*inset]):base;
    const candidate=unit(cross(e.tangent,base.n)),inside=sub(e.inside,base.p),out=inside.reduce((s,v,k)=>s+v*candidate[k],0)>0?candidate.map(v=>-v) as XYZ:candidate;
    return {p:point.p,n:point.n,out,uv:point.uv,distance};
  };
  return {total,at};
}

export function detailSurface(id:string,sourceSurfaceId:string,kind:'rib'|'turnback'|'thread',label:string):GarmentDisplaySurface{
  return {id,sourceId:id,sourceSurfaceId,copy:1,layer:kind==='thread'?'stitch':'finish',detail:{operationId:id,kind,label,coordinateSpace:kind==='rib'?'cut-piece-mm':'path-mm'},localMm:[],uvMm:[],positionsMm:[],renderNormals:[],triangles:[],boundary:[],simulationIds:[],foldAxis:null,sourceHalfSign:0};
}
export function normaliseDetail(s:GarmentDisplaySurface){
  let volume=0;for(let t=0;t<s.triangles.length;t+=3){const [a,b,c]=s.triangles.slice(t,t+3).map(i=>s.positionsMm[i]),v=cross(b,c);volume+=a.reduce((sum,x,k)=>sum+x*v[k],0);}
  if(volume<0)for(let t=0;t<s.triangles.length;t+=3)[s.triangles[t+1],s.triangles[t+2]]=[s.triangles[t+2],s.triangles[t+1]];
  const sums=new Map<number,XYZ>();
  for(let t=0;t<s.triangles.length;t+=3){const ids=s.triangles.slice(t,t+3),[a,b,c]=ids.map(i=>s.positionsMm[i]),n=cross(sub(b,a),sub(c,a));for(const i of ids){const id=s.simulationIds[i];sums.set(id,add(sums.get(id)??[0,0,0],n));}}
  s.renderNormals=s.simulationIds.map(id=>unit(sums.get(id)??[0,0,1]));
}
/** Closed two-sided strip with welded end IDs, independent UV seam. */
export function solidStrip(s:GarmentDisplaySurface,samples:Sample[],width:number,thickness:number,point:(sample:Sample,t:number)=>XYZ,uv:(distance:number,t:number,inside:boolean)=>XY){
  const rows=5,n=samples.length-1,stride=rows+1,layer=(n+1)*stride;
  for(let inside=0;inside<2;inside++)for(let i=0;i<=n;i++)for(let j=0;j<=rows;j++){
    const t=j/rows,q=point(samples[i],t),p=i===n?[...s.positionsMm[inside*layer+j]] as XYZ:add(q,samples[i].n,inside?-thickness/2:thickness/2),v=uv(samples[i].distance,t,!!inside);s.positionsMm.push(p);s.uvMm.push(v);s.localMm.push([...v]);s.simulationIds.push(inside*n*stride+(i%n)*stride+j);
  }
  for(let i=0;i<n;i++)for(let j=0;j<rows;j++){const a=i*stride+j,b=a+stride,c=a+1,d=b+1;s.triangles.push(a,b,c,b,d,c,a+layer,c+layer,b+layer,b+layer,c+layer,d+layer);}
  for(let i=0;i<n;i++)for(const j of [0,rows]){const a=i*stride+j,b=a+stride,c=a+layer,d=b+layer;s.triangles.push(...(j===0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  if(!(width>0))throw Error('工艺条宽度无效');normaliseDetail(s);return s;
}
/** Batched thread geometry: one mesh per operation, not one draw call per stitch. */
export function stitchGeometry(s:GarmentDisplaySurface,total:number,pitch:number,at:(distance:number)=>Sample){
  const count=Math.max(1,Math.floor(total/pitch)),step=total/count,radius=.2,sides=5;
  for(let i=0;i<count;i++){
    const start=at(i*step+.15*step),end=at(i*step+.85*step),axis=unit(sub(end.p,start.p)),binormal=unit(cross(axis,start.n)),offset=s.positionsMm.length;
    for(const [j,q]of [start,end].entries())for(let k=0;k<sides;k++){const angle=k*2*Math.PI/sides,p=add(add(add(q.p,q.n,.3),q.n,radius*Math.cos(angle)),binormal,radius*Math.sin(angle));s.positionsMm.push(p);s.uvMm.push([i*step+j*step*.7,k/sides]);s.localMm.push([i*step+j*step*.7,k/sides]);s.simulationIds.push(s.simulationIds.length);}
    for(let k=0;k<sides;k++){const a=offset+k,b=offset+(k+1)%sides,c=a+sides,d=b+sides;s.triangles.push(a,b,c,b,d,c);}
    for(let k=1;k<sides-1;k++)s.triangles.push(offset,offset+k+1,offset+k,offset+sides,offset+sides+k,offset+sides+k+1);
  }
  normaliseDetail(s);return s;
}
