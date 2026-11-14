/** Same real meshes, cameras and browser canvas before/after renderer changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const stage=process.argv[2];assert(['before','after'].includes(stage));
const out=process.env.GARMENT_EDGE_EVIDENCE_DIR??'doc/evidence/garment-edge-review-20261111';fs.mkdirSync(out,{recursive:true});
assert(!(stage==='before'&&fs.existsSync(`${out}/before.json`)),'Baseline already exists; use GARMENT_EDGE_EVIDENCE_DIR for a new comparison.');
if(stage==='before'){
 fs.mkdirSync(`${out}/baseline-renderer`,{recursive:true});
 for(const path of ['src/features/piece-library/garment-antialias.ts','src/features/piece-library/garment-renderer.ts','src/lib/pattern/mesh/garment-raster.ts'])fs.copyFileSync(path,`${out}/baseline-renderer/${path.split('/').at(-1)}`);
}
const browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.setViewport({width:900,height:650,deviceScaleFactor:1});
 await page.goto(process.env.GARMENT_E2E_URL??'http://localhost:5341/',{waitUntil:'networkidle0'});
 await page.evaluate(async()=>{
  const modules=await Promise.all(['/src/application/pattern-3d.ts','/src/lib/pattern/mesh/garment-assembly.ts','/src/lib/pattern/mesh/garment-finish.ts','/src/data/referenceMeasurements.ts','/src/lib/pattern/mesh/garment-view.ts','/src/features/piece-library/garment-renderer.ts','/src/features/piece-library/garment-software-renderer.ts','/src/features/piece-library/garment-material.ts'].map(p=>import(p)));
  window.edgeModules=Object.assign({},...modules);document.body.replaceChildren();document.body.style.cssText='margin:0;overflow:hidden';
 });
 for(const id of ['t-shirt','brian-reference']){
  const identity=await page.evaluate(id=>{
   const m=window.edgeModules,appearance={color:'#87CEEB',fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0},size={width:900,height:650,dpr:1};
   const source=m.createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:m.getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:appearance.color,fabricId:'solid'});
   const model=m.createFinishedGarment(m.assembleGarment(source)),camera=m.fitGarmentCamera(model,size,28,12);
   window.edgeState={model,size,appearance,tile:m.fabricTile(appearance),image:null,wire:false,selected:'',camera};
   window.edgeViews={oblique:camera,front:m.fitGarmentCamera(model,size,0,0),neck:{...camera,centerMm:[0,-55,0],pixelsPerMm:3,tiltDeg:35}};
   return {model:JSON.stringify(model),views:window.edgeViews};
  },id);
  const modelSha256=createHash('sha256').update(identity.model).digest('hex');
  for(const mode of ['webgl','software']){
   await page.evaluate(mode=>{
    window.edgeRenderer?.dispose();document.body.replaceChildren();
    const canvas=document.createElement('canvas');canvas.dataset.testid='edge-canvas';canvas.style.cssText='display:block;width:900px;height:650px';document.body.append(canvas);
    const m=window.edgeModules;window.edgeRenderer=(mode==='webgl'?m.createGarmentRenderer:m.createGarmentSoftwareRenderer)(canvas,window.edgeState.model,()=>{throw Error('Renderer failed');});
   },mode);
   for(const view of ['oblique','front','neck']){
    const info=await page.evaluate(async view=>{
     window.edgeRenderer.update({...window.edgeState,camera:window.edgeViews[view]});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
     return {canvasWidth:c.width,canvasHeight:c.height,antialias:c.dataset.antialias??null,frameMs:c.dataset.softwareFrameMs??null,glRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,camera:window.edgeViews[view]};
    },view);
    await (await page.$('canvas')).screenshot({path:`${out}/${stage}-${id}-${mode}-${view}.png`});
    results.push({id,mode,view,modelSha256,...info});
   }
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.edgeState.model)),identity.model,'rendering changed the mm mesh');
 }
 assert.deepEqual(errors,[]);
 if(stage==='after'){
  const before=JSON.parse(fs.readFileSync(`${out}/before.json`,'utf8'));
  assert.equal(results.length,before.results.length);
  for(const [i,r]of results.entries())for(const k of ['id','mode','view','modelSha256','camera'])assert.deepEqual(r[k],before.results[i][k],`comparison changed ${k}`);
 }
 fs.writeFileSync(`${out}/${stage}.json`,JSON.stringify({kind:'real-browser-renderer-comparison',size:{width:900,height:650,dpr:1},results,errors,sourceUnchanged:true,fullUiWorkflow:false},null,2));
 console.log(JSON.stringify({stage,frames:results.length,errors,out}));
}finally{await browser.close();}
