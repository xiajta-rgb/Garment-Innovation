import type { XY } from '@/types/pattern3d';

const segmentDistance=(p:XY,a:XY,b:XY)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
/** Screen-space simplification. It never modifies millimetre geometry. */
export function simplifyViewLine(points:XY[],tolerance=.3):XY[]{
  if(points.length<3)return points;
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop()!;let far=tolerance,index=-1;
    for(let i=a+1;i<b;i++){const d=segmentDistance(points[i],points[a],points[b]);if(d>far){far=d;index=i;}}
    if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
export const viewPoint=(p:XY)=>p.map(v=>v.toFixed(2)).join(' ');
export const viewLine=(points:XY[])=>points.length>1?`M${points.map(viewPoint).join('L')}`:'';

/** Rounded vector joins for a display contour. Sharp garment corners stay sharp.
 * Controls remain in the local triangle, so this never creates spline overshoot. */
export function cleanViewContour(points:XY[],tolerance=3){
  if(points.length<4)return viewLine(points)+'Z';
  const ring=[...points];if(Math.hypot(...ring[0].map((v,k)=>v-ring.at(-1)![k]))<1e-8)ring.pop();
  let split=1,far=0;
  for(let i=1;i<ring.length;i++){const d=Math.hypot(...ring[i].map((v,k)=>v-ring[0][k]));if(d>far){far=d;split=i;}}
  const p=[...simplifyViewLine(ring.slice(0,split+1),tolerance),...simplifyViewLine([...ring.slice(split),ring[0]],tolerance).slice(1,-1)];
  const corners=p.map((v,i)=>{
    const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length],la=Math.hypot(...v.map((n,k)=>n-a[k])),lb=Math.hypot(...v.map((n,k)=>b[k]-n));
    const cosine=((v[0]-a[0])*(b[0]-v[0])+(v[1]-a[1])*(b[1]-v[1]))/(la*lb||1);
    // Preserve sleeve tips, underarms and pocket corners (turns >= 40 degrees).
    const r=cosine>Math.cos(40*Math.PI/180)?Math.min(16,la*.45,lb*.45):0;
    const enter=v.map((n,k)=>n+(a[k]-n)*r/(la||1)) as XY,exit=v.map((n,k)=>n+(b[k]-n)*r/(lb||1)) as XY;
    const c1=enter.map((n,k)=>n+(v[k]-n)*2/3) as XY,c2=exit.map((n,k)=>n+(v[k]-n)*2/3) as XY;
    return {enter,exit,c1,c2,r};
  });
  return `M${viewPoint(corners[0].enter)}`+corners.map((c,i)=>(i?`L${viewPoint(c.enter)}`:'')+(c.r?`C${viewPoint(c.c1)} ${viewPoint(c.c2)} ${viewPoint(c.exit)}`:'')).join('')+'Z';
}

/** Trace the visible union instead of exposing thousands of triangle edges.
 * Half-pixel occupancy comes from the orthographic depth test used for seams. */
export function maskContour(mask:Uint8Array,width:number,height:number,scale:number,ribOnly=false){
  const edges=new Map<number,number[]>(),stride=width+1,has=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height&&(ribOnly?mask[y*width+x]===2:mask[y*width+x]>0);
  const add=(a:number,b:number)=>{const list=edges.get(a)??[];list.push(b);edges.set(a,list);};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(has(x,y)){
    const a=y*stride+x,b=a+1,c=b+stride,d=a+stride;
    if(!has(x,y-1))add(a,b);if(!has(x+1,y))add(b,c);if(!has(x,y+1))add(c,d);if(!has(x-1,y))add(d,a);
  }
  let result='';
  while(edges.size){const start=edges.keys().next().value!,loop:XY[]=[];let current=start;
    do{loop.push([current%stride/scale,Math.floor(current/stride)/scale]);const next=edges.get(current);if(!next?.length)break;const end=next.pop()!;if(!next.length)edges.delete(current);current=end;}while(current!==start);
    if(loop.length<4)continue;
    // Remove the half-pixel staircase before simplification. Four local
    // averaging passes round raster corners by under one display pixel.
    let smooth=loop;for(let pass=0;pass<4;pass++){const old=smooth;smooth=old.map((p,i)=>p.map((v,k)=>(old[(i+old.length-1)%old.length][k]+2*v+old[(i+1)%old.length][k])/4) as XY);}
    const xs=smooth.map(p=>p[0]),ys=smooth.map(p=>p[1]);
    // Small details use a smaller bound; keep separate loops and openings.
    const tolerance=Math.min(3,Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*.025);
    result+=cleanViewContour(smooth,tolerance);
  }
  return result;
}
