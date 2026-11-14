import { placePoint,reflect,unplacePoint } from './panel-mesh';
import type { PanelMesh,PatternMesh3d,XY,XYZ } from '@/types/pattern3d';

export interface PhysicalCamera {centerMm:XYZ;yawDeg:number;tiltDeg:number;pixelsPerMm:number;panCss:XY}
export interface ViewportSize {width:number;height:number;dpr:number}
export interface SurfaceAnchor {panelId:string;sourceId:string;triangle:number;weights:XYZ;localMm:XY;sourceMm:XY;worldMm:XYZ;mirrored:boolean}
const dot=(a:XYZ,b:XYZ)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a:XYZ,b:XYZ):XYZ=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
// A generated model is immutable for its revision; caches never write into CAD geometry.
const localBoundsCache=new WeakMap<PanelMesh,{min:XY;max:XY}>();
function localBounds(panel:PanelMesh){
  let bounds=localBoundsCache.get(panel);if(bounds)return bounds;
  const min:XY=[Infinity,Infinity],max:XY=[-Infinity,-Infinity];for(const v of panel.vertices)for(let k=0;k<2;k++){min[k]=Math.min(min[k],v.localMm[k]);max[k]=Math.max(max[k],v.localMm[k]);}
  bounds={min,max};localBoundsCache.set(panel,bounds);return bounds;
}
export function cameraBasis(camera:Pick<PhysicalCamera,'yawDeg'|'tiltDeg'>){
  const a=camera.yawDeg*Math.PI/180,b=camera.tiltDeg*Math.PI/180;
  return {right:[Math.cos(a),0,Math.sin(a)] as XYZ,up:[Math.sin(a)*Math.sin(b),Math.cos(b),-Math.cos(a)*Math.sin(b)] as XYZ,
    forward:[-Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b)] as XYZ};
}
export function projectPhysicalPoint(world:XYZ,camera:PhysicalCamera,size:ViewportSize):XY{
  const p=sub(world,camera.centerMm),basis=cameraBasis(camera);
  return [size.width/2+camera.panCss[0]+dot(p,basis.right)*camera.pixelsPerMm,size.height/2+camera.panCss[1]-dot(p,basis.up)*camera.pixelsPerMm];
}
export function modelBounds(model:PatternMesh3d){
  const min:XYZ=[Infinity,Infinity,Infinity],max:XYZ=[-Infinity,-Infinity,-Infinity];
  for(const panel of model.panels)for(const p of panel.positionsMm)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  if([...min,...max].some(v=>!Number.isFinite(v)))throw new Error('三维边界为空或包含无效坐标');
  const center=min.map((v,i)=>(v+max[i])/2) as XYZ,radius=Math.hypot(...max.map((v,i)=>(v-min[i])/2));
  return {min,max,center,radius};
}
export function fitPhysicalCamera(model:PatternMesh3d,size:ViewportSize):PhysicalCamera{
  return framePhysicalCamera(model,size,{centerMm:[0,0,0],yawDeg:25,tiltDeg:12,pixelsPerMm:1,panCss:[0,0]});
}
/** Frame projected bounds, not a bounding sphere: wide pattern layouts must fill the viewport. */
export function framePhysicalCamera(model:PatternMesh3d,size:ViewportSize,camera:PhysicalCamera,ids?:readonly string[]):PhysicalCamera{
  const panels=ids?model.panels.filter(p=>ids.includes(p.id)):model.panels;
  if(!panels.length)return camera;
  const bounds=modelBounds({...model,panels}),basis=cameraBasis(camera);
  const min:XY=[Infinity,Infinity],max:XY=[-Infinity,-Infinity];
  for(const panel of panels)for(const point of panel.positionsMm){const relative=sub(point,bounds.center),q=[dot(relative,basis.right),dot(relative,basis.up)];for(let k=0;k<2;k++){min[k]=Math.min(min[k],q[k]);max[k]=Math.max(max[k],q[k]);}}
  const cx=(min[0]+max[0])/2,cy=(min[1]+max[1])/2;
  return {...camera,centerMm:bounds.center.map((v,k)=>v+basis.right[k]*cx+basis.up[k]*cy) as XYZ,panCss:[0,0],
    pixelsPerMm:Math.min(30,.84*Math.min(Math.max(1,size.width)/Math.max(1,max[0]-min[0]),Math.max(1,size.height)/Math.max(1,max[1]-min[1])))};
}
export function frontCamera(panel:PanelMesh,camera:PhysicalCamera):PhysicalCamera{
  const min:XY=[Infinity,Infinity],max:XY=[-Infinity,-Infinity];for(const v of panel.vertices)for(let i=0;i<2;i++){min[i]=Math.min(min[i],v.localMm[i]);max[i]=Math.max(max[i],v.localMm[i]);}
  return {...camera,yawDeg:-panel.placement.yawDeg,tiltDeg:0,panCss:[0,0],centerMm:placePoint([(min[0]+max[0])/2,(min[1]+max[1])/2],panel.placement)};
}
function sourceCoordinate(model:PatternMesh3d,panel:PanelMesh,local:XY){
  if(!panel.unfolded)return {point:local,mirrored:false};
  const fold=model.sourceAssembly.boundaries.find(b=>b.piece===panel.sourceId&&b.disposition==='fold');
  const edge=panel.sourceEdges.find(e=>e.id===fold?.edgeIds[0]);if(!edge)throw new Error('二维来源缺少折边映射');
  const a:XY=[edge.from.x,edge.from.y],b:XY=[edge.to.x,edge.to.y],side=(p:XY)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const source=panel.vertices.find(v=>!v.mirrored&&Math.abs(side(v.sourceMm))>1e-6);if(!source)throw new Error('对折源半片方向未知');
  const mirrored=side(local)*side(source.sourceMm)<-1e-8;
  return {point:mirrored?reflect(local,a,b):local,mirrored};
}
export function mapSurfaceAnchor(model:PatternMesh3d,panelId:string,triangle:number,weights:XYZ):SurfaceAnchor{
  const panel=model.panels.find(p=>p.id===panelId);
  if(!panel||!Number.isInteger(triangle)||triangle<0||triangle>=panel.triangles.length/3||weights.some(v=>!Number.isFinite(v)||v< -1e-8)||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-8)throw new Error('三维拾取索引或重心坐标无效');
  const indices=panel.triangles.slice(triangle*3,triangle*3+3);
  const local=([0,1] as const).map(k=>indices.reduce((s,id,i)=>s+panel.vertices[id].localMm[k]*weights[i],0)) as XY;
  // Never interpolate folded source coordinates across the symmetry axis: that would collapse widths.
  const source=sourceCoordinate(model,panel,local);
  return {panelId,sourceId:panel.sourceId,triangle,weights,localMm:local,sourceMm:source.point,worldMm:placePoint(local,panel.placement),mirrored:source.mirrored};
}
/** Double-precision plane intersection and barycentric lookup. Pixels select; CAD coordinates measure. */
export function pickPhysicalSurface(model:PatternMesh3d,visibleIds:readonly string[],screen:XY,camera:PhysicalCamera,size:ViewportSize):SurfaceAnchor|null{
  const basis=cameraBasis(camera),x=(screen[0]-size.width/2-camera.panCss[0])/camera.pixelsPerMm,y=-(screen[1]-size.height/2-camera.panCss[1])/camera.pixelsPerMm;
  const origin=camera.centerMm.map((v,k)=>v+basis.right[k]*x+basis.up[k]*y) as XYZ;
  let best:{depth:number;anchor:SurfaceAnchor}|null=null;const visible=new Set(visibleIds);
  for(const panel of model.panels){
    if(!visible.has(panel.id))continue;
    const a=panel.placement.yawDeg*Math.PI/180,normal:XYZ=[Math.sin(a),0,Math.cos(a)],den=dot(basis.forward,normal);
    if(Math.abs(den)<1e-8)continue;
    const point=panel.positionsMm[0],depth=dot(sub(point,origin),normal)/den,world=origin.map((v,k)=>v+basis.forward[k]*depth) as XYZ,local=unplacePoint(world,panel.placement);
    if(best&&depth<=best.depth)continue;
    const bounds=localBounds(panel);if(local.some((v,k)=>v<bounds.min[k]-1e-8||v>bounds.max[k]+1e-8))continue;
    for(let i=0;i<panel.triangles.length;i+=3){
      const [p,q,r]=panel.triangles.slice(i,i+3).map(n=>panel.vertices[n].localMm);
      const determinant=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1]);if(Math.abs(determinant)<1e-12)continue;
      const u=((q[1]-r[1])*(local[0]-r[0])+(r[0]-q[0])*(local[1]-r[1]))/determinant;
      const v=((r[1]-p[1])*(local[0]-r[0])+(p[0]-r[0])*(local[1]-r[1]))/determinant,w=1-u-v;
      if(Math.min(u,v,w)>=-1e-8){best={depth,anchor:mapSurfaceAnchor(model,panel.id,i/3,[u,v,w])};break;}
    }
  }
  return best?.anchor??null;
}
export function measureSurfaceAnchors(a:SurfaceAnchor,b:SurfaceAnchor){
  const spatialMm=Math.hypot(...sub(a.worldMm,b.worldMm));
  const restMm=a.panelId===b.panelId?Math.hypot(a.localMm[0]-b.localMm[0],a.localMm[1]-b.localMm[1]):null;
  return {spatialMm,restMm,kind:restMm===null?'inter-panel-gap' as const:'same-panel-straight' as const};
}
export function calibrateScreen(rulerCssPx:number,measuredPhysicalMm:number,deviceKey:string){
  if(!Number.isFinite(rulerCssPx)||rulerCssPx<=0||!Number.isFinite(measuredPhysicalMm)||measuredPhysicalMm<10||measuredPhysicalMm>1000)throw new Error('请填写实体尺实测长度（10–1000 mm）');
  return {cssPxPerPhysicalMm:rulerCssPx/measuredPhysicalMm,deviceKey};
}
