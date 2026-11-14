import type { AssemblyEdge } from '@/types/assembly';

const nodes=[0,-.5384693101056831,.5384693101056831,-.906179845938664,.906179845938664];
const weights=[.5688888888888889,.4786286704993665,.4786286704993665,.2369268850561891,.2369268850561891];
const validParameter=(t:number)=>{if(!Number.isFinite(t)||t<0||t>1)throw Error('曲线参数必须位于0至1之间');};
function speed(edge:AssemblyEdge,t:number){
  const a=1-t,p=edge.cp1!,q=edge.cp2!;
  return Math.hypot(3*a*a*(p.x-edge.from.x)+6*a*t*(q.x-p.x)+3*t*t*(edge.to.x-q.x),
    3*a*a*(p.y-edge.from.y)+6*a*t*(q.y-p.y)+3*t*t*(edge.to.y-q.y));
}
function quadrature(edge:AssemblyEdge,a:number,b:number){
  const half=(b-a)/2,mid=(a+b)/2;let sum=0;
  for(let i=0;i<nodes.length;i++)sum+=weights[i]*speed(edge,mid+half*nodes[i]);
  return half*sum;
}
function derivativeRoots(p:number,c:number,d:number,q:number){
  const a=q-3*d+3*c-p,b=2*(d-2*c+p),v=c-p,epsilon=1e-14*Math.max(1,Math.abs(a),Math.abs(b),Math.abs(v));
  if(Math.abs(a)<epsilon)return Math.abs(b)<epsilon?[]:[-v/b];
  const discriminant=b*b-4*a*v;if(discriminant<0)return [];
  const stable=-.5*(b+(b>=0?1:-1)*Math.sqrt(discriminant));
  return stable===0?[-b/(2*a)]:[stable/a,v/stable];
}
/** Integrate actual cubic speed in source millimetres; chord flatness does not
 * imply uniform parameter speed. Independent of the edge's cached lengthMm. */
export function edgeArcLength(edge:AssemblyEdge,from=0,to=1):number{
  validParameter(from);validParameter(to);if(from===to)return 0;
  if(edge.kind==='line')return Math.abs(to-from)*Math.hypot(edge.to.x-edge.from.x,edge.to.y-edge.from.y);
  if(!edge.cp1||!edge.cp2)throw Error('三次曲线缺少控制点');
  const integrate=(a:number,b:number,whole:number,tolerance:number,depth:number):number=>{
    const mid=(a+b)/2,left=quadrature(edge,a,mid),right=quadrature(edge,mid,b),sum=left+right;
    if(Math.abs(sum-whole)<=Math.max(1e-13,tolerance))return sum;
    if(depth>=20)throw Error('曲线弧长积分未收敛');
    return integrate(a,mid,left,tolerance/2,depth+1)+integrate(mid,b,right,tolerance/2,depth+1);
  };
  const a=Math.min(from,to),b=Math.max(from,to);
  // At zero speed the norm has a cusp. Split at coordinate extrema so a
  // reversing straight cubic does not exhaust quadrature recursion there.
  const cuts=[a,...new Set([...derivativeRoots(edge.from.x,edge.cp1.x,edge.cp2.x,edge.to.x),...derivativeRoots(edge.from.y,edge.cp1.y,edge.cp2.y,edge.to.y)].filter(t=>t>a&&t<b)),b].sort((x,y)=>x-y);
  let length=0;for(let i=1;i<cuts.length;i++)length+=integrate(cuts[i-1],cuts[i],quadrature(edge,cuts[i-1],cuts[i]),1e-9*(cuts[i]-cuts[i-1])/(b-a),0);
  return length;
}
/** Invert physical distance over an oriented parameter interval. The optional
 * length is the previously integrated interval length, never a chord length. */
export function edgeParameterAtLength(edge:AssemblyEdge,from:number,to:number,distanceMm:number,length=edgeArcLength(edge,from,to)){
  validParameter(from);validParameter(to);
  if(!Number.isFinite(distanceMm)||!Number.isFinite(length)||length<0||distanceMm<0||distanceMm>length)throw Error('曲线站位距离超出弧长范围');
  if(distanceMm===0||length===0)return from;if(distanceMm===length)return to;
  if(edge.kind==='line')return from+(to-from)*distanceMm/length;
  let low=0,high=1;
  for(let i=0;i<28;i++){
    const fraction=(low+high)/2,t=from+(to-from)*fraction;
    if(edgeArcLength(edge,from,t)<distanceMm)low=fraction;else high=fraction;
  }
  return from+(to-from)*(low+high)/2;
}
