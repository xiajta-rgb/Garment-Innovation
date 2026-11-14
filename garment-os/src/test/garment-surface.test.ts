import { afterAll,expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import { createGarmentDisplay,DEFAULT_GARMENT_SURFACE } from '@/lib/pattern/mesh/garment-surface';
import { garmentUsesImage,pickGarment } from '@/lib/pattern/mesh/garment-view';
import { projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { createPattern3d } from '@/application/pattern-3d';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import type { GarmentAssembly3d,GarmentDisplay3d } from '@/types/garment3d';

const evidence:unknown[]=[];
function edgeAudit(display:GarmentDisplay3d){
  const edges=new Map<string,{count:number;direction:number}>(),positions=new Map<number,number[]>();
  for(const s of display.surfaces){
    for(const [i,id]of s.simulationIds.entries()){const old=positions.get(id);if(old)expect(s.positionsMm[i]).toEqual(old);else positions.set(id,s.positionsMm[i]);}
    for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){
      const a=s.simulationIds[s.triangles[t+k]],b=s.simulationIds[s.triangles[t+(k+1)%3]],key=[Math.min(a,b),Math.max(a,b)].join(':');expect(a).not.toBe(b);
      const value=edges.get(key)??{count:0,direction:0};value.count++;value.direction+=a<b?1:-1;edges.set(key,value);
    }
  }
  return edges;
}
function plane():GarmentAssembly3d{
  return {schema:'garment-os/garment-assembly/v1',templateId:'numeric-plane-fixture',unit:'mm',stage:'seam-constrained-preview',sourcePanelCount:1,seams:[],unassembledPanelIds:[],pending:[],drapeValidated:false,productionApproved:false,
    quality:{vertices:4,triangles:2,iterations:0,strainP95:0,maxStrain:0,maxSeamGapMm:0,connectedComponents:1,remeshAreaErrorRatio:0,nonManifoldEdges:0,boundaryLoops:1,maxBoundarySnapMm:0,maxBoundaryDeviationMm:0},
    surfaces:[{id:'fixture.front#1',sourceId:'fixture.front',copy:1,foldAxis:null,sourceHalfSign:0,localMm:[[0,0],[100,0],[100,100],[0,100]],uvMm:[[0,0],[100,0],[100,100],[0,100]],positionsMm:[[0,0,0],[100,0,0],[100,-100,0],[0,-100,0]],triangles:[0,1,2,0,2,3],simulationIds:[0,1,2,3],boundary:[0,1,2,3]}]};
}

for(const id of ['brian-reference','t-shirt','womens-basic-tee','long-sleeve-tee','bound-tank'])it(`display shell, normals and immutable source: ${id}`,()=>{
  const source=assembleGarment(createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#87CEEB',fabricId:'solid'})),before=JSON.stringify(source),start=performance.now(),display=createGarmentDisplay(source),duration=performance.now()-start;
  expect(JSON.stringify(source)).toBe(before);expect(createGarmentDisplay(source)).toBe(display);expect(display.metrics.closedShell).toBe(true);
  expect(display.metrics.maxBoundaryDisplacementMm).toBeLessThanOrEqual(1+1e-9);expect(display.metrics.maxControlDisplacementMm).toBeLessThanOrEqual(2+1e-9);
  const edges=edgeAudit(display);expect([...edges.values()].every(e=>e.count===2&&e.direction===0)).toBe(true);
  const shared=new Map<number,number[]>();
  for(const s of display.surfaces.filter(s=>s.layer==='outer')){
    const original=source.surfaces.find(p=>p.id===s.sourceSurfaceId)!;expect(s.uvMm.slice(0,original.uvMm.length)).toEqual(original.uvMm);expect(s.triangles.length).toBe(original.triangles.length*4);
    const inner=display.surfaces.find(p=>p.sourceSurfaceId===s.sourceSurfaceId&&p.layer==='inner')!;
    for(let i=0;i<s.positionsMm.length;i++){
      expect(Math.hypot(...s.renderNormals[i])).toBeCloseTo(1,10);expect(Math.hypot(...s.positionsMm[i].map((v,k)=>v-inner.positionsMm[i][k]))).toBeCloseTo(.8,9);
      const id=s.simulationIds[i],old=shared.get(id);if(old)expect(s.renderNormals[i]).toEqual(old);else shared.set(id,s.renderNormals[i]);
    }
  }
  evidence.push({id,displayConstructionMs:duration,metrics:display.metrics,independentClosedEdgeAudit:true,sourceUnchanged:true});
},15000);

it('millimetre thickness is symmetric, boundary rims do not cap the opening, and display limits are explicit',()=>{
  const source=plane(),display=createGarmentDisplay(source),outer=display.surfaces[0],inner=display.surfaces[1],rim=display.surfaces[2];
  expect(outer.positionsMm.every(p=>Math.abs(p[2]-.4)<1e-10)).toBe(true);expect(inner.positionsMm.every(p=>Math.abs(p[2]+.4)<1e-10)).toBe(true);
  expect(display.metrics.renderTriangles).toBe(80);expect(display.metrics.boundaryEdges).toBe(8);expect(rim.triangles.length/3).toBe(64);
  expect(display.metrics.maxBoundaryDisplacementMm).toBeCloseTo(1,10);expect([...edgeAudit(display).values()].every(e=>e.count===2&&e.direction===0)).toBe(true);
});
it('flat, rounded, thin and high quality settings produce distinct cached geometry without modifying the draft',()=>{
  const source=plane(),before=JSON.stringify(source),thin=createGarmentDisplay(source,{subdivision:0,thicknessMm:0,roundedEdges:false});
  expect(thin.surfaces).toHaveLength(1);expect(thin.metrics.renderTriangles).toBe(2);expect(thin.metrics.closedShell).toBe(false);expect([...edgeAudit(thin).values()].filter(e=>e.count===1)).toHaveLength(4);
  const square=createGarmentDisplay(source,{subdivision:1,thicknessMm:1.2,roundedEdges:false}),fine=createGarmentDisplay(source,{subdivision:2,thicknessMm:1.2,roundedEdges:true});
  expect(fine.metrics.renderTriangles).toBeGreaterThan(square.metrics.renderTriangles);expect([...edgeAudit(square).values()].every(e=>e.count===2&&e.direction===0)).toBe(true);expect([...edgeAudit(fine).values()].every(e=>e.count===2&&e.direction===0)).toBe(true);
  expect(fine.metrics.maxBoundaryDisplacementMm).toBeLessThanOrEqual(1+1e-9);expect(JSON.stringify(source)).toBe(before);
});
it('picking follows the displayed triangle and maps back to its source coordinates',()=>{
  const display=createGarmentDisplay(plane()),size={width:500,height:500,dpr:2},camera={centerMm:[50,-50,0] as [number,number,number],yawDeg:0,tiltDeg:0,pixelsPerMm:3,panCss:[0,0] as [number,number]},s=display.surfaces[0],ids=s.triangles.slice(0,3),weights=[.2,.3,.5];
  const world=[0,1,2].map(k=>ids.reduce((sum,id,j)=>sum+s.positionsMm[id][k]*weights[j],0)) as [number,number,number],uv=[0,1].map(k=>ids.reduce((sum,id,j)=>sum+s.uvMm[id][k]*weights[j],0)),hit=pickGarment(display,camera,size,projectPhysicalPoint(world,camera,size))!;
  expect(hit.id).toBe(s.id);expect(hit.sourceMm[0]).toBeCloseTo(uv[0],9);expect(hit.sourceMm[1]).toBeCloseTo(uv[1],9);
});
it('prints apply to the exterior only and invalid display settings fail closed',()=>{
  const source=plane(),d=createGarmentDisplay(source),a={color:'#ffffff',fabric:'solid' as const,repeatMm:40,imageDataUrl:'data:image/png;base64,A',imageTarget:'all' as const,imageMode:'print' as const,rotationDeg:0};
  expect(d.surfaces.map(s=>garmentUsesImage(s,a))).toEqual([true,false,false]);
  for(const thicknessMm of [-1,6,NaN])expect(()=>createGarmentDisplay(source,{...DEFAULT_GARMENT_SURFACE,thicknessMm})).toThrow(/布厚/);
});
afterAll(()=>{mkdirSync('doc/evidence/garment-finish-20261111',{recursive:true});writeFileSync('doc/evidence/garment-finish-20261111/surface-validation.json',JSON.stringify({kind:'independent-render-shell-and-cad-trace-validation',cases:evidence,browserAcceptance:false,productionApproved:false},null,2));});
