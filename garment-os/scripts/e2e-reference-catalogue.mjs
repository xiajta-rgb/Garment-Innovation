/** Run only where browser automation is enabled. Produces actual page screenshots. */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const snapshot=JSON.parse(readFileSync('src/data/referencePieceCatalogue.snapshot.json','utf8'));
const images=JSON.parse(readFileSync('src/data/referenceIllustrations.json','utf8'));
const families=[...new Set([...snapshot.entries.map(e=>e.family),...images.map(e=>e.family)])];
const out=`doc/evidence/reference-catalogue-ui/${new Date().toISOString().replace(/[:.]/g,'-')}`;
mkdirSync(out,{recursive:true});
const results=[],errors=[];
let browser;
try {
  browser=await puppeteer.launch({
    executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true,args:['--window-size=1505,1131'],
  });
  const page=await browser.newPage();
  await page.setViewport({width:1505,height:1131});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(process.env.GARMENT_E2E_URL??'http://localhost:5341/',{waitUntil:'networkidle0'});
  for(const family of families){
    await page.click(`[data-sidebar-family="${family}"]`);
    await page.waitForSelector(`[data-testid="reference-catalogue"][data-catalogue-family="${family}"]`);
    const expected=snapshot.entries.filter(e=>e.family===family);
    const seen=new Set();
    const pages=Math.max(1,Math.ceil(expected.length/12));
    for(let number=0;number<pages;number++){
      const ids=await page.$$eval('[data-catalogue-entry]',els=>els.map(el=>el.getAttribute('data-catalogue-entry')));
      assert.equal(ids.length,Math.min(12,expected.length-number*12));
      for(const id of ids){
        const ref=expected.find(e=>e.id===id);assert(ref);seen.add(id);
        await page.click(`[data-catalogue-entry="${id}"]`);
        const path=await page.$eval('[data-testid="catalogue-detail"] [data-reference-layer="net"]',el=>el.getAttribute('d'));
        assert.equal(path,ref.paths.find(p=>p.layer==='net').data);
      }
      if(number<pages-1){
        const button=(await page.$$('nav[aria-label="参考图纸分页"] button')).at(-1);
        await button.click();
      }
    }
    assert.equal(seen.size,expected.length);
    if(!expected.length){
      assert(images.some(i=>i.family===family));
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-reference-photo] img')].every(img=>img.complete&&img.naturalWidth>0));
    }
    const file=`${out}/${family}.png`;
    await page.screenshot({path:file});
    results.push({family,sourcePathsChecked:seen.size,screenshot:file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
  }
  assert.equal(errors.length,0);
}catch(error){errors.push(String(error));process.exitCode=1;}
finally{
  if(browser)await browser.close();
  writeFileSync(out+'/report.json',JSON.stringify({actualBrowserChecked:results.length>0,complete:results.length===families.length&&!errors.length,results,errors},null,2));
  console.log(JSON.stringify({out,pass:results.length,errors},null,2));
}
