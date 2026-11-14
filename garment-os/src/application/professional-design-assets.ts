import { graphicTechniqueTag } from './graphic-techniques';
import { PROFESSIONAL_DESIGN_ASSETS } from '@/data/professionalDesignAssets';
import dictionary from '@/data/designTagDictionary.snapshot.json';
import { DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_DETAILS, DEFAULT_COMPOSITION_ELEMENTS, readCompositionElements } from '@/lib/pattern/composition-elements';
import { compositionCatalogue, compositionTeeStarter, replaceCompositionAsset } from './composition-catalogue';
import type { CompositionElements } from '@/types/composition-elements';
import type { CompositionPlan, CompositionSource } from '@/types/piece-composition';

export function designAsset(id:string){const asset=PROFESSIONAL_DESIGN_ASSETS.find(a=>a.id===id);if(!asset)throw Error('设计素材不存在');return asset;}
export function designAssetTags(id:string){return designAsset(id).tagNames.map(name=>{const t=dictionary.tags.find(t=>t.name===name);if(!t)throw Error(`素材标签不存在：${name}`);return {code:t.code,name:t.name};});}
export function applyDesignAsset(id:string,plan:CompositionPlan,source:CompositionSource,uid:()=>string):CompositionPlan{
 const a=designAsset(id);if(plan.pieces.some(p=>p.source.templateId!=='t-shirt'))throw Error('此素材当前接通男士短T，请先另起短T方案');
 const current=plan.elements??DEFAULT_COMPOSITION_ELEMENTS,e:CompositionElements={...structuredClone(current),...a.patch,tagIntent:undefined,craft:{...DEFAULT_COMPOSITION_CRAFT,...current.craft,...a.craft},details:{...DEFAULT_COMPOSITION_DETAILS,...current.details,...a.details}};
 if(a.id==='opening.full'&&plan.pieces.some(p=>p.assetKey==='design.kangaroo-pocket'))throw Error('整片袋鼠袋不能跨越全开襟，请先移除袋鼠袋');
 if(a.pocket==='kangaroo'&&e.craft!.opening==='full-zip')throw Error('整片袋鼠袋不能跨越全开襟，请先改用套头或短开襟');

 if(a.patch?.fabric){delete e.materials?.main;delete e.materialImages?.main;}
 let next={...plan,elements:readCompositionElements(e),pieces:plan.pieces.length?structuredClone(plan.pieces):compositionTeeStarter(source,uid)};
 if(a.pocket){const cat=compositionCatalogue({...source,templateId:'t-shirt',construction:undefined},e),asset=cat.assets.find(p=>p.key===`design.${a.pocket==='patch'?'patch':a.pocket}-pocket`)!;
  next={...replaceCompositionAsset(next,asset,cat,uid,'front',a.pocket==='kangaroo'?250:315,a.pocket==='kangaroo'?440:285).plan,elements:next.elements};}
 if(a.graphic){if(e.graphics.length>=12)throw Error('每个方案最多12个Logo');e.graphics.push({id:uid(),kind:a.graphic,text:'STUDIO',view:'front',x:315,y:270,width:a.graphic==='text'?72:38,height:a.graphic==='text'?18:38,color:'#eee7d7'});next.elements=readCompositionElements(e);}
 return next;
}
export function designAssetPackage(plan:CompositionPlan){
 const e=plan.elements??DEFAULT_COMPOSITION_ELEMENTS,c={...DEFAULT_COMPOSITION_CRAFT,...e.craft},d={...DEFAULT_COMPOSITION_DETAILS,...e.details};
 const ids=[`fabric.${e.fabric}`,...(d.hood==='none'?[`neck.${e.neckline}`]:[]),`shoulder.${e.shoulder==='set-in'?'set-in':e.shoulder}`,...(c.opening==='none'?[]:[`opening.${{buttons:'buttons','quarter-zip':'quarter','full-zip':'full'}[c.opening]}`]),...(c.neckFinish==='binding'&&d.hood==='none'&&!['stand','polo'].includes(e.neckline)?['finish.binding']:[]),...(c.backNeckTape?['finish.tape']:[]),...(c.seamFinish==='piping'?['finish.piping']:c.seamFinish==='topstitch'?['finish.topstitch']:[]),...(d.cuffFinish==='rib'?['finish.cuff-rib']:[]),...(d.hemFinish==='rib'?['finish.hem-rib']:d.hemFinish==='side-slit'?['finish.slit']:[]),...(d.panel==='none'?[]:[`panel.${d.panel}`]),...(d.hood==='none'?[]:[`hood.${d.hood==='two-piece'?'two':'three'}`]),...(d.drawcord?['hood.cord']:[]),...plan.pieces.filter(p=>p.assetKey.includes('pocket')).map(p=>`pocket.${p.assetKey.replace('design.','').replace('-pocket','').replace('patch-pocket','patch')}`)];
 const assets=[...new Set(plan.pieces.length?ids:[])].filter(id=>PROFESSIONAL_DESIGN_ASSETS.some(a=>a.id===id)).map(id=>{const a=designAsset(id);return {...a,tags:designAssetTags(id),drawingReady:true,netPatternReady:false,productionApproved:false};});
 return {schema:'garment-os/professional-design-package/v1',planId:plan.id,name:plan.name,dictionaryRevision:dictionary.source.revision,parameters:{craft:c,details:d},assets,matrix:plan.matrix??null,redesign:plan.redesign??null,graphics:e.graphics.map(g=>({...g,technique:g.technique??'artwork',techniqueTag:graphicTechniqueTag(g.technique??'artwork')?{code:graphicTechniqueTag(g.technique??'artwork')!.code,name:graphicTechniqueTag(g.technique??'artwork')!.name}:null,productionApproved:false})),pockets:plan.pieces.filter(p=>p.assetKey.includes('pocket')).map(p=>({id:p.id,assetKey:p.assetKey,view:p.view,widthMm:p.widthMm,heightMm:p.heightMm,position:{x:p.x,y:p.y,unit:'drawing-pixel'},rotation:p.rotation,netPatternReady:false})),materials:e.materials??{},netPatternReady:false,productionApproved:false,notes:['本包为设计配套清单；基础源净样不代表新增结构净样','设计值不能当作公司原稿尺寸或生产规格']};
}
