import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/style-three-view-20261111';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(String(e)));
async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function click(text){const button=await page.$$('button');for(const b of button)if(await b.evaluate((e,t)=>e.textContent.trim()===t,text)){await b.click();await settle();return;}throw Error(`Missing button ${text}`);}
async function exportCase(id){
 await settle();const data=await page.evaluate(async()=>{
  const {useDesignStore}=await import('/src/store/useDesignStore.ts'),{exportStyleThreeViewSvg}=await import('/src/lib/pattern/style-variation-drawing.ts'),{styleReferencePng}=await import('/src/features/company-design/style-image-reference.ts'),{styleDesignImagePrompt}=await import('/src/application/style-design-image.ts');
  const draft=useDesignStore.getState().companyDraft;return {draft,svg:exportStyleThreeViewSvg(draft),referenceSvg:exportStyleThreeViewSvg(draft,true),png:await styleReferencePng(exportStyleThreeViewSvg(draft,true)),prompt:styleDesignImagePrompt(draft)};
 });
 fs.writeFileSync(`${out}/${id}.svg`,data.svg);fs.writeFileSync(`${out}/${id}-reference.svg`,data.referenceSvg);const image=Buffer.from(data.png.split(',')[1],'base64');fs.writeFileSync(`${out}/${id}-reference.png`,image);
 fs.writeFileSync(`${out}/${id}.json`,JSON.stringify({draft:data.draft,prompt:data.prompt,referenceSha256:createHash('sha256').update(image).digest('hex')},null,2));
 await(await page.$('[data-testid="company-design-sheet"]')).screenshot({path:`${out}/${id}-sheet.png`});await page.screenshot({path:`${out}/${id}-page.png`});
 return data;
}
try{
 await page.setViewport({width:1740,height:1130,deviceScaleFactor:1});await page.goto((process.env.GARMENT_E2E_URL??'http://localhost:5341/')+'?workspace=company',{waitUntil:'networkidle0'});await page.waitForSelector('[data-design-view="side"]');
 assert.equal(await page.$$eval('[data-testid="company-design-sheet"] [data-design-view]',es=>es.length),3);await exportCase('baseline');results.push({name:'real-three-view-default',pass:true});
 await click('撞色口袋 Polo');await page.waitForSelector('[data-operation="placket"]');assert.equal(await page.$$eval('[data-design-view="front"] [data-operation="pocket"]',es=>es.length),1);assert.equal(await page.$$eval('[data-design-view="back"] [data-operation="pocket"]',es=>es.length),0);await exportCase('polo');results.push({name:'combined-polo-variation',pass:true});
 await page.select('[aria-label="改款领型"]','v');await page.select('[aria-label="改款袖型"]','elbow');await page.select('[aria-label="改款图案"]','back');await page.waitForSelector('[data-design-view="back"] [data-operation="graphic"]');
 assert.equal(await page.$eval('[aria-label="改款口袋"]',e=>e.value),'chest');assert.equal(await page.$eval('[aria-label="改款领型"]',e=>e.value),'v');assert.equal(await page.$$eval('[data-design-view="front"] [data-operation="graphic"]',es=>es.length),0);results.push({name:'sequential-edits-preserve-other-choices',pass:true});
 await page.click('[title="撤销 (Ctrl+Z)"]');await settle();assert.equal(await page.$eval('[aria-label="改款图案"]',e=>e.value),'none');await page.click('[title="重做 (Ctrl+Shift+Z)"]');await settle();assert.equal(await page.$eval('[aria-label="改款图案"]',e=>e.value),'back');results.push({name:'undo-redo-actual-artwork',pass:true});
 const id=await page.evaluate(async()=>{const {useDesignStore}=await import('/src/store/useDesignStore.ts');return useDesignStore.getState().currentDesignId;});assert.equal(id,null);
 await page.click('[data-testid="design-save"]');await page.waitForFunction(()=>document.querySelector('[data-testid="design-save"]')?.getAttribute('aria-busy')==='false');
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-design-view="side"]');await page.click('[title="Saved Designs"]');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim().startsWith('常规微落肩圆领短T男')));
 // Reopen through the saved-design list, using its actual visible name.
 const buttons=await page.$$('button');let opened=false;for(const b of buttons){const text=await b.evaluate(e=>e.textContent.trim());if(text.startsWith('常规微落肩圆领短T')&&text!=='常规微落肩圆领短T'){await b.click();opened=true;break;}}
 assert(opened,'saved design is listed');await page.waitForFunction(()=>document.querySelector('[aria-label="改款领型"]')?.value==='v');assert.equal(await page.$eval('[aria-label="改款口袋"]',e=>e.value),'chest');assert.equal(await page.$eval('[aria-label="改款图案"]',e=>e.value),'back');results.push({name:'save-reload-reopen-variations',pass:true});
 await click('拼色袋鼠帽衫');await page.waitForSelector('[data-operation="hood-side"]');await exportCase('hoodie');assert.equal(await page.$eval('[aria-label="改款下摆"]',e=>e.value),'rib');results.push({name:'hoodie-three-view-variation',pass:true});
 const disabled=await page.$$eval('button',es=>es.find(e=>e.textContent==='使用此母版查看裁片 / 三维')?.disabled);assert.equal(disabled,true);results.push({name:'drawing-cannot-claim-unsupported-cad',pass:true});
 await click('森灵测试');await page.waitForSelector('[data-testid="style-design-senling"]',{visible:true});assert.equal(await page.$eval('[aria-label="三视图生图模型"]',e=>e.value),'nano-banana-pro');await page.screenshot({path:`${out}/senling-panel.png`});results.push({name:'senling-current-design-entry',pass:true});
 const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(out)});await click('下载三视图 PNG');
 for(let i=0;i<40&&!fs.existsSync(`${out}/COT25M002-三视图.png`);i++)await new Promise(r=>setTimeout(r,250));assert(fs.existsSync(`${out}/COT25M002-三视图.png`));results.push({name:'real-png-download',pass:true});
 assert.deepEqual(errors,[]);
}catch(error){results.push({name:'failure',pass:false,error:String(error)});await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({kind:'real-browser-style-three-view-workflow',results,errors,paidGenerationExecuted:false},null,2));await browser.close();console.log(JSON.stringify({out,results,errors}));}
