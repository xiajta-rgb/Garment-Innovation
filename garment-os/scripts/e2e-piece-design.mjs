import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/piece-design-20261111';fs.mkdirSync(out,{recursive:true});
const trace=message=>{fs.appendFileSync(`${out}/browser-progress.log`,`${new Date().toISOString()} ${message}\n`);console.log(message);};
fs.writeFileSync(`${out}/browser-progress.log`,'');trace('Starting browser');
const browser=await puppeteer.launch({executablePath:process.env.GARMENT_E2E_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage(),errors=[],steps=[];
trace('Browser ready');
const pushStep=steps.push.bind(steps);steps.push=(step)=>{trace(`${step.name}: ${step.pass?'passed':'failed'}`);return pushStep(step);};
page.on('pageerror',e=>errors.push(String(e)));
async function click(label){await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===t),{},label);for(const b of await page.$$('button'))if(await b.evaluate((e,t)=>e.textContent.trim()===t,label)){await b.click();return;}throw Error('Missing '+label);}
const metadata=()=>page.$eval('[data-testid="piece-design-three-view"] metadata',e=>JSON.parse(e.textContent));
async function ready(){await page.waitForSelector('[data-testid="piece-design-three-view"]',{timeout:60000});}
async function number(label,value){const input=await page.$(`[aria-label="${label}"]`);await input.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await input.press('Backspace');await input.type(String(value));await input.press('Tab');}
async function capture(name){await ready();await(await page.$('[data-testid="piece-design-three-view"]')).screenshot({path:`${out}/${name}-three-view.png`});fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(await metadata(),null,2));fs.writeFileSync(`${out}/${name}.svg`,await page.$eval('[data-testid="piece-design-three-view"]',e=>e.innerHTML));}
try{
 await page.setViewport({width:1800,height:1200});await page.goto((process.env.GARMENT_E2E_URL??'http://localhost:5341/')+'?workspace=piece-design',{waitUntil:'networkidle0'});await click('配套尺寸与配缝');await click('创建直身T恤裁片组合');await ready();
 let m=await metadata();assert.equal(m.coordinateSpace,'source-cad-mm');assert.equal(m.pieces.length,5);assert.equal(await page.$$eval('[data-piece-design-view]',es=>es.length),3);assert(m.joins.every(j=>j.status!=='failed'));await capture('baseline');steps.push({name:'real-source-pieces-and-three-view',pass:true});
 const initialSleeve=m.pieces.find(p=>p.id==='teagan.sleeve').netPath,initialNeck=m.neckband.attachmentLengthMm;
 await page.select('[aria-label="组合袖片方案"]','0.65');await page.waitForFunction(()=>document.querySelector('[data-testid="piece-design-three-view"] metadata')?.textContent.includes('"sleeveLength":0.65'));await ready();
 await number('领宽比例',.35);await page.waitForFunction(()=>document.querySelector('[data-testid="piece-design-three-view"] metadata')?.textContent.includes('"necklineWidth":0.35'));await ready();
 m=await metadata();assert.notEqual(m.pieces.find(p=>p.id==='teagan.sleeve').netPath,initialSleeve);assert.notEqual(m.neckband.attachmentLengthMm,initialNeck);assert.equal(m.configuration.construction.options.sleeveLength,.65);steps.push({name:'sleeve-neckline-regenerate-cad-and-band',pass:true});
 await number('袋宽 mm',125);await page.waitForFunction(()=>document.querySelector('[data-testid="piece-design-three-view"] metadata')?.textContent.includes('"widthMm":125'));await ready();
 await page.select('[aria-label="组合贴袋类型"]','round');await page.waitForFunction(()=>document.querySelector('[data-testid="piece-design-three-view"] metadata')?.textContent.includes('"kind":"round"'));await ready();
 m=await metadata();assert.equal(m.configuration.construction.options.sleeveLength,.65);assert.equal(m.configuration.pieceDesign.pocket.widthMm,125);steps.push({name:'independent-pocket-net-and-cut-dimensions',pass:true});
 const pocket=await page.$('[data-testid="draggable-pocket"]');await pocket.evaluate(e=>e.scrollIntoView({block:'center'}));const box=await pocket.boundingBox();assert(box);const before=m.configuration.pieceDesign.pocket;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+10,box.y+box.height/2+14,{steps:8});await page.mouse.up();await ready();
 await page.waitForFunction(old=>{const e=document.querySelector('[data-testid="piece-design-three-view"] metadata');return e&&JSON.parse(e.textContent).configuration.pieceDesign.pocket.yMm!==old;},{},before.yMm);m=await metadata();assert(m.configuration.pieceDesign.pocket.yMm>before.yMm);steps.push({name:'real-pointer-drag-pocket-in-source-mm',pass:true});
 await capture('modified');
 await number('袋中心距前中 mm',220);await page.waitForSelector('.piece-error');assert.equal(await page.$('[data-testid="piece-design-three-view"]'),null);assert(await page.$eval('.piece-image-controls .piece-primary',e=>e.disabled));steps.push({name:'out-of-panel-placement-blocks-preview-and-generation',pass:true});
 await page.click('[title="撤销 (Ctrl+Z)"]');await ready();assert.equal((await metadata()).configuration.pieceDesign.pocket.widthMm,125);steps.push({name:'undo-restores-valid-composition',pass:true});
 await page.click('[data-testid="design-save"]');await page.waitForFunction(()=>document.querySelector('[data-testid="design-save"]')?.getAttribute('aria-busy')==='false');
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-testid="piece-design-board"]');await page.click('[title="Saved Designs"]');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim().startsWith('裁片组合 · 贴袋撞色T恤')));
 for(const b of await page.$$('button'))if(await b.evaluate(e=>e.textContent.trim().startsWith('裁片组合 · 贴袋撞色T恤'))){await b.click();break;}
 await ready();m=await metadata();assert.equal(m.configuration.pieceDesign.pocket.kind,'round');assert.equal(m.configuration.pieceDesign.pocket.widthMm,125);assert.equal(m.configuration.construction.options.necklineWidth,.35);steps.push({name:'save-refresh-reopen-exact-composition',pass:true});
 const widthInput=await page.$('[aria-label="袋宽 mm"]');await widthInput.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await widthInput.press('Backspace');await widthInput.press('Tab');await page.waitForSelector('.piece-error');
 await page.click('[aria-label="袋高 mm"]');await page.click('[aria-label="袋中心距前中 mm"]');assert.equal(await page.$('[data-testid="piece-design-three-view"]'),null);assert(await page.$eval('.piece-image-controls .piece-primary',e=>e.disabled));
 await number('袋宽 mm',125);await ready();steps.push({name:'blank-dimension-stays-blocked-after-other-fields-blur',pass:true});
 const downloads=fs.mkdtempSync(path.join(out,'downloads-'));
 const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(downloads)});await click('下载裁片与配缝');
 for(let n=0;n<40&&!fs.existsSync(`${downloads}/裁片组合-设计与配缝.json`);n++)await new Promise(r=>setTimeout(r,100));const exported=JSON.parse(fs.readFileSync(`${downloads}/裁片组合-设计与配缝.json`));assert.equal(exported.configuration.pieceDesign.pocket.widthMm,125);steps.push({name:'real-piece-and-seam-export',pass:true});
 await click('下载毫米裁片 SVG');for(let n=0;n<40&&!fs.existsSync(`${downloads}/裁片组合-毫米裁片.svg`);n++)await new Promise(r=>setTimeout(r,100));const cad=fs.readFileSync(`${downloads}/裁片组合-毫米裁片.svg`,'utf8');assert.match(cad,/width="[\d.]+mm"/);assert.equal((cad.match(/data-cad-piece=/g)??[]).length,5);steps.push({name:'real-millimetre-cad-svg-export',pass:true});
 for(const filename of ['裁片组合-设计与配缝.json','裁片组合-毫米裁片.svg'])fs.copyFileSync(path.join(downloads,filename),path.join(out,filename));trace(`Fresh exports saved from ${downloads}`);
 await page.select('[aria-label="裁片组合生成效果"]','model');assert.equal(await page.$eval('[aria-label="裁片组合生成效果"]',e=>e.value),'model');steps.push({name:'product-and-model-generation-choices',pass:true});await page.screenshot({path:`${out}/final-editor-page.png`});assert.deepEqual(errors,[]);
}catch(error){steps.push({name:'failure',pass:false,error:String(error)});await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({kind:'real-browser-pattern-composition',steps,errors,paidGenerationExecuted:false},null,2));await browser.close();console.log(JSON.stringify({steps,errors}));}
