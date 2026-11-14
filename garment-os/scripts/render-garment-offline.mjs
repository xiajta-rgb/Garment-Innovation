/** Render the actual textured fallback component. These are offline projections, not browser screenshots. */
import fs from 'node:fs';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const out='doc/evidence/garment-assembly-20261111';fs.mkdirSync(out,{recursive:true});
const tileUrl=`data:image/png;base64,${fs.readFileSync(`${out}/fabric-tile.png`).toString('base64')}`,imageUrl=`data:image/png;base64,${fs.readFileSync(`${out}/sample-print.png`).toString('base64')}`;
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const [{createPattern3d},{assembleGarment},{getReferenceMeasurements},{GarmentProjectedSurface},{fitGarmentCamera},{createGarmentDisplay}]=await Promise.all([
 server.ssrLoadModule('/src/application/pattern-3d.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-assembly.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts'),server.ssrLoadModule('/src/features/piece-library/GarmentProjectedSurface.tsx'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-view.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-surface.ts')]);
 const results=[];
 for(const id of ['brian-reference','t-shirt','womens-basic-tee','long-sleeve-tee','bound-tank']){
  const source=createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#5785bd',fabricId:'solid'}),snapshot=JSON.stringify(source),start=performance.now(),model=assembleGarment(source);
  if(JSON.stringify(source)!==snapshot)throw Error('Source CAD mutated');
  fs.writeFileSync(`${out}/${id}.json`,JSON.stringify(model));
  const display=createGarmentDisplay(model);
  for(const yaw of [0,35,150]){
   const size={width:1100,height:900,dpr:1},camera=fitGarmentCamera(model,size,yaw,8),appearance={color:'#5785bd',fabric:'checker',repeatMm:80,imageDataUrl:imageUrl,imageMode:'print',imageTarget:'front',rotationDeg:0};
   const content=renderToStaticMarkup(createElement('svg',{xmlns:'http://www.w3.org/2000/svg',width:1100,height:900},
    createElement('rect',{width:1100,height:900,fill:'#25262a'}),createElement('text',{x:24,y:32,fill:'#ddd',fontFamily:'sans-serif',fontSize:18},`${id} | assembled surfaces + actual UV image | offline projection`),
    createElement(GarmentProjectedSurface,{model:display,camera,size,appearance,tileUrl,wire:false})));
   if(/NaN|Infinity/.test(content))throw Error('Invalid projected coordinates');
   const count=(content.match(/data-garment-triangle=/g)??[]).length;if(count!==display.metrics.renderTriangles)throw Error('Wrong rendered triangle count');
   const file=`${out}/${id}-${yaw}.svg`;
   fs.writeFileSync(file,content);
  }
  results.push({id,ms:performance.now()-start,surfaces:model.surfaces.length,quality:model.quality,display:display.metrics,sourceUnchanged:true,browserScreenshot:false});
 }
 fs.writeFileSync(`${out}/offline-verification.json`,JSON.stringify({kind:'actual-react-textured-garment-projection',renders:15,browserAcceptance:false,results},null,2));console.log(JSON.stringify(results.map(r=>({id:r.id,surfaces:r.surfaces,components:r.quality.connectedComponents,triangles:r.quality.triangles})),null,2));
}finally{await server.close();}
