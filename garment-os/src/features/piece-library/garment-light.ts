import type { XY } from '@/types/pattern3d';

/** Gouraud lighting in projected space: shared vertex lighting stays continuous
 * across triangle edges. A single flat colour per face exposes the tessellation. */
export function garmentLightGradient(points:XY[],values:number[]){
  const low=Math.min(...values),high=Math.max(...values),range=high-low;
  const [p,q,r]=points,dx=q[0]-p[0],dy=q[1]-p[1],ex=r[0]-p[0],ey=r[1]-p[1],det=dx*ey-dy*ex;
  if(range<1e-7||Math.abs(det)<1e-10)return null;
  const gx=((values[1]-values[0])*ey-(values[2]-values[0])*dy)/det,gy=(dx*(values[2]-values[0])-ex*(values[1]-values[0]))/det;
  const from=points[values.indexOf(low)],scale=range/(gx*gx+gy*gy);
  return {from,to:[from[0]+gx*scale,from[1]+gy*scale] as XY,low,high};
}
