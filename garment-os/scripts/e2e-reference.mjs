/** Browser workflow for an operator with browser automation enabled.
 * Not executed by the architecture check; each run writes fresh UI screenshots.
 * Source equality is independently verified by the Vitest reference suites.
 */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const url=process.env.GARMENT_E2E_URL ?? 'http://localhost:5341/';
const out=`doc/evidence/reference-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;
mkdirSync(out,{recursive:true});
const results=[],errors=[];
let browser,page;
async function clickText(text) {
  for(const handle of await page.$$('button')) {
    const matches=await handle.evaluate((el,label)=>el.textContent?.trim()===label,text);
    if(matches){await handle.click();await handle.dispose();return;}
    await handle.dispose();
  }
  throw Error(`Button not found: ${text}`);
}
async function input(selector,value) {
  const handle=await page.$(selector);assert(handle,selector);await handle.click({clickCount:3});
  await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');
  if(String(value))await handle.type(String(value));else await handle.press('Backspace');
  await handle.press('Tab');await handle.dispose();
}
async function openMeshDetails(label) {
  for(const handle of await page.$$('.mesh-inspector summary')) {
    if(await handle.evaluate((el,text)=>el.textContent?.trim()===text,label)) {
      if(!await handle.evaluate(el=>el.parentElement.open))await handle.click();
      await handle.dispose();return;
    }
    await handle.dispose();
  }
  throw Error(`3D details not found: ${label}`);
}
async function screenshot(name) {
  if(!page)return null;
  const path=`${out}/${String(results.length+1).padStart(2,'0')}-${name}.png`;
  await page.screenshot({path});return {path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
}
async function step(name,action) {await action();results.push({name,pass:true,screenshot:await screenshot(name)});}
const net=()=>page.$eval('[data-testid="reference-preview"] [data-layer="net"]',el=>el.getAttribute('d'));
try {
  browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--window-size=1767,1131']});
  page=await browser.newPage();await page.setViewport({width:1767,height:1131});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'networkidle0',timeout:30000});
  await step('home-source-geometry',async()=>{await page.waitForSelector('#garment-sketch [data-source-id="front-body-reference-net"]');assert((await page.$eval('body',e=>e.textContent)).includes('生产待验收'));});
  await step('home-direct-3d-entry',async()=>{
    const shortcut=await page.$('[data-testid="open-3d-mapping"]');
    assert(shortcut,'3D mapping must be reachable directly from the main toolbar');
    await shortcut.screenshot({path:`${out}/3d-entry.png`});
    await shortcut.click();await page.waitForSelector('[data-testid="pattern-3d-panel"]');await clickText('裁片检查');
    assert((await page.$eval('[data-testid="mesh-template-support"]',e=>e.textContent)).includes('Brian'));
    await clickText('包边背心范例');await page.waitForSelector('[data-testid="mesh-preview"]');
    assert.equal(await page.$$eval('[data-mesh-panel]',es=>es.length),5);
    assert.equal(await page.$eval('[data-testid="open-3d-mapping"]',e=>e.getAttribute('aria-pressed')),'true');
    assert.equal(await page.$('#garment-sketch'),null);
    await page.screenshot({path:`${out}/home-direct-3d.png`});
    await clickText('Sketch');await page.waitForSelector('#garment-sketch');
    assert.equal(await page.$('[data-testid="pattern-3d-panel"]'),null);
    await page.click('[data-testid="template-brian-reference"]');
    await page.waitForSelector('#garment-sketch [data-source-id="front-body-reference-net"]');
  });
  await clickText('裁片库');await page.waitForSelector('[data-testid="brian-generator"]');
  for(const id of ['front-body','back-body','sleeve'])await step(`brian-${id}`,async()=>{
    await page.click(`[data-testid="reference-piece-${id}"]`);await page.waitForSelector(`[data-testid="reference-preview"][data-piece-id="${id}"]`);
    assert.equal(await net(),await page.$eval('[data-layer="reference"]',e=>e.getAttribute('d')));
    assert.equal(await page.$$eval('[data-pass="false"]',es=>es.length),0);
  });
  await step('measured-geometry-response',async()=>{
    await page.click('[data-testid="reference-piece-front-body"]');const before=await net();
    await input('[data-testid="reference-input-shoulderSlope"]',18);
    await page.waitForFunction(d=>document.querySelector('[data-layer="net"]')?.getAttribute('d')!==d,{},before);
  });
  await step('filters-remove-stale-preview',async()=>{
    await page.click('[data-reference-tag="collar"]');await page.waitForSelector('[data-testid="reference-empty"]');
    assert.equal(await page.$('[data-testid="reference-preview"]'),null);await clickText('清除筛选');
    await page.click('[data-reference-tag="sleeve"]');assert.equal(await page.$$eval('[data-testid^="reference-piece-"]',es=>es.length),1);
    await clickText('清除筛选');
  });
  await step('missing-input-blocks',async()=>{
    await input('[data-testid="reference-input-neckCirc"]','');await page.waitForSelector('[data-testid="reference-error"]');
    assert.equal(await page.$eval('[data-testid="reference-apply"]',e=>e.disabled),true);assert.equal(await page.$('[data-testid="reference-preview"]'),null);
  });
  await page.click('[data-testid="load-reference-sample"]');await page.waitForSelector('[data-testid="reference-preview"]');
  await step('seven-source-samples',async()=>{await clickText('多样本尺寸对照');await page.waitForSelector('[data-testid="reference-size-overlay"]');assert.equal(await page.$$eval('[data-size]',es=>es.length),7);await clickText('返回单片');});
  await page.click('[data-testid="reference-piece-front-body"]');const referencePath=await net();
  await page.click('[data-testid="reference-apply"]');await clickText('裁片库');
  await step('canvas-and-board-share-source',async()=>{
    await clickText('Pattern');await page.waitForSelector('[data-testid="reference-pattern-board"]');
    assert.equal(await page.$$eval('[data-board-piece]',es=>es.length),3);
    assert.equal(await page.$eval('[data-board-source="front-body-reference-net"]',e=>e.getAttribute('d')),referencePath);
    assert.equal(await page.$eval('#garment-sketch [data-source-id="front-body-reference-net"]',e=>e.getAttribute('d')),referencePath);
  });
  await step('retired-and-incomplete-cards-blocked',async()=>{
    for(const id of ['t-shirt-pro','v-neck-tee'])assert.equal(await page.$eval(`[data-testid="template-${id}"]`,e=>e.disabled),true);
    await clickText('Polo');for(const id of ['polo-shirt','long-sleeve-polo'])assert.equal(await page.$eval(`[data-testid="template-${id}"]`,e=>e.disabled),true);
    await clickText('衬衫');assert.equal(await page.$eval('[data-testid="template-womens-blouse"]',e=>e.disabled),true);
  });
  for(const [id,count,category] of [['t-shirt',3,'针织 / 基型'],['womens-basic-tee',3,'针织 / 基型'],['long-sleeve-tee',3,'针织 / 基型'],['button-up-shirt',10,'衬衫']])await step(`reviewed-template-${id}`,async()=>{
    await clickText(category);await page.click(`[data-testid="template-${id}"]`);
    await page.waitForFunction(n=>document.querySelectorAll('[data-board-piece]').length===n,{},count);
    await clickText('裁片库');await page.waitForSelector('[data-testid="standard-generator"]');
    assert.equal(await page.$$eval('[data-standard-piece]',es=>es.length),count);await clickText('裁片库');
  });
  await step('shirt-collars-edit-and-empty-filter',async()=>{
    await clickText('裁片库');await page.waitForSelector('[data-testid="standard-generator"]');
    await page.click('[data-standard-tag="collar"]');assert.equal(await page.$$eval('[data-standard-piece]',es=>es.length),2);
    await input('[data-testid="standard-input-neckCirc"]',395);
    assert(await page.$('[data-source-path="simon.collar:underCollar"]'));
    await page.click('[data-testid="standard-apply"]');await clickText('清除筛选');await page.click('[data-standard-tag="pocket"]');
    await page.waitForSelector('[data-testid="standard-empty"]');assert.equal(await page.$('[data-testid="standard-preview"]'),null);
    await clickText('清除筛选');await clickText('裁片库');
  });
  await clickText('裁片库');await clickText('裁片组成');
  await step('assembly-inventory-and-source-interfaces',async()=>{
    await page.waitForSelector('[data-testid="assembly-panel"]');
    assert.equal(await page.$$eval('[data-assembly-piece]',es=>es.length),10);
    assert.equal(await page.$$eval('[data-assembly-join]',es=>es.length),14);
    assert.equal(await page.$eval('[data-assembly-join="placket-overlap"]',e=>e.getAttribute('data-status')),'pending');
    await clickText('领面与领座上边');
    assert.equal(await page.$$eval('[data-assembly-edge]',es=>es.length),3);
    await page.$eval('[data-testid="assembly-join-details"]',e=>e.scrollIntoView({block:'start'}));
  });
  await step('assembly-filter-does-not-drop-required-components',async()=>{
    await clickText('领类');
    assert.deepEqual(await page.$$eval('[data-assembly-piece]',es=>es.map(e=>e.getAttribute('data-assembly-piece'))),['simon.collar','simon.collarStand']);
    assert.equal(await page.$$eval('[data-assembly-join]',es=>es.length),2);
    assert((await page.$eval('[data-testid="assembly-summary"]',e=>e.textContent)).includes('89/89'));
    assert(await page.$$eval('[data-assembly-interface]',es=>es.every(e=>e.getAttribute('data-assembly-interface').startsWith('simon.collar'))));
    await clickText('清除组成筛选');await clickText('口袋类');await page.waitForSelector('[data-testid="assembly-empty"]');
    assert.equal(await page.$$eval('[data-assembly-interface]',es=>es.length),0);await clickText('清除组成筛选');
  });
  await clickText('部件组合');
  await step('component-controls-regenerate-source',async()=>{
    await page.waitForSelector('[data-testid="construction-panel"]');
    await page.select('select[aria-label="袖口造型"]','roundedBarrelCuff');
    await input('input[aria-label="领尖角"]',100);
    assert((await page.$eval('[data-testid="construction-summary"]',e=>e.textContent)).includes('10 种裁片'));
    assert.equal(await page.$eval('[data-construction-operation="cuff-pleats"]',e=>e.getAttribute('data-status')),'needs-redraft');
    assert((await page.$eval('[data-construction-operation="cuff-pleats"]',e=>e.textContent)).includes('去褶后尚余差值'));
  });
  await step('short-sleeve-removes-cuff-and-plackets',async()=>{
    await page.select('select[aria-label="袖型"]','short');
    await page.waitForFunction(()=>document.querySelector('[data-testid="construction-summary"]')?.textContent?.includes('7 种裁片'));
    assert.equal(await page.$('select[aria-label="袖口造型"]'),null);
    assert.equal(await page.$('[data-construction-operation="cuff-pleats"]'),null);
    await clickText('裁片生成器');assert.equal(await page.$$eval('[data-standard-piece]',es=>es.length),7);
    await clickText('裁片组成');assert.equal(await page.$$eval('[data-assembly-piece]',es=>es.length),7);
    assert.equal(await page.$('[data-assembly-piece="simon.cuff"]'),null);
  });
  await clickText('部件组合');await clickText('恢复源构型');
  await step('taxonomy-catalogue-and-empty-role',async()=>{
    await clickText('分类总览');await page.waitForSelector('[data-testid="piece-taxonomy"]');
    assert.equal(await page.$$eval('[data-taxonomy-role]',es=>es.length),129);
    await page.select('select[aria-label="分类大类"]','hood');
    assert.equal(await page.$$eval('[data-taxonomy-role]',es=>es.length),4);
    assert((await page.$eval('[data-taxonomy-role="hood.side"]',e=>e.textContent)).includes('参考源已绑定'));
    assert((await page.$eval('[data-taxonomy-role="hood.center"]',e=>e.textContent)).includes('仅分类定义'));
    await page.click('[data-taxonomy-role="hood.center"] button');
    assert.equal(await page.$('[data-piece-key]'),null);
    assert.equal(await page.$('#garment-sketch path[data-piece-id]'),null);
  });
  await step('taxonomy-stand-drives-real-source',async()=>{
    await clickText('分类总览');await page.waitForSelector('[data-taxonomy-role="collar.stand"]');
    await page.click('[data-taxonomy-role="collar.stand"] button');
    assert.equal(await page.$eval('[data-piece-key]',e=>e.getAttribute('data-piece-key')),'simon.collarStand');
    assert(await page.$$eval('#garment-sketch path[data-piece-id]',es=>es.length>0&&es.every(e=>e.getAttribute('data-piece-id')==='simon.collarStand')));
    await clickText('裁片生成器');
    assert.deepEqual(await page.$$eval('[data-standard-piece]',es=>es.map(e=>e.getAttribute('data-standard-piece'))),['simon.collarStand']);
    await clickText('清除筛选');
    assert.equal(await page.$$eval('[data-standard-piece]',es=>es.length),10);
  });
  await clickText('裁片库');
  await step('saved-design-restores-real-inputs',async()=>{
    const name=`Architecture UI ${Date.now()}`;
    const before=await page.$eval('#garment-sketch [data-source-id="simon.collar:seam"]',e=>e.getAttribute('d'));
    await input('input[placeholder="Design name..."]',name);await page.click('button[title="Save Design"]');
    await page.waitForFunction(()=>document.querySelector('[data-testid="design-save"]')?.getAttribute('aria-busy')==='false');
    await clickText('List');await page.waitForFunction(n=>[...document.querySelectorAll('button')].some(e=>e.textContent?.includes(n)),{},name);
    await page.click('button[title="New Design"]');
    for(const handle of await page.$$('button')) {if(await handle.evaluate((el,n)=>el.textContent?.includes(n),name)){await handle.click();break;}await handle.dispose();}
    await page.waitForFunction(d=>document.querySelector('#garment-sketch [data-source-id="simon.collar:seam"]')?.getAttribute('d')===d,{},before);
  });
  await step('hoodie-components-and-real-ribbing-filter',async()=>{
    await clickText('连帽卫衣');await page.click('[data-testid="template-hooded-zip-sweatshirt"]');
    await clickText('裁片库');await clickText('部件组合');
    assert((await page.$eval('[data-testid="construction-summary"]',e=>e.textContent)).includes('7 种裁片'));
    await page.select('select[aria-label="罗纹接条"]','false');await page.select('select[aria-label="前贴袋"]','false');
    assert((await page.$eval('[data-testid="construction-summary"]',e=>e.textContent)).includes('4 种裁片'));
    await clickText('裁片生成器');await clickText('清除筛选');
    assert.equal(await page.$$eval('[data-standard-piece]',es=>es.length),4);
    await input('[data-testid="standard-input-headCirc"]','');assert.equal(await page.$('[data-testid="standard-preview"]'),null);
    await input('[data-testid="standard-input-headCirc"]',610);await page.click('[data-testid="standard-apply"]');
    await clickText('部件组合');await clickText('恢复源构型');await clickText('裁片生成器');
    await page.click('[data-standard-tag="material:ribbing"]');
    assert.deepEqual((await page.$$eval('[data-standard-piece]',es=>es.map(e=>e.getAttribute('data-standard-piece')))).sort(),['huey.cuff','huey.waistband']);
    await clickText('清除筛选');
  });
  await step('real-panel-3d-mapping-and-rotation',async()=>{
    await clickText('三维映射');await clickText('裁片检查');await page.waitForSelector('[data-testid="mesh-preview"]');
    assert.equal(await page.$$eval('[data-mesh-panel]',es=>es.length),14);
    await page.waitForFunction(()=>['WebGL2','Canvas2D','SVG'].some(mode=>document.querySelector('[data-testid="render-mode"]')?.textContent?.includes(mode)));
    const canvas=await page.$('[data-testid="mesh-preview"]');
    const before=await canvas.screenshot({path:`${out}/3d-before-rotation.png`});
    await openMeshDetails('视图精调');
    await page.$eval('input[aria-label="三维水平旋转"]',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'65');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const after=await canvas.screenshot({path:`${out}/3d-after-rotation.png`});
    assert(!Buffer.from(after).equals(Buffer.from(before)),'rotation must change the actual composited canvas image');
    await openMeshDetails('映射质量与能力边界');await openMeshDetails('实体尺寸校准');await openMeshDetails('量尺与二维来源');
    assert((await page.$eval('[data-testid="pattern-3d-panel"]',e=>e.textContent)).includes('尚未实现缝合闭合'));
    assert((await page.$eval('[data-testid="screen-calibration"]',e=>e.textContent)).includes('尚未用实体尺校准'));
    assert(await page.$eval('[aria-label="三维顶点来源"] tbody',e=>e.children.length<=50));
  });
  let lossMethod='already-compatible';
  await step('graphics-loss-compatible-projection',async()=>{
    const mode=await page.$eval('[data-testid="render-mode"]',e=>e.textContent);
    if(mode.includes('WebGL2'))lossMethod=await page.$eval('[data-testid="mesh-preview"]',canvas=>{
      const extension=canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      if(extension){extension.loseContext();return 'actual-webgl-context-loss';}
      canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));return 'injected-loss-event';
    });
    else if(!mode.includes('SVG')){await clickText('切换兼容显示');lossMethod='manual-compatible';}
    await page.waitForSelector('svg[data-testid="mesh-preview"] [data-projected-panel]');
    assert.equal(await page.$$eval('[data-projected-panel]',es=>es.length),14);
    const paths=await page.$$eval('[data-projected-panel]',es=>es.map(e=>e.getAttribute('d')));
    assert(paths.every(d=>d&&d.startsWith('M')&&!/NaN|Infinity/.test(d)));
    await page.screenshot({path:`${out}/3d-after-context-loss.png`});
    const previous=paths.join(' '),sourceLength=await page.$eval('[data-testid="source-edge-length"]',e=>e.textContent);
    await page.$eval('input[aria-label="三维水平旋转"]',e=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'-35');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(old=>[...document.querySelectorAll('[data-projected-panel]')].map(e=>e.getAttribute('d')).join(' ')!==old,{},previous);
    assert.equal(await page.$eval('[data-testid="source-edge-length"]',e=>e.textContent),sourceLength);
    await clickText('重试硬件渲染');
    await page.waitForFunction(()=>['WebGL2','Canvas2D','SVG'].some(mode=>document.querySelector('[data-testid="render-mode"]')?.textContent?.includes(mode)));
  });
  results.at(-1).lossMethod=lossMethod;
  await step('style-workflow-brief-to-source-cad-bom-technical',async()=>{
    await clickText('款式工作流');await page.waitForSelector('[data-testid="style-workflow"]');
    await page.select('[data-testid="style-workflow"] select','bound-tank');
    await clickText('确认设计并生成裁片');await page.waitForSelector('[data-testid="workflow-cad"]');
    assert.equal(await page.$$eval('[data-workflow-piece]',e=>e.length),4);
    const binding='[data-workflow-path="aaron.neckBinding:seam"]';
    const previous=await page.$eval(binding,e=>e.getAttribute('d'));
    await page.click('[data-workflow-step="1"]');
    await input('[data-testid="style-workflow"] input[type="number"]','30');
    await clickText('确认设计并生成裁片');await page.waitForSelector(binding);
    assert.notEqual(await page.$eval(binding,e=>e.getAttribute('d')),previous);
    assert((await page.$eval('[data-testid="workflow-summary"]',e=>e.textContent)).includes('5 片'));
    await clickText('查看 BOM 草案');assert.equal(await page.$$eval('[data-workflow-bom]',e=>e.length),4);
    await clickText('查看技术与工艺稿');await page.waitForSelector('[data-workflow-operation="binding-neck"]');
    assert((await page.$eval('[data-workflow-operation="binding-neck"]',e=>e.textContent)).includes('实际展开条长'));
  });
  assert.equal(errors.length,0,errors.join('\n'));
} catch(error) {results.push({name:'failure',pass:false,error:String(error),screenshot:await screenshot('failure')});process.exitCode=1;}
finally {
  writeFileSync(`${out}/summary.json`,JSON.stringify({url,generatedAt:new Date().toISOString(),productionApproved:false,results,browserErrors:errors},null,2));
  await browser?.close();
}
