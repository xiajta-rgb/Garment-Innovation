/** Actual finished mesh and software viewport; offline evidence, no browser. */
import fs from 'node:fs';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const stage=process.argv[2]??'after',out='doc/evidence/garment-edge-stability-20261111';
fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const [{createPattern3d},{assembleGarment},{createFinishedGarment},{getReferenceMeasurements},{fitGarmentCamera},{rasterGarment}]=await Promise.all([
  '/src/application/pattern-3d.ts','/src/lib/pattern/mesh/garment-assembly.ts','/src/lib/pattern/mesh/garment-finish.ts','/src/data/referenceMeasurements.ts','/src/lib/pattern/mesh/garment-view.ts','/src/lib/pattern/mesh/garment-raster.ts'
 ].map(p=>server.ssrLoadModule(p)));
 const results=[],appearance={color:'#87CEEB',fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0},size={width:900,height:650,dpr:1};
 for(const id of ['t-shirt','brian-reference']){
  const source=createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:appearance.color,fabricId:'solid'}),display=createFinishedGarment(assembleGarment(source)),unchanged=JSON.stringify(display),camera=fitGarmentCamera(display,size,28,12);
  for(const [label,view]of [['oblique',camera],['front',fitGarmentCamera(display,size,0,0)],['neck',{...camera,centerMm:[0,-55,0],pixelsPerMm:3,tiltDeg:35}]]){
   const start=performance.now(),frame=rasterGarment(display,appearance,view,size),ms=performance.now()-start;
   await sharp(Buffer.from(frame.pixels.buffer),{raw:{width:frame.width,height:frame.height,channels:4}}).resize(size.width,size.height).png().toFile(`${out}/${stage}-${id}-${label}.png`);
   const repeat=rasterGarment(display,appearance,view,size);
   if(!Buffer.from(frame.pixels).equals(Buffer.from(repeat.pixels)))throw Error('Non-deterministic frame');
   results.push({id,label,ms,width:frame.width,height:frame.height,triangles:frame.triangles,deterministic:true});
  }
  if(JSON.stringify(display)!==unchanged)throw Error('Renderer mutated millimeter geometry');
 }
 fs.writeFileSync(`${out}/${stage}.json`,JSON.stringify({kind:'actual-software-renderer-offline',results,sourceUnchanged:true,browserAcceptance:false,gpuMeasured:false},null,2));
 console.log(JSON.stringify(results,null,2));
}finally{await server.close();}
