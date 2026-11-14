import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const out='doc/evidence/accessory-editing-20261112';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),steps=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const mark=name=>{steps.push({name,pass:true});console.log(name);};
const data=()=>page.$eval('.composition-stage metadata',e=>JSON.parse(e.textContent).plan);
const click=async(text,scope='')=>{for(const b of await page.$$(`${scope} button`))if(await b.evaluate(e=>e.textContent.trim())===text){await b.evaluate(e=>e.scrollIntoView({block:'center'}));await b.click();return;}throw Error('Missing '+text);};
const field=async(label,value)=>{const e=await page.$(`[aria-label="${label}"]`);assert(e,label);await e.click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type(String(value));await page.keyboard.press('Tab');};
const shot=async name=>{await page.$eval('.composition-accessory-toolbar',e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`${out}/${name}.png`});};
const selectPiece=async id=>{await page.$eval('.composition-layer-details',e=>e.open=true);await page.click(`[data-layer-id="${id}"] button:last-child`);};
const point=async selector=>page.$eval(selector,e=>{const b=e.getBBox(),p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(e.getScreenCTM());return{x:p.x,y:p.y};});
const pointerTransform=async(mode)=>{
 const selector=mode==='rotate'?'.composition-stage [data-accessory-handle="rotate"]':'.composition-stage [data-accessory-handle="resize"][data-corner="1/1"]';
 await page.$eval('.composition-stage',e=>e.scrollIntoView({block:'center'}));
 const start=await point(selector),centre=await page.$eval('.composition-stage [data-editor-handle]',e=>{const p=new DOMPoint(0,0).matrixTransform(e.getScreenCTM());return{x:p.x,y:p.y};});
 const x=start.x-centre.x,y=start.y-centre.y,a=Math.PI/3;
 const end=mode==='rotate'?{x:centre.x+x*Math.cos(a)-y*Math.sin(a),y:centre.y+x*Math.sin(a)+y*Math.cos(a)}:{x:centre.x+x*1.35,y:centre.y+y*1.35};
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});await page.mouse.up();
};
try{
 await page.setViewport({width:1416,height:1147});await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});await page.waitForSelector('[data-design-shoulder="raglan"]');
 await page.click('[data-design-shoulder="raglan"]');await click('Logo','.composition-element-tabs');await page.click('[data-add-graphic="monogram"]');
 let logo=(await data()).elements.graphics[0],initialLogo=logo;
 assert(await page.$('[aria-label="附件调整"]'));assert.equal(await page.$$eval('[data-accessory-handle="resize"]',es=>es.length),4);
 await page.click('[aria-label="放大所选附件"]');logo=(await data()).elements.graphics[0];assert(Math.abs(logo.width/initialLogo.width-1.1)<1e-8);
 await page.click('[aria-label="缩小所选附件"]');logo=(await data()).elements.graphics[0];assert(Math.abs(logo.width-initialLogo.width)<1e-8);
 await page.click('[aria-label="向右旋转15度"]');assert.equal((await data()).elements.graphics[0].rotation,15);
 await page.click('[aria-label="向左旋转15度"]');assert.equal((await data()).elements.graphics[0].rotation,0);mark('logo-shows-corner-and-rotation-handles-plus-working-scale-rotate-buttons');
 await pointerTransform('resize');logo=(await data()).elements.graphics[0];assert(logo.width>initialLogo.width*1.2);assert(Math.abs(logo.width/logo.height-initialLogo.width/initialLogo.height)<1e-8);
 await pointerTransform('rotate');logo=(await data()).elements.graphics[0];assert(logo.rotation>45&&logo.rotation<75);assert.equal(logo.x,initialLogo.x);assert.equal(logo.y,initialLogo.y);
 assert((await page.$eval(`[data-composition-graphic="${logo.id}"]`,e=>e.getAttribute('transform'))).includes(`rotate(${logo.rotation})`));await shot('logo-handles');mark('real-logo-pointer-resize-and-rotation-change-the-rendered-mark-without-moving-its-centre');
 await field('Logo旋转角度 °',-30);assert.equal((await data()).elements.graphics[0].rotation,-30);
 const beforeDelete=await data();await page.click('[title="撤销 (Ctrl+Z)"]');assert.notEqual((await data()).elements.graphics[0].rotation,-30);await page.click('[title="重做 (Ctrl+Shift+Z)"]');assert.deepEqual(await data(),beforeDelete);mark('numeric-logo-angle-and-transform-undo-redo-work');
 await page.click('[aria-label="Logo文字"]');await page.keyboard.press('Home');await page.keyboard.press('Delete');assert.equal((await data()).elements.graphics.length,1);
 await page.$eval('.composition-stage svg',e=>e.focus());await page.keyboard.press('Delete');assert.equal((await data()).elements.graphics.length,0);
 await page.click('[title="撤销 (Ctrl+Z)"]');assert.equal((await data()).elements.graphics.length,1);mark('delete-key-removes-selected-logo-and-undo-restores-it-while-text-editing-is-protected');
 await click('口袋','.composition-element-tabs');await click('单胸贴袋');let pocket=(await data()).pieces.find(p=>p.assetKey==='design.patch-pocket'),basePocket=pocket;
 assert(await page.$('[aria-label="附件调整"]'));await page.click('[aria-label="放大所选附件"]');assert((await data()).pieces.find(p=>p.id===pocket.id).widthMm>basePocket.widthMm);
 await pointerTransform('rotate');pocket=(await data()).pieces.find(p=>p.id===pocket.id);assert(pocket.rotation>45&&pocket.rotation<75);
 await pointerTransform('resize');pocket=(await data()).pieces.find(p=>p.id===pocket.id);assert(pocket.widthMm>basePocket.widthMm*1.2);assert.equal(pocket.x,basePocket.x);assert.equal(pocket.y,basePocket.y);await shot('pocket-handles');mark('new-pocket-auto-selects-and-supports-real-pointer-rotation-and-proportional-scaling');
 await page.$eval('.composition-stage svg',e=>e.focus());await page.keyboard.press('Delete');assert.equal((await data()).pieces.find(p=>p.id===pocket.id),undefined);await page.click('[title="撤销 (Ctrl+Z)"]');assert.deepEqual((await data()).pieces.find(p=>p.id===pocket.id),pocket);
 await selectPiece(pocket.id);await page.click('[aria-label="删除所选附件"]');assert.equal((await data()).pieces.find(p=>p.id===pocket.id),undefined);await page.click('[title="撤销 (Ctrl+Z)"]');mark('pocket-delete-key-toolbar-delete-and-undo-restore-the-exact-transform');
 const fixed=(await data()).pieces.find(p=>p.assetKey==='body-front');await selectPiece(fixed.id);const fixedPlan=await data();await page.$eval('.composition-stage svg',e=>e.focus());await page.keyboard.press('Delete');assert.deepEqual(await data(),fixedPlan);assert.equal(await page.$('[data-editor-handle]'),null);assert.equal(await page.$('[aria-label="附件调整"]'),null);mark('structural-pieces-do-not-get-accessory-handles-or-delete-key-removal');
 await click('Logo','.composition-element-tabs');await page.click('[data-add-graphic="emblem"]');logo=(await data()).elements.graphics.at(-1);await page.select('[aria-label="Logo所在视图"]','back');await field('Logo旋转角度 °',45);await pointerTransform('resize');logo=(await data()).elements.graphics.at(-1);assert.equal(logo.view,'back');assert.equal(logo.rotation,45);
 // Back-view coordinates must not include the 500-unit column offset during a drag.
 const logoSelector=`[data-composition-graphic="${logo.id}"]`;await page.$eval(logoSelector,e=>e.scrollIntoView({block:'center'}));let centre=await point(logoSelector);await page.mouse.move(centre.x,centre.y);await page.mouse.down();await page.mouse.move(centre.x+12,centre.y+8,{steps:8});await page.mouse.up();const moved=(await data()).elements.graphics.at(-1);assert(moved.x>logo.x&&moved.x<logo.x+50);assert(moved.y>logo.y);mark('back-view-logo-drag-and-resize-use-the-correct-view-coordinates');
 await page.select('[aria-label="Logo所在视图"]','side');await pointerTransform('rotate');assert.equal((await data()).elements.graphics.at(-1).view,'side');assert((await data()).elements.graphics.at(-1).rotation>90);mark('side-view-logo-rotation-works-at-the-fixed-third-view');
 const original=await data();await click('复制改款');const copied=await data();assert.equal(copied.elements.graphics.at(-1).rotation,original.elements.graphics.at(-1).rotation);assert.equal(copied.pieces.find(p=>p.assetKey==='design.patch-pocket').rotation,pocket.rotation);
 await click('并排比对');await page.keyboard.press('Delete');assert.equal(await page.$$eval('.composition-comparison metadata',es=>es.length),2);assert.equal(await page.$('.composition-comparison [data-editor-handle]'),null);await click('返回编辑');mark('comparison-preserves-rotations-without-edit-handles-or-delete-key-edits');
 await selectPiece(copied.pieces.find(p=>p.assetKey==='design.patch-pocket').id);
 const downloadPath=path.resolve(`${out}/downloads`);fs.mkdirSync(downloadPath,{recursive:true});const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath});
 for(const ext of ['svg','png']){const file=path.join(downloadPath,`方案 02-三视图.${ext}`);if(fs.existsSync(file))fs.unlinkSync(file);await click(ext==='svg'?'下载组合三视图':'下载参考 PNG');for(let i=0;i<100&&!fs.existsSync(file);i++)await new Promise(r=>setTimeout(r,100));assert(fs.statSync(file).size>1000);}
 const svg=fs.readFileSync(path.join(downloadPath,'方案 02-三视图.svg'),'utf8');assert(svg.includes(`rotate(${pocket.rotation})`));assert(svg.includes(`rotate(${copied.elements.graphics.at(-1).rotation})`));assert(!svg.includes('data-editor-handle'));assert(!svg.includes('data-accessory-handle'));mark('svg-and-png-downloads-preserve-rotations-and-exclude-edit-controls');
 const saved=await data(),name=`附件编辑验收-${Date.now()}`;await page.evaluate(async name=>{const url=performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);const {useDesignStore}=await import(url);useDesignStore.getState().setDesignName(name);},name);
 await click('Save','.top-nav');await page.waitForFunction(()=>!document.querySelector('.top-nav [aria-busy="true"]'));await page.click('[title="New Design"]');await page.waitForFunction(()=>!document.querySelector('.composition-stage [data-composition-piece]'));await click('List');await page.waitForFunction(name=>[...document.querySelectorAll('button')].some(e=>e.textContent.includes(name)),{},name);for(const b of await page.$$('button'))if(await b.evaluate((e,name)=>e.textContent.includes(name),name)){await b.click();break;}
 await page.waitForFunction(()=>document.querySelectorAll('.composition-stage [data-composition-piece]').length===12);assert.deepEqual(await data(),saved);mark('save-new-list-reopen-retains-all-logo-and-pocket-transforms');
 await selectPiece(saved.pieces.find(p=>p.assetKey==='design.patch-pocket').id);await page.setViewport({width:390,height:844});await shot('mobile-controls');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewport({width:1416,height:1147});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);mark('desktop-mobile-controls-fit-and-page-has-no-runtime-errors');
 fs.writeFileSync(`${out}/saved-plan.json`,JSON.stringify(saved,null,2));
}catch(error){process.exitCode=1;steps.push({name:'failure',pass:false,error:String(error)});console.error(error);await page.screenshot({path:`${out}/failure.png`});}
finally{fs.writeFileSync(`${out}/browser.json`,JSON.stringify({steps,errors},null,2));await browser.close();}
