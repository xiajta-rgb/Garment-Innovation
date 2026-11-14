import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import sharp from 'sharp';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const input='research/redesign-study-20261113/briefs.json';
const out='public/designer-studies/short-tee-20261113';
if(fs.existsSync(out))throw Error('本轮提案目录已存在，请保留现有证据并使用新的版本目录');
const briefs=JSON.parse(fs.readFileSync(input,'utf8'));
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const uid=()=>crypto.randomUUID();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
try{
 const {createDesignStore}=await vite.ssrLoadModule('/src/store/designStore.ts');
 const {compositionSource}=await vite.ssrLoadModule('/src/application/composition-catalogue.ts');
 const {emptyPieceComposition,readPieceComposition}=await vite.ssrLoadModule('/src/lib/pattern/piece-composition.ts');
 const {applyDesignAsset,designAssetPackage}=await vite.ssrLoadModule('/src/application/professional-design-assets.ts');
 const {emptyBatchRequest,generateRedesignBatch}=await vite.ssrLoadModule('/src/application/redesign-batch.ts');
 const {readCompositionElements,DEFAULT_COMPOSITION_CRAFT,DEFAULT_COMPOSITION_DETAILS}=await vite.ssrLoadModule('/src/lib/pattern/composition-elements.ts');
 const {CompositionCanvas}=await vite.ssrLoadModule('/src/features/piece-design/CompositionCanvas.tsx');
 const repo={save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}};
 const store=createDesignStore({repository:repo});
 store.getState().setGender('male');store.getState().applyPattern('t-shirt');
 const config=store.getState().getConfiguration(),source=compositionSource(config,'t-shirt');
 let base=applyDesignAsset('shoulder.set-in',emptyPieceComposition(uid()).plans[0],source,uid);
 base.name='基款 · 圆领装袖短T';
 base.pieces=base.pieces.map(p=>({...p,color:'#bbc3bd'}));
 base.elements={...base.elements,neckColor:'#bbc3bd',craft:{...DEFAULT_COMPOSITION_CRAFT},details:{...DEFAULT_COMPOSITION_DETAILS}};
 const before=JSON.stringify(base),seen=new Set(),designs=[];
 fs.mkdirSync(out,{recursive:true});
 const svg=(plan,view)=>renderToStaticMarkup(createElement(CompositionCanvas,{plan,showGrid:false,...(view?{focusView:view}:{})})).replace('<svg ','<svg style="overflow:hidden" ');
 async function render(plan,id){
  fs.writeFileSync(path.join(out,id+'-three-views.svg'),svg(plan));
  for(const view of ['front','back','side']){
   const markup=svg(plan,view);fs.writeFileSync(path.join(out,id+'-'+view+'.svg'),markup);
   await sharp(Buffer.from(markup)).resize({width:500}).flatten({background:'white'}).png().toFile(path.join(out,id+'-'+view+'.png'));
  }
 }
 await render(base,'original');
 for(const brief of briefs.designs){
  const request=emptyBatchRequest(brief.name+'：'+brief.intent);
  for(const axis of ['neck','shoulder','fabric','pocket','finish','panel','contrast'])request.choices[axis]=[brief[axis]??'keep'];
  request.maxChangedAxes=7;request.maxCandidates=12;request.accentColor=brief.accentColor;
  const batch=generateRedesignBatch(request,base,source,uid);
  assert.equal(batch.candidates.length,1,brief.id+': '+JSON.stringify(batch.rejected));
  const candidate=batch.candidates[0],plan=candidate.plan;
  plan.name=brief.id+' · '+brief.name;
  // Palette and movable-pocket placement are explicit designer edits after the matrix operation.
  plan.pieces=plan.pieces.map(p=>({...p,color:p.assetKey.includes('pocket')?(brief.pocketColor??brief.bodyColor):brief.bodyColor}));
  plan.elements.neckColor=plan.elements.neckContrast?brief.accentColor:brief.bodyColor;
  plan.elements.cuffColor=plan.elements.cuffContrast?brief.accentColor:brief.bodyColor;
  plan.elements.sleeveColor=plan.elements.sleeveContrast?brief.accentColor:brief.bodyColor;
  plan.elements.craft={...plan.elements.craft,trimColor:brief.trimColor??brief.accentColor};
  plan.elements.details={...plan.elements.details,panelColor:brief.panelColor??brief.bodyColor};
  for(const p of plan.pieces.filter(p=>p.assetKey.includes('pocket'))){p.x=315;p.y=310;}
  plan.elements=readCompositionElements(plan.elements);
  readPieceComposition({schema:'garment-os/piece-composition-editor/v1',activePlanId:plan.id,plans:[plan]});
  assert.deepEqual(plan.pieces.filter(p=>!p.assetKey.includes('pocket')).map(p=>[p.assetKey,p.widthMm,p.heightMm,p.source]),base.pieces.map(p=>[p.assetKey,p.widthMm,p.heightMm,p.source]));
  assert.deepEqual(plan.elements.graphics,base.elements.graphics);
  const signature=crypto.createHash('sha256').update(JSON.stringify({elements:plan.elements,pieces:plan.pieces.map(({assetKey,widthMm,heightMm,x,y,color,rotation})=>({assetKey,widthMm,heightMm,x,y,color,rotation}))})).digest('hex');
  assert(!seen.has(signature),'重复设计');seen.add(signature);
  const pkg=designAssetPackage(plan),group=briefs.groups.find(g=>g.id===brief.group);
  designs.push({...brief,plan,request,groupName:group.name,sourceLessons:group.sources,package:pkg,signature,productionApproved:false,materialStatus:'肌理为视觉示意，未指派企业真实面料',reviewStatus:'设计表达已生成；净样、配缝与样衣待专业核验',designerEdits:['主体与局部调色','袋位在现有可移动范围内调整'],preserved:['同一男士短T模板尺寸来源','衣身/袖片主要宽高规格','固定正背侧锚点','未新增品牌图案']});
  await render(plan,brief.id);
 }
 assert.equal(JSON.stringify(base),before,'原款不能改变');
 assert.equal(designs.length,12);
 const manifest={...briefs,schema:'garment-os/designer-study/v1',base,source,configuration:config,designs,knowledge:{read:16,indexed:19,complete:false},productionApproved:false};
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.copyFileSync(input,path.join(out,'briefs.json'));
 const text=(label,width=360)=>Buffer.from(`<svg width="${width}" height="62"><rect width="100%" height="100%" fill="#f1f3ef"/><text x="14" y="25" font-family="Microsoft YaHei,sans-serif" font-size="16" fill="#263e33">${esc(label)}</text><text x="14" y="48" font-family="Microsoft YaHei,sans-serif" font-size="12" fill="#68786e">设计研究 / 净样与实料待核</text></svg>`);
 for(const view of ['front','back','side']){
  const tileW=360,tileH=610,composite=[];
  for(const [i,d]of designs.entries()){
   composite.push({input:await sharp(path.join(out,d.id+'-'+view+'.png')).resize({width:tileW}).png().toBuffer(),left:i%4*tileW,top:Math.floor(i/4)*tileH+62});
   composite.push({input:text(d.id+' '+d.name,tileW),left:i%4*tileW,top:Math.floor(i/4)*tileH});
  }
  await sharp({create:{width:tileW*4,height:tileH*3,channels:3,background:'#fff'}}).composite(composite).png().toFile(path.join(out,'matrix-'+view+'.png'));
 }
 for(const group of briefs.groups){
  const rows=designs.filter(d=>d.group===group.id),composite=[];
  for(const [i,d]of rows.entries()){
   const markup=svg(d.plan);composite.push({input:await sharp(Buffer.from(markup)).resize({width:1500}).png().toBuffer(),left:0,top:i*830+62});
   composite.push({input:text(d.id+' '+d.name+' · '+group.name,1500),left:0,top:i*830});
  }
  await sharp({create:{width:1500,height:2490,channels:3,background:'#fff'}}).composite(composite).png().toFile(path.join(out,'series-'+group.id+'.png'));
  const composition={schema:'garment-os/piece-composition-editor/v1',activePlanId:rows[0].plan.id,plans:[base,...rows.map(d=>d.plan)]};
  const configuration={...config,pieceComposition:readPieceComposition(composition)};
  fs.writeFileSync(path.join(out,'series-'+group.id+'-design.json'),JSON.stringify({schema:'garment-os/design/v3',id:uid(),name:group.name+' · 改款设计研究',gender:'male',createdAt:'2026-11-13T00:00:00.000Z',updatedAt:'2026-11-13T00:00:00.000Z',tags:['male','改款设计研究'],configuration,presentation:{view:'front',viewMode:'clean'}},null,2));
 }
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({source:input,uniqueDesigns:seen.size,baseUnchanged:true,dimensionsAndFixedViewsPreserved:true,designerEdits:'配色、袋色、袋位在生成后明确调整；不是矩阵7轴覆盖了所有要求',materialPhotosAssigned:0,productionApproved:false,designReview:'待实际图像核对；程序校验不代表专业审核'},null,2));
 console.log(JSON.stringify({out,designs:designs.length,groups:briefs.groups.map(g=>g.name),baseline:'公司短T轮廓参考+现有男士短T模板',productionApproved:false}));
}finally{await vite.close();}
