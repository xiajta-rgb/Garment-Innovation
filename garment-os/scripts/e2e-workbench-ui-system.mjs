import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/workbench-ui-system-20261112';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),errors=[],posts=[],steps=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
const record=name=>{steps.push({name,pass:true});console.log(name);};
async function click(text,scope=''){for(const b of await page.$$(`${scope?scope+' ':''}button`))if((await b.evaluate(e=>e.textContent)).trim()===text){await b.click();return;}throw Error('Missing '+text);}
const configuration=()=>page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);return (await import(url)).useDesignStore.getState().getConfiguration();});
async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
try{
  await page.setViewport({width:1600,height:1050});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-testid=piece-design-board]');
  assert.deepEqual(await page.$$eval('[data-workbench-section]',es=>es.map(e=>e.textContent)),['设计台','资产库','裁片库','参考资料']);
  assert.equal(await page.$$eval('.workbench-primary-nav button',es=>es.length),5); // Includes the mobile-only sidebar control.
  assert.equal(await page.$$eval('.workbench-primary-nav button',es=>es.filter(e=>e.textContent.includes('公司')).length),0);
  record('four-primary-sections-replace-the-unstructured-toolbar');

  await click('资产库','.workbench-primary-nav');await page.waitForSelector('[data-testid=asset-library]');
  await click('原稿面料','.asset-material-source');
  assert.equal(await page.$$eval('[data-asset-id]',es=>es.length),4);
  assert.equal(await page.$eval('.asset-context',e=>e.open),false);
  assert.deepEqual(await page.$$eval('.asset-tabs button',es=>es.map(e=>e.textContent)),['面料库','工艺方案','结构组合','裁片模板','配色库']);
  await page.screenshot({path:`${out}/assets-desktop.png`});
  await click('结构组合','.asset-tabs');await page.select('[aria-label="资产细分类"]','button-up-shirt');
  assert.equal(await page.$$eval('[data-asset-id]',es=>es.length),6);
  await page.click('[data-asset-id="shirt-short-baseball"] button');await page.waitForSelector('[data-testid=asset-cad-preview]');
  assert(await page.$('[data-testid=asset-cad-preview] [data-piece="simon.sleeve"]'));
  await page.screenshot({path:`${out}/asset-structure-preview.png`});
  record('asset-filters-drive-real-cards-and-source-piece-previews');

  await click('裁片模板','.asset-tabs');await page.click('[data-asset-id="t-shirt"] button');
  await page.waitForSelector('[data-testid=piece-library]');assert.equal((await configuration()).activePatternId,'t-shirt');
  await click('裁片检验 (QC)','.piece-library-tabs');
  await page.screenshot({path:`${out}/pieces-desktop.png`});await noOverflow();
  const current=await configuration();
  record('asset-template-selection-opens-current-source-in-the-main-piece-library');

  await click('参考资料','.workbench-primary-nav');await page.waitForSelector('[data-testid=company-design-board]');
  assert.deepEqual(await page.$$eval('.workbench-secondary-nav > button',es=>es.map(e=>e.textContent)),['公司设计稿','参考裁片库','品类与功能','模板审查','基础裁片核对']);
  await page.screenshot({path:`${out}/references-desktop.png`});
  for(const [label,id]of [['参考裁片库','reference-catalogue'],['品类与功能','category-workbench'],['模板审查','template-review-studio'],['基础裁片核对','tee-foundation-studio']]){
    await click(label,'.workbench-secondary-nav');await page.waitForSelector(`[data-testid="${id}"]`);assert.deepEqual(await configuration(),current);
  }
  record('company-artwork-catalogue-category-and-review-share-one-reference-section-without-changing-CAD');

  await click('设计台','.workbench-primary-nav');await page.waitForSelector('[data-testid=piece-design-board]');
  await click('创建直身T恤裁片组合');await page.waitForSelector('.piece-three-view svg',{timeout:60000});
  await page.screenshot({path:`${out}/design-desktop.png`});
  await click('定制矩阵','.workbench-secondary-nav');
  await page.waitForFunction(()=>document.querySelectorAll('[data-desk-drawing]').length===5,{timeout:60000});
  await page.screenshot({path:`${out}/matrix-desktop.png`});
  const theme=await page.evaluate(()=>({body:getComputedStyle(document.querySelector('.design-desk')).backgroundColor,root:getComputedStyle(document.querySelector('[data-testid=workbench-shell]')).backgroundColor}));assert.equal(theme.body,theme.root);
  await page.click('.theme-toggle-btn');
  assert(await page.$eval('.desk-stage',e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('.top-nav')).backgroundColor));
  await page.screenshot({path:`${out}/matrix-dark.png`});
  await click('资产库','.workbench-primary-nav');await page.waitForSelector('[data-testid=asset-library]');
  await click('原稿面料','.asset-material-source');
  assert(await page.$eval('.asset-grid article',e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('.top-nav')).backgroundColor));
  await page.screenshot({path:`${out}/assets-dark.png`});await page.click('.theme-toggle-btn');
  record('design-matrix-assets-and-piece-modules-use-the-shared-theme');
  await click('设计台','.workbench-primary-nav');await page.click('[data-testid=open-3d-mapping]');
  await page.waitForSelector('.mesh-inspector',{timeout:60000});
  assert(await page.$eval('.mesh-workbench-header',e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('.top-nav')).backgroundColor));
  assert(await page.$eval('.mesh-inspector',e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('.top-nav')).backgroundColor));
  await page.screenshot({path:out+'/three-dimensional-shared-ui.png'});
  await page.click('.theme-toggle-btn');
  assert(await page.$eval('.mesh-inspector',e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('.top-nav')).backgroundColor));
  await page.screenshot({path:out+'/three-dimensional-dark.png'});await page.click('.theme-toggle-btn');
  await click('定制矩阵','.workbench-secondary-nav');await page.waitForSelector('[data-testid=design-desk]');
  await click('资产库','.workbench-primary-nav');await page.waitForSelector('[data-testid=asset-library]');
  await click('原稿面料','.asset-material-source');
  record('three-dimensional-controls-follow-both-shared-themes');

  await page.setViewport({width:390,height:844});await noOverflow();
  assert(await page.$eval('.workbench-primary-nav',e=>e.scrollWidth<=e.clientWidth));
  await page.screenshot({path:`${out}/assets-mobile.png`});
  await click('裁片库','.workbench-primary-nav');await page.waitForSelector('[data-testid=piece-library]');await noOverflow();
  await page.waitForSelector('[data-testid=standard-preview]');
  assert(await page.$eval('[data-testid=standard-preview]',e=>e.getBoundingClientRect().width>=innerWidth-40));
  assert(await page.$eval('.pattern-generator-layout',e=>getComputedStyle(e).flexDirection==='column'));
  await page.$eval('[data-testid=standard-preview]',e=>e.scrollIntoView({block:'center'}));
  await page.screenshot({path:out+'/pieces-mobile.png'});
  await click('裁片检验 (QC)','.piece-library-tabs');
  assert(await page.$eval('.piece-qc-canvas svg',e=>e.getBoundingClientRect().width>=innerWidth-4));
  await page.$eval('.piece-qc-canvas',e=>e.scrollIntoView({block:'center'}));
  await page.screenshot({path:out+'/pieces-qc-mobile.png'});
  record('mobile-generator-and-QC-keep-full-width-CAD-previews');
  await click('参考资料','.workbench-primary-nav');await page.waitForSelector('[data-testid=company-design-board]');await noOverflow();
  await page.screenshot({path:`${out}/references-mobile.png`});
  await click('设计台','.workbench-primary-nav');await page.waitForSelector('[data-testid=design-desk]');await noOverflow();
  await click('模板与尺寸','.workbench-primary-nav');
  assert.equal(await page.$eval('[data-testid=workbench-shell]',e=>e.dataset.sidebarOpen),'true');
  await page.click('[aria-label="关闭模板与尺寸面板"]');
  record('mobile-primary-navigation-and-shared-sidebar-remain-reachable-without-page-overflow');

  const before=fs.readFileSync(`${out}/before-three-view.svg`,'utf8');
  const after=await page.evaluate(async()=>{const {newTeeBase}=await import('/src/application/tee-matrix.ts');const {defaultPieceDesign}=await import('/src/lib/pattern/piece-design-spec.ts');const {createPieceDesign}=await import('/src/application/piece-design.ts');const c=newTeeBase();c.pieceDesign=defaultPieceDesign();return createPieceDesign(c,.65).threeViewSvg;});
  fs.writeFileSync(`${out}/after-three-view.svg`,after);
  const audit=await page.evaluate(async(before,after)=>{
    const parse=s=>new DOMParser().parseFromString(s,'image/svg+xml');const a=JSON.parse(parse(before).querySelector('metadata').textContent),b=JSON.parse(parse(after).querySelector('metadata').textContent);
    async function reversals(svg){const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();const c=document.createElement('canvas');c.width=1500;c.height=760;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,1500,760).data;const sides=[[],[]];for(let y=390;y<565;y+=2){const xs=[];for(let x=60;x<450;x++){const i=(y*1500+x)*4;if(Math.abs(data[i]-54)<3&&Math.abs(data[i+1]-64)<3&&Math.abs(data[i+2]-56)<3)xs.push(x);}if(xs.length){sides[0].push(xs[0]);sides[1].push(xs.at(-1));}}return sides.reduce((sum,x)=>{const signs=x.slice(1).map((v,i)=>Math.sign(v-x[i])).filter(Boolean);return sum+signs.slice(1).filter((v,i)=>v!==signs[i]).length;},0);}
    return {sameSource:JSON.stringify(a.pieces)===JSON.stringify(b.pieces),sameConfiguration:JSON.stringify(a.configuration)===JSON.stringify(b.configuration),beforeReversals:await reversals(before),afterReversals:await reversals(after),linework:b.linework,pocketSegments:(parse(after).querySelector('[data-piece-design-view="front"] [data-source-piece="design.patch-pocket"]').getAttribute('d').match(/L/g)||[]).length};
  },before,after);
  assert(audit.sameSource);assert(audit.sameConfiguration);assert.equal(audit.pocketSegments,5);assert(audit.afterReversals<audit.beforeReversals);
  fs.writeFileSync(`${out}/linework-audit.json`,JSON.stringify(audit,null,2));
  await page.setViewport({width:1500,height:760});await page.setContent(`<style>body{margin:0}</style>${after}`);await page.screenshot({path:`${out}/after-three-view.png`});
  await page.setContent(`<style>body{margin:0;font:14px sans-serif;color:#333;background:#f5f5f5}.pair{display:flex}.pair>div{width:750px;background:white}h3{padding:16px;margin:0}svg{width:750px;height:380px}</style><div class="pair"><div><h3>优化前 · 同一测试款</h3>${before}</div><div><h3>优化后 · 裁片与尺寸保持一致</h3>${after}</div></div>`);await page.setViewport({width:1500,height:440});await page.screenshot({path:`${out}/three-view-comparison.png`});
  record('same-source-same-camera-comparison-shows-fewer-contour-reversals-and-five-straight-pocket-edges');
  assert.deepEqual(errors,[]);assert.deepEqual(posts.filter(url=>new URL(url).pathname!=='/api/materials'),[]);
}catch(e){process.exitCode=1;steps.push({pass:false,error:String(e)});console.error(e);await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({steps,errors,posts},null,2));await browser.close();}
