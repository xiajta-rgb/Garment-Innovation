/** Actual finished mesh / optional compatibility component, offline only. No browser launch. */
import fs from 'node:fs';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.GARMENT_SHARP_MODULE??'C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/garment-construction-20261111';fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const [{createPattern3d},{assembleGarment},{createFinishedGarment},{getReferenceMeasurements},{GarmentProjectedSurface},{fitGarmentCamera},{rasterGarment},{exportGarmentTechnicalSvg},{exportGarmentFashionSvg}]=await Promise.all([
 server.ssrLoadModule('/src/application/pattern-3d.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-assembly.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-finish.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts'),server.ssrLoadModule('/src/features/piece-library/GarmentProjectedSurface.tsx'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-view.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-raster.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-technical-view.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-fashion-sheet.ts')]);
 const results=[],appearance={color:'#87CEEB',fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0},size={width:1000,height:900,dpr:1};
 for(const id of ['brian-reference','t-shirt']){
  const source=createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:appearance.color,fabricId:'solid'}),model=assembleGarment(source),start=performance.now(),display=createFinishedGarment(model),durationMs=performance.now()-start;
  const camera=fitGarmentCamera(display,size,28,12);
  for(const [label,view]of [['after',camera],['neck',{...camera,centerMm:[0,-55,0],pixelsPerMm:3,tiltDeg:35}],['back',fitGarmentCamera(display,size,180,0)],['front',fitGarmentCamera(display,size,0,0)],['side',fitGarmentCamera(display,size,90,0)]]){
   if(process.env.GARMENT_RENDER_LEGACY_SVG==='1'){
    const content=renderToStaticMarkup(createElement('svg',{xmlns:'http://www.w3.org/2000/svg',width:size.width,height:size.height},createElement('rect',{width:'100%',height:'100%',fill:'#25262a'}),createElement(GarmentProjectedSurface,{model:display,camera:view,size,appearance,tileUrl:'',wire:false})));
    if(/NaN|Infinity/.test(content))throw Error('Invalid projection');fs.writeFileSync(`${out}/${id}-${label}-legacy-svg.svg`,content);await sharp(Buffer.from(content)).png().toFile(`${out}/${id}-${label}-legacy-svg.png`);
   }
   const raster=rasterGarment(display,appearance,view,size,{scale:2});
   await sharp(Buffer.from(raster.pixels.buffer),{raw:{width:raster.width,height:raster.height,channels:4}}).resize(size.width,size.height).png().toFile(`${out}/${id}-${label}-depth.png`);
  }
  fs.writeFileSync(`${out}/${id}-plan.json`,JSON.stringify({finishPlan:display.finishPlan,metrics:display.metrics,illustration:display.illustration,durationMs},null,2));results.push({id,durationMs,metrics:display.metrics,illustration:display.illustration,details:display.surfaces.filter(s=>s.detail).map(s=>({id:s.id,kind:s.detail.kind,triangles:s.triangles.length/3}))});
  const technical=exportGarmentTechnicalSvg(display);fs.writeFileSync(`${out}/${id}-technical.svg`,technical);await sharp(Buffer.from(technical)).png().toFile(`${out}/${id}-technical.png`);
  const fashion=exportGarmentFashionSvg(display);fs.writeFileSync(`${out}/${id}-fashion.svg`,fashion);await sharp(Buffer.from(fashion)).png().toFile(`${out}/${id}-fashion.png`);
 }
 const labels=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1160"><g font-family="sans-serif" font-size="16" fill="#334155"><text x="20" y="24">Brian / long sleeve</text><text x="620" y="24">Teagan / short sleeve</text><text x="20" y="595">Same finished mesh / front, back, side / fixed scale</text><text x="20" y="1150" font-size="13">Offline software viewport review / browser acceptance pending</text></g></svg>');
 await sharp({create:{width:1200,height:1160,channels:4,background:'#f6f8fa'}}).composite([
  {input:await sharp(`${out}/brian-reference-after-depth.png`).resize(600,540).toBuffer(),left:0,top:32},
  {input:await sharp(`${out}/t-shirt-after-depth.png`).resize(600,540).toBuffer(),left:600,top:32},
  {input:await sharp(`${out}/t-shirt-technical.png`).resize(1080,528,{fit:'contain',background:'#f6f8fa'}).toBuffer(),left:60,top:603},
  {input:labels,left:0,top:0}
 ]).png().toFile(`${out}/construction-overview.png`);
 fs.writeFileSync(`${out}/offline-validation.json`,JSON.stringify({kind:'shared-software-viewport-depth-raster-and-orthographic-views',renders:10,technicalViewSheets:2,fashionSheets:2,results,browserAcceptance:false,productionApproved:false},null,2));console.log(JSON.stringify(results.map(r=>({id:r.id,ms:r.durationMs,triangles:r.metrics.renderTriangles,illustration:r.illustration})),null,2));
}finally{await server.close();}
