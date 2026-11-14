import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/designer-study-20261113';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),steps=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));
const click=async(label,scope='')=>{for(const b of await page.$$(`${scope} button`))if(await b.evaluate(e=>e.textContent.trim())===label){await b.click();return;}throw Error('找不到：'+label);};
const mark=name=>{steps.push({name,pass:true});console.log(name);};
const getComposition=()=>page.evaluate(async()=>{const name=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n));return (await import(name)).useDesignStore.getState().pieceComposition;});
try{
 await page.setViewport({width:1416,height:1147});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});await page.waitForSelector('.composition-element-tabs');
 await click('专业素材','.composition-element-tabs');await page.select('[aria-label="专业素材分类"]','shoulder');await page.click('[data-apply-design-asset="shoulder.set-in"]');
 const original=await getComposition();assert(original.plans.length>0);
 await click('批量改款','.composition-element-tabs');await click('查看本轮设计提案');await page.waitForSelector('[data-study-option]');
 assert.equal(await page.$$('[data-study-option]').then(es=>es.length),3);mark('original-workbench-loads-curated-study-without-changing-current-design');
 const groups=['复古运动','城市轻商务','自然肌理','都市工装'],seen=[];
 for(const label of groups){await click(label,'[data-testid="designer-study"]');seen.push(...await page.$$eval('[data-study-option]',es=>es.map(e=>e.getAttribute('data-study-option'))));}
 assert.equal(new Set(seen).size,12);assert.deepEqual(await getComposition(),original);mark('four-directions-show-twelve-unique-authored-designs-with-original-preserved');
 await click('复古运动','[data-testid="designer-study"]');
 for(const [view,label]of [['front','提案正面'],['back','提案背面'],['side','提案侧面']]){
  await click(label);assert.equal(await page.$$eval('[data-study-option] [data-composition-view]',(es,v)=>es.filter(e=>e.getAttribute('data-composition-view')===v).length,view),3);
  await page.$eval('[data-testid="designer-study"]',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/workbench-${view}.png`});
 }mark('fixed-front-back-side-comparison-renders-real-plan-geometry');
 await click('城市轻商务','[data-testid="designer-study"]');await click('提案正面');
 assert(await page.$('[data-study-option="B01"] [data-design-neckline="polo"]')||await page.$eval('[data-study-option="B01"] svg metadata',e=>e.textContent.includes('"neckline":"polo"')));
 await page.click('[data-study-option="B03"] summary');assert((await page.$eval('[data-study-option="B03"]',e=>e.textContent)).includes('拉链贴边'));mark('design-intent-and-specific-interface-checks-are-visible-per-candidate');
 await page.setViewport({width:390,height:844});await page.$eval('[data-testid="designer-study"]',e=>e.scrollIntoView({block:'start'}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/mobile.png'});mark('integrated-study-fits-mobile-without-horizontal-overflow');
 await page.setViewport({width:1416,height:1147});await click('复古运动','[data-testid="designer-study"]');await page.click('[aria-label="选择提案A01"]');await page.click('[aria-label="选择提案A02"]');await page.click('[aria-label="选择提案A03"]');await page.click('[data-add-study]');
 const added=await getComposition();assert.equal(added.plans.length,original.plans.length+4);assert.deepEqual(added.plans.slice(0,original.plans.length),original.plans);assert.equal(added.plans.filter(p=>p.name.startsWith('A0')).length,3);mark('three-selected-designs-and-study-base-append-atomically-with-user-base-preserved');
 await click('Save','.top-nav');await page.waitForFunction(()=>!document.querySelector('.top-nav [aria-busy="true"]'));
 const saved=await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n));const state=(await import(url)).useDesignStore.getState();const {designRepository}=await import('/src/lib/db/design-repository.ts');return designRepository.get(state.currentDesignId);});assert.deepEqual(saved.configuration.pieceComposition,added);mark('existing-save-reads-back-all-selected-designs-and-matrix-provenance');
 await click('批量改款','.composition-element-tabs');await click('查看本轮设计提案');await page.waitForSelector('[aria-label="选择提案A01"]');assert(await page.$eval('[aria-label="选择提案A01"]',e=>e.disabled));mark('already-added-study-designs-cannot-be-added-twice');
 await click('并排比对');await page.$eval('.composition-comparison',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:out+'/selected-comparison.png'});
 assert.deepEqual(errors,[]);mark('no-browser-page-errors');
 fs.writeFileSync(out+'/saved-design.json',JSON.stringify(saved,null,2));
}catch(e){process.exitCode=1;steps.push({name:'failure',pass:false,error:String(e)});console.error(e);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{fs.writeFileSync(out+'/browser.json',JSON.stringify({steps,errors},null,2));await browser.close();}
