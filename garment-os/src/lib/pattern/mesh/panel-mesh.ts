import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { validateAssembly } from '@/lib/pattern/assembly/validate';
import earcut,{deviation} from 'earcut';
import type { AssemblyEdge,AssemblyPiece,AssemblyReport } from '@/types/assembly';
import type { MeshVertexTrace,PanelMesh,PatternMesh3d,XY,XYZ } from '@/types/pattern3d';
import { MESH_PRECISION } from './precision-policy';

const distance=(a:XY,b:XY)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const xy=(p:{x:number;y:number}):XY=>[p.x,p.y];
export function edgePoint(e:AssemblyEdge,t:number):XY{
  if(e.kind==='line')return [e.from.x+(e.to.x-e.from.x)*t,e.from.y+(e.to.y-e.from.y)*t];
  const a=1-t,p=e.cp1!,q=e.cp2!;
  return [a*a*a*e.from.x+3*a*a*t*p.x+3*a*t*t*q.x+t*t*t*e.to.x,a*a*a*e.from.y+3*a*a*t*p.y+3*a*t*t*q.y+t*t*t*e.to.y];
}
const midpoint=(a:XY,b:XY):XY=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const lineDistance=(p:XY,a:XY,b:XY)=>Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1]))/(distance(a,b)||1);
const segmentDistance=(p:XY,a:XY,b:XY)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
  const t=length2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2)):0;
  return distance(p,[a[0]+t*dx,a[1]+t*dy]);
};
/** De Casteljau subdivision: the control hull bounds the chord error. No SVG layout transform. */
export function sampleEdge(e:AssemblyEdge,toleranceMm=MESH_PRECISION.curveChordMm):Array<{t:number;point:XY}>{
  const out:Array<{t:number;point:XY}>=[{t:0,point:xy(e.from)}];
  const split=(a:XY,b:XY,c:XY,d:XY,t0:number,t1:number,depth:number)=>{
    const flat=Math.max(segmentDistance(b,a,d),segmentDistance(c,a,d));
    if(flat<=toleranceMm&&distance(a,d)<=MESH_PRECISION.boundarySpanMm){out.push({t:t1,point:d});return;}
    if(depth>=18)throw new Error('三维网格曲线细分未收敛');
    const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd),t=(t0+t1)/2;
    split(a,ab,abc,m,t0,t,depth+1);split(m,bcd,cd,d,t,t1,depth+1);
  };
  if(e.kind==='line'){
    const count=Math.max(1,Math.ceil(e.lengthMm/MESH_PRECISION.boundarySpanMm));for(let i=1;i<=count;i++)out.push({t:i/count,point:edgePoint(e,i/count)});
  }else split(xy(e.from),xy(e.cp1!),xy(e.cp2!),xy(e.to),0,1,0);
  return out;
}
export function reflect(point:XY,a:XY,b:XY):XY{
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;if(den<1e-12)throw new Error('对折轴无效');
  const t=((point[0]-a[0])*dx+(point[1]-a[1])*dy)/den;
  return [2*(a[0]+t*dx)-point[0],2*(a[1]+t*dy)-point[1]];
}
export function placePoint(p:XY,placement:PanelMesh['placement']):XYZ{
  const a=placement.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),o=placement.translationMm;
  return [p[0]*c+o[0],-p[1]+o[1],-p[0]*s+o[2]];
}
export function unplacePoint(p:XYZ,placement:PanelMesh['placement']):XY{
  const a=placement.yawDeg*Math.PI/180,x=p[0]-placement.translationMm[0],z=p[2]-placement.translationMm[2];
  return [x*Math.cos(a)-z*Math.sin(a),-(p[1]-placement.translationMm[1])];
}
const signedArea=(vertices:XY[])=>vertices.reduce((a,p,i)=>{const q=vertices[(i+1)%vertices.length];return a+(p[0]*q[1]-q[0]*p[1])/2;},0);
// Three-point Gauss-Legendre integrates x*y'−y*x' (degree <=5) exactly for a cubic.
function exactArea(edges:AssemblyEdge[]):number{
  let area=0;const ts=[.5-Math.sqrt(3/5)/2,.5,.5+Math.sqrt(3/5)/2],weights=[5/18,4/9,5/18];
  for(const e of edges)for(let i=0;i<3;i++){
    const t=ts[i],a=1-t,p=edgePoint(e,t);
    const dx=e.kind==='line'?e.to.x-e.from.x:3*a*a*(e.cp1!.x-e.from.x)+6*a*t*(e.cp2!.x-e.cp1!.x)+3*t*t*(e.to.x-e.cp2!.x);
    const dy=e.kind==='line'?e.to.y-e.from.y:3*a*a*(e.cp1!.y-e.from.y)+6*a*t*(e.cp2!.y-e.cp1!.y)+3*t*t*(e.to.y-e.cp2!.y);
    area+=weights[i]*(p[0]*dy-p[1]*dx)/2;
  }return Math.abs(area);
}
function polygon(piece:AssemblyPiece,report:AssemblyReport):MeshVertexTrace[]{
  const folds=report.boundaries.filter(b=>b.piece===piece.id&&b.disposition==='fold');
  let edges=piece.edges,axis:[XY,XY]|undefined;
  if(piece.onFold){
    if(folds.length!==1)throw new Error(`${piece.id} 对折展开需唯一已定位折边`);
    const ids=new Set(folds[0].edgeIds),foldsEdges=edges.filter(e=>ids.has(e.id));
    if(!foldsEdges.length||foldsEdges.some(e=>e.kind!=='line'))throw new Error('曲线或缺失折边不能自动展开');
    axis=[xy(foldsEdges[0].from),xy(foldsEdges.at(-1)!.to)];
    if(foldsEdges.some(e=>lineDistance(xy(e.from),axis![0],axis![1])>1e-6||lineDistance(xy(e.to),axis![0],axis![1])>1e-6))throw new Error('折边不共线');
    const start=edges.findIndex((e,i)=>!ids.has(e.id)&&ids.has(edges[(i+edges.length-1)%edges.length].id));
    edges=[...edges.slice(start),...edges.slice(0,start)].filter(e=>!ids.has(e.id));
    if(distance(xy(edges[0].from),axis[0])>1e-6&&distance(xy(edges[0].from),axis[1])>1e-6)throw new Error('折边不是连续轮廓边界');
  }
  const vertices=edges.flatMap(e=>sampleEdge(e).slice(0,-1).map(({t,point})=>({sourceMm:point,localMm:point,sourceEdge:e.id,t,mirrored:false})));
  if(axis){
    const last=edges.at(-1)!;vertices.push({sourceMm:xy(last.to),localMm:xy(last.to),sourceEdge:last.id,t:1,mirrored:false});
    vertices.push(...vertices.slice(1,-1).reverse().map(v=>({...v,localMm:reflect(v.localMm,axis![0],axis![1]),mirrored:true})));
  }
  if(vertices.length<3||vertices.some((v,i)=>distance(v.localMm,vertices[(i+1)%vertices.length].localMm)<1e-8))throw new Error('网格轮廓包含无效重复点');
  return vertices;
}

/** Rigid flat-panel placement, not cloth simulation. Net curves retain per-vertex source provenance. */
export function buildPanelMeshes(input:{assemblyPieces:AssemblyPiece[];assembly:AssemblyReport}):PatternMesh3d{
  const original=input.assembly;
  const report={...validateAssembly(getAssemblyDefinition(original.templateId,original.construction?.selection??undefined),input.assemblyPieces),construction:original.construction};
  if(!report.integrityPass||report.status==='blocked')throw new Error('结构检查未通过，三维映射已阻断');
  if(input.assemblyPieces.length!==report.pieces.length)throw new Error('三维源裁片清单不完整');
  const panels:PanelMesh[]=[];let cursor=0,rowOffset=0,rowHeight=0;
  for(const piece of input.assemblyPieces){
    const declaration=report.pieces.find(p=>p.id===piece.id);
    if(!declaration||piece.quantity!==declaration.quantity||piece.onFold!==declaration.onFold)throw new Error('三维源裁剪数量或裁法不一致');
    const vertices=polygon(piece,report),flat=vertices.flatMap(v=>v.localMm),rawTriangles=earcut(flat),triangles:number[]=[];
    // A collinear boundary station can produce a zero-area face. Keep its source vertex trace,
    // discard only that face, then require full polygon area conservation.
    for(let i=0;i<rawTriangles.length;i+=3){const ids=rawTriangles.slice(i,i+3);if(Math.abs(signedArea(ids.map(n=>vertices[n].localMm)))>1e-9)triangles.push(...ids);}
    if(!triangles.length||deviation(flat,[],2,triangles)>1e-8)throw new Error('网格三角化面积不守恒');
    const sourceArea=exactArea(piece.edges)*(piece.onFold?2:1),polygonArea=Math.abs(signedArea(vertices.map(v=>v.localMm)));
    let triangleArea=0;
    for(let i=0;i<triangles.length;i+=3){const area=Math.abs(signedArea(triangles.slice(i,i+3).map(n=>vertices[n].localMm)));if(area<=1e-9)throw new Error('网格含退化三角形');triangleArea+=area;}
    const error=Math.abs(polygonArea-sourceArea)/sourceArea;
    if(!Number.isFinite(error)||error>MESH_PRECISION.areaErrorRatio)throw new Error('网格与源曲线面积误差超过0.1%');
    const minX=Math.min(...vertices.map(v=>v.localMm[0])),maxX=Math.max(...vertices.map(v=>v.localMm[0]));
    for(let copy=1;copy<=piece.quantity;copy++){
      // Exploded board, with different rigid yaw angles to expose depth. Not body-derived placement.
      const minY=Math.min(...vertices.map(v=>v.localMm[1])),height=Math.max(...vertices.map(v=>v.localMm[1]))-minY;
      if(cursor>0&&cursor+maxX-minX>1800){cursor=0;rowOffset+=rowHeight+120;rowHeight=0;}
      rowHeight=Math.max(rowHeight,height);
      const placement:PanelMesh['placement']={yawDeg:panels.length%2===0?-18:18,translationMm:[cursor-minX,minY-rowOffset,(panels.length%3)*50]};
      const positions=vertices.map(v=>placePoint(v.localMm,placement));
      const roundtrip=Math.max(...vertices.map((v,i)=>distance(v.localMm,unplacePoint(positions[i],placement))));
      let distortion=0;
      for(let i=0;i<triangles.length;i+=3)for(let j=0;j<3;j++){
        const a=triangles[i+j],b=triangles[i+(j+1)%3],local=distance(vertices[a].localMm,vertices[b].localMm),world=Math.hypot(...positions[a].map((v,k)=>v-positions[b][k]));distortion=Math.max(distortion,Math.abs(local-world));
      }
      if(roundtrip>MESH_PRECISION.rigidRoundtripMm||distortion>MESH_PRECISION.rigidRoundtripMm)throw new Error('三维刚性转换发生尺寸失真');
      panels.push({id:`${piece.id}#${copy}`,sourceId:piece.id,copy,quantity:piece.quantity,unfolded:piece.onFold,material:piece.primaryMaterial??'fabric',placement,
        vertices:structuredClone(vertices),positionsMm:positions,triangles:[...triangles],sourceEdges:structuredClone(piece.edges),
        metrics:{sourceAreaMm2:sourceArea,polygonAreaMm2:polygonArea,triangleAreaMm2:triangleArea,areaErrorRatio:error,maxRoundtripMm:roundtrip,maxEdgeDistortionMm:distortion,discardedZeroAreaFaces:(rawTriangles.length-triangles.length)/3}});
      cursor+=maxX-minX+60;
    }
  }
  const result:PatternMesh3d={schema:'garment-os/pattern-3d/v1',templateId:report.templateId,engine:report.engine,version:report.version,unit:'mm',stage:'flat-panel-placement',panels,sourceAssembly:structuredClone(report),seams:[],
    simulationReady:false,drapeValidated:false,productionApproved:false,pending:[
      '当前是裁片三维展开预置；尚未执行缝合闭合、人体碰撞或布料物理仿真。',
      '网格仅做轮廓三角化，尚未形成均匀内部网格与弯曲/剪切求解约束。',
      '数量按源指令展开；非对折副本的左右和内外层分配不从数量推断。',
      ...report.pending.map(p=>p.message),
    ]};
  if(report.templateId==='bound-tank'){
    const front=panels.find(p=>p.sourceId==='aaron.front')!,back=panels.find(p=>p.sourceId==='aaron.back')!;
    for(const [boundary,join]of [['shoulder','shoulders'],['side','sides']]as const)for(const mirrored of [false,true]){
      const a=report.boundaries.find(b=>b.piece===front.sourceId&&b.id===boundary)!,b=report.boundaries.find(b=>b.piece===back.sourceId&&b.id===boundary)!;
      const samples=Array.from({length:17},(_,i)=>{
        const fraction=i/16;
        const sample=(panel:PanelMesh,edgeIds:string[]):{source:XY;world:XYZ;edge:string;t:number}=>{
          const chain=edgeIds.map(id=>panel.sourceEdges.find(e=>e.id===id)!);
          // Chord-arclength approximation is bounded by the same 0.05 mm subdivision; no manufacturing claim.
          const spans=chain.flatMap(e=>{const stations=sampleEdge(e);return stations.slice(1).map((p,i)=>({edge:e,t0:stations[i].t,t1:p.t,length:distance(stations[i].point,p.point)}));});
          const total=spans.reduce((s,p)=>s+p.length,0);let target=total*fraction,idx=0;
          while(idx<spans.length-1&&target>spans[idx].length)target-=spans[idx++].length;
          const span=spans[idx],t=span.t0+(span.t1-span.t0)*(target/span.length),p=edgePoint(span.edge,t);
          const fold=report.boundaries.find(b=>b.piece===panel.sourceId&&b.disposition==='fold')!;
          const f=panel.sourceEdges.find(e=>e.id===fold.edgeIds[0])!;
          return {source:p,world:placePoint(mirrored?reflect(p,xy(f.from),xy(f.to)):p,panel.placement),edge:span.edge.id,t};
        };
        const sa=sample(front,a.edgeIds),sb=sample(back,b.edgeIds);
        return {a:sa.world,b:sb.world,aSource:sa.source,bSource:sb.source,aSourceEdge:sa.edge,bSourceEdge:sb.edge,aT:sa.t,bT:sb.t,fraction,gapMm:Math.hypot(...sa.world.map((v,k)=>v-sb.world[k]))};
      });
      result.seams.push({id:`${join}-${mirrored?'reflected':'original'}`,aPanel:front.id,bPanel:back.id,sourceJoinId:join,mirrored,sourceLengthDeltaMm:a.lengthMm-b.lengthMm,status:'unsewn',samples});
    }
    result.pending.push('仅肩缝、侧缝已有左右展开后的物理片对应；包条完成态与端头未知，未映射为已缝合边。');
  }else result.pending.push('已按源裁剪指令转换实际数量；左右、内外层与完整物理片配缝分配尚未实现，不能视为已缝合成衣。');
  return result;
}
