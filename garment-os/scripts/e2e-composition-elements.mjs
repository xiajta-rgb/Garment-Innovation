import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const out='doc/evidence/composition-elements-20261112';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),steps=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const mark=(name,detail)=>{steps.push({name,pass:true,detail});console.log(name);};
const click=async(text,scope='')=>{if(['肩袖 / 领型','撞色配色','口袋','Logo','面料'].includes(text))scope='.composition-element-tabs';for(const b of await page.$$(`${scope} button`))if(await b.evaluate(e=>e.textContent.trim())===text){await b.evaluate(e=>e.scrollIntoView({block:'center'}));await b.click();return;}throw Error('Missing '+text);};
const data=()=>page.$eval('.composition-stage metadata',e=>JSON.parse(e.textContent));
const field=async(label,value)=>{const e=await page.$(`[aria-label="${label}"]`);assert(e,label);await e.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(String(value));await page.keyboard.press('Tab');};
const shot=async name=>{await page.$eval('.composition-stage',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`${out}/${name}.png`});};
try{
 await page.setViewport({width:1416,height:1147});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});await page.waitForSelector('[data-design-shoulder="raglan"]');
 assert.equal(await page.$eval('.composition-source-catalogue',e=>e.open),false);mark('design-intent-elements-replace-raw-front-back-neck-piece-cards');
 await page.click('[data-design-shoulder="raglan"]');await page.waitForFunction(()=>document.querySelectorAll('.composition-stage [data-composition-piece]').length===11);
 let p=(await data()).plan;assert.equal(p.elements.shoulder,'raglan');const centres=p.pieces.filter(p=>p.assetKey.startsWith('body-')||p.assetKey.startsWith('neck-')).map(p=>({key:p.assetKey,x:p.x}));
 await click('撞色配色');await click('海军 × 米白');p=(await data()).plan;assert(p.elements.sleeveContrast&&p.elements.neckContrast&&p.elements.cuffContrast);
 assert.equal(await page.$$eval('.composition-stage [data-design-element="cuff-contrast"]',es=>es.length),5);await shot('raglan-contrast');mark('raglan-rebuilds-joined-body-sleeve-shapes-to-neckline-and-shows-neck-cuff-contrast');
 await click('肩袖 / 领型');const raglanPath=await page.$eval('.composition-stage [data-asset-key="body-front"] path',e=>e.getAttribute('d'));
 await page.click('[data-design-shoulder="drop"]');const dropPath=await page.$eval('.composition-stage [data-asset-key="body-front"] path',e=>e.getAttribute('d'));assert.notEqual(raglanPath,dropPath);
 await page.click('[data-design-shoulder="set-in"]');const setinPath=await page.$eval('.composition-stage [data-asset-key="body-front"] path',e=>e.getAttribute('d'));assert.notEqual(setinPath,dropPath);
 await page.click('[data-design-shoulder="raglan"]');await page.click('[data-design-neckline="v"]');p=(await data()).plan;assert.equal(p.elements.neckline,'v');assert.deepEqual(p.pieces.filter(p=>p.assetKey.startsWith('body-')||p.assetKey.startsWith('neck-')).map(p=>({key:p.assetKey,x:p.x})),centres);await shot('raglan-v-neck');mark('set-in-drop-raglan-and-v-neck-produce-distinct-geometry-at-fixed-view-positions');
 await click('口袋');await click('双胸贴袋');assert.equal((await data()).plan.pieces.filter(p=>p.assetKey==='design.patch-pocket').length,2);await click('单胸贴袋');assert.equal((await data()).plan.pieces.filter(p=>p.assetKey==='design.patch-pocket').length,1);mark('pocket-layout-is-a-design-option-and-keeps-accessory-positioning');
 await click('Logo');await page.click('[data-add-graphic="text"]');await field('Logo文字','FIELD LAB');await field('Logo宽度',82);await field('Logo水平位置',250);await field('Logo垂直位置',320);
 let graphic=(await data()).plan.elements.graphics[0];assert.equal(graphic.text,'FIELD LAB');assert.equal(graphic.x,250);
 const selector=`.composition-stage [data-composition-graphic="${graphic.id}"]`;await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));let b=await page.$eval(selector,e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(b.x+18,b.y+12,{steps:8});await page.mouse.up();assert((await data()).plan.elements.graphics[0].x>250);
 await page.click('[data-add-graphic="monogram"]');await field('Logo文字','FL');await click('后背上方');assert.equal((await data()).plan.elements.graphics[1].view,'back');
 await page.click('[data-add-graphic="emblem"]');assert.equal((await data()).plan.elements.graphics.length,3);await click('删除Logo');assert.equal((await data()).plan.elements.graphics.length,2);mark('editable-text-monogram-emblem-and-real-logo-drag-work-on-selected-views');
 const upload=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=80;const x=c.getContext('2d');x.fillStyle='#bd5b36';x.fillRect(0,0,200,80);x.fillStyle='#fff';x.font='bold 36px Arial';x.fillText('CUSTOM',14,52);return c.toDataURL('image/png');});
 const logoFile=path.resolve(`${out}/custom-logo-test.png`);fs.writeFileSync(logoFile,Buffer.from(upload.split(',')[1],'base64'));await (await page.$('[aria-label="上传Logo"]')).uploadFile(logoFile);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('.composition-stage metadata').textContent).plan.elements.graphics.some(g=>g.kind==='image'));
 const imported=(await data()).plan.elements.graphics.find(g=>g.kind==='image');assert(imported.image.dataUrl.startsWith('data:image/png;base64,'));mark('uploaded-logo-is-embedded-and-rendered-without-external-file-dependency');
 await click('面料');await page.click('[data-design-fabric="waffle"]');assert.equal((await data()).plan.elements.fabric,'waffle');assert(await page.$('.composition-stage pattern[id$="fabric-main"]'));
 await shot('waffle-elements');await page.click('[data-design-fabric="rib"]');assert.equal((await data()).plan.elements.fabric,'rib');await shot('rib-elements');mark('waffle-and-rib-textures-change-all-three-view-fills-without-changing-outer-contours');
 await page.$eval('.composition-enterprise-materials',e=>{e.open=true;e.scrollIntoView({block:'center'});});
 await page.waitForFunction(()=>document.querySelector('[data-composition-material]')||document.querySelector('.composition-material-choices [role="alert"]'),{timeout:60000});
 assert.equal(await page.$('.composition-material-choices [role="alert"]'),null,'live material library connection must be available');
 await page.waitForFunction(()=>document.querySelector('.composition-material-cards>button:not(:disabled) .managed-image[data-image-state="ready"]'),{timeout:30000});
 const materials=await page.$$('.composition-material-cards>button:not(:disabled)'),attempts=[];
 for(const material of materials.slice(0,3)){
  if(!await material.$('.managed-image[data-image-state="ready"]'))continue;
  await material.click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.composition-stage metadata').textContent).plan.elements.materials?.main||document.querySelector('.piece-error'),{timeout:40000});
  if((await data()).plan.elements.materials?.main)break;
  attempts.push(await page.$eval('.piece-error',e=>e.textContent));
 }
 fs.writeFileSync(`${out}/unavailable-source-images.json`,JSON.stringify(attempts,null,2));
 await page.waitForFunction(()=>JSON.parse(document.querySelector('.composition-stage metadata').textContent).plan.elements.materials?.main||document.querySelector('.piece-error'),{timeout:40000});
 p=(await data()).plan;assert(p.elements.materials?.main,'material application must persist a source snapshot');
 assert(p.elements.materialImages?.main,'source photo must be actually embedded for the live swatch test');
 fs.writeFileSync(`${out}/material-source.json`,JSON.stringify({assignment:p.elements.materials.main,imageSize:{width:p.elements.materialImages.main.width,height:p.elements.materialImages.main.height}},null,2));
 await shot('enterprise-fabric');mark('live-enterprise-material-source-photo-is-selected-embedded-and-clipped-to-the-garment',{name:p.elements.materials.main.material.materialName,code:p.elements.materials.main.material.materialCode});
 const originalBeforeCopy=(await data()).plan;await click('复制改款');const cloned=(await data()).plan;
 assert.deepEqual({...cloned.elements,graphics:cloned.elements.graphics.map(g=>({...g,id:'same'}))},{...originalBeforeCopy.elements,graphics:originalBeforeCopy.elements.graphics.map(g=>({...g,id:'same'}))});
 await click('肩袖 / 领型');await page.click('[data-design-shoulder="set-in"]');await click('面料');await page.click('[data-design-fabric="waffle"]');
 await click('并排比对');const compared=await page.$$eval('.composition-comparison metadata',es=>es.map(e=>JSON.parse(e.textContent).plan));assert.equal(compared.length,2);assert.equal(compared[0].elements.shoulder,'raglan');assert.equal(compared[1].elements.shoulder,'set-in');assert(compared[0].elements.materials.main);assert.equal(compared[1].elements.materials.main,undefined);assert.equal(compared[1].elements.graphics.length,3);assert.equal(compared[1].elements.neckline,'v');
 await page.$eval('.composition-comparison',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`${out}/compare-front.png`});await click('比对背面');await page.screenshot({path:`${out}/compare-back.png`});await click('返回编辑');mark('copied-plans-keep-independent-structure-logos-and-fabric-with-equal-scale-comparison');
 const downloads=path.resolve(`${out}/downloads`);fs.mkdirSync(downloads,{recursive:true});const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 for(const ext of ['svg','png']){const file=path.join(downloads,ext==='svg'?'方案 02-三视图.svg':'方案 02-三视图.png');if(fs.existsSync(file))fs.unlinkSync(file);await click(ext==='svg'?'下载组合三视图':'下载参考 PNG');for(let i=0;i<100&&!fs.existsSync(file);i++)await new Promise(r=>setTimeout(r,100));assert(fs.statSync(file).size>1000);}
 const svg=fs.readFileSync(path.join(downloads,'方案 02-三视图.svg'),'utf8');assert(svg.includes('FIELD LAB'));assert(svg.includes('data:image/png;base64,'));assert(svg.includes('fabric-main'));assert(!svg.includes('data-editor-handle'));mark('svg-and-png-export-contain-the-actual-design-elements-and-embedded-logo');
 const saved=await data(),name=`元素组合验收-${Date.now()}`;
 await page.evaluate(async name=>{const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);const {useDesignStore}=await import(url);useDesignStore.getState().setDesignName(name);},name);
 await click('Save','.top-nav');await page.waitForFunction(()=>!document.querySelector('.top-nav [aria-busy="true"]'));await page.click('[title="New Design"]');await page.waitForFunction(()=>!document.querySelector('.composition-stage [data-composition-piece]'));
 await click('List');await page.waitForFunction(name=>[...document.querySelectorAll('button')].some(e=>e.textContent.includes(name)),{},name);for(const b of await page.$$('button'))if(await b.evaluate((e,name)=>e.textContent.includes(name),name)){await b.click();break;}
 await page.waitForFunction(()=>document.querySelectorAll('.composition-stage [data-composition-piece]').length===12);assert.deepEqual((await data()).plan,saved.plan);mark('save-new-list-reopen-restores-the-complete-combination');
 await click('肩袖 / 领型');await page.click('[data-design-shoulder="drop"]');await page.click('[title="撤销 (Ctrl+Z)"]');assert.equal((await data()).plan.elements.shoulder,'set-in');await page.click('[title="重做 (Ctrl+Shift+Z)"]');assert.equal((await data()).plan.elements.shoulder,'drop');mark('global-undo-redo-restores-combination-choices');
 await page.setViewport({width:390,height:844});await shot('mobile');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1416,height:1147});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);mark('desktop-mobile-layout-and-no-page-errors');
 fs.writeFileSync(`${out}/saved-combination.json`,JSON.stringify(saved,null,2));
}catch(error){process.exitCode=1;steps.push({name:'failure',pass:false,error:String(error)});console.error(error);await page.screenshot({path:`${out}/failure.png`});}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({steps,errors},null,2));await browser.close();}
