import fs from 'node:fs';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';import path from 'node:path';
const out=process.env.MATERIAL_EVIDENCE_DIR??'doc/evidence/material-images-20261112';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),steps=[],errors=[],queries=[],replies=[],pending=[];let intercepted=false;
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(new URL(r.url()).pathname==='/api/materials'&&r.method()==='POST'&&!intercepted)queries.push(JSON.parse(r.postData()));});
page.on('response',r=>{if(new URL(r.url()).pathname==='/api/materials'&&!intercepted)pending.push(r.json().then(data=>replies.push({http:r.status(),data})));});
const record=name=>{steps.push({name,pass:true});console.log(name);};
async function click(text,scope=''){for(const b of await page.$$((scope?scope+' ':'')+'button'))if((await b.evaluate(e=>e.textContent)).trim()===text){await b.click();return;}throw Error('Missing '+text);}
const state=()=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);const s=(await import(url)).useDesignStore.getState();return{configuration:s.getConfiguration(),id:s.currentDesignId,saving:s.isSaving,paths:s.draft.paths.map(p=>p.data)};});
const input=(label,value)=>page.$eval(`[aria-label="${label}"]`,(e,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
const result=()=>page.waitForFunction(()=>document.querySelectorAll('[data-managed-material-id]').length>0||document.querySelector('.managed-material-results .managed-empty')?.textContent.includes('没有符合')||document.querySelector('.managed-error'),{timeout:20000});
try{
 await page.setViewport({width:1600,height:1050});await page.goto('http://localhost:5341/?workspace=assets',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid=managed-material-library]');
 await page.waitForFunction(()=>document.querySelector('.managed-connected'));await result();assert.equal(await page.$('.managed-error'),null);assert.equal(queries.length,1);
 await page.click('[data-testid=template-t-shirt]');const before=await state();
 await result();record('integrated-material-management-auto-loads-one-bounded-home-page-and-reuses-it-on-remount');
 await page.waitForFunction(()=>[...document.querySelectorAll('.managed-material-gallery img')].every(i=>i.complete&&i.naturalWidth>0),{timeout:30000});
 const images=await page.$$eval('.managed-material-gallery img',es=>es.map(i=>({src:i.src,width:i.naturalWidth,height:i.naturalHeight})));
 assert.equal(images.length,3);assert(images.some(i=>i.width===7008&&i.height===4672));assert(await page.$('.managed-image[data-image-state=missing]'));
 fs.writeFileSync(out+'/source-image-dimensions.json',JSON.stringify(images,null,2));
 await page.screenshot({path:out+'/materials-gallery-desktop.png'});
 await page.click('.managed-material-gallery [aria-label="查看原图 FC-00315"]');await page.waitForSelector('.managed-image-dialog[open]');
 await page.waitForFunction(()=>document.querySelector('.managed-image-dialog header').textContent.includes('7008 × 4672'));
 await page.screenshot({path:out+'/material-original-fit.png'});
 await click('100%','.managed-image-dialog');assert.equal(await page.$eval('.managed-image-stage img',i=>i.getBoundingClientRect().width),7008);
 await page.$eval('.managed-image-stage',e=>{e.scrollLeft=2000;e.scrollTop=1200;});await page.screenshot({path:out+'/material-original-texture-100.png'});
 await page.keyboard.press('Escape');assert.equal(await page.$('.managed-image-dialog'),null);
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'查看原图 FC-00315');
 await page.click('.managed-view-toolbar input');assert.equal(await page.$$eval('[data-managed-material-id]',es=>es.length),3);assert.equal(queries.length,1);
 await click('列表','.managed-view-toolbar');assert.equal(await page.$$eval('.managed-table-scroll tbody img',es=>es.length),3);await click('图片','.managed-view-toolbar');await page.click('.managed-view-toolbar input');
 record('real-source-images-show-in-gallery-and-table-with-page-local-filter-original-pixels-zoom-Escape-and-focus-restoration');
 const ids=await page.$$eval('[data-managed-material-id]',es=>es.map(e=>e.dataset.managedMaterialId));assert(ids.length>0&&ids.length<=25);assert.equal(queries.length,1);assert.deepEqual(queries[0],{pageNo:1,pageSize:25,status:'0'});
 await page.screenshot({path:out+'/materials-live-list.png'});
 assert(await page.$eval('.managed-material-results',e=>e.textContent.includes('未提供总数')));
 if(ids.length===25){await click('下一页');await result();assert.equal(queries.at(-1).pageNo,2);assert(await page.$eval('.managed-pagination',e=>e.textContent.includes('第 2 页')));}
 record('live-paging-is-bounded-to-requested-pages-and-never-displays-a-fabricated-total');
 await input('面料编码查询','FC-00315');await click('查询面料');await result();assert.equal(await page.$('.managed-error'),null);
 assert.equal(await page.$$eval('[data-managed-material-id]',es=>es.length),1);assert.equal(await page.$eval('[data-managed-material-id]',e=>e.dataset.managedMaterialId),'1739493085997006850');
 await page.screenshot({path:out+'/material-live-detail.png'});
 assert(await page.$eval('.managed-material-detail',e=>e.textContent.includes('100%Cotton')));
 record('real-code-filter-preserves-exact-long-ID-and-shows-source-fields-images-and-dictionaries');
 await page.select('[aria-label="中台面料关联部位"]','main');await click('关联为衣身主料');assert.equal((await state()).configuration.managedMaterials.main.material.materialId,'1739493085997006850');assert.deepEqual((await state()).paths,before.paths);
 await page.click('[title="撤销 (Ctrl+Z)"]');assert.equal((await state()).configuration.managedMaterials,undefined);await page.click('[title="重做 (Ctrl+Shift+Z)"]');assert((await state()).configuration.managedMaterials.main);
 await page.$eval('[placeholder="Design name..."]',e=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'面料关联实测');e.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('Save','.top-nav');await page.waitForFunction(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);const s=(await import(url)).useDesignStore.getState();return !!s.currentDesignId&&!s.isSaving;});
 const saved=await page.evaluate(async id=>{const {designRepository}=await import('/src/lib/db/design-repository.ts');return designRepository.get(id);},(await state()).id);fs.writeFileSync(out+'/saved-design-readback.json',JSON.stringify(saved,null,2));
 await click('New','.left-panel');assert.equal((await state()).configuration.managedMaterials,undefined);await click('List','.left-panel');
 await page.waitForFunction(()=>[...document.querySelectorAll('.left-panel button')].some(b=>b.textContent.includes('面料关联实测')));
 for(const b of await page.$$('.left-panel button'))if((await b.evaluate(e=>e.textContent)).includes('面料关联实测')){await b.click();break;}
 await page.waitForSelector('[data-testid=workbench-material-summary]');assert.deepEqual((await state()).configuration.managedMaterials,saved.configuration.managedMaterials);
 record('linkage-preserves-CAD-and-works-through-original-undo-redo-save-and-reopen');
 const cdp=await page.createCDPSession();const downloads=fs.mkdtempSync(path.resolve(out,'downloads-'));await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await click('导出资产关联候选');let exported;for(let i=0;i<50;i++){const name=fs.readdirSync(downloads).find(f=>f.endsWith('.json'));if(name){exported=JSON.parse(fs.readFileSync(path.join(downloads,name)));break;}await new Promise(r=>setTimeout(r,100));}
 assert.equal(exported.managedMaterialAssignments.main.material.materialId,'1739493085997006850');assert.equal(exported.remoteSync,'not-performed');fs.writeFileSync(out+'/asset-handoff-readback.json',JSON.stringify(exported,null,2));
 await click('设计台','.workbench-primary-nav');await page.waitForSelector('[data-testid=piece-design-board]');assert(await page.$eval('[data-testid=workbench-material-summary]',e=>e.textContent.includes('FC-00315')));
 await click('创建直身T恤裁片组合');await page.waitForSelector('.piece-three-view svg',{timeout:60000});await click('衣身主料图片','[data-testid=workbench-material-summary]');await page.waitForSelector('.managed-image-dialog[open]');await page.keyboard.press('Escape');
 assert(await page.$('.piece-three-view svg'));await page.screenshot({path:out+'/design-with-linked-fabric.png'});await click('管理面料');await page.waitForSelector('[data-testid=managed-material-library]');await result();
 record('linked-material-is-visible-in-design-workbench-and-asset-export-without-remote-writes');
 await page.waitForFunction(()=>document.querySelector('.managed-connected'));await page.click('.managed-material-filters details summary');await input('面料ID查询','1739493085997006850');await click('查询面料');await result();assert.equal(await page.$$eval('[data-managed-material-id]',es=>es.length),1);
 assert.equal(queries.at(-1).materialId,'1739493085997006850');await page.click('.theme-toggle-btn');await page.screenshot({path:out+'/materials-dark.png'});await page.click('.theme-toggle-btn');
 await page.setViewport({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.$eval('.managed-material-detail',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:out+'/materials-mobile.png'});
 assert(await page.$eval('.managed-material-detail',e=>e.getBoundingClientRect().width<=innerWidth));
 await page.click('.managed-material-detail [aria-label="查看原图 FC-00315"]');await page.waitForSelector('.managed-image-dialog[open]');assert(await page.$eval('.managed-image-dialog',e=>e.getBoundingClientRect().width<=innerWidth));await page.screenshot({path:out+'/material-original-mobile.png'});await page.keyboard.press('Escape');
 assert(await page.evaluate(()=>![...Object.keys(localStorage),...Object.keys(sessionStorage)].some(k=>/mcp.*token|access.*token/i.test(k))));assert.equal(await page.$eval('[aria-label="面料访问凭证"]',e=>e.value),'');
 record('exact-ID-query-themes-and-mobile-use-real-records-without-browser-credential-storage');
 await page.setRequestInterception(true);intercepted=true;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/materials'&&r.method()==='POST')r.respond({status:403,contentType:'application/json',body:JSON.stringify({error:'测试状态：当前账号没有面料查询权限。'})});else r.continue();});
 await page.setViewport({width:1600,height:1050});await click('查询面料');await page.waitForSelector('.managed-error');assert.equal(await page.$$eval('[data-managed-material-id]',es=>es.length),0);assert(await page.$eval('.managed-error',e=>e.textContent.includes('权限')));
 record('simulated-permission-failure-clears-stale-results-and-offers-requery');
 assert.equal(queries.length,4);assert.deepEqual(errors,[]);
}catch(e){process.exitCode=1;steps.push({pass:false,error:String(e)});console.error(e);await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}
finally{await Promise.allSettled(pending);fs.writeFileSync(out+'/live-responses.json',JSON.stringify(replies,null,2));fs.writeFileSync(out+'/browser.json',JSON.stringify({steps,errors,liveQueries:queries,remoteWrites:0,simulatedErrorStep:intercepted},null,2));await browser.close();}
