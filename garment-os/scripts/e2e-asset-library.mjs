/** Deferred browser acceptance. No browser is launched unless explicitly enabled. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
if(process.env.GARMENT_RUN_BROWSER_ACCEPTANCE!=='1')throw Error('浏览器验收尚待安排；允许执行后设置 GARMENT_RUN_BROWSER_ACCEPTANCE=1。');
const out=`doc/evidence/asset-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;fs.mkdirSync(out,{recursive:true});
let browser,page;const results=[],errors=[];
async function click(text){for(const b of await page.$$('button')){if(await b.evaluate((e,text)=>e.textContent?.trim()===text,text)){assert(!await b.evaluate(e=>e.disabled));await b.click();await b.dispose();return;}await b.dispose();}throw Error(`找不到按钮：${text}`);}
async function step(name,fn){await fn();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`${out}/${name}.png`});results.push({name,pass:true});}
const cards=()=>page.$$eval('article[data-asset-id]',els=>els.map(e=>e.getAttribute('data-asset-id')));
try{
  browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  page=await browser.newPage();await page.setViewport({width:1767,height:1131});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GARMENT_E2E_URL??'http://localhost:5341/',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="company-design-board"]');
  await step('material-library',async()=>{await click('资产与模板库');await page.waitForSelector('[data-testid="asset-library"]');assert.equal((await cards()).length,4);});
  await step('apply-materials',async()=>{
    await page.click('[data-asset-id="mat-fc304"] button');await page.select('[aria-label="选用面料部位"]','neck');await page.click('[data-asset-id="mat-fc00332"] button');
    assert((await page.$eval('.asset-inspector',e=>e.textContent)).includes('FC-00332'));
  });
  await step('finish-and-color',async()=>{
    await click('工艺方案');assert.equal(await page.$$eval('[data-asset-id] button:not(:disabled)',b=>b.length),1);await page.click('[data-asset-id="finish-cot25m002"] button');
    await click('配色库');await page.click('[data-asset-id="color-808080"] button');await click('查看当前设计稿');await page.waitForSelector('[data-testid="company-design-board"]');
    assert.equal(await page.$eval('[data-part="body"]',e=>e.getAttribute('fill')),'#808080');assert((await page.$eval('[aria-label="公司款式成分"]',e=>e.value)).includes('34%'));
  });
  const name=`资产库验收-${Date.now()}`;
  await page.$eval('[aria-label="公司款式品名"]',(el,name)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,name);el.dispatchEvent(new Event('input',{bubbles:true}));},name);
  await step('save-reopen-assets',async()=>{
    await page.click('[data-testid="design-save"]');await page.waitForFunction(()=>document.querySelector('[data-testid="design-save"]')?.getAttribute('aria-busy')==='false');
    await page.click('[title="New Design"]');await page.click('[title="Saved Designs"]');
    await page.waitForFunction(name=>[...document.querySelectorAll('button')].some(b=>b.textContent?.trim().startsWith(name)),{},name);
    const buttons=await page.$$('button');let found=false;for(const b of buttons){if(await b.evaluate((e,n)=>e.textContent?.trim().startsWith(n),name)){await b.click();found=true;}await b.dispose();if(found)break;}assert(found);
    await page.waitForFunction(name=>document.querySelector('[aria-label="公司款式品名"]')?.value===name,{},name);
    await click('资产与模板库');assert((await page.$eval('.asset-inspector',e=>e.textContent)).includes('FC-00332'));
  });
  await step('structure-filter-preview',async()=>{
    await click('结构组合');await page.select('[aria-label="资产细分类"]','button-up-shirt');assert.equal((await cards()).length,6);
    await page.click('[data-asset-id="shirt-short-baseball"] button');await page.waitForSelector('[data-testid="asset-cad-preview"]');
    assert(await page.$('[data-testid="asset-cad-preview"] [data-piece="simon.sleeve"]'));assert.equal(await page.$('[data-testid="asset-cad-preview"] [data-piece="simon.cuff"]'),null);
    const apply=await page.$$('.asset-preview button');await apply[0].scrollIntoView();await apply[0].click();await apply[0].dispose();
    await click('查看当前裁片');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent?.trim()==='裁片生成器'));
  });
  await step('blocked-template-filter',async()=>{await click('资产与模板库');await click('裁片模板');await page.select('[aria-label="资产细分类"]','blocked');assert.equal((await cards()).length,5);assert.equal(await page.$$eval('[data-asset-id] button:not(:disabled)',b=>b.length),0);});
  assert.deepEqual(errors,[]);
}catch(error){results.push({pass:false,error:String(error)});process.exitCode=1;if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{fs.writeFileSync(`${out}/result.json`,JSON.stringify({results,errors,browserAcceptance:results.length===6&&results.every(r=>r.pass)&&!errors.length,productionApproved:false},null,2));await browser?.close();console.log(JSON.stringify({out,results,errors},null,2));}
