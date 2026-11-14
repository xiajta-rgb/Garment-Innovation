import { readRedesignMatrixOrigin } from './redesign-matrix-origin';
import type { RedesignOrigin } from '@/types/piece-composition';
import { REDESIGN_METHODS } from '@/data/redesignMethods';
import type { CompositionSource, PieceComposition, CompositionPiece } from '@/types/piece-composition';
import { requireReviewedPattern } from '@/data/patternReview';
import { readConstructionSelection } from './construction-selection';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { PANTS_MEASUREMENT_FIELDS } from '@/data/foundationMethods';
import { SKIRT_MEASUREMENT_FIELDS } from '@/data/skirtMethods';
import { readCompositionElements } from './composition-elements';

const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('裁片组合数据格式无效');return v as Record<string,unknown>;};
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>160)throw Error('裁片组合标识或名称无效');return v;};
function number(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('裁片尺寸或位置超出有效范围');return v;}
function flag(v:unknown){if(typeof v!=='boolean')throw Error('裁片显示或镜像状态无效');return v;}
function source(v:unknown):CompositionSource {
 const s=object(v),templateId=text(s.templateId);requireReviewedPattern(templateId);
 if(!['male','female','unisex'].includes(String(s.gender))||!['XS','S','M','L','XL','XXL','XXXL'].includes(String(s.standardSize))||!['slim','regular','loose'].includes(String(s.fit)))throw Error('裁片来源尺寸分组无效');
 const measurements=object(s.measurements);if(!Object.keys(measurements).length)throw Error('裁片来源测量缺失');
 const required=templateId==='panel-circle-skirt'?SKIRT_MEASUREMENT_FIELDS.map(f=>f.id):templateId==='elastic-waist-pants'?PANTS_MEASUREMENT_FIELDS.map(f=>f.id):['neckCirc','hpsToBust','hpsToWaistBack','waistToArmpit','shoulderSlope','bust','waist','hip','bicep','wristCirc','shoulderWidth','sleeveLength','hipDepth','totalLength',...(templateId==='hooded-zip-sweatshirt'?['headCirc']:[])];
 for(const key of required)number(measurements[key],key==='shoulderSlope'?0:.01,5000);
 for(const [key,value] of Object.entries(measurements))number(value,key==='shoulderSlope'?0:.01,5000);
 return {templateId,gender:s.gender as CompositionSource['gender'],standardSize:s.standardSize as CompositionSource['standardSize'],fit:s.fit as CompositionSource['fit'],measurements:structuredClone(measurements) as unknown as CompositionSource['measurements'],construction:readConstructionSelection(templateId,s.construction)};
}
function piece(v:unknown):CompositionPiece {
 const p=object(v);if(!['front','back','side'].includes(String(p.view)))throw Error('裁片所在视图无效');
 if(typeof p.color!=='string'||!/^#[a-f\d]{6}$/i.test(p.color))throw Error('裁片颜色无效');
 const origin=source(p.source),assetKey=text(p.assetKey),engine=requireReviewedPattern(origin.templateId).engine;
 const teaganKeys=['body-front','body-back','neck-front','neck-back','sleeve','facing','side-body','side-sleeve','design.patch-pocket','design.kangaroo-pocket','design.welt-pocket','design.zip-welt-pocket'];
 const known=engine==='teagan'?teaganKeys.includes(assetKey):!!SOURCE_PIECE_ROLES[assetKey]&&(assetKey.startsWith(engine+'.')||(engine==='brian'&&assetKey==='library.sleeve'));
 if(!known)throw Error('裁片身份与来源模板不一致');
 return {id:text(p.id),source:origin,assetKey,name:text(p.name),view:p.view as CompositionPiece['view'],x:number(p.x,-1000,1500),y:number(p.y,-1000,1800),widthMm:number(p.widthMm,1,3000),heightMm:number(p.heightMm,1,3000),rotation:number(p.rotation,-360,360),mirrored:flag(p.mirrored),color:p.color,visible:flag(p.visible)};
}
function readRedesign(value:unknown):RedesignOrigin{
 const r=object(value);const method=REDESIGN_METHODS.find(m=>m.id===r.methodId&&m.implemented);
 if(!method||r.sourceFileId!==method.sourceFileId||r.sourceBlockId!==method.sourceBlockId)throw Error('改款方法与来源不匹配');
 const list=(v:unknown)=>{if(!Array.isArray(v)||v.length>30)throw Error('改款差异记录无效');return v.map(text);};
 return {methodId:method.id,basePlanId:text(r.basePlanId),baseSignature:text(r.baseSignature),sourceFileId:method.sourceFileId,sourceBlockId:method.sourceBlockId,changed:list(r.changed),preserved:list(r.preserved),notes:list(r.notes),...(r.donorPlanId===undefined?{}:{donorPlanId:text(r.donorPlanId)})};
}
export function readPieceComposition(value:unknown):PieceComposition {
 const c=object(value);
 if(c.schema!=='garment-os/piece-composition-editor/v1'||!Array.isArray(c.plans)||!c.plans.length||c.plans.length>12)throw Error('组合方案格式无效或超过12款');
 const plans=c.plans.map(v=>{
  const p=object(v);if(!Array.isArray(p.pieces)||p.pieces.length>80)throw Error('每个方案最多80个裁片');
  const pieces=p.pieces.map(piece);if(new Set(pieces.map(p=>p.id)).size!==pieces.length)throw Error('裁片标识重复');
  if((p.elements as {craft?:{opening?:string}}|undefined)?.craft?.opening==='full-zip'&&pieces.some(p=>p.assetKey==='design.kangaroo-pocket'))throw Error('整片袋鼠袋不能跨越全开襟');
  return {id:text(p.id),name:text(p.name),pieces,...(p.matrix===undefined?{}:{matrix:readRedesignMatrixOrigin(p.matrix)}),...(p.redesign===undefined?{}:{redesign:readRedesign(p.redesign)}),...(p.elements===undefined?{}:{elements:readCompositionElements(p.elements)})};
 });
 if(new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('组合方案标识重复');
 const activePlanId=text(c.activePlanId);if(!plans.some(p=>p.id===activePlanId))throw Error('当前组合方案不存在');
 return {schema:'garment-os/piece-composition-editor/v1',activePlanId,plans};
}
export function emptyPieceComposition(id:string):PieceComposition {return {schema:'garment-os/piece-composition-editor/v1',activePlanId:id,plans:[{id,name:'方案 01',pieces:[]}]};}
