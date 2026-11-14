import { REDESIGN_METHODS } from '@/data/redesignMethods';
import { PROFESSIONAL_DESIGN_ASSETS } from '@/data/professionalDesignAssets';
import { GRAPHIC_TECHNIQUES, graphicTechniqueTag } from './graphic-techniques';
import { DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_DETAILS, DEFAULT_COMPOSITION_ELEMENTS, readCompositionElements } from '@/lib/pattern/composition-elements';
import { readPieceComposition } from '@/lib/pattern/piece-composition';
import { normalizeComposition } from './composition-catalogue';
import { applyDesignAsset } from './professional-design-assets';
import type { CompositionPlan, CompositionSource, CompositionView } from '@/types/piece-composition';
import type { GraphicTechnique } from '@/types/composition-elements';
import type { RedesignMethodId } from '@/types/redesign-method';

export interface RedesignRequest {
 methodId:RedesignMethodId;assetId?:string;graphicId?:string;donor?:CompositionPlan;
 donorPart?:'neck'|'shoulder';targetView?:CompositionView;removeId?:string;
 technique?:GraphicTechnique;patternAction?:'shrink'|'remove';decoration?:'contrast'|'piping';
}
export { GRAPHIC_TECHNIQUES, graphicTechniqueTag } from './graphic-techniques';
function comparable(plan:CompositionPlan){const e=plan.elements??DEFAULT_COMPOSITION_ELEMENTS;return {pieces:plan.pieces,elements:{...e,craft:{...DEFAULT_COMPOSITION_CRAFT,...e.craft},details:{...DEFAULT_COMPOSITION_DETAILS,...e.details},tagIntent:undefined}};}
export function planSignature(plan:CompositionPlan){const value=JSON.stringify(comparable(plan),(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
export function redesignAssetChoices(methodId:RedesignMethodId){return PROFESSIONAL_DESIGN_ASSETS.filter(a=>methodId==='silhouette-lock'?a.group==='fabric':methodId==='add-part'?!!a.pocket||a.id==='hood.two'||a.id==='hood.three':methodId==='replacement'?['neck','shoulder','fabric','opening'].includes(a.group):false);}
/** Actions adapt source methods to the currently supported short-T host; never transplant raw donor CAD. */
export function createRedesign(request:RedesignRequest,base:CompositionPlan,source:CompositionSource,uid:()=>string):CompositionPlan{
 const method=REDESIGN_METHODS.find(m=>m.id===request.methodId);if(!method?.implemented)throw Error('品类转移尚缺目标品类三视图与配套净样，请先完善目标模板');
 if(!base.pieces.length)throw Error('请先在当前方案中完成基础起稿');
 if(base.pieces.some(p=>p.source.templateId!=='t-shirt'))throw Error('当前可执行改款适配短T方案，其他品类需先接通对应接口');
 let next=structuredClone(base);const e=structuredClone(base.elements??DEFAULT_COMPOSITION_ELEMENTS),craft={...DEFAULT_COMPOSITION_CRAFT,...e.craft},details={...DEFAULT_COMPOSITION_DETAILS,...e.details};
 e.craft=craft;e.details=details;delete e.tagIntent;next.elements=e;delete next.redesign;
 const changed:string[]=[],notes:string[]=['文献为女装改款方法；本方案是现有短T设计台的适配应用','结构净样、配缝与生产工艺仍须专业核验'];
 const preserved=['原方案内容','主款尺寸来源','三视图固定部位'];
 const graphic=()=>{const g=e.graphics.find(g=>g.id===request.graphicId);if(!g)throw Error('请明确选择现有图形');return g;};
 if(['replacement','silhouette-lock','add-part'].includes(method.id)){
  if(!redesignAssetChoices(method.id).some(a=>a.id===request.assetId))throw Error('请选择此方法允许的设计素材');
  if(method.id==='add-part'&&request.assetId?.startsWith('hood.')&&details.hood!=='none')throw Error('当前已有帽体；更换帽型请使用设计素材替换');
  next=applyDesignAsset(request.assetId!,next,base.pieces.find(p=>p.assetKey==='body-front')?.source??source,uid);const a=PROFESSIONAL_DESIGN_ASSETS.find(a=>a.id===request.assetId)!;
  changed.push(`${method.name}：${a.name}`);notes.push(...a.needs);
  if(method.id==='silhouette-lock')preserved.push('领型、肩袖、全部结构片尺寸与位置');
  if(a.group==='neck'||a.group==='opening')notes.push('领型和开合按兼容组合同时处理');
 }else if(method.id==='detail-transfer'||method.id==='detail-extension'){
  const g=graphic(),view=request.targetView;if(!view||view===g.view)throw Error('请选择不同于原图形的目标视图');
  if(view==='side')throw Error('侧面可用面积需定位核对，本次迁移仅接正面与背面');
  const target={...structuredClone(g),view,x:250,y:270};
  if(method.id==='detail-extension'){if(e.graphics.length>=12)throw Error('每个方案最多12个Logo');target.id=uid();e.graphics.push(target);changed.push('保留原图形，在另一视图增加呼应');}
  else {e.graphics=e.graphics.map(old=>old.id===g.id?target:old);changed.push('图形迁移到另一视图，保留大小与图案内容');}
  preserved.push('领型与肩袖轮廓','图形源文件与实际绘制尺寸');notes.push('目标图形位置为居中初值，须检查视觉重心和最终打样位置');
 }else if(method.id==='style-combination'){
  const donor=request.donor;if(!donor||donor.id===base.id||!donor.pieces.length||donor.pieces.some(p=>p.source.templateId!=='t-shirt'))throw Error('请选择另一个已有短T内容的方案作为部件来源');
  const de=donor.elements??DEFAULT_COMPOSITION_ELEMENTS,dc={...DEFAULT_COMPOSITION_CRAFT,...de.craft},dd={...DEFAULT_COMPOSITION_DETAILS,...de.details};
  if(request.donorPart==='shoulder'){e.shoulder=de.shoulder;changed.push(`借用 ${donor.name} 的肩袖构型`);preserved.push('主款领型与面料');}
  else if(request.donorPart==='neck'){
   e.neckline=de.neckline;Object.assign(craft,{opening:dc.opening,neckFinish:dc.neckFinish,bindingWidthMm:dc.bindingWidthMm,openingLengthMm:dc.openingLengthMm,placketWidthMm:dc.placketWidthMm,collarHeightMm:dc.collarHeightMm});
   Object.assign(details,{hood:dd.hood,hoodHeightMm:dd.hoodHeightMm,drawcord:dd.drawcord});e.neckContrast=de.neckContrast;e.neckColor=de.neckColor;
   if(de.materials?.neck){e.materials={...e.materials,neck:structuredClone(de.materials.neck)};}else if(e.materials)delete e.materials.neck;
   if(de.materialImages?.neck){e.materialImages={...e.materialImages,neck:structuredClone(de.materialImages.neck)};}else if(e.materialImages)delete e.materialImages.neck;
   changed.push(`借用 ${donor.name} 的领口、开合及帽领连接组合`);preserved.push('主款肩袖与主体面料');
  }else throw Error('请选择借用领部或肩袖');
  notes.push('借用设计参数，在主款原尺寸上重绘；没有直接拼接不同来源的纸样');
 }else if(method.id==='reverse'){
  if(!e.sleeveContrast)throw Error('请先形成明确的主体与袖片撞色关系');
  if(e.materialImages?.main)throw Error('主体已有企业面料图片，配色反转不能替代真实换料；请另用组合更换');
  const main=base.pieces.find(p=>p.assetKey==='body-front')?.color;if(!main)throw Error('缺少主款前身颜色');
  if(main===e.sleeveColor)throw Error('主体与袖片同色，无需反转');
  const oldSleeve=e.sleeveColor;e.sleeveColor=main;next.pieces=next.pieces.map(p=>['body-front','body-back','side-body','facing'].includes(p.assetKey)?{...p,color:oldSleeve}:p);
  changed.push('主体与袖片配色对调');preserved.push('结构、领型、图形与口袋');
 }else if(method.id==='change-form'){
  const g=graphic();if(!request.technique||request.technique==='artwork')throw Error('请选择具体加工工艺');if(g.technique===request.technique)throw Error('此图形已选择相同工艺');g.technique=request.technique;
  changed.push(`保留图形，工艺意向改为${GRAPHIC_TECHNIQUES.find(([id])=>id===request.technique)![1]}`);preserved.push('图形内容、尺寸、位置及服装轮廓');
  notes.push('三视图保留原图形；不是刺绣或印花实物仿真，绣版、衬层、色牢度及成本需验证');if(!graphicTechniqueTag(request.technique))notes.push('当前字典未找到此工艺的精确叶子标签，未借用其他工艺编码');
 }else if(method.id==='remove-part'){
  const pocket=next.pieces.find(p=>p.id===request.removeId&&p.assetKey.includes('pocket'));
  if(pocket){next.pieces=next.pieces.filter(p=>p.id!==pocket.id);changed.push(`移除 ${pocket.name}`);}
  else if(request.removeId==='hood'&&details.hood!=='none'){details.hood='none';details.drawcord=false;changed.push('移除帽体及帽口绳组件，保留圆领连接口');}
  else if(request.removeId==='panel'&&details.panel!=='none'){details.panel='none';changed.push('合并衣身设计分割；无生产裁片自动合并');}
  else throw Error('请选择实际存在的口袋、帽体或拼片；不能直接删除衣身与袖片');
  notes.push('移除部件后的接边、缝份及加固需要重新制版处理');
 }else if(method.id==='reduce-decoration'){
  if(request.decoration==='contrast'){if(!e.neckContrast&&!e.sleeveContrast&&!e.cuffContrast)throw Error('当前没有可关闭的撞色');if(e.materialImages?.neck||e.materialImages?.cuff)throw Error('撞色部位有关联面料图片，请先在面料中明确换料，避免把照片关联当作配色开关');e.neckContrast=false;e.sleeveContrast=false;e.cuffContrast=false;changed.push('关闭领口、袖片与袖口撞色');}
  else if(request.decoration==='piping'&&craft.seamFinish==='piping'){craft.seamFinish='plain';changed.push('移除拼缝嵌边装饰，保留原拼接缝');}
  else throw Error('请选择当前存在的装饰');preserved.push('门襟、罗纹结构、功能帽绳与图形');
 }else if(method.id==='reduce-pattern'){
  const g=graphic();if(request.patternAction==='remove'){e.graphics=e.graphics.filter(old=>old.id!==g.id);changed.push('移除指定图形');}
  else if(request.patternAction==='shrink'){const w=g.width*.65,h=g.height*.65;if(w<10||h<5)throw Error('图形已接近最小尺寸，无法继续缩小');g.width=w;g.height=h;changed.push('指定图形等比缩至65%，位置保持');}
  else throw Error('请选择缩小或移除指定图形');preserved.push('结构、主体面料及其他图形');
 }
 next.elements=readCompositionElements(next.elements);
 if(planSignature(next)===planSignature(base))throw Error('本次选择与当前方案相同，请选择能产生差异的改款项');
 if(next.elements.craft?.opening==='full-zip'&&next.pieces.some(p=>p.assetKey==='design.kangaroo-pocket'))throw Error('整片袋鼠袋不能跨越全开襟，请先选择分体袋或其他开合');
 next.id=uid();const target=PROFESSIONAL_DESIGN_ASSETS.find(a=>a.id===request.assetId)?.name??(request.donorPart==='neck'?'借用领口':request.donorPart==='shoulder'?'借用肩袖':request.technique?GRAPHIC_TECHNIQUES.find(([id])=>id===request.technique)?.[1]:undefined);
 next.name=`${method.name}${target?' · '+target:''}`.slice(0,100);
 next.pieces=next.pieces.map(p=>({...p,id:uid()}));next.elements.graphics=next.elements.graphics.map(g=>({...g,id:uid()}));
 next.redesign={methodId:method.id,basePlanId:base.id,baseSignature:planSignature(base),...(request.donor?{donorPlanId:request.donor.id}:{}),sourceFileId:method.sourceFileId,sourceBlockId:method.sourceBlockId,changed,preserved,notes};
 return normalizeComposition(readPieceComposition({schema:'garment-os/piece-composition-editor/v1',activePlanId:next.id,plans:[next]})).plans[0];
}
