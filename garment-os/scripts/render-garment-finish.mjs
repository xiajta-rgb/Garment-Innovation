/** Actual React compatibility renderer, explicitly offline; never a browser screenshot. */
import fs from 'node:fs';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const out='doc/evidence/garment-finish-20261111';fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const [{createPattern3d},{assembleGarment},{createGarmentDisplay},{getReferenceMeasurements},{GarmentProjectedSurface},{fitGarmentCamera,garmentNormals}]=await Promise.all([
 server.ssrLoadModule('/src/application/pattern-3d.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-assembly.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-surface.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts'),server.ssrLoadModule('/src/features/piece-library/GarmentProjectedSurface.tsx'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-view.ts')]);
 const results=[],appearance={color:'#87CEEB',fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0},size={width:900,height:900,dpr:1};
 for(const id of ['brian-reference','t-shirt']){
  const source=createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:appearance.color,fabricId:'solid'}),model=assembleGarment(source),snapshot=JSON.stringify(model),display=createGarmentDisplay(model);
  const baseline=`${out}/${id}-before-source.json`;
  if(!fs.existsSync(baseline))fs.copyFileSync(`doc/evidence/garment-assembly-20261111/${id}.json`,baseline);
  const previous=JSON.parse(fs.readFileSync(baseline,'utf8'));
  const before={source:previous,templateId:id,settings:{subdivision:0,thicknessMm:0,roundedEdges:false},surfaces:previous.surfaces.map(s=>({...s,sourceSurfaceId:s.id,layer:'outer',renderNormals:garmentNormals(s)})),metrics:{...display.metrics,renderTriangles:previous.quality.triangles}};
  const camera=fitGarmentCamera(display,size,35,12);
  for(const [label,shown,view]of [['before',before,camera],['after',display,camera],['neck',display,{...camera,centerMm:[0,-55,0],pixelsPerMm:3.2,tiltDeg:40}],['back',display,fitGarmentCamera(display,size,150,12)]]){
   const content=renderToStaticMarkup(createElement('svg',{xmlns:'http://www.w3.org/2000/svg',width:900,height:900},
    createElement('rect',{width:900,height:900,fill:'#25262a'}),createElement('text',{x:20,y:30,fill:'#ddd',fontFamily:'sans-serif',fontSize:15},`${id} | ${label} | offline actual component`),
    createElement(GarmentProjectedSurface,{model:shown,camera:view,size,appearance,tileUrl:'',wire:false})));
   if(/NaN|Infinity/.test(content))throw Error('Non-finite projection');
   const faces=(content.match(/data-garment-triangle=/g)??[]).length;if(faces!==shown.metrics.renderTriangles)throw Error('Wrong displayed triangle count');
   const file=`${out}/${id}-${label}.svg`;fs.writeFileSync(file,content);results.push({id,label,file,faces,browserScreenshot:false});
  }
  if(JSON.stringify(model)!==snapshot)throw Error('Source model mutated');fs.writeFileSync(`${out}/${id}-after-source.json`,snapshot);fs.writeFileSync(`${out}/${id}-display.json`,JSON.stringify({settings:display.settings,metrics:display.metrics,sourceUnchanged:true}));
 }
 fs.writeFileSync(`${out}/offline-review.json`,JSON.stringify({kind:'actual-React-display-surface-projection',renders:results,browserAcceptance:false,hardwareRendererVerified:false},null,2));console.log(results.map(r=>({id:r.id,label:r.label,faces:r.faces})));
}finally{await server.close();}
