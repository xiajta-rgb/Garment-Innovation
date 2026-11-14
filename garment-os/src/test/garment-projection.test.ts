import { expect,it } from 'vitest';
import { garmentLightGradient } from '@/features/piece-library/garment-light';
import type { XY } from '@/types/pattern3d';
it('interpolates lighting at every vertex, including a slanted projected triangle',()=>{
  const points:XY[]=[[23,37],[310,52],[88,490]],values=[.45,.86,.71],gradient=garmentLightGradient(points,values)!;
  const d=gradient.to.map((v,k)=>v-gradient.from[k]),squared=d[0]*d[0]+d[1]*d[1];
  for(const [i,p]of points.entries()){
    const t=((p[0]-gradient.from[0])*d[0]+(p[1]-gradient.from[1])*d[1])/squared;
    expect(gradient.low+(gradient.high-gradient.low)*t).toBeCloseTo(values[i],12);
  }
});
it('keeps constant lighting and edge-on projections finite',()=>{
  expect(garmentLightGradient([[0,0],[1,0],[0,1]],[.7,.7,.7])).toBeNull();
  expect(garmentLightGradient([[0,0],[1,1],[2,2]],[.5,.7,.9])).toBeNull();
});
