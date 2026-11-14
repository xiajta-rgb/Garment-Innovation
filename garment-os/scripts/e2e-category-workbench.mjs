/** Deferred real-browser acceptance; invoke only when browser acceptance is authorized again. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
if(process.env.GARMENT_RUN_BROWSER_ACCEPTANCE!=='1')throw Error('浏览器验收按用户安排稍后进行；允许执行后设置 GARMENT_RUN_BROWSER_ACCEPTANCE=1。');
const out=`doc/evidence/category-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;
fs.mkdirSync(out,{recursive:true});
let browser,page;const results=[],errors=[];
async function click(text){
  for(const b of await page.$$('button')){
    if(await b.evaluate((e,text)=>e.textContent?.trim()===text,text)){
      assert(!await b.evaluate(e=>e.disabled));await b.click();await b.dispose();return;
    }await b.dispose();
  }throw Error(`找不到按钮：${text}`);
}
async function step(name,fn){await fn();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`${out}/${name}.png`});results.push({name,pass:true});}
const cards=()=>page.$$eval('article[data-asset-id]',els=>els.map(e=>e.getAttribute('data-asset-id')));
try{
  browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  page=await browser.newPage();await page.setViewport({width:1767,height:1131});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GARMENT_E2E_URL??'http://localhost:5341/',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid="company-design-board"]');await click('品类与功能');await page.waitForSelector('[data-testid="category-workbench"]');
  await step('pants-filter',async()=>{
    await page.select('[aria-label="服装品类分组"]','pants');
    assert.equal(await page.$$eval('nav button[data-category-id]',els=>els.length),6);
    await page.click('nav [data-category-id="leggings"]');
    assert.equal(await page.$eval('[data-testid="category-detail"]',el=>el.dataset.categoryId),'leggings');
    assert(await page.$$eval('[data-testid="category-detail"] button',els=>els.find(el=>el.textContent==='尺寸与裁片生成').disabled));
    assert((await page.$eval('[data-testid="category-detail"]',el=>el.textContent)).includes('双向伸缩/回弹'));
  });
  await step('shirt-source',async()=>{
    await page.select('[aria-label="服装品类分组"]','shirt');await click('选用此品类模板');
    assert(await page.$$eval('[data-testid="category-detail"] button',els=>els.find(el=>el.textContent==='成衣曲面 / 贴图示意').disabled));
    await click('配缝方向与裁片 BOM');await page.waitForSelector('[data-testid="assembly-panel"]');
  });
  await step('shirt-pieces-3d',async()=>{
    await click('品类与功能');await page.waitForSelector('[data-testid="category-workbench"]');
    assert.equal(await page.$eval('[data-testid="category-detail"]',el=>el.dataset.categoryId),'shirt');
    await click('三维裁片 / 毫米量尺 / 导出');await page.waitForSelector('[data-testid="mesh-summary"]');
    assert(await page.$$eval('[aria-label="三维工作方式"] button',els=>els.find(el=>el.textContent==='裁片检查').getAttribute('aria-pressed')==='true'));
  });
  await step('pullover-boundary',async()=>{
    await click('品类与功能');await page.waitForSelector('[data-testid="category-workbench"]');
    await page.select('[aria-label="服装品类分组"]','sweat');await page.click('nav [data-category-id="pullover-hoodie"]');
    assert((await page.$eval('[data-testid="category-detail"]',el=>el.textContent)).includes('不能用拉链帽衫替代'));
    await click('筛选本品类结构组合 (0)');await page.waitForSelector('[data-testid="asset-library"]');assert.deepEqual(await cards(),[]);
    await page.select('[aria-label="资产所属服装品类"]','zip-hoodie');assert.equal((await cards()).length,4);
  });
  await step('exact-role-reference',async()=>{
    await click('返回品类与功能');await page.waitForSelector('[data-testid="category-workbench"]');
    await page.select('[aria-label="服装品类分组"]','knit');await page.click('nav [data-category-id="round-short-tee"]');
    await page.$$eval('.category-table tr',rows=>rows.find(r=>r.textContent.includes('binding.neck')).querySelector('button').click());
    await page.waitForSelector('[data-testid="reference-catalogue"]');
    assert.equal(await page.$eval('[aria-label="参考裁片角色"]',el=>el.value),'binding.neck');
  });
  assert.deepEqual(errors,[]);
}catch(error){results.push({pass:false,error:String(error)});process.exitCode=1;if(page)await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{
  fs.writeFileSync(`${out}/result.json`,JSON.stringify({results,errors,browserAcceptance:results.length===5&&results.every(r=>r.pass)&&!errors.length,productionApproved:false},null,2));
  await browser?.close();console.log(JSON.stringify({out,results,errors},null,2));
}
