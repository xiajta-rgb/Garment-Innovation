import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import puppeteer from 'puppeteer-core';
const url=process.env.GARMENT_E2E_URL??'http://localhost:5341/';
const out=`doc/evidence/mannequin-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;mkdirSync(out,{recursive:true});
let browser,page;
const hash=buf=>createHash('sha256').update(buf).digest('hex');
try{
 browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--window-size=1600,1000']});
 page=await browser.newPage();await page.setViewport({width:1600,height:1000});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:'networkidle0',timeout:30000});
 await page.click('[data-testid="open-3d-mapping"]');await page.waitForSelector('[data-testid="pattern-3d-panel"]');await page.waitForSelector('[data-testid="garment-scene"]');
 await page.waitForSelector('[data-testid="toggle-mannequin"]');
 const toggle=await page.$('[data-testid="toggle-mannequin"]');assert(toggle);assert.equal(await toggle.evaluate(e=>e.checked),true);
 const mode=await page.$('[aria-label="人体模型模式"]');assert(mode);assert.equal(await mode.evaluate(e=>e.value),'real-human');
 const viewport=await page.$('[data-testid="garment-viewport"]') ?? await page.$('.mesh-viewport');assert(viewport,'Garment viewport missing');
 const before=await viewport.screenshot({path:`${out}/01-before.png`});
 const performanceTier=await page.$eval('[data-testid="performance-profile"]',e=>e.textContent);assert(performanceTier?.includes('性能档位'));
 await page.waitForFunction(()=>document.querySelector('[data-testid="mannequin-status"]')?.textContent?.includes('通用人体 GLB'),{timeout:15000});
 const status=await page.$eval('[data-testid="mannequin-status"]',e=>e.textContent);assert(status.includes('通用人体 GLB'));assert(status.includes('不代表公司人体扫描'));
 await toggle.click();await page.waitForFunction(()=>!document.querySelector('[data-testid="mannequin-status"]'));const off=await viewport.screenshot({path:`${out}/02-off.png`});assert.notEqual(hash(before),hash(off),'turning human model off must change rendered pixels');
 await toggle.click();await page.waitForSelector('[data-testid="mannequin-status"]');await page.waitForFunction(()=>document.querySelector('[data-testid="mannequin-status"]')?.textContent?.includes('通用人体 GLB'));
 await page.select('[aria-label="人体模型模式"]','parametric');await page.waitForFunction(()=>document.querySelector('[data-testid="mannequin-status"]')?.textContent?.includes('比例人台'));const parametric=await viewport.screenshot({path:`${out}/03-parametric.png`});assert.notEqual(hash(before),hash(parametric),'parametric mode must be visually distinct from the real GLB');
 await page.select('[aria-label="人体模型模式"]','real-human');await page.waitForFunction(()=>document.querySelector('[data-testid="mannequin-status"]')?.textContent?.includes('通用人体 GLB'));
 assert.equal(await page.$eval('[data-testid="simulation-mode"]',e=>e.textContent.includes('XPBD 预览配置')),true);assert.equal(await page.$eval('[aria-label="启用人台碰撞"]',e=>e.disabled),false);await page.click('[data-testid="simulation-preview-toggle"]');assert((await page.$eval('[data-testid="simulation-toolbar-state"]',e=>e.textContent)).includes('仿真预览配置'));
 await new Promise(r=>setTimeout(r,500));const after=await viewport.screenshot({path:`${out}/04-on-again.png`});assert.equal(hash(before),hash(after),'turning real GLB on again must restore the framed human scene');
 const matching=await page.$$eval('button',bs=>bs.filter(b=>b.textContent?.trim()==='切换兼容显示').map(b=>({disabled:b.disabled,outer:b.outerHTML})));let switched=false;for(const button of await page.$$('button')){if(await button.evaluate((e,label)=>e.textContent?.trim()===label,'切换兼容显示')){await button.evaluate(e=>e.click());switched=true;break;}}assert(switched,'Canvas2D fallback button missing');await page.waitForFunction(()=>document.querySelector('[data-testid="garment-render-mode"]')?.textContent?.includes('Canvas2D'),{timeout:10000});
 await page.waitForFunction(()=>document.querySelector('[data-testid="mannequin-status"]')?.textContent?.includes('兼容模式不支持人体 GLB'),{timeout:10000});const fallbackBefore=await viewport.screenshot({path:`${out}/05-fallback-real-glb-unsupported.png`});
 await page.select('[aria-label="人体模型模式"]','parametric');await page.waitForFunction(()=>document.querySelector('[data-testid="mannequin-status"]')?.textContent?.includes('比例人台'));const fallbackParametric=await viewport.screenshot({path:`${out}/06-fallback-parametric.png`});assert.notEqual(hash(fallbackBefore),hash(fallbackParametric),'Canvas2D must distinguish unsupported real GLB from explicit parametric mode');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({browserAcceptance:true,realGlbDefaultOn:true,status,performanceTier,webglToggle:true,canvas2dUnsupportedState:true,parametricFallbackExplicit:true,screenshots:out,renderMode:'WebGL2 + Canvas2D fallback'}));
}catch(e){console.error(String(e));if(page){console.error('mode=',await page.$eval('[data-testid="garment-render-mode"]',e=>e.textContent).catch(()=>''));console.error('body=',(await page.$eval('body',e=>e.innerText)).slice(-800));}process.exitCode=1}finally{await browser?.close().catch(()=>{})}

