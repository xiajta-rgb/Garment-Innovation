/** Real-browser acceptance workflow. Run only when browser use is enabled.
 * Saves fresh screenshots and interaction results; never treats an offline render
 * or a changed camera attribute alone as proof of a working rendered viewport.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const url=process.env.GARMENT_E2E_URL??'http://localhost:5341/';
const out=`doc/evidence/3d-workbench-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;
const results=[],errors=[];
mkdirSync(out,{recursive:true});
let browser,page,lossMethod='not-tested';
const viewport='[data-testid="mesh-preview"]';
const camera=()=>page.$eval('.mesh-viewport',e=>({yaw:Number(e.dataset.cameraYaw),scale:Number(e.dataset.cameraScale),pan:e.dataset.cameraPan}));
const sourceLength=()=>page.$eval('[data-testid="source-edge-length"]',e=>e.textContent);
const renderedMode=()=>page.$eval('[data-testid="render-mode"]',e=>e.textContent);
async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function clickText(label){
  for(const button of await page.$$('button')){
    if(await button.evaluate((e,text)=>e.textContent?.trim()===text,label)){
      if(!await button.evaluate(e=>e.disabled))await button.click();
      await button.dispose();return;
    }
    await button.dispose();
  }
  throw Error(`Button not found: ${label}`);
}
async function openDetail(label){
  for(const summary of await page.$$('.mesh-inspector summary')){
    if(await summary.evaluate((e,text)=>e.textContent?.trim()===text,label)){
      if(!await summary.evaluate(e=>e.parentElement.open))await summary.click();
      await summary.dispose();return;
    }
    await summary.dispose();
  }
  throw Error(`Details not found: ${label}`);
}
async function ready(count){
  await page.waitForFunction(expected=>document.querySelectorAll('[data-mesh-panel]').length===expected&&
    /WebGL2|Canvas2D|SVG/.test(document.querySelector('[data-testid="render-mode"]')?.textContent??''),{},count);
  await settle();
  const bounds=await (await page.$(viewport)).boundingBox();
  assert(bounds.width>=300&&bounds.height>=300,`Viewport too small: ${JSON.stringify(bounds)}`);
  return bounds;
}
async function sceneImage(name){
  await settle();
  const image=await (await page.$(viewport)).screenshot({path:`${out}/${name}.png`});
  return createHash('sha256').update(image).digest('hex');
}
async function step(name,action){
  const detail=await action();await settle();
  const screenshot=`${out}/${String(results.length+1).padStart(2,'0')}-${name}.png`;
  await page.screenshot({path:screenshot});
  results.push({name,pass:true,screenshot,detail});
}
async function drag(dx,dy,{shift=false,middle=false}={}){
  const box=await (await page.$(viewport)).boundingBox(),x=box.x+box.width*.45,y=box.y+box.height*.5;
  await page.mouse.move(x,y);if(shift)await page.keyboard.down('Shift');
  await page.mouse.down({button:middle?'middle':'left'});
  await page.mouse.move(x+dx,y+dy,{steps:12});await page.mouse.up({button:middle?'middle':'left'});
  if(shift)await page.keyboard.up('Shift');await settle();
}
try{
  browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true,args:['--window-size=1767,1131']});
  page=await browser.newPage();await page.setViewport({width:1767,height:1131});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(url,{waitUntil:'networkidle0',timeout:30000});
  await page.click('[data-testid="open-3d-mapping"]');await page.waitForSelector('[data-testid="pattern-3d-panel"]');await clickText('裁片检查');
  await step('brian-source-and-large-viewport',async()=>{
    await clickText('Brian 基型范例');const box=await ready(4);
    assert((await page.$eval('[data-testid="mesh-template-support"]',e=>e.textContent)).includes('Brian'));
    assert.equal(await page.$eval('[data-testid="open-3d-mapping"]',e=>e.getAttribute('aria-pressed')),'true');
    return {panels:4,viewport:box,mode:await renderedMode()};
  });
  await step('orbit-pan-zoom-and-source-invariance',async()=>{
    const length=await sourceLength(),before=await camera(),imageBefore=await sceneImage('orbit-before');
    await drag(120,25);const rotated=await camera(),imageAfter=await sceneImage('orbit-after');
    assert.notEqual(rotated.yaw,before.yaw);assert.notEqual(imageBefore,imageAfter,'Orbit must change actual pixels');
    assert.equal(await page.$eval('[data-testid="surface-measure"]',e=>e.textContent.includes('三维直线')),false);
    await drag(35,20,{shift:true});assert.notEqual((await camera()).pan,rotated.pan);
    const scale=(await camera()).scale;await page.mouse.wheel({deltaY:-180});await settle();assert((await camera()).scale>scale);
    assert.equal(await sourceLength(),length);return {sourceUnchanged:true,renderChanged:true};
  });
  await step('frame-presets-and-resize',async()=>{
    await page.focus('.mesh-stage');await page.keyboard.press('Home');assert.equal((await camera()).pan,'0,0');
    await page.keyboard.press('1');assert.equal((await camera()).yaw,0);
    await page.keyboard.press('3');assert.equal((await camera()).yaw,90);
    await clickText('立体视图');await page.focus('.mesh-stage');await page.keyboard.press('f');
    const scale=(await camera()).scale;await page.setViewport({width:1505,height:1000});await settle();
    assert.equal((await camera()).scale,scale,'Resize must preserve px/mm until explicitly framed');
    await clickText('适配全部');await ready(4);
    return {shortcuts:true,resizePreservesScale:true};
  });
  await step('isolate-hide-and-restore',async()=>{
    await clickText('隔离当前片');assert((await page.$eval('[data-testid="mesh-summary"]',e=>e.textContent)).includes('当前 1 片可见'));
    await clickText('退出隔离');await ready(4);
    await page.click('.mesh-outliner-row button[aria-label^="隐藏 "]');
    assert((await page.$eval('[data-testid="mesh-summary"]',e=>e.textContent)).includes('当前 3 片可见'));
    await clickText('全部显示');await ready(4);return {isolated:1,hidden:1,restored:4};
  });
  await step('hardware-loss-and-compatible-projection',async()=>{
    const mode=await renderedMode();
    if(mode.includes('WebGL2')){
      lossMethod=await page.$eval(viewport,canvas=>{
        const extension=canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
        if(extension){extension.loseContext();return 'actual-webgl-context-loss';}
        canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));return 'injected-loss-event';
      });
    }else if(!mode.includes('SVG')){await clickText('切换兼容显示');lossMethod='manual-compatible';}
    else lossMethod='initial-svg-fallback';
    await page.waitForSelector('svg[data-testid="mesh-preview"] [data-projected-panel]');
    assert.equal(await page.$$eval('[data-projected-panel]',es=>es.length),4);
    const image=await sceneImage('compatible-before');await drag(-90,20);
    assert.notEqual(await sceneImage('compatible-after'),image);
    const gridCount=await page.$$eval('[data-testid="projected-floor-grid"] path',es=>es.length);assert(gridCount>0);
    // Click the actual input through its containing label; no hidden application state.
    const grid=await page.$('.mesh-display-options label:first-child input');await grid.click();
    assert.equal(await page.$('[data-testid="projected-floor-grid"]'),null);await grid.click();await grid.dispose();
    return {lossMethod,gridCount,renderChanged:true};
  });
  await step('source-ruler-through-real-pointer-input',async()=>{
    await clickText('当前片正视');await clickText('隔离当前片');await page.click('[aria-label="量尺工具"]');
    // Pick well inside the visible source outline, in SVG user coordinates.
    const points=await page.$eval('svg[data-testid="mesh-preview"] [data-projected-panel]',path=>{
      const box=path.getBBox(),matrix=path.getScreenCTM(),inside=[];
      for(let iy=2;iy<9;iy++)for(let ix=2;ix<9;ix++){
        const point=new DOMPoint(box.x+box.width*ix/10,box.y+box.height*iy/10);
        if(path.isPointInFill(point))inside.push(point);
      }
      if(inside.length<2)throw Error('Cannot find two interior points');
      return [inside[0],inside.at(-1)].map(p=>{const s=p.matrixTransform(matrix);return {x:s.x,y:s.y};});
    });
    for(const p of points)await page.mouse.click(p.x,p.y);
    await page.waitForFunction(()=>document.querySelector('[data-testid="surface-measure"]')?.textContent.includes('同片平面直线'));
    const result=await page.$eval('[data-testid="surface-measure"]',e=>e.textContent),values=[...result.matchAll(/([\d.]+) mm/g)].map(m=>Number(m[1]));
    assert.equal(values.length,2);assert(values[0]>0);assert(Math.abs(values[0]-values[1])<=.001);
    await openDetail('量尺与二维来源');assert.equal(await page.$$eval('[data-testid="surface-anchor"]',es=>es.length),2);
    await openDetail('实体尺寸校准');assert((await page.$eval('[data-testid="screen-calibration"]',e=>e.textContent)).includes('尚未用实体尺校准'));
    return {result,physicalScreenCalibrated:false};
  });
  await step('hardware-retry-keeps-camera-and-source',async()=>{
    const before=await camera(),length=await sourceLength();await clickText('重试硬件渲染');await ready(4);
    assert.deepEqual(await camera(),before);assert.equal(await sourceLength(),length);
    return {mode:await renderedMode(),cameraRetained:true,sourceRetained:true};
  });
  await step('explicit-template-switches',async()=>{
    const models=[];
    for(const [label,count] of [['包边背心范例',5],['连帽卫衣范例',14],['Brian 基型范例',4]]){
      await clickText(label);await ready(count);await sceneImage(`template-${count}`);models.push({label,count,mode:await renderedMode()});
    }
    return models;
  });
  await step('responsive-workbench-viewport',async()=>{
    for(const width of [1280,1767]){await page.setViewport({width,height:1000});await ready(4);await clickText('适配全部');}
    return {widths:[1280,1767],mode:await renderedMode()};
  });
  assert.equal(errors.length,0,errors.join('\n'));
}catch(error){
  const screenshot=page?`${out}/failure.png`:null;if(page)await page.screenshot({path:screenshot}).catch(()=>{});
  results.push({name:'failure',pass:false,error:String(error),screenshot});process.exitCode=1;
}finally{
  writeFileSync(`${out}/summary.json`,JSON.stringify({url,generatedAt:new Date().toISOString(),kind:'real-browser-interaction',
    browserAcceptance:results.length===9&&results.every(r=>r.pass)&&errors.length===0,lossMethod,physicalScreenCalibrated:false,hardwareGpuFpsMeasured:false,
    simulationReady:false,drapeValidated:false,productionApproved:false,results,browserErrors:errors},null,2));
  await browser?.close();
}
