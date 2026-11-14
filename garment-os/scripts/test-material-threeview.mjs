import fs from 'node:fs';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out='doc/evidence/material-senling-20261112';
const source=JSON.parse(fs.readFileSync(out+'/source-records.json','utf8'));
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage();await page.goto('http://localhost:5341/',{waitUntil:'networkidle0'});
  const result=await page.evaluate(async source=>{
    const {newTeeBase}=await import('/src/application/tee-matrix.ts');
    const {defaultPieceDesign}=await import('/src/lib/pattern/piece-design-spec.ts');
    const {createPieceDesign}=await import('/src/application/piece-design.ts');
    const {pieceMaterialPreview}=await import('/src/application/piece-material-preview.ts');
    const {styleReferencePng}=await import('/src/features/company-design/style-image-reference.ts');
    const c=newTeeBase();c.pieceDesign=defaultPieceDesign('#eeeeee');c.pieceDesign.pocket.kind='none';c.pieceDesign.colors={front:'#eeeeee',back:'#eeeeee',sleeve:'#eeeeee',pocket:'#eeeeee',neckband:'#354038'};
    const design=createPieceDesign(c),variants=[];
    for(const material of source.records){
      const suffix=material.materialPic.toLowerCase().endsWith('.png')?'png':'jpg';
      const img=new Image();img.src=`/doc/evidence/material-senling-20261112/${material.materialCode}-original.${suffix}`;await img.decode();
      const crop=Math.min(1024,img.naturalWidth,img.naturalHeight),canvas=document.createElement('canvas');canvas.width=crop;canvas.height=crop;
      canvas.getContext('2d').drawImage(img,(img.naturalWidth-crop)/2,(img.naturalHeight-crop)/2,crop,crop,0,0,crop,crop);
      const sample=canvas.toDataURL('image/png');
      const assignment={source:'basedata.material.list',version:'1',endpoint:source.endpoint,fetchedAt:source.fetchedAt,material};
      const applied=pieceMaterialPreview(design,assignment,{dataUrl:sample,width:crop,height:crop});
      const parse=svg=>new DOMParser().parseFromString(svg,'image/svg+xml');
      const before=parse(design.threeViewSvg),after=parse(applied.svg);
      const paths=doc=>[...doc.querySelectorAll('path')].map(p=>p.getAttribute('d'));
      if(JSON.stringify(paths(before))!==JSON.stringify(paths(after)))throw Error('Geometry changed');
      const beforeMeta=JSON.parse(before.querySelector('metadata').textContent),afterMeta=JSON.parse(after.querySelector('metadata').textContent);
      const checks={samePaths:true,threeViews:after.querySelectorAll('[data-piece-design-view]').length,paintedRegions:after.querySelectorAll('[data-source-piece][fill="url(#piece-material-photo)"]').length,sameSourceCAD:JSON.stringify(beforeMeta.pieces)===JSON.stringify(afterMeta.pieces),sameConfiguration:JSON.stringify(beforeMeta.configuration)===JSON.stringify(afterMeta.configuration),sourceWidth:img.naturalWidth,sourceHeight:img.naturalHeight,cropCenterPx:crop,physicalScaleKnown:false};
      variants.push({code:material.materialCode,svg:applied.svg,png:await styleReferencePng(applied.svg),sample,checks,metadata:applied.metadata});
    }
    return {baseline:{svg:design.threeViewSvg,png:await styleReferencePng(design.threeViewSvg)},variants,configuration:c};
  },source);
  function png(name,data){fs.writeFileSync(`${out}/${name}.png`,Buffer.from(data.split(',')[1],'base64'));}
  png('baseline-threeview',result.baseline.png);fs.writeFileSync(out+'/baseline-threeview.svg',result.baseline.svg);
  for(const v of result.variants){assert.equal(v.checks.threeViews,3);assert(v.checks.paintedRegions>3);png(v.code+'-threeview',v.png);png(v.code+'-sample',v.sample);fs.writeFileSync(`${out}/${v.code}-threeview.svg`,v.svg);}
  const html=`<!doctype html><meta charset="utf-8"><title>三视图套料实测</title><style>body{margin:0;padding:24px;background:#f4f4f4;font:15px 'Microsoft YaHei',sans-serif;color:#29332f}h1{font-size:23px;margin:0 0 10px}p{color:#6d756f;font-size:13px;margin:0 0 22px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{background:white;border:1px solid #ddd;border-radius:8px;overflow:hidden}header{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid #eee}header img{width:64px;height:64px;object-fit:cover;border-radius:4px}h2{font-size:17px;margin:0}small{display:block;margin-top:6px;color:#80857f}article>img{width:100%;display:block}</style><h1>同款三视图 · 真实面料套用测试</h1><p>同一套T恤裁片、同一视角与比例。衣身与袖片使用真实面料照片，领条保留独立配色；纹理比例为视觉参考。</p><div class="grid"><article><header><div><h2>原始三视图</h2><small>男士圆领短T · 常规装袖 · 无口袋</small></div></header><img src="baseline-threeview.png"></article>${source.records.map(m=>`<article><header><img src="${m.materialCode}-sample.png"><div><h2>${m.materialCode} · ${m.materialName}</h2><small>${m.ingredients} · 来源原图 · 中心裁样</small></div></header><img src="${m.materialCode}-threeview.png"></article>`).join('')}</div>`;
  fs.writeFileSync(out+'/comparison.html',html);
  fs.writeFileSync(out+'/threeview-verification.json',JSON.stringify({configuration:result.configuration,variants:result.variants.map(({code,checks,metadata})=>({code,checks,metadata})),generationPerformed:false},null,2));
  await page.setViewport({width:1800,height:1250});await page.goto('http://localhost:5341/'+out+'/comparison.html',{waitUntil:'networkidle0'});await page.screenshot({path:out+'/comparison.png',fullPage:true});
  console.log(JSON.stringify(result.variants.map(({code,checks})=>({code,...checks})),null,2));
}finally{await browser.close();}
