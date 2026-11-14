/** Company profile -> shared viewport mesh -> offline depth renders. No browser. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const sharp=createRequire(import.meta.url)(process.env.GARMENT_SHARP_MODULE??'C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out='doc/evidence/company-master-20261111';fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const [{COMPANY_STYLE_MASTERS},{createPattern3d},{getReferenceMeasurements},{assembleGarment},{createFinishedGarment},{fitGarmentCamera},{rasterGarment},{exportGarmentTechnicalSvg}]=await Promise.all([
  server.ssrLoadModule('/src/data/companyStyleMasters.ts'),server.ssrLoadModule('/src/application/pattern-3d.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-assembly.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-finish.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-view.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-raster.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-technical-view.ts')]);
 const results=[],size={width:900,height:800,dpr:1};
 for(const m of COMPANY_STYLE_MASTERS.filter(m=>m.cadTemplateId)){
  const config={activePatternId:m.cadTemplateId,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:m.color,fabricId:'solid'},source=createPattern3d(config),model=assembleGarment(source),before=JSON.stringify(model),appearance={color:m.color,fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0,companyMasterId:m.id,finish:m.finish},start=performance.now(),display=createFinishedGarment(model,appearance),durationMs=performance.now()-start;
  for(const [name,yaw,tilt]of [['front',0,0],['back',180,0],['oblique',28,12],['side',90,0]]){
   const raster=rasterGarment(display,appearance,fitGarmentCamera(display,size,yaw,tilt),size,{scale:1.5});
   await sharp(Buffer.from(raster.pixels.buffer),{raw:{width:raster.width,height:raster.height,channels:4}}).resize(size.width,size.height).png().toFile(`${out}/${m.source.styleCode}-3d-${name}.png`);
  }
  const technical=exportGarmentTechnicalSvg(display);fs.writeFileSync(`${out}/${m.source.styleCode}-3d-views.svg`,technical);await sharp(Buffer.from(technical)).png().toFile(`${out}/${m.source.styleCode}-3d-views.png`);
  if(JSON.stringify(model)!==before)throw Error('Source CAD was mutated');
  const item={masterId:m.id,referenceTemplateId:m.cadTemplateId,illustration:display.illustration,metrics:display.metrics,durationMs,sourceUnchanged:true,productionApproved:false};results.push(item);console.log(JSON.stringify(item));
 }
 await sharp({create:{width:1500,height:1100,channels:4,background:'#f6f7f4'}}).composite([
  {input:await sharp(`${out}/COT25M002.png`).resize(750,530).toBuffer(),left:0,top:0},
  {input:await sharp(`${out}/LT26M1581.png`).resize(750,530).toBuffer(),left:750,top:0},
  {input:await sharp(`${out}/COT25M002-3d-oblique.png`).resize(450,400).toBuffer(),left:140,top:540},
  {input:await sharp(`${out}/LT26M1581-3d-oblique.png`).resize(450,400).toBuffer(),left:890,top:540},
  {input:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1100"><g font-family="Microsoft YaHei, sans-serif" fill="#52623d" font-size="17"><text x="140" y="990">COT25M002 · 公司母版派生二维 / 三维示意</text><text x="890" y="990">LT26M1581 · 公司母版派生二维 / 三维示意</text><text x="140" y="1040" font-size="14">离线渲染 · 同一母版比例和工艺设定 · 原始毫米CAD与UV保持独立 · 浏览器验收待完成</text></g></svg>'),left:0,top:0}
 ]).png().toFile(`${out}/company-2d-3d.png`);
 fs.writeFileSync(`${out}/3d-offline-validation.json`,JSON.stringify({mode:'offline-shared-viewport',results,browserAcceptance:false,productionApproved:false},null,2));
}finally{await server.close();}
