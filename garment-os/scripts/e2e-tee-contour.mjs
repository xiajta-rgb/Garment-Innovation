import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const out='doc/evidence/tee-contour-20261112';
fs.mkdirSync(out,{recursive:true});
const before=JSON.parse(fs.readFileSync(`${out}/before-metadata.json`,'utf8'));
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),steps=[],errors=[],posts=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
const mark=(name,detail)=>{steps.push({name,pass:true,detail});console.log(name);};
const click=async text=>{
 for(const button of await page.$$('button'))if((await button.evaluate(e=>e.textContent.trim()))===text){await button.click();return;}
 throw Error(`Missing button: ${text}`);
};
const wait=expected=>page.waitForFunction(expected=>{
 const text=document.querySelector('[data-testid="piece-design-three-view"] metadata')?.textContent;
 if(!text)return false;const c=JSON.parse(text).configuration;
 return (!expected.fit||c.fit===expected.fit)&&(!expected.length||c.measurements.totalLength===expected.length)&&(!expected.sleeve||c.construction?.options.sleeveLength===expected.sleeve)&&(!expected.pocket||c.pieceDesign.pocket.kind===expected.pocket);
},{timeout:90000},expected);
const meta=()=>page.$eval('[data-testid="piece-design-three-view"] metadata',e=>JSON.parse(e.textContent));
const apply=configuration=>page.evaluate(async configuration=>{
 const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);
 const {useDesignStore}=await import(url);useDesignStore.getState().applyReviewedConfiguration(configuration);
},configuration);
const capture=async name=>{
 const svg=await page.$eval('[data-testid="piece-design-three-view"]',e=>e.innerHTML);
 fs.writeFileSync(`${out}/${name}.svg`,svg);
 const tab=await browser.newPage();await tab.setViewport({width:1500,height:720});await tab.setContent(`<style>body{margin:0}</style>${svg}`);
 await tab.screenshot({path:`${out}/${name}.png`});await tab.close();return svg;
};
const geometry=()=>page.$eval('[data-testid="piece-design-three-view"] svg',svg=>{
 const checks=[],failures=[];
 for(const view of ['front','back','side']){
  const group=svg.querySelector(`[data-company-tee-view="${view}"]`);
  const body=group.querySelector(view==='back'?'[data-source-piece="teagan.back"]':'[data-source-piece="teagan.front"]');
  const sleeve=group.querySelector('[data-source-piece="teagan.sleeve"]');
  const operations=view==='side'?['side-hem','side-cuff']:['body-double-needle','sleeve-double-needle'];
  for(const operation of operations)for(const line of group.querySelectorAll(`[data-operation="${operation}"]`)){
   const isSleeve=/sleeve|cuff/.test(operation),target=isSleeve?sleeve:body,total=line.getTotalLength();
   for(let i=1;i<40;i++){
    const pt=line.getPointAtLength(total*i/40);
    // The left sleeve uses the same fill under a mirror transform.
    const local=new DOMPoint(isSleeve&&view!=='side'?Math.abs(pt.x):pt.x,pt.y);
    if(!target.isPointInFill(local))failures.push({view,operation,t:i/40,x:pt.x,y:pt.y});
   }
   checks.push({view,operation,samples:39});
  }
  const boundary=group.querySelector('[data-operation="garment-contour"]');
  const bbox=boundary.getBBox();
  if(!Number.isFinite(boundary.getTotalLength())||bbox.width<=0||bbox.height<=0)failures.push({view,invalidBoundary:true});
 }
 return {checks,failures,samples:checks.reduce((n,c)=>n+c.samples,0)};
});
const seamRaster=()=>page.$eval('[data-testid="piece-design-three-view"] svg',async svg=>{
 const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=720;
 const ctx=canvas.getContext('2d'),img=new Image();
 img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await img.decode();ctx.drawImage(img,0,0);
 const actual=svg.getBoundingClientRect(),failures=[];let samples=0;
 for(const seam of svg.querySelectorAll('[data-operation="armhole-seam"]'))for(let i=10;i<=40;i++){
  const point=seam.getPointAtLength(seam.getTotalLength()*i/50).matrixTransform(seam.getScreenCTM());
  const x=Math.round((point.x-actual.x)*1500/actual.width),y=Math.round((point.y-actual.y)*720/actual.height);
  const pixels=ctx.getImageData(x-1,y-1,3,3).data;
  for(let p=0;p<pixels.length;p+=4){samples++;if(pixels[p]>55||pixels[p+1]>65||pixels[p+2]>57)failures.push({x,y,rgb:[...pixels.slice(p,p+3)]});}
 }
 return {samples,failures};
});
try{
 await page.setViewport({width:1600,height:1100});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});
 await click('配套尺寸与配缝');await click('创建直身T恤裁片组合');await wait({});
 await capture('same-color');let g=await geometry();assert.deepEqual(g.failures,[]);mark('same-color-workbench-and-contained-topstitching',g);
 const raster=await seamRaster();assert.deepEqual(raster.failures,[]);mark('same-color-armhole-has-no-light-raster-cracks',raster);
 await apply(before.configuration);await wait({fit:before.configuration.fit,length:before.configuration.measurements.totalLength,pocket:before.configuration.pieceDesign.pocket.kind});
 const current=await meta();assert.deepEqual(current.configuration,before.configuration);
 assert.deepEqual(current.pieces,before.pieces);assert.deepEqual(current.styleGuide.landmarks,before.styleGuide.landmarks);
 fs.writeFileSync(`${out}/after-metadata.json`,JSON.stringify(current,null,2));
 const afterSvg=await capture('after');g=await geometry();assert.deepEqual(g.failures,[]);mark('same-configuration-source-pieces-and-landmarks-preserved',g);
 const drawingPaths=await page.$$eval('[data-testid="piece-design-three-view"] path',es=>es.map(e=>e.getAttribute('d')));
 await click('仅看结构线');assert.deepEqual(await page.$$eval('[data-testid="piece-design-three-view"] path',es=>es.map(e=>e.getAttribute('d'))),drawingPaths);
 assert(await page.$$eval('[data-contour-underlay]',es=>es.every(e=>e.getAttribute('fill')==='#f6f7f5')));
 await capture('structure-only');await click('恢复配色');mark('structure-toggle-preserves-all-boundary-paths');
 const downloads=path.resolve(`${out}/downloads`);fs.mkdirSync(downloads,{recursive:true});
 const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 const target=path.join(downloads,'裁片组合-三视图.svg');if(fs.existsSync(target))fs.unlinkSync(target);
 await click('下载组合三视图');
 for(let i=0;i<60&&!fs.existsSync(target);i++)await new Promise(r=>setTimeout(r,100));
 const same=await page.evaluate((downloaded,rendered)=>{
  const canonical=svg=>new XMLSerializer().serializeToString(new DOMParser().parseFromString(svg,'image/svg+xml'));
  return canonical(downloaded)===canonical(rendered);
 },fs.readFileSync(target,'utf8'),afterSvg);
 assert(same,'Downloaded SVG must preserve rendered paths, colors and metadata');mark('download-matches-rendered-boundaries-exactly');
 await page.setViewport({width:1294,height:1147});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`${out}/workbench-1294.png`});
 await page.setViewport({width:1600,height:1100});
 const input=await page.$('[aria-label="设计衣长 mm"]');await input.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('640');await page.keyboard.press('Tab');await wait({length:640});
 await page.select('[aria-label="组合衣身松量"]','loose');await wait({fit:'loose'});
 await page.select('[aria-label="组合袖片方案"]','0.65');await wait({sleeve:.65});
 await capture('longer-looser-longer-sleeve');g=await geometry();assert.deepEqual(g.failures,[]);mark('real-controls-preserve-contours-and-contain-stitches-after-variation',g);
 await click('定制矩阵');await page.waitForFunction(()=>document.querySelectorAll('[data-desk-drawing]').length>=5,{timeout:90000});
 const matrix=await page.$$eval('[data-desk-drawing]',es=>es.map(e=>{
  const doc=new DOMParser().parseFromString(decodeURIComponent(e.src.slice(e.src.indexOf(',')+1)),'image/svg+xml');
  return {scale:JSON.parse(doc.querySelector('metadata').textContent).styleGuide.scalePixelsPerDrawingUnit,contours:doc.querySelectorAll('[data-operation="garment-contour"]').length};
 }));assert.equal(new Set(matrix.map(m=>m.scale)).size,1);assert(matrix.every(m=>m.contours===3));
 await page.screenshot({path:`${out}/matrix.png`});mark('custom-matrix-reuses-contour-finishing-at-shared-scale',matrix);
 const compare=await browser.newPage();await compare.setViewport({width:1500,height:1580});
 await compare.setContent(`<style>body{margin:0;font:20px 'Microsoft YaHei',sans-serif;background:#edf1ed;color:#24352a}h3{margin:0;padding:20px 34px;font-size:20px;font-weight:500}section{background:#fff}svg{display:block;width:1500px;height:720px}</style><h3>优化前 · 同款、同视角</h3><section>${fs.readFileSync(`${out}/before.svg`,'utf8')}</section><h3>优化后 · 连续外轮廓 / 下摆转角 / 平行双压线</h3><section>${afterSvg}</section>`);
 await compare.screenshot({path:`${out}/comparison.png`,fullPage:true});
 await compare.setViewport({width:1600,height:600});
 await compare.setContent(`<style>body{margin:0;background:#edf1ed;font:18px 'Microsoft YaHei',sans-serif;color:#24352a;display:flex;gap:16px;padding:20px}section{width:770px;background:#fff}h3{font-size:18px;padding:0 20px;font-weight:500}.crop{height:460px;overflow:hidden;position:relative}.crop svg{position:absolute;width:2250px;height:1080px;left:15px;top:-445px}</style><section><h3>优化前 · 下摆与腋下</h3><div class="crop">${fs.readFileSync(`${out}/before.svg`,'utf8')}</div></section><section><h3>优化后 · 下摆与腋下</h3><div class="crop">${afterSvg}</div></section>`);
 await compare.screenshot({path:`${out}/contour-detail.png`});await compare.close();
 assert.deepEqual(errors,[]);assert.deepEqual(posts.filter(url=>!url.endsWith('/api/materials')),[]);mark('no-page-errors-or-image-generation-requests');
}catch(e){process.exitCode=1;steps.push({name:'failure',pass:false,error:String(e)});console.error(e);await page.screenshot({path:`${out}/failure.png`});}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({steps,errors,posts,paidGenerationExecuted:false},null,2));await browser.close();}
