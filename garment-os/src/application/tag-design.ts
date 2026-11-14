import { PROFESSIONAL_DESIGN_ASSETS } from '@/data/professionalDesignAssets';
import { applyDesignAsset } from './professional-design-assets';
import dictionary from '@/data/designTagDictionary.snapshot.json';
import { DESIGN_CAPABILITIES } from '@/data/designCapabilities';
import { ELEMENT_LIBRARY } from '@/data/elementRegistry';
import { DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_ELEMENTS, DEFAULT_COMPOSITION_DETAILS, readCompositionElements } from '@/lib/pattern/composition-elements';
import { compositionCatalogue, compositionTeeStarter, replaceCompositionAsset } from './composition-catalogue';
import type { CompositionElements } from '@/types/composition-elements';
import type { CompositionPlan, CompositionSource } from '@/types/piece-composition';

export const DESIGN_TAG_DICTIONARY=dictionary;
export interface TagDesignRequest {tags:string[];bindingPart?:'neck'|'back-neck';colourPart?:'neck'|'sleeve'|'cuff';pocketPart?:'chest';finishPart?:'cuff'|'hem';panelPart?:'yoke'|'side';hoodType?:'two-piece'|'three-piece';trimColor?:string}
export interface TagDesignResult {
 assetIds:string[];pocketKind?:'patch'|'kangaroo'|'welt'|'zip-welt';codes:string[];names:string[];issues:string[];warnings:string[];elements:CompositionElements;pocket:boolean;
 matches:{code:string;name:string;axis:string;capabilities:string[];sources:string[];missing:string[];preview:boolean}[];
 previewReady:boolean;patternReady:false;productionApproved:false;
 dictionaryRevision:number;libraryObservedAt:string;
}
const namesToNeck={圆领:'crew',V领:'v',亨利领开口:'henley',Polo领:'polo',立领:'stand'} as const;
const sourceMatches=(names:string[])=>DESIGN_CAPABILITIES.filter(c=>c.tagNames.some(n=>names.includes(n)));
/** Exact stable-code / dictionary-word lookup. Unknown and underspecified combinations fail closed. */
export function resolveTagDesign(request:TagDesignRequest,current:CompositionElements=DEFAULT_COMPOSITION_ELEMENTS):TagDesignResult{
 const issues:string[]=[],warnings:string[]=[],elements=structuredClone(current),craft={...DEFAULT_COMPOSITION_CRAFT,...elements.craft},details={...DEFAULT_COMPOSITION_DETAILS,...elements.details},chosen:typeof dictionary.tags=[];
 const values=[...new Set(request.tags.map(s=>s.trim()).filter(Boolean))];
 if(!values.length)issues.push('请至少选择一个标签');if(values.length>24)issues.push('每次最多24个标签');
 for(const value of values){const candidates=dictionary.tags.filter(t=>t.code===value||t.name===value);if(candidates.length!==1){issues.push(candidates.length?`标签需指定稳定编码：${value}`:`字典未找到标签：${value}`);continue;}if(!chosen.some(t=>t.code===candidates[0].code))chosen.push(candidates[0]);}
 const names=chosen.map(t=>t.name),has=(name:string)=>names.includes(name);
 const necks=names.filter(n=>n in namesToNeck);if(necks.length>1)issues.push('当前同一领部存在多个互斥领型，请保留一种');
 if(necks.length===1)elements.neckline=namesToNeck[necks[0] as keyof typeof namesToNeck];
 if(has('装袖')&&has('插肩'))issues.push('装袖与插肩不能同时应用');
 if(has('插肩')&&(has('微落肩')||has('大落肩')))issues.push('当前插肩与落肩构型不能同时应用');
 if(has('微落肩')&&has('大落肩'))issues.push('微落肩与大落肩必须分别选择');
 if(has('插肩'))elements.shoulder='raglan';else if(has('微落肩')||has('大落肩'))elements.shoulder='drop';else if(has('装袖'))elements.shoulder='set-in';
 if(has('大落肩'))issues.push('大落肩尚缺独立绘图与裁片档位，不能用微落肩代替');
 if(necks.length&&['henley','polo'].includes(elements.neckline))craft.opening='buttons';
 else if(necks.length)craft.opening='none';
 if(has('全开襟')&&has('半开襟'))issues.push('全开襟与半开襟互斥');
 if(has('拉链')&&has('纽扣'))issues.push('当前同一门襟不能同时应用纽扣与拉链');
 if(has('拉链')){
  if(!has('全开襟')&&!has('半开襟'))issues.push('拉链须补充半开襟或全开襟，并确认用于门襟');
  else craft.opening=has('全开襟')?'full-zip':'quarter-zip';
 }
 if(has('全开襟')&&!has('拉链'))issues.push('当前全开襟绘图需明确拉链器件');
 if(has('半开襟')&&!has('拉链')&&!has('纽扣')&&!has('亨利领开口')&&!has('Polo领'))issues.push('半开襟须明确纽扣或拉链器件');
 if(has('纽扣'))craft.opening='buttons';
 if(has('亨利领开口')&&has('拉链'))issues.push('亨利领开口在字典中要求扣合，不能用拉链代替');
 if(has('包边')&&!request.bindingPart)issues.push('包边须指定领口或后领部位');
 if(has('包边')&&request.bindingPart==='neck')craft.neckFinish='binding';
 if(has('包边')&&request.bindingPart==='neck'&&['polo','stand'].includes(elements.neckline))issues.push('立领/Polo领边缘包边尚缺独立绘图，请指定后领内侧或补充领边结构');
 if(has('包边')&&request.bindingPart==='back-neck')craft.backNeckTape=true;
 if(has('领肩加固条')){if(request.bindingPart!=='back-neck')issues.push('领肩加固条须明确后领或肩缝，本次仅接后领');else craft.backNeckTape=true;}
 if((has('外露拉链')||has('单向拉链'))&&!has('拉链'))issues.push('拉链显露和开启方式须同时指定拉链器件及开襟范围');

 if(has('嵌边'))craft.seamFinish='piping';
 if(has('色块拼接')||has('弧线拼片')){if(!request.panelPart)issues.push('拼片须指定弧线育克或侧身分割');else if(has('弧线拼片')&&request.panelPart!=='yoke')issues.push('当前弧线拼片仅接通育克分割');else details.panel=request.panelPart;}
 if(has('罗纹收口')){if(!request.finishPart)issues.push('罗纹收口须指定袖口或下摆');else if(request.finishPart==='cuff')details.cuffFinish='rib';else details.hemFinish='rib';}
 if(has('侧缝开衩')||has('下摆开衩'))details.hemFinish='side-slit';
 if(has('罗纹收口')&&request.finishPart==='hem'&&(has('侧缝开衩')||has('下摆开衩')))issues.push('同一下摆不能同时接整条罗纹和侧开衩');
 if(has('连帽')){if(!request.hoodType)issues.push('连帽须选择两片或三片帽体');else {details.hood=request.hoodType;elements.neckline='crew';if(necks.some(n=>n!=='圆领'))issues.push('当前帽体不能与独立立领或翻领叠加');}}
 if(has('抽绳调节')||has('鸡眼')||has('绳带')){if(!has('连帽'))issues.push('当前绳道、鸡眼与绳带须指定连帽部位');else details.drawcord=true;}
 
 if(has('明线')||has('压线'))craft.seamFinish='topstitch';
 if(has('包缝'))warnings.push('包缝属内侧工序，本次不把它画成外露装饰线；内侧工艺图待补');
 if(has('撞色')&&!request.colourPart)issues.push('撞色须指定领口、袖片或袖口');
 if(has('撞色')&&request.colourPart){const part=request.colourPart;elements[`${part}Contrast`]=true;if(request.trimColor)elements[`${part}Color`]=request.trimColor;}
 if(request.trimColor){if(!/^#[\da-f]{6}$/i.test(request.trimColor))issues.push('配料颜色格式无效');else craft.trimColor=request.trimColor;}
 if(has('贴袋')&&!has('胸袋')&&request.pocketPart!=='chest')issues.push('贴袋须补充胸袋位置，或明确口袋部位');
 if(has('胸袋')&&!has('贴袋')&&!has('嵌线袋'))issues.push('胸袋仅表示位置，须补充贴袋或其他袋型');

 if(has('拉链口袋')&&!has('嵌线袋'))issues.push('拉链口袋须补充嵌线袋型和胸袋位置，闭合方式不能代替袋型');
 if(has('嵌线袋')&&!has('胸袋')&&request.pocketPart!=='chest')issues.push('嵌线袋须明确胸部位置');
 if(has('袋鼠式前袋')&&(has('嵌线袋')||has('贴袋')))issues.push('本次口袋组合存在不同袋型，请分次添加');
 
 const fabrics=[['华夫格','waffle'],['华夫格肌理','waffle'],['罗纹','rib'],['坑条','rib'],['罗纹状','rib'],['珠地','pique'],['平纹','jersey'],['竹节纱','slub']] as const;
 const fabricChoices=fabrics.filter(([name])=>has(name));if(new Set(fabricChoices.map(([,value])=>value)).size>1)issues.push('同一主体面料存在不同肌理，请拆分部位或保留一种');
 if(fabricChoices.length){elements.fabric=fabricChoices[0][1];delete elements.materialImages?.main;delete elements.materials?.main;warnings.push('面料标签用于期望外观；须另选企业面料确认真实组织与物性');}
 for(const t of chosen){if(!sourceMatches([t.name]).length&&!['装袖','短袖'].includes(t.name))issues.push(`尚未接通此标签的短T组合规则：${t.name}`);}
 const matches=chosen.map(t=>{const capabilities=sourceMatches([t.name]);return {code:t.code,name:t.name,axis:t.axis,capabilities:capabilities.map(c=>c.name),sources:capabilities.flatMap(c=>c.sourceIds),missing:[...new Set(capabilities.flatMap(c=>c.needs))],preview:capabilities.some(c=>c.preview)||['装袖','短袖'].includes(t.name)};});
 for(const match of matches)if(!match.preview)issues.push(`三视图映射待补：${match.name}`);
 elements.craft=craft;elements.details=details;elements.tagIntent={codes:chosen.map(t=>t.code),dictionaryRevision:dictionary.source.revision,...(request.bindingPart?{bindingPart:request.bindingPart}:{}),...(request.colourPart?{colourPart:request.colourPart}:{}),...(request.pocketPart?{pocketPart:request.pocketPart}:{}),...(request.finishPart?{finishPart:request.finishPart}:{}),...(request.panelPart?{panelPart:request.panelPart}:{}),...(request.hoodType?{hoodType:request.hoodType}:{})};
 try{readCompositionElements(elements);}catch(error){issues.push(error instanceof Error?error.message:'组合尚未接通');}
 if(elements.shoulder==='drop')warnings.push('当前为微落肩绘图派生，毫米裁片需重建配套');
 warnings.push('未指定的设计维度保留当前方案设置');
 warnings.push('三视图为设计派生；新增门襟、领片和插肩不能沿用基础T净样作为完整裁片包');
 const pocketKind=has('袋鼠式前袋')?'kangaroo':has('嵌线袋')?(has('拉链口袋')?'zip-welt':'welt'):has('贴袋')?'patch':undefined;
 const assetIds=PROFESSIONAL_DESIGN_ASSETS.filter(a=>{
  if(!a.tagNames.some(n=>names.includes(n)))return false;
  if(a.group==='neck')return a.patch?.neckline===elements.neckline&&details.hood==='none'&&(a.id!=='neck.crew'||craft.neckFinish==='rib');
  if(a.group==='opening')return a.craft?.opening===craft.opening;
  return Object.entries(a.patch??{}).every(([key,value])=>elements[key as keyof CompositionElements]===value)&&Object.entries(a.craft??{}).every(([key,value])=>craft[key as keyof typeof craft]===value)&&Object.entries(a.details??{}).every(([key,value])=>details[key as keyof typeof details]===value)&&(!a.pocket||a.pocket===pocketKind);
 }).map(a=>a.id);
 if(pocketKind==='kangaroo'&&craft.opening==='full-zip')issues.push('整片袋鼠袋不能跨越全开襟');
 return {assetIds,pocketKind,codes:chosen.map(t=>t.code),names,issues:[...new Set(issues)],warnings:[...new Set(warnings)],elements,pocket:has('贴袋')&&(has('胸袋')||request.pocketPart==='chest'),matches,previewReady:issues.length===0,patternReady:false,productionApproved:false,dictionaryRevision:dictionary.source.revision,libraryObservedAt:ELEMENT_LIBRARY.syncedAt};
}
export function applyTagDesign(result:TagDesignResult,plan:CompositionPlan,source:CompositionSource,id:()=>string):CompositionPlan{
 if(!result.previewReady)throw Error('标签组合尚有缺项，未修改方案');
 if(result.elements.craft?.opening==='full-zip'&&plan.pieces.some(p=>p.assetKey==='design.kangaroo-pocket'))throw Error('整片袋鼠袋不能跨越全开襟，请先移除或改为分体袋');
 if(plan.pieces.length&&!plan.pieces.every(p=>p.source.templateId==='t-shirt'))throw Error('当前标签组合仅接通短T绘图，请另起短T方案');
 let next={...plan,pieces:plan.pieces.length?structuredClone(plan.pieces):compositionTeeStarter(source,id),elements:structuredClone(result.elements)};
 if(result.pocketKind&&!next.pieces.some(p=>p.assetKey===`design.${result.pocketKind}-pocket`)){const applied=applyDesignAsset(`pocket.${result.pocketKind}`,next,source,id);return {...applied,elements:{...applied.elements!,tagIntent:next.elements.tagIntent}};}
 if(result.pocket&&!next.pieces.some(p=>p.assetKey==='design.patch-pocket')){
  const cat=compositionCatalogue({...source,templateId:'t-shirt',construction:undefined}),asset=cat.assets.find(a=>a.key==='design.patch-pocket')!;
  next=replaceCompositionAsset(next,asset,cat,id,'front',315,285).plan as typeof next;
 }
 return next;
}
export function designCapabilityAudit(){
 const elements=ELEMENT_LIBRARY.elements;
 return {dictionary:dictionary.source,tagCount:dictionary.tags.length,assetCount:elements.length,verifiedTaggedAssets:elements.filter(e=>e.status==='可用'&&e.labelStatus==='已核验'&&e.tagCodes&&e.tagDictionaryVersion).length,
  localDesignAssets:PROFESSIONAL_DESIGN_ASSETS.map(a=>({id:a.id,name:a.name,tagNames:a.tagNames,companyCodes:a.companyCodes,components:a.components,netPatternReady:false,productionApproved:false})),
  pendingCandidates:elements.filter(e=>e.tagCandidates.length>0).length,capabilities:DESIGN_CAPABILITIES.map(c=>({...c,localAssets:PROFESSIONAL_DESIGN_ASSETS.filter(a=>a.tagNames.some(n=>c.tagNames.includes(n))).map(a=>({id:a.id,name:a.name})),tags:c.tagNames.map(name=>dictionary.tags.find(t=>t.name===name)).filter(Boolean),assets:c.sourceIds.map(sourceId=>{const e=elements.find(e=>e.sourceId===sourceId);return {sourceId,found:!!e,status:e?.status??'未登记',labelStatus:e?.labelStatus??'未核验',tagCodes:e?.tagCodes??null};}),patternReady:false}))};
}
