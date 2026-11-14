import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const out='doc/evidence/large-material-20261112';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),steps=[],errors=[];let compression;
page.on('pageerror',e=>errors.push(String(e)));
const mark=name=>{steps.push({name,pass:true});console.log(name);};
const click=async(text,scope='')=>{for(const e of await page.$$(`${scope} button`))if(await e.evaluate(e=>e.textContent.trim())===text){await e.click();return;}throw Error('Missing '+text);};
const state=()=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);const s=(await import(url)).useDesignStore.getState();return{composition:s.pieceComposition,currentDesignId:s.currentDesignId};});
const plan=async()=>{const s=await state();return s.composition.plans.find(p=>p.id===s.composition.activePlanId);};
try{
 await page.setViewport({width:1416,height:1147});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});
 await page.waitForSelector('[data-design-shoulder="raglan"]');await page.click('[data-design-shoulder="raglan"]');
 await click('口袋','.composition-element-tabs');await click('单胸贴袋');
 await page.click('[data-workbench-section="assets"]');await page.waitForSelector('[aria-label="查看面料 FC-00315"]',{timeout:30000});
 await page.click('[aria-label="查看面料 FC-00315"]');assert.equal(await page.$eval('[aria-label="面料应用目标"]',e=>e.value),'composition');
 const reply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/materials/image',{timeout:65000});
 await page.click('.managed-material-detail .managed-primary');const response=await reply;
 assert.equal(response.status(),200,response.ok()?'':await response.text());
 const headers=response.headers();compression={sourceBytes:Number(headers['x-material-source-bytes']),compressed:headers['x-material-image-compressed']==='true',outputBytes:Number(headers['content-length']),contentType:headers['content-type']};
 assert(compression.sourceBytes>12_000_000);assert.equal(compression.compressed,true);assert.equal(compression.contentType,'image/webp');assert(compression.outputBytes>0&&compression.outputBytes<=4_000_000);
 await page.waitForSelector('.managed-notice',{timeout:65000});assert.equal(await page.$('.managed-error'),null);mark('real-FC-00315-source-above-12MB-is-automatically-compressed-and-applied');
 await page.screenshot({path:`${out}/material-applied.png`});
 const applied=await plan(),image=applied.elements.materialImages.main;
 assert(image.dataUrl.startsWith('data:image/jpeg;base64,'));assert.equal(applied.elements.materials.main.material.materialCode,'FC-00315');assert(image.width<=768&&image.height<=768);
 compression.embedded={width:image.width,height:image.height,bytes:Buffer.from(image.dataUrl.split(',')[1],'base64').length};
 await page.click('[data-workbench-section="design"]');await page.waitForSelector('.composition-stage');
 assert(await page.$eval('.composition-stage',e=>[...e.querySelectorAll('image')].some(i=>i.getAttribute('href')?.startsWith('data:image/jpeg;base64,'))));
 await page.screenshot({path:`${out}/three-view-applied.png`});mark('compressed-fabric-is-visible-on-the-existing-raglan-three-view-with-source-linkage');
 await page.click('[title="撤销 (Ctrl+Z)"]');assert.equal((await plan()).elements?.materialImages?.main,undefined);
 await page.click('[title="重做 (Ctrl+Shift+Z)"]');assert.deepEqual((await plan()).elements.materialImages.main,image);mark('compressed-fabric-participates-in-undo-and-redo');
 await click('Save','.top-nav');await page.waitForFunction(()=>!document.querySelector('.top-nav [aria-busy="true"]'));
 const saved=await page.evaluate(async id=>{const {designRepository}=await import('/src/lib/db/design-repository.ts');return designRepository.get(id);},(await state()).currentDesignId);
 assert(saved);assert(JSON.stringify(saved).includes(image.dataUrl));assert(JSON.stringify(saved).includes('FC-00315'));mark('saved-design-persists-the-compressed-photo-and-original-material-provenance');
 await page.click('[data-workbench-section="assets"]');await page.waitForSelector('[aria-label="查看面料 FC-00315"]');await page.click('[aria-label="查看面料 FC-00315"]');
 await page.click('.managed-material-detail [aria-label="查看原图 FC-00315"]');await page.waitForFunction(()=>document.querySelector('.managed-image-dialog header')?.textContent.includes('7008 × 4672'),{timeout:35000});
 await page.screenshot({path:`${out}/original-still-available.png`});mark('original-full-resolution-photo-remains-available-after-design-compression');
 assert.deepEqual(errors,[]);mark('no-page-runtime-errors');
}catch(error){process.exitCode=1;steps.push({name:'failure',pass:false,error:String(error)});console.error(error);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({steps,errors,compression},null,2));await browser.close();}
