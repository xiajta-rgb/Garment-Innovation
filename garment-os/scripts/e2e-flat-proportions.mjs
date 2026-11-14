import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/flat-proportions-20261112';
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),errors=[],steps=[];
page.on('pageerror',e=>errors.push(String(e)));
const click=async text=>{for(const b of await page.$$('button'))if((await b.evaluate(e=>e.textContent.trim()))===text){await b.click();return;}throw Error('Missing '+text);};
const ready=()=>page.waitForSelector('[data-testid="piece-design-three-view"]',{timeout:90000});
const meta=()=>page.$eval('[data-testid="piece-design-three-view"] metadata',e=>JSON.parse(e.textContent));
const capture=async name=>{
 const svg=await page.$eval('[data-testid="piece-design-three-view"]',e=>e.innerHTML);fs.writeFileSync(`${out}/${name}.svg`,svg);
 const height=Number(svg.match(/height="(\d+)"/)?.[1]??760);
 const tab=await browser.newPage();await tab.setViewport({width:1500,height});await tab.setContent(`<style>body{margin:0}</style>${svg}`);await tab.screenshot({path:`${out}/${name}.png`});await tab.close();
 await page.screenshot({path:`${out}/${name}-workbench.png`});
};
try{
 await page.setViewport({width:1600,height:1100});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});
 await click('创建直身T恤裁片组合');await ready();
 if(process.argv.includes('--before')){await capture('before');console.log('baseline saved');}
 else{
  let m=await meta();assert.equal(m.flatSpecification.basis,'source-net-pattern');
  const row=id=>m.flatSpecification.rows.find(r=>r.id===id).valueMm;
  const baseline={length:row('front-length'),chest:row('front-chest'),shoulder:row('shoulder'),sleeve:row('sleeve-length'),cuff:row('cuff')};
  assert.equal(await page.$$eval('[data-flat-geometry]',es=>es.length),2);await capture('after');
  const dimensionPaths=await page.$$eval('[data-flat-measure]',es=>es.map(e=>e.getAttribute('d')));
  await click('隐藏量点');assert.equal(await page.$$eval('[data-flat-dimensions]',es=>es.length),0);
  await click('显示量点');assert.deepEqual(await page.$$eval('[data-flat-measure]',es=>es.map(e=>e.getAttribute('d'))),dimensionPaths);
  const shapePaths=await page.$$eval('[data-flat-geometry] path',es=>es.map(e=>e.getAttribute('d')));
  await click('仅看结构线');assert.deepEqual(await page.$$eval('[data-flat-geometry] path',es=>es.map(e=>e.getAttribute('d'))),shapePaths);
  await click('恢复配色');
  const downloads=fs.mkdtempSync(`${out}/downloads-`),client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:fs.realpathSync(downloads)});
  const displayed=await page.$eval('[data-testid="piece-design-three-view"]',e=>e.innerHTML);await click('下载组合三视图');
  for(let i=0;i<60&&!fs.existsSync(`${downloads}/裁片组合-三视图.svg`);i++)await new Promise(r=>setTimeout(r,100));
  const exported=fs.readFileSync(`${downloads}/裁片组合-三视图.svg`,'utf8');
  // Browser serialization may normalize whitespace; compare the parsed path list and metadata.
  assert.deepEqual(await page.evaluate(([a,b])=>{const parse=x=>{const d=new DOMParser().parseFromString(x,'image/svg+xml');return {paths:[...d.querySelectorAll('path')].map(p=>p.getAttribute('d')),metadata:JSON.parse(d.querySelector('metadata').textContent)};};return [parse(a),parse(b)];},[displayed,exported]).then(([a,b])=>({same:JSON.stringify(a)===JSON.stringify(b)})),{same:true});
  steps.push({name:'structure-toggle-preserves-geometry-and-real-download-matches-display',pass:true});
  await page.setViewport({width:1294,height:1147});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/workbench-1294.png`});await page.setViewport({width:1600,height:1100});
  steps.push({name:'default-planar-views-and-reversible-dimension-overlay',pass:true});
  const initial=m.configuration.measurements.totalLength;
  const input=await page.$('[aria-label="设计衣长 mm"]');await input.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(String(initial+40));await page.keyboard.press('Tab');
  await page.waitForFunction(value=>{const e=document.querySelector('[data-testid="piece-design-three-view"] metadata');return e&&JSON.parse(e.textContent).configuration.measurements.totalLength===value;},{timeout:90000},initial+40);m=await meta();
  assert(Math.abs(row('front-length')-baseline.length-40)<.01);assert(Math.abs(row('front-chest')-baseline.chest)<1);assert.equal(row('sleeve-length'),baseline.sleeve);await capture('longer-40mm');
  steps.push({name:'real-input-adds-40mm-length-with-submillimetre-source-side-curve-coupling',pass:true});
  await page.select('[aria-label="组合衣身松量"]','loose');await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="piece-design-three-view"] metadata');return e&&JSON.parse(e.textContent).configuration.fit==='loose';},{timeout:90000});m=await meta();assert(row('front-chest')>baseline.chest);assert.equal(row('shoulder'),baseline.shoulder);
  steps.push({name:'ease-rebuilds-source-width-without-inventing-drop-shoulder',pass:true});
  await page.select('[aria-label="组合袖片方案"]','0.65');await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="piece-design-three-view"] metadata');return e&&JSON.parse(e.textContent).configuration.construction?.options.sleeveLength===.65;},{timeout:90000});m=await meta();assert(row('sleeve-length')>baseline.sleeve);await capture('loose-extended-sleeve');
  steps.push({name:'sleeve-choice-rebuilds-real-cad-and-displayed-top-length',pass:true});
  assert.equal(m.productionApproved,false);assert.equal(m.drapeValidated,false);
  assert.equal(await page.$$eval('[data-testid="flat-specification"] tbody tr',es=>es.length),14);
  assert.equal(await page.$eval('[data-testid="workbench-shell"]',e=>!!e),true);
  await click('定制矩阵');await page.waitForSelector('[data-desk-drawing]',{timeout:90000});
  const matrix=await page.$eval('[data-desk-drawing]',e=>{const d=new DOMParser().parseFromString(decodeURIComponent(e.src.split(',').slice(1).join(',')),'image/svg+xml');return {geometry:d.querySelectorAll('[data-flat-geometry]').length,metadata:JSON.parse(d.querySelector('metadata').textContent)};});
  assert.equal(matrix.geometry,2);assert.equal(matrix.metadata.flatSpecification.basis,'source-net-pattern');
  await page.waitForFunction(()=>document.querySelectorAll('[data-desk-drawing]').length>=5,{timeout:90000});
  const scales=await page.$$eval('[data-desk-drawing]',es=>es.map(e=>{const d=new DOMParser().parseFromString(decodeURIComponent(e.src.split(',').slice(1).join(',')),'image/svg+xml');return JSON.parse(d.querySelector('metadata').textContent).drawingScalePixelsPerMm;}));assert.equal(new Set(scales).size,1);
  await page.screenshot({path:`${out}/matrix-workbench.png`});steps.push({name:'original-matrix-reuses-the-same-dimensional-drawing',pass:true});
  assert.deepEqual(errors,[]);
  const before=fs.readFileSync(`${out}/before.svg`,'utf8'),after=fs.readFileSync(`${out}/after.svg`,'utf8'),comparison=await browser.newPage();
  await comparison.setViewport({width:1500,height:1480});await comparison.setContent(`<style>body{margin:0;background:#f1f3f1;font:22px sans-serif;color:#293a30}h3{margin:0;padding:18px 28px}svg{display:block;width:1500px}</style><h3>优化前：组装投影作为主视图</h3>${before}<h3>优化后：源净样衣身＋尺寸化袖示意＋量点；同一款式配置</h3>${after}`);await comparison.screenshot({path:`${out}/before-after.png`,fullPage:true});await comparison.close();
  console.log(JSON.stringify({steps,baseline,errors}));
 }
}catch(e){process.exitCode=1;steps.push({name:'failure',error:String(e),pass:false});await page.screenshot({path:`${out}/failure.png`});console.error(e);}
finally{fs.writeFileSync(`${out}/${process.argv.includes('--before')?'baseline':'browser'}.json`,JSON.stringify({steps,errors},null,2));await browser.close();}
