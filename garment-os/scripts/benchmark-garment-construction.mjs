import {createServer} from 'vite';
import fs from 'node:fs';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {createPattern3d}=await server.ssrLoadModule('/src/application/pattern-3d.ts'),{assembleGarment}=await server.ssrLoadModule('/src/lib/pattern/mesh/garment-assembly.ts'),{createFinishedGarment}=await server.ssrLoadModule('/src/lib/pattern/mesh/garment-finish.ts'),{garmentTechnicalView}=await server.ssrLoadModule('/src/lib/pattern/mesh/garment-technical-view.ts'),{getReferenceMeasurements}=await server.ssrLoadModule('/src/data/referenceMeasurements.ts');
 const {rasterGarment}=await server.ssrLoadModule('/src/lib/pattern/mesh/garment-raster.ts'),{fitGarmentCamera}=await server.ssrLoadModule('/src/lib/pattern/mesh/garment-view.ts'),results=[];
 const model=assembleGarment(createPattern3d({activePatternId:'brian-reference',gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#87CEEB',fabricId:'solid'}));
 for(const subdivision of [1,2]){let start=performance.now();const d=createFinishedGarment(model,{surface:{subdivision,thicknessMm:.8,roundedEdges:true}}),result={subdivision,createMs:performance.now()-start,triangles:d.metrics.renderTriangles,views:[]};for(const yaw of [0,180,90]){start=performance.now();garmentTechnicalView(d,yaw,150,150);result.views.push({yaw,viewMs:performance.now()-start});}
  const size={width:900,height:650,dpr:1},camera=fitGarmentCamera(d,size);start=performance.now();const frame=rasterGarment(d,{color:'#87CEEB',fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0},camera,size);result.softwareFrameMs=performance.now()-start;result.rasterPixels=frame.width*frame.height;results.push(result);
 }
 const report={kind:'offline-cpu-only-benchmark',results,browserAcceptance:false,hardwareGpuFpsMeasured:false};fs.writeFileSync('doc/evidence/garment-construction-20261111/cpu-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
