/** Two deliberate serial paid tests from the real pattern-composition editor. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/piece-design-20261111',manifest=`${out}/senling-live.json`;fs.mkdirSync(out,{recursive:true});
assert(!fs.existsSync(manifest),'Live intents exist. Inspect the same jobs; do not repeat submissions.');
const browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage(),records=[],images=new Map(),errors=[];
let current='';const save=()=>fs.writeFileSync(manifest,JSON.stringify({kind:'real-browser-pattern-composition-to-senling',records,errors,productionApproved:false},null,2));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
page.on('pageerror',e=>{errors.push(String(e));save();});
page.on('request',r=>{if(!r.url().endsWith('/api/style-image')||r.method()!=='POST')return;const body=JSON.parse(r.postData());if(body.action!=='generate')return;assert(body.referencePng);const bytes=Buffer.from(body.referencePng.split(',')[1],'base64');fs.writeFileSync(`${out}/${current}-submitted-reference.png`,bytes);records.push({effect:current,id:body.id,model:body.model,aspectRatio:body.aspectRatio,prompt:body.prompt,referenceFile:`${current}-submitted-reference.png`,referenceSha256:sha(bytes),submittedAt:new Date().toISOString(),state:'submitted'});save();});
page.on('response',async r=>{try{if(r.request().resourceType()==='image'&&!r.url().startsWith('http://localhost'))images.set(r.url(),{bytes:await r.buffer(),mime:r.headers()['content-type']});if(!r.url().endsWith('/api/style-image'))return;const request=JSON.parse(r.request().postData()),record=records.find(x=>x.id===request.id);if(!record)return;const body=await r.json();if(!r.ok()){record.error=body.error;save();return;}if(body.state){record.state=body.state;if(body.state==='done')record.reference=body.reference;save();}}catch(e){errors.push(String(e));save();}});
async function click(label){for(const b of await page.$$('button'))if(await b.evaluate((e,t)=>e.textContent.trim()===t,label)){await b.click();return;}throw Error('Missing '+label);}
try{
 await page.setViewport({width:1800,height:1200});await page.goto((process.env.GARMENT_E2E_URL??'http://localhost:5341/')+'?workspace=piece-design',{waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="piece-design-board"]');await click('创建直身T恤裁片组合');await page.waitForSelector('[data-testid="piece-design-three-view"]',{timeout:60000});
 await page.select('[aria-label="组合袖片方案"]','0.65');await page.waitForFunction(()=>document.querySelector('[data-testid="piece-design-three-view"] metadata')?.textContent.includes('"sleeveLength":0.65'),{timeout:60000});
 fs.writeFileSync(`${out}/submitted-composition.svg`,await page.$eval('[data-testid="piece-design-three-view"]',e=>e.innerHTML));const metadata=await page.$eval('[data-testid="piece-design-three-view"] metadata',e=>JSON.parse(e.textContent));fs.writeFileSync(`${out}/submitted-composition.json`,JSON.stringify(metadata,null,2));
 for(const effect of ['product','model']){
  current=effect;await page.select('[aria-label="裁片组合生成效果"]',effect);await click('生成当前方案效果图');
  await page.waitForFunction(t=>[...document.querySelectorAll('.piece-image-test')].some(e=>e.getAttribute('data-effect')===t),{},effect);
  await page.waitForFunction(t=>{const e=[...document.querySelectorAll('.piece-image-test')].find(e=>e.getAttribute('data-effect')===t);return e?.querySelector('img[referrerpolicy="no-referrer"]')||e?.textContent.includes('避免重复提交')&&document.querySelector('.piece-senling [role="status"]')?.textContent;},{timeout:8*60000},effect);
  const record=records.find(r=>r.effect===effect);assert(record);assert.equal(record.state,'done',record.error??'Generation not confirmed');assert.equal(record.reference.inputSha256,record.referenceSha256);
  const selector=`.piece-image-test[data-effect="${effect}"]`,url=record.reference.imageUrl;await page.waitForFunction(s=>document.querySelector(`${s} img[referrerpolicy="no-referrer"]`)?.naturalWidth>0,{timeout:45000},selector);
  for(let n=0;n<30&&!images.has(url);n++)await new Promise(r=>setTimeout(r,200));const original=images.get(url);assert(original,'Original response not captured');
  const ext=original.mime?.includes('png')?'png':original.mime?.includes('webp')?'webp':'jpg';record.originalFile=`${effect}-senling-original.${ext}`;fs.writeFileSync(`${out}/${record.originalFile}`,original.bytes);record.originalSha256=sha(original.bytes);record.finishedAt=new Date().toISOString();record.reviewStatus='pending-visual-review';save();
  await(await page.$(`${selector} .piece-image-pair`)).screenshot({path:`${out}/${effect}-comparison.png`});await page.screenshot({path:`${out}/${effect}-page.png`});
 }
 assert.equal(records.length,2);assert.equal(records[0].referenceSha256,records[1].referenceSha256,'Both outputs must share exactly the same input design');assert.deepEqual(errors,[]);
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="piece-design-board"]');await click('创建直身T恤裁片组合');await page.waitForSelector('[data-testid="piece-design-three-view"]',{timeout:60000});await page.waitForFunction(()=>document.querySelectorAll('.piece-image-test img[referrerpolicy="no-referrer"]').length===2);fs.writeFileSync(`${out}/senling-session-restore.json`,JSON.stringify({passed:true,restoredTests:2,extraSubmissions:records.length-2},null,2));
}catch(e){errors.push(String(e));save();await page.screenshot({path:`${out}/senling-failure.png`}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();save();console.log(JSON.stringify({submitted:records.length,completed:records.filter(r=>r.state==='done').length,errors}));}
