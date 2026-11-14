/** Real-browser garment workflow; screenshots require separate visual review. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const out=`doc/evidence/garment-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let browser,page;
async function click(label){for(const b of await page.$$('button')){if(await b.evaluate((e,t)=>e.textContent?.trim()===t,label)){if(!await b.evaluate(e=>e.disabled))await b.click();await b.dispose();return;}await b.dispose();}throw Error(`Missing button ${label}`);}
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function number(label,value){
  const selector=`[aria-label="${label}"]`;await page.waitForSelector(`${selector}:not(:disabled)`);await settle();
  const input=await page.$(selector);await input.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(value);await page.keyboard.press('Tab');
  await page.waitForFunction((selector,value)=>document.querySelector(selector)?.value===value,{},selector,value);await settle();
}
async function shot(name){await settle();const buffer=await(await page.$('[data-testid="garment-canvas"]')).screenshot({path:`${out}/${name}.png`});return createHash('sha256').update(buffer).digest('hex');}
async function step(name,fn){await fn();await page.screenshot({path:`${out}/${name}-page.png`});results.push({name,pass:true});}
try{
  browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});page=await browser.newPage();await page.setViewport({width:1767,height:1131});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GARMENT_E2E_URL??'http://localhost:5341/',{waitUntil:'networkidle0'});await page.click('[data-testid="open-3d-mapping"]');
  await step('default-connected-garment',async()=>{await page.waitForSelector('[data-testid="garment-canvas"]',{timeout:30000});assert((await page.$eval('[data-testid="garment-assembly-summary"]',e=>e.textContent)).includes('4 片组成 1 个连接体'));assert.equal(await page.$$eval('[data-garment-panel]',es=>es.length),4);await shot('garment-front');});
  await step('shared-three-view-cameras',async()=>{
    await page.waitForSelector('[data-testid="garment-technical-views"]');
    for(const [label,yaw]of [['正面',0],['背面',180],['侧面',90]]){await page.click(`[aria-label="联动${label}三视图"]`);assert.equal(Number(await page.$eval('[data-testid="garment-viewport"]',e=>e.getAttribute('data-garment-yaw'))),yaw);await shot(`technical-${yaw}`);}
    await click('成衣正面');
  });
  await step('finish-dimensions-and-real-geometry',async()=>{
    const before=await shot('finished-clothing');await page.click('[aria-label="显示成衣工艺"]');assert((await page.$eval('[data-testid="garment-finish-summary"]',e=>e.textContent)).includes('0 项工艺'));assert.notEqual(await shot('without-finish'),before);
    await page.click('[aria-label="显示成衣工艺"]');await number('罗纹领成品宽 mm','24');assert.equal(await page.$eval('[aria-label="罗纹领成品宽 mm"]',e=>e.value),'24');await shot('rib-width-24mm');
  });
  await step('front-back-fashion-sheet',async()=>{
    await click('前后款式稿');await page.waitForSelector('[data-testid="garment-fashion-sheet"]');
    const content=await page.$eval('[data-testid="garment-fashion-sheet"]',e=>e.textContent);assert(content.includes('成品宽 24 mm'));assert(content.includes('正面 / FRONT'));assert(content.includes('背面 / BACK'));
    assert.equal(await page.$$eval('[data-testid="garment-fashion-sheet"] [data-callout]',es=>es.length),4);
    await(await page.$('[data-testid="garment-fashion-sheet"]')).screenshot({path:`${out}/front-back-fashion-sheet.png`});
    await click('关闭款式稿');await page.waitForSelector('[data-testid="garment-fashion-sheet"]',{hidden:true});
  });
  await step('surface-and-open-edge-controls',async()=>{
    await page.select('[aria-label="成衣曲面精细度"]','0');
    await number('成衣显示布厚 mm','0');
    assert((await page.$eval('[data-testid="garment-surface-summary"]',e=>e.textContent)).includes('单层曲面'));const before=await shot('edges-raw');
    await page.select('[aria-label="成衣曲面精细度"]','1');await number('成衣显示布厚 mm','0.8');
    assert((await page.$eval('[data-testid="garment-surface-summary"]',e=>e.textContent)).includes('内外面与边缘侧壁'));assert.notEqual(await shot('edges-thick-smooth'),before);
    await page.click('[aria-label="成衣开口圆角"]');await shot('edges-flat');await page.click('[aria-label="成衣开口圆角"]');await shot('edges-rounded');
  });
  await step('orbit-real-curved-surface',async()=>{const before=await shot('orbit-before'),box=await(await page.$('[data-testid="garment-canvas"]')).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+180,y+20,{steps:16});await page.mouse.up();assert.notEqual(await shot('orbit-after'),before);});
  await step('fabric-physical-repeat',async()=>{const before=await shot('fabric-before');await page.select('[aria-label="成衣面料图案"]','stripe');await settle();assert.notEqual(await shot('fabric-after'),before);await number('图案单元 mm','40');assert.equal(await page.$eval('[aria-label="图案单元 mm"]',e=>e.value),'40');});
  await step('local-image-UV-print',async()=>{const input=await page.$('[aria-label="上传成衣贴图"]');await input.uploadFile('doc/evidence/garment-assembly-20261111/sample-print.png');await page.waitForSelector('img[alt="当前成衣贴图"]');await page.select('[aria-label="成衣贴图位置"]','front');await page.select('[aria-label="成衣贴图方式"]','print');await click('成衣正面');await shot('front-print');await click('成衣背面');await shot('back-fabric');});
  await step('compatible-curved-texture',async()=>{
    // Close the floating view panel before using the status-bar controls.
    await click('二维三视图');await page.waitForSelector('[data-testid="garment-technical-views"]',{hidden:true});
    if(!(await page.$eval('[data-testid="garment-render-mode"]',e=>e.textContent)).includes('Canvas2D'))await click('切换兼容显示');
    await page.waitForFunction(()=>Number(document.querySelector('[data-testid="garment-canvas"]')?.getAttribute('data-depth-triangles'))>1000);await shot('compatible-garment');
    await click('重试硬件渲染');await page.waitForFunction(()=>document.querySelector('[data-testid="garment-render-mode"]')?.textContent.includes('WebGL2'));await page.waitForSelector('[data-testid="garment-canvas"]');
  });
  await step('source-inspection-and-return',async()=>{await click('裁片检查');await page.waitForSelector('[data-testid="mesh-preview"]');await click('三维成衣');await page.waitForSelector('[data-testid="garment-canvas"]',{timeout:30000});assert((await page.$eval('[data-testid="garment-assembly-summary"]',e=>e.textContent)).includes('4 片组成 1 个连接体'));await shot('return-garment');});
  assert.equal(errors.length,0,errors.join('\n'));
}catch(error){results.push({name:'failure',pass:false,error:String(error)});if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(`${out}/summary.json`,JSON.stringify({kind:'real-browser-garment-workflow',results,errors,browserWorkflowPassed:results.length===10&&results.every(r=>r.pass)&&errors.length===0,visualReviewPending:true,browserAcceptance:false,drapeValidated:false,productionApproved:false},null,2));await browser?.close();}
