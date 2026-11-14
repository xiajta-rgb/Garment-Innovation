import { modelBounds } from './viewport-mapping';
import type { PatternMesh3d,XYZ } from '@/types/pattern3d';
export interface ViewportGrid {stepMm:number;sizeMm:number;divisions:number;centerMm:XYZ;lines:Array<{a:XYZ;b:XYZ;axis:'x'|'z'|null}>}
const grids=new WeakMap<PatternMesh3d,ViewportGrid>();
/** Reference floor only; neither the CAD model nor its transform is modified. */
export function viewportGrid(model:PatternMesh3d):ViewportGrid {
  const cached=grids.get(model);if(cached)return cached;
  const bounds=modelBounds(model),target=Math.max(10,bounds.radius/6),power=10**Math.floor(Math.log10(target));
  const stepMm=[1,2,5,10].map(n=>n*power).find(n=>n>=target)!;
  const divisions=2*Math.max(5,Math.ceil(bounds.radius*1.3/stepMm)),sizeMm=divisions*stepMm,half=sizeMm/2;
  const centerMm:XYZ=[bounds.center[0],bounds.min[1]-40,bounds.center[2]],lines:ViewportGrid['lines']=[];
  for(let i=-divisions/2;i<=divisions/2;i++){
    const offset=i*stepMm;
    lines.push({a:[centerMm[0]-half,centerMm[1],centerMm[2]+offset],b:[centerMm[0]+half,centerMm[1],centerMm[2]+offset],axis:i===0?'x':null});
    lines.push({a:[centerMm[0]+offset,centerMm[1],centerMm[2]-half],b:[centerMm[0]+offset,centerMm[1],centerMm[2]+half],axis:i===0?'z':null});
  }
  const result={stepMm,sizeMm,divisions,centerMm,lines};grids.set(model,result);return result;
}
