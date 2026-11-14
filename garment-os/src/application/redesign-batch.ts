import { REDESIGN_AXES, REDESIGN_BATCH_OPTIONS, batchOption } from '@/data/redesignBatchAxes';
import corpus from '@/data/redesignCorpus.snapshot.json';
import dictionary from '@/data/designTagDictionary.snapshot.json';
import { REDESIGN_METHODS, REDESIGN_SOURCE } from '@/data/redesignMethods';
import { DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_DETAILS, DEFAULT_COMPOSITION_ELEMENTS } from '@/lib/pattern/composition-elements';
import { readPieceComposition } from '@/lib/pattern/piece-composition';
import { normalizeComposition } from './composition-catalogue';
import { applyDesignAsset, designAsset, designAssetPackage } from './professional-design-assets';
import { planSignature } from './redesign-workflow';
import type { CompositionPlan, CompositionSource, PieceComposition } from '@/types/piece-composition';
import type { RedesignAxis, RedesignBatchRequest, RedesignBatchResult } from '@/types/redesign-batch';

export function emptyBatchRequest(brief=''):RedesignBatchRequest {
 return {schema:'garment-os/redesign-batch-request/v1',brief,choices:Object.fromEntries(REDESIGN_AXES.map(a=>[a,['keep']])) as RedesignBatchRequest['choices'],locks:[],maxChangedAxes:2,maxCandidates:24,accentColor:'#9b654e',pendingRequirements:[],allowPartial:false};
}
/** Deliberately a catalogue keyword helper, not a general natural-language model. */
export function suggestBatchRequest(brief:string):RedesignBatchRequest {
 const r=emptyBatchRequest(brief.slice(0,2000));
 for(const axis of REDESIGN_AXES){
  const found=REDESIGN_BATCH_OPTIONS[axis].filter(o=>o.id!=='keep'&&[o.name,...o.aliases??[]].some(word=>brief.toLowerCase().includes(word.toLowerCase())));
  if(found.length)r.choices[axis]=['keep',...found.map(o=>o.id)];
 }
 // Compound contrast expresses one assembly; do not silently split it into three alternatives.
 if(r.choices.contrast.includes('contrast.neck-cuff'))r.choices.contrast=['keep','contrast.neck-cuff'];
 const unsupported=brief.match(/荷叶边|泡泡袖|羊腿袖|灯笼袖|不对称|镂空|压褶|百褶|可拆卸|真丝|羊毛|透视|连衣裙|半裙|大落肩|超大廓形|oversize|刺绣|贴布绣|印花/gi)??[];
 r.pendingRequirements=[...new Set(unsupported)].map(s=>`${s}：需Agent确认对应模板、图稿或真实面料，关键词入口未执行`);
 if(/不[要做用加]|不要|禁止|保留|锁定|只[改换动]|不能/.test(brief))r.pendingRequirements.push('想法含保留或排除条件，请用Agent整理锁定项，或手动核对下方维度');
 if(REDESIGN_AXES.every(a=>r.choices[a].length===1))r.pendingRequirements.push('未识别可执行素材，请使用下方选项或载入Agent请求');
 // An unmodelled instruction remains visible verbatim rather than being claimed as understood.
 r.pendingRequirements.push('关键词建议尚未完成语义核对；原始想法已保留，请核对选项后再生成');
 return r;
}
export function readBatchRequest(value:unknown):RedesignBatchRequest {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('批量请求格式无效');
 const v=value as RedesignBatchRequest;
 if(v.schema!=='garment-os/redesign-batch-request/v1'||typeof v.brief!=='string'||!v.brief.trim()||v.brief.length>2000)throw Error('请填写2000字以内的改款想法');
 if(!v.choices||typeof v.choices!=='object'||Object.keys(v.choices).length!==7)throw Error('请提供完整的7个设计维度');
 for(const a of REDESIGN_AXES)if(!Array.isArray(v.choices[a])||!v.choices[a].length||v.choices[a].length>10||v.choices[a].some(id=>!batchOption(a,id))||new Set(v.choices[a]).size!==v.choices[a].length)throw Error(`设计维度选项无效：${a}`);
 if(!Array.isArray(v.locks)||v.locks.some(a=>!REDESIGN_AXES.includes(a))||new Set(v.locks).size!==v.locks.length)throw Error('锁定项无效');
 for(const a of v.locks)if(v.choices[a].length!==1||v.choices[a][0]!=='keep')throw Error('锁定维度只能选择保留当前');
 if(!Number.isInteger(v.maxChangedAxes)||v.maxChangedAxes<1||v.maxChangedAxes>7||!Number.isInteger(v.maxCandidates)||v.maxCandidates<1||v.maxCandidates>48)throw Error('请设置1至7个变化维度、1至48个候选');
 if(!/^#[0-9a-f]{6}$/i.test(v.accentColor)||typeof v.allowPartial!=='boolean'||!Array.isArray(v.pendingRequirements)||v.pendingRequirements.length>30||v.pendingRequirements.some(s=>typeof s!=='string'||!s.trim()||s.length>200))throw Error('撞色或待补要求格式无效');
 if(v.pendingRequirements.length&&!v.allowPartial)throw Error('请先处理待补要求，或明确仅生成可执行部分');
 const combinations=REDESIGN_AXES.reduce((n,a)=>n*v.choices[a].length,1);if(combinations>10000)throw Error('组合超过10000，请减少选项或锁定维度');
 return structuredClone(v);
}
function axisContent(p:CompositionPlan,a:RedesignAxis):unknown {
 const e=p.elements??DEFAULT_COMPOSITION_ELEMENTS,c={...DEFAULT_COMPOSITION_CRAFT,...e.craft},d={...DEFAULT_COMPOSITION_DETAILS,...e.details};
 switch(a){
  case 'neck':return [e.neckline,c.opening,c.openingLengthMm,c.placketWidthMm,c.collarHeightMm,d.hood,d.hoodHeightMm,d.drawcord];
  case 'shoulder':return e.shoulder;
  case 'fabric':return [e.fabric,e.materials?.main,e.materialImages?.main];
  case 'pocket':return p.pieces.filter(p=>p.assetKey.includes('pocket')).map(p=>{const copy={...p};Reflect.deleteProperty(copy,'id');return copy;});
  case 'finish':return [c.neckFinish,c.bindingWidthMm,c.backNeckTape,c.seamFinish,c.trimColor,d.cuffFinish,d.cuffHeightMm,d.hemFinish,d.hemHeightMm,d.slitHeightMm];
  case 'panel':return [d.panel,d.panelColor,d.panelDepthMm];
  case 'contrast':return [e.neckContrast,e.sleeveContrast,e.cuffContrast,e.neckContrast?e.neckColor:null,e.sleeveContrast?e.sleeveColor:null,e.cuffContrast?e.cuffColor:null];
 }
}
const contentKey=(p:CompositionPlan)=>JSON.stringify([REDESIGN_AXES.map(a=>axisContent(p,a)),p.elements?.graphics,p.pieces.filter(p=>!p.assetKey.includes('pocket')).map(p=>({...p,id:undefined}))]);
function applyOption(p:CompositionPlan,a:RedesignAxis,id:string,accent:string,source:CompositionSource,uid:()=>string):CompositionPlan {
 if(id==='keep')return p;
 const o=batchOption(a,id)!;
 if(a==='pocket')p={...p,pieces:p.pieces.filter(p=>!p.assetKey.includes('pocket'))};
 if(a==='panel'&&id==='none'){p.elements!.details!.panel='none';return p;}
 if(a==='contrast'){
  const e=p.elements!;if(e.materialImages?.neck||e.materialImages?.cuff||e.materialImages?.main)throw Error('照片面料会覆盖配色，请先明确换料，再做撞色矩阵');
  e.neckContrast=['contrast.neck','contrast.neck-cuff'].includes(id);e.sleeveContrast=id==='contrast.sleeve';e.cuffContrast=['contrast.cuff','contrast.neck-cuff'].includes(id);
  if(id!=='contrast.none'){const body=p.pieces.find(p=>p.assetKey==='body-front')?.color;if(body?.toLowerCase()===accent.toLowerCase())throw Error('撞色与主体同色，无法形成可见差异');if(e.neckContrast)e.neckColor=accent;if(e.sleeveContrast)e.sleeveColor=accent;if(e.cuffContrast)e.cuffColor=accent;}
  return p;
 }
 if(o.assetId){
  if(id==='finish.binding'&&(p.elements!.neckline!=='crew'||p.elements!.craft!.opening!=='none'||p.elements!.details!.hood!=='none'))throw Error('当前领口包边素材仅接通封闭圆领，不能覆盖已选领型/开合/帽体');
  return applyDesignAsset(o.assetId,p,source,uid);
 }
 return p;
}
export function generateRedesignBatch(input:unknown,base:CompositionPlan,source:CompositionSource,uid:()=>string):RedesignBatchResult {
 const request=readBatchRequest(input);
 if(!base.pieces.length||base.pieces.some(p=>p.source.templateId!=='t-shirt'))throw Error('批量三视图当前接通男士短T，请先选择短T基款');
 const id=uid(),signature=planSignature(base),counts={combinations:0,unchanged:0,overBudget:0,conflicting:0,duplicates:0,eligible:0,truncated:0};
 const result:RedesignBatchResult={schema:'garment-os/redesign-batch/v1',id,request,base:structuredClone(base),baseSignature:signature,candidates:[],rejected:[],counts,knowledge:{read:corpus.read,indexed:corpus.indexed,complete:corpus.complete},productionApproved:false};
 const keys=new Set<string>(),eligible:RedesignBatchResult['candidates']=[];
 function enumerate(index:number,options:Record<RedesignAxis,string>){
  if(index<REDESIGN_AXES.length){const a=REDESIGN_AXES[index];for(const choice of request.choices[a])enumerate(index+1,{...options,[a]:choice});return;}
  counts.combinations++;
  try{
   let p=structuredClone(base);p.elements={...structuredClone(DEFAULT_COMPOSITION_ELEMENTS),...p.elements,craft:{...DEFAULT_COMPOSITION_CRAFT,...p.elements?.craft},details:{...DEFAULT_COMPOSITION_DETAILS,...p.elements?.details}};delete p.redesign;delete p.matrix;delete p.elements.tagIntent;
   const hostSource=base.pieces.find(p=>p.assetKey==='body-front')?.source??source;
   // A requested pocket replacement is removed before neckline compatibility checks.
   if(options.pocket!=='keep')p.pieces=p.pieces.filter(p=>!p.assetKey.includes('pocket'));
   for(const axis of REDESIGN_AXES)p=applyOption(p,axis,options[axis],request.accentColor,hostSource,uid);
   if(p.elements!.craft!.opening==='full-zip'&&p.pieces.some(p=>p.assetKey==='design.kangaroo-pocket'))throw Error('整片袋鼠袋不能跨越全开襟');
   const changedAxes=REDESIGN_AXES.filter(a=>JSON.stringify(axisContent(p,a))!==JSON.stringify(axisContent(base,a)));
   if(request.locks.some(a=>changedAxes.includes(a)))throw Error('联动结构会改动锁定维度，请重新选择');
   if(!changedAxes.length){counts.unchanged++;return;}
   if(changedAxes.length>request.maxChangedAxes){counts.overBudget++;return;}
   const key=contentKey(p);if(keys.has(key)){counts.duplicates++;return;}keys.add(key);
   const assets=REDESIGN_AXES.map(a=>batchOption(a,options[a])?.assetId).filter((a):a is string=>!!a);
   const needs=[...new Set([...assets.flatMap(id=>designAsset(id).needs),'结构净样、配缝、面料测试与工艺打样待核验',...request.pendingRequirements])];
   p.id=uid();p.name=changedAxes.map(a=>options[a]==='keep'?`联动${a==='finish'?'边口工艺':a}`:batchOption(a,options[a])?.name??a).join(' · ').slice(0,100);p.matrix={schema:'garment-os/redesign-matrix-origin/v1',batchId:id,basePlanId:base.id,baseSignature:signature,brief:request.brief,options:{...options},changedAxes,sourceFileId:REDESIGN_SOURCE.fileId,sourceBlockIds:REDESIGN_METHODS.filter(m=>['replacement','style-combination','silhouette-lock'].includes(m.id)).map(m=>m.sourceBlockId),pendingRequirements:request.pendingRequirements};
   // Remap entity IDs only after content comparison; generated IDs cannot manufacture differences.
   p.pieces=p.pieces.map(p=>({...p,id:uid()}));p.elements!.graphics=p.elements!.graphics.map(g=>({...g,id:uid()}));
   p=normalizeComposition(readPieceComposition({schema:'garment-os/piece-composition-editor/v1',activePlanId:p.id,plans:[p]})).plans[0];
   const tags=designAssetPackage(p).assets.flatMap(a=>a.tags.map(t=>t.code));
   if(p.elements?.neckContrast||p.elements?.sleeveContrast||p.elements?.cuffContrast){const tag=dictionary.tags.find(t=>t.name==='撞色');if(tag)tags.push(tag.code);}
   eligible.push({id:p.id,plan:p,options:{...options},changedAxes,tagCodes:[...new Set(tags)],needs});
  }catch(e){counts.conflicting++;result.rejected.push({options:{...options},reason:e instanceof Error?e.message:String(e)});}
 }
 enumerate(0,{} as Record<RedesignAxis,string>);
 // Round-robin by changed dimension so the first page is not filled by one minor variation.
 const groups=new Map<string,typeof eligible>();for(const candidate of eligible){const k=candidate.changedAxes.join('/');groups.set(k,[...groups.get(k)??[],candidate]);}
 const ordered:typeof eligible=[];while([...groups.values()].some(g=>g.length))for(const g of groups.values()){const c=g.shift();if(c)ordered.push(c);}
 counts.eligible=ordered.length;counts.truncated=Math.max(0,ordered.length-request.maxCandidates);result.candidates=ordered.slice(0,request.maxCandidates);return result;
}
export function importBatchSelection(current:PieceComposition,batch:RedesignBatchResult,ids:string[]):PieceComposition {
 const base=current.plans.find(p=>p.id===batch.base.id);if(!base||planSignature(base)!==batch.baseSignature)throw Error('基款已修改，请重新生成矩阵');
 if(!ids.length||new Set(ids).size!==ids.length)throw Error('请选择不同的候选');
 const plans=ids.map(id=>{const c=batch.candidates.find(c=>c.id===id);if(!c)throw Error('候选不存在');return c.plan;});
 if(plans.some(p=>current.plans.some(old=>old.id===p.id)))throw Error('所选方案已经加入设计台');
 if(current.plans.length+plans.length>12)throw Error(`设计台还可加入${12-current.plans.length}个方案，请减少选择`);
 return normalizeComposition(readPieceComposition({...current,plans:[...current.plans,...structuredClone(plans)],activePlanId:plans[0].id}));
}
export function batchPackage(batch:RedesignBatchResult){return {...batch,candidates:batch.candidates.map(c=>({...c,package:designAssetPackage(c.plan)}))};}
