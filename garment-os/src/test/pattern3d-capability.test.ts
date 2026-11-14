import { afterAll,expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { createPattern3d } from '@/application/pattern-3d';
import { listExecutablePatterns } from '@/data/patternLibrary';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { fitPhysicalCamera,framePhysicalCamera,projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { viewportGrid } from '@/lib/pattern/mesh/viewport-grid';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import type { GenderType,StandardSize } from '@/types/measurements';
import type { Fit } from '@/types/design';

const results:unknown[]=[];
for(const template of listExecutablePatterns())for(const gender of ['male','female'] as GenderType[])for(const size of ['S','M','XL'] as StandardSize[])for(const fit of ['regular','loose'] as Fit[])
it(`source CAD → 3D: ${template.id}/${gender}/${size}/${fit}`,()=>{
  const model=createPattern3d({activePatternId:template.id,gender,standardSize:size,fit,measurements:getReferenceMeasurements(gender,size),engineVersion:'4.10.2',garmentColor:'#cccccc',fabricId:'solid'});
  const expected=getAssemblyDefinition(template.id).pieces.reduce((sum,p)=>sum+p.quantity,0);
  expect(model.panels).toHaveLength(expected);
  expect(model.productionApproved).toBe(false);expect(model.simulationReady).toBe(false);expect(model.drapeValidated).toBe(false);
  const snapshot=JSON.stringify(model),viewport={width:1100,height:760,dpr:1},camera=fitPhysicalCamera(model,viewport);
  for(const panel of model.panels){
    expect(panel.positionsMm).toHaveLength(panel.vertices.length);
    expect(panel.metrics.maxRoundtripMm).toBeLessThan(1e-6);expect(panel.metrics.maxEdgeDistortionMm).toBeLessThan(1e-6);
    // Independently evaluate source Bernstein curves at sampled trace parameters.
    for(const vertex of panel.vertices.filter((_,i)=>i%Math.max(1,Math.floor(panel.vertices.length/20))===0)){
      const edge=panel.sourceEdges.find(e=>e.id===vertex.sourceEdge)!,t=vertex.t,u=1-t;
      const coordinate=(axis:'x'|'y')=>edge.kind==='line'?u*edge.from[axis]+t*edge.to[axis]:u**3*edge.from[axis]+3*u*u*t*edge.cp1![axis]+3*u*t*t*edge.cp2![axis]+t**3*edge.to[axis];
      expect(Math.hypot(coordinate('x')-vertex.sourceMm[0],coordinate('y')-vertex.sourceMm[1])).toBeLessThan(1e-6);
    }
  }
  for(const angles of [{yawDeg:25,tiltDeg:12},{yawDeg:0,tiltDeg:0},{yawDeg:90,tiltDeg:0}]){
    const framed=framePhysicalCamera(model,viewport,{...camera,...angles}),points=model.panels.flatMap(p=>p.positionsMm.map(point=>projectPhysicalPoint(point,framed,viewport)));
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(viewport.width*.079);expect(Math.max(...xs)).toBeLessThanOrEqual(viewport.width*.921);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(viewport.height*.079);expect(Math.max(...ys)).toBeLessThanOrEqual(viewport.height*.921);
    expect(Math.max((Math.max(...xs)-Math.min(...xs))/viewport.width,(Math.max(...ys)-Math.min(...ys))/viewport.height)).toBeGreaterThan(.83);
  }
  const grid=viewportGrid(model);expect(grid.stepMm).toBeGreaterThan(0);expect(grid.divisions).toBeLessThan(60);expect(JSON.stringify(model)).toBe(snapshot);
  results.push({template:template.id,gender,size,fit,panels:expected,sourceTrace:true,framing:true,manufacturingApproved:false});
});
afterAll(()=>{const out='doc/evidence/3d-workbench-20261111';mkdirSync(out,{recursive:true});writeFileSync(`${out}/source-capability-matrix.json`,JSON.stringify({kind:'numerical-source-verification',browserAcceptance:false,cases:results},null,2));});
