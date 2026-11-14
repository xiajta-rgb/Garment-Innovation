/** Deferred real-browser acceptance. This file has not been executed for this change. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
if(process.env.GARMENT_RUN_BROWSER_ACCEPTANCE!=='1')throw Error('浏览器验收尚待安排；确认允许执行后设置 GARMENT_RUN_BROWSER_ACCEPTANCE=1。');
const out=`doc/evidence/company-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];let browser,page;
async function click(text,prefix=false){for(const b of await page.$$('button')){const matches=await b.evaluate((e,{text,prefix})=>prefix?e.textContent?.trim().startsWith(text):e.textContent?.trim()===text,{text,prefix});if(matches){assert(!await b.evaluate(e=>e.disabled));await b.click();await b.dispose();return;}await b.dispose();}throw Error(`找不到按钮：${text}`);}
async function input(label,value){const field=await page.$(`[aria-label="${label}"]`);assert(field);await field.click({clickCount:3});await field.type(String(value));await field.press('Tab');}
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function step(name,run){await run();await settle();await page.screenshot({path:`${out}/${name}.png`});results.push({name,pass:true});}
try{
 browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});page=await browser.newPage();await page.setViewport({width:1767,height:1131});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(process.env.GARMENT_E2E_URL??'http://localhost:5341/',{waitUntil:'networkidle0'});
 await step('company-default',async()=>{await page.waitForSelector('[data-testid="company-design-board"]');assert.equal(await page.$eval('[data-company-master]',e=>e.getAttribute('data-company-master')),'company-cot25m002');});
 await step('original-company-reference',async()=>{await click('对照公司原稿');await page.waitForFunction(()=>{const image=document.querySelector('img[alt="COT25M002 公司原始设计稿"]');return image?.complete&&image.naturalWidth>0;});});await click('返回派生稿');
 for(const [name,id,blocked]of [['常规直身圆领长T','company-lt26m1581',false],['微落肩圆领罗纹卫衣','company-at25m3295',true],['微落肩套头连帽卫衣','company-at25m3288',true],['常规微落肩圆领短T','company-cot25m002',false]])await step(`select-${id}`,async()=>{
  await click(name,true);assert.equal(await page.$eval('[data-company-master]',e=>e.getAttribute('data-company-master')),id);
  assert.equal(await page.$$eval('button',buttons=>buttons.find(b=>b.textContent?.trim()==='使用此母版查看裁片 / 三维')?.disabled),blocked);
 });
 const name=`公司母版验收-${Date.now()}`;
 await step('edit-company-style',async()=>{await input('新款款号','COMPANY-E2E');await input('公司款式品名',name);await input('罗纹领高 mm',24);assert((await page.$eval('[data-testid="company-design-sheet"]',e=>e.textContent)).includes('24mm 罗纹领'));});
 await step('company-3d-and-views',async()=>{await click('使用此母版查看裁片 / 三维');await page.waitForSelector('[data-testid="garment-canvas"]',{timeout:30000});assert((await page.$eval('[data-testid="mesh-template-support"]',e=>e.textContent)).includes('公司母版 COT25M002'));await click('成衣正面');});
 await step('back-and-finish-sync',async()=>{await click('成衣背面');await input('罗纹领成品宽 mm',22);await click('公司设计稿');await page.waitForSelector('[data-testid="company-design-sheet"]');assert((await page.$eval('[data-testid="company-design-sheet"]',e=>e.textContent)).includes('22mm 罗纹领'));});
 await step('save-new-reopen',async()=>{
  await page.click('[data-testid="design-save"]');await page.waitForFunction(()=>document.querySelector('[data-testid="design-save"]')?.getAttribute('aria-busy')==='false');
  await page.click('[title="New Design"]');await click('公司设计稿');assert.notEqual(await page.$eval('[aria-label="公司款式品名"]',e=>e.value),name);
  await page.click('[title="Saved Designs"]');await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent?.trim().startsWith(text)),{},name);await click(name,true);
  await page.waitForFunction(text=>document.querySelector('[aria-label="公司款式品名"]')?.value===text,{},name);
  assert.equal(await page.$eval('[aria-label="新款款号"]',e=>e.value),'COMPANY-E2E');assert.equal(await page.$eval('[aria-label="罗纹领高 mm"]',e=>e.value),'22');
 });
 assert.deepEqual(errors,[]);
}catch(error){results.push({pass:false,error:String(error)});process.exitCode=1;if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{fs.writeFileSync(`${out}/result.json`,JSON.stringify({results,errors,browserAcceptance:results.every(r=>r.pass)&&!errors.length,productionApproved:false},null,2));await browser?.close();console.log(JSON.stringify({out,results,errors},null,2));}
