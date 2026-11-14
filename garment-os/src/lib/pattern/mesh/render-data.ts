import type { PatternMesh3d,XYZ } from '@/types/pattern3d';
import { modelBounds } from './viewport-mapping';
import { MESH_PRECISION } from './precision-policy';
export interface RenderGeometry {key:string;positions:Float32Array;indices:Uint32Array;center2d:[number,number]}
export interface MeshRenderData {originMm:XYZ;radiusMm:number;geometries:RenderGeometry[];panels:Array<{id:string;geometry:string;yawDeg:number;translation:XYZ}>;maxUploadErrorMm:number;maxTransformQuantizationMm:number}
/** Canonical CAD stays Float64. GPU buffers are disposable, locally rebased Float32 copies. */
export function prepareMeshRenderData(model:PatternMesh3d):MeshRenderData{
  const bounds=modelBounds(model),geometries:RenderGeometry[]=[],panels:MeshRenderData['panels']=[];let maxError=0,maxTransformError=0;
  for(const panel of model.panels){
    let geometry=geometries.find(g=>g.key===panel.sourceId);
    if(!geometry){
      const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const v of panel.vertices)for(let k=0;k<2;k++){min[k]=Math.min(min[k],v.localMm[k]);max[k]=Math.max(max[k],v.localMm[k]);}
      const center:[number,number]=[(min[0]+max[0])/2,(min[1]+max[1])/2],positions=new Float32Array(panel.vertices.length*3);
      panel.vertices.forEach((v,i)=>{positions[i*3]=v.localMm[0]-center[0];positions[i*3+1]=-(v.localMm[1]-center[1]);maxError=Math.max(maxError,Math.abs(positions[i*3]+center[0]-v.localMm[0]),Math.abs(-positions[i*3+1]+center[1]-v.localMm[1]));});
      geometry={key:panel.sourceId,positions,indices:new Uint32Array(panel.triangles),center2d:center};geometries.push(geometry);
    }else{
      const source=model.panels.find(p=>p.sourceId===panel.sourceId)!;
      if(source.vertices.length!==panel.vertices.length||source.triangles.length!==panel.triangles.length||source.triangles.some((v,i)=>v!==panel.triangles[i])||source.vertices.some((v,i)=>v.localMm.some((n,k)=>n!==panel.vertices[i].localMm[k])))throw new Error('同源副本几何不一致，不能复用显示缓冲');
    }
    const a=panel.placement.yawDeg*Math.PI/180,[cx,cy]=geometry.center2d,[tx,ty,tz]=panel.placement.translationMm;
    const translation:XYZ=[tx+cx*Math.cos(a)-bounds.center[0],ty-cy-bounds.center[1],tz-cx*Math.sin(a)-bounds.center[2]];
    panels.push({id:panel.id,geometry:geometry.key,yawDeg:panel.placement.yawDeg,translation});
    // CPU Float32 arithmetic probe of uploaded instance matrices AND batched outlines.
    // Actual shader/compiler/raster precision still requires hardware verification.
    const f=Math.fround,c=Math.cos(a),s=Math.sin(a);
    for(let i=0;i<panel.vertices.length;i++){
      const x=geometry.positions[i*3],y=geometry.positions[i*3+1],expected=panel.positionsMm[i].map((v,k)=>v-bounds.center[k]);
      const instance=[f(f(f(c)*x)+f(translation[0])),f(y+f(translation[1])),f(f(f(-s)*x)+f(translation[2]))];
      const outline=[f(c*x+translation[0]),f(y+translation[1]),f(-s*x+translation[2])];
      maxTransformError=Math.max(maxTransformError,...[instance,outline].map(p=>Math.hypot(...p.map((v,k)=>v-expected[k]))));
    }
  }
  if(maxError>MESH_PRECISION.localBufferMm)throw new Error('GPU局部坐标量化误差超过0.001mm，已阻断可视化');
  if(!Number.isFinite(maxTransformError)||maxTransformError>MESH_PRECISION.float32TransformProbeMm)throw new Error('显示实例或轮廓的浮点量化估算超过0.01mm，已阻断可视化');
  return {originMm:bounds.center,radiusMm:bounds.radius,geometries,panels,maxUploadErrorMm:maxError,maxTransformQuantizationMm:maxTransformError};
}
