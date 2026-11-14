import { expect,it } from 'vitest';
import { edgeArcLength,edgeParameterAtLength } from '@/lib/pattern/mesh/edge-arclength';
import { edgePoint } from '@/lib/pattern/mesh/panel-mesh';
import type { AssemblyEdge } from '@/types/assembly';

const cubic:AssemblyEdge={id:'nonuniform-straight-cubic',kind:'curve',from:{x:0,y:0},cp1:{x:0,y:0},cp2:{x:0,y:0},to:{x:100,y:0},lengthMm:999};
it('inverts the analytic x=100t³ curve by distance instead of linear parameter',()=>{
  expect(edgeArcLength(cubic)).toBeCloseTo(100,10);
  for(const distance of [0,.01,1,25,50,99,100]){
    const t=edgeParameterAtLength(cubic,0,1,distance);
    expect(t).toBeCloseTo(Math.cbrt(distance/100),7);
    expect(edgePoint(cubic,t)[0]).toBeCloseTo(distance,5);
  }
});
it('preserves reverse direction, subinterval distances and exact endpoints',()=>{
  expect(edgeArcLength(cubic,1,.5)).toBeCloseTo(87.5,10);
  expect(edgePoint(cubic,edgeParameterAtLength(cubic,1,.5,25))[0]).toBeCloseTo(75,5);
  expect(edgeParameterAtLength(cubic,.5,1,0)).toBe(.5);
  expect(edgeParameterAtLength(cubic,1,.5,87.5)).toBe(.5);
});
it('agrees with an independent dense polyline integration of a curved cubic',()=>{
  const edge:AssemblyEdge={...cubic,cp1:{x:-80,y:150},cp2:{x:220,y:-20},to:{x:150,y:100}};
  let sum=0,previous=edgePoint(edge,0);const count=20000;
  const lengths=[0];
  for(let i=1;i<=count;i++){const p=edgePoint(edge,i/count);sum+=Math.hypot(p[0]-previous[0],p[1]-previous[1]);lengths.push(sum);previous=p;}
  expect(edgeArcLength(edge)).toBeCloseTo(sum,5);
  for(const fraction of [.1,.4,.8]){
    const t=edgeParameterAtLength(edge,0,1,sum*fraction),index=t*count,i=Math.floor(index),distance=lengths[i]+(lengths[i+1]-lengths[i])*(index-i);
    expect(distance).toBeCloseTo(sum*fraction,5);
  }
});
it('handles ordinary lines and degenerate curves, rejecting invalid distances',()=>{
  const line:AssemblyEdge={...cubic,kind:'line',to:{x:30,y:40}};
  expect(edgeArcLength(line)).toBe(50);expect(edgeParameterAtLength(line,1,0,15)).toBe(.7);
  const zero={...cubic,to:{x:0,y:0}};expect(edgeArcLength(zero)).toBe(0);expect(edgeParameterAtLength(zero,0,1,0)).toBe(0);
  for(const distance of [-1,101,NaN])expect(()=>edgeParameterAtLength(cubic,0,1,distance)).toThrow(/弧长范围/);
  expect(()=>edgeArcLength(cubic,-.1,1)).toThrow(/参数/);
});
it('integrates a reversing collinear cubic through its zero-speed points',()=>{
  const reversing={...cubic,cp1:{x:100,y:0},cp2:{x:-100,y:0},to:{x:0,y:0}};
  const length=200/Math.sqrt(3);expect(edgeArcLength(reversing)).toBeCloseTo(length,7);
  expect(edgeParameterAtLength(reversing,0,1,length/2)).toBeCloseTo(.5,7);
});
