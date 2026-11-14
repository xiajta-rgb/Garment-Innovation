/** Two paid tests through the actual editor, retaining immutable inputs/jobs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/style-three-view-20261111',manifest=`${out}/senling-live.json`;fs.mkdirSync(out,{recursive:true});
assert(!fs.existsSync(manifest),'Live intents already exist. Inspect their results before starting another paid run.');
const browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage(),records=[],images=new Map(),errors=[];
let current='';const save=()=>fs.writeFileSync(manifest,JSON.stringify({kind:'real-browser-senling-image-conditioned-tests',records,errors,productionApproved:false},null,2));
page.on('pageerror',e=>{errors.push(String(e));save();});
page.on('request',r=>{
 if(!r.url().endsWith('/api/style-image')||r.method()!=='POST')return;
 const body=JSON.parse(r.postData());if(body.action!=='generate')return;
 assert(body.referencePng,'image conditioning is required');const input=Buffer.from(body.referencePng.split(',')[1],'base64'),referenceFile=`${current}-live-reference.png`;fs.writeFileSync(`${out}/${referenceFile}`,input);
 records.push({case:current,id:body.id,model:body.model,prompt:body.prompt,referenceFile,referenceSha256:createHash('sha256').update(input).digest('hex'),submittedAt:new Date().toISOString(),state:'submitted'});save();
});
page.on('response',async r=>{
 try{
  if(r.request().resourceType()==='image'&&!r.url().startsWith('http://localhost'))images.set(r.url(),{data:await r.buffer(),mime:r.headers()['content-type']});
  if(!r.url().endsWith('/api/style-image'))return;const request=JSON.parse(r.request().postData()),record=records.find(x=>x.id===request.id);if(!record)return;
  const body=await r.json();if(!r.ok()){record.error=body.error;save();return;}
  if(body.state){record.state=body.state;if(body.state==='done')record.reference=body.reference;save();}
 }catch(error){errors.push('Could not retain response evidence: '+String(error));save();}
});
async function click(label){for(const b of await page.$$('button'))if(await b.evaluate((e,t)=>e.textContent.trim()===t,label)){await b.click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return;}throw Error('Missing control '+label);}
try{
 await page.setViewport({width:1740,height:1130,deviceScaleFactor:1});await page.goto((process.env.GARMENT_E2E_URL??'http://localhost:5341/')+'?workspace=company',{waitUntil:'networkidle0'});await page.waitForSelector('[data-design-view="side"]');
 for(const [id,preset]of [['polo','撞色口袋 Polo'],['hoodie','拼色袋鼠帽衫']]){
  current=id;await click(preset);await page.waitForFunction(label=>document.querySelector('[aria-label="改款领型"]')?.value===label,{},id==='polo'?'polo':'hood');
  const before=await page.$eval('[data-testid="company-design-sheet"]',e=>e.innerHTML);fs.writeFileSync(`${out}/${id}-live-design.svg`,before);
  const opened=await page.$$eval('button',es=>es.find(e=>e.textContent==='森灵测试')?.getAttribute('aria-pressed'));if(opened!=='true')await click('森灵测试');
  await page.waitForSelector('[data-testid="style-design-senling"]',{visible:true});await click(records.length?'用当前方案再测试':'将当前三视图送入森灵');
  await page.waitForFunction(()=>{
   const image=document.querySelector('img[alt="森灵三视图测试结果"]');return !!(image?.complete&&image.naturalWidth>0)||!!document.querySelector('[data-testid="style-design-senling"] [role="alert"]');
  },{timeout:8*60000});
  const record=records.find(r=>r.case===id);assert(record,'actual submission was captured');assert.equal(record.state,'done',record.error??'No completed output');assert.equal(record.reference.inputSha256,record.referenceSha256);
  const url=record.reference.imageUrl;for(let i=0;i<40&&!images.has(url);i++)await new Promise(r=>setTimeout(r,250));assert(images.has(url),'Original result image was loaded by the page');
  const original=images.get(url),ext=original.mime?.includes('jpeg')?'jpg':original.mime?.includes('webp')?'webp':'png';record.originalFile=`${id}-senling-original.${ext}`;record.originalSha256=createHash('sha256').update(original.data).digest('hex');fs.writeFileSync(`${out}/${record.originalFile}`,original.data);
  record.reviewStatus='pending-visual-review';record.finishedAt=new Date().toISOString();save();
  await(await page.$('.company-senling-comparison')).screenshot({path:`${out}/${id}-senling-comparison.png`});await page.screenshot({path:`${out}/${id}-senling-page.png`});
 }
 assert.equal(records.length,2);assert.deepEqual(errors,[]);console.log(JSON.stringify({tests:records.length,completed:records.filter(r=>r.state==='done').length,out}));
}catch(error){errors.push(String(error));save();await page.screenshot({path:`${out}/senling-failure.png`}).catch(()=>{});process.exitCode=1;console.log(JSON.stringify({error:String(error),out}));}
finally{await browser.close();}
