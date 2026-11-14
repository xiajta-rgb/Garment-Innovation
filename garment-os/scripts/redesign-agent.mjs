import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import sharp from 'sharp';
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
if(!args.includes('--out')||(!args.includes('--task')&&!args.includes('--demo'))){console.error('用法：node scripts/redesign-agent.mjs --task task.json --out 输出目录；或 --demo --out 输出目录');process.exit(1);}
const out=path.resolve(value('--out'));if(fs.existsSync(out)){console.error('输出目录已存在，请使用新目录');process.exit(1);}
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {generateRedesignBatch,batchPackage,emptyBatchRequest}=await vite.ssrLoadModule('/src/application/redesign-batch.ts');
 let task;
 if(args.includes('--demo')){
  const {createDesignStore}=await vite.ssrLoadModule('/src/store/designStore.ts'),{compositionSource}=await vite.ssrLoadModule('/src/application/composition-catalogue.ts'),{emptyPieceComposition}=await vite.ssrLoadModule('/src/lib/pattern/piece-composition.ts'),{applyDesignAsset}=await vite.ssrLoadModule('/src/application/professional-design-assets.ts');
  const store=createDesignStore({repository:{save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}}}),source=compositionSource(store.getState().getConfiguration(),'t-shirt');
  const base=applyDesignAsset('graphic.text',applyDesignAsset('shoulder.set-in',emptyPieceComposition(crypto.randomUUID()).plans[0],source,()=>crypto.randomUUID()),source,()=>crypto.randomUUID()),request=emptyBatchRequest('男士休闲短T：V领、插肩、华夫格；保留原款Logo和主体尺寸');
  request.choices.neck=['keep','neck.v'];request.choices.shoulder=['keep','shoulder.raglan'];request.choices.fabric=['keep','fabric.waffle'];request.maxChangedAxes=3;
  task={base,source,request,demo:true};
 }else task=JSON.parse(fs.readFileSync(path.resolve(value('--task')),'utf8'));
 const source=task.source??task.base?.pieces?.find(p=>p.assetKey==='body-front')?.source;if(!source)throw Error('任务缺少基款尺寸来源');
 const result=generateRedesignBatch(task.request,task.base,source,()=>crypto.randomUUID());
 const {CompositionCanvas}=await vite.ssrLoadModule('/src/features/piece-design/CompositionCanvas.tsx'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'task.json'),JSON.stringify(task,null,2));fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(batchPackage(result),null,2));
 const plans=[{plan:result.base,id:'original'},...result.candidates.map((c,i)=>({plan:c.plan,id:`variant-${String(i+1).padStart(2,'0')}`}))],tiles={front:[],back:[],side:[]};
 for(const p of plans){
  const svg=renderToStaticMarkup(createElement(CompositionCanvas,{plan:p.plan,showGrid:false}));fs.writeFileSync(path.join(out,p.id+'-three-views.svg'),svg);
  for(const view of Object.keys(tiles)){const markup=renderToStaticMarkup(createElement(CompositionCanvas,{plan:p.plan,focusView:view,showGrid:false}));fs.writeFileSync(path.join(out,p.id+'-'+view+'.svg'),markup);const raster=await sharp(Buffer.from(markup)).resize({width:300}).flatten({background:'white'}).png().toBuffer();tiles[view].push(raster);}
 }
 for(const [view,images] of Object.entries(tiles))for(let start=0;start<images.length;start+=12){const group=images.slice(start,start+12),composites=[];for(const [i,input] of group.entries()){composites.push({input,left:(i%4)*308,top:Math.floor(i/4)*490+24});composites.push({input:Buffer.from(`<svg width="300" height="24"><text x="8" y="18" font-family="sans-serif" font-size="13">${start+i===0?'ORIGINAL':`VARIANT ${start+i}`}</text></svg>`),left:(i%4)*308,top:Math.floor(i/4)*490});}await sharp({create:{width:Math.min(4,group.length)*308,height:Math.ceil(group.length/4)*490,channels:3,background:'#f5f5f2'}}).composite(composites).png().toFile(path.join(out,`compare-${view}-${Math.floor(start/12)+1}.png`));}
 fs.writeFileSync(path.join(out,'readme.txt'),`本次${result.candidates.length}个差异候选。task.json保存基款与请求，matrix.json保留完整参数、文献来源、排除原因与配套待核验项。\n原款与候选按同视角、同缩放导出。三视图为设计表达，生产裁片及工艺仍需核验。\n文献已读16/19（145图），不含未提供的付费高清原件；完整阅读范围见平台参考资料。\n${task.demo?'本次为模板基款演示，并非用户当前已保存款。':''}`);
 console.log(JSON.stringify({out,candidates:result.candidates.length,counts:result.counts,knowledge:result.knowledge,demo:!!task.demo}));
}finally{await vite.close();}
