import { DESIGN_SCHEMA, ENGINE_VERSION, type DesignConfiguration, type DesignDocument, type DesignPresentation } from '@/types/design';
import { requireReviewedPattern } from '@/data/patternReview';
import { readConstructionSelection } from '@/lib/pattern/construction-selection';
import { readCompanyStyle } from '@/lib/pattern/company-style';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { readPieceDesign,supportsPieceDesign } from '@/lib/pattern/piece-design-spec';
import { SKIRT_PATTERN_ID,SKIRT_MEASUREMENT_FIELDS } from '@/data/skirtMethods';
import {PANTS_PATTERN_ID,PANTS_MEASUREMENT_FIELDS} from '@/data/foundationMethods';
import { readManagedAssignments } from './managed-materials';
import { readPieceComposition } from '@/lib/pattern/piece-composition';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('设计数据必须为对象');
  return value as Record<string, unknown>;
};
export function readConfiguration(value: unknown): DesignConfiguration {
  const input = record(value);
  if (input.engineVersion !== ENGINE_VERSION) throw new Error('制图版本不兼容，请保留原文件后重新核对');
  if (typeof input.gender !== 'string' || !['male', 'female', 'unisex'].includes(input.gender)) throw new Error('缺少有效的体型分组');
  if (typeof input.standardSize !== 'string' || !['XS','S','M','L','XL','XXL','XXXL'].includes(input.standardSize)) throw new Error('缺少有效的样本尺码标识');
  if (typeof input.fit !== 'string' || !['slim','regular','loose'].includes(input.fit)) throw new Error('缺少有效的松量方案');
  if (typeof input.activePatternId !== 'string') throw new Error('缺少制版模板');
  requireReviewedPattern(input.activePatternId);
  const m = record(input.measurements);
  const upperKeys = ['neckCirc','hpsToBust','hpsToWaistBack','waistToArmpit','shoulderSlope','bust','waist','hip','bicep','wristCirc','shoulderWidth','sleeveLength','hipDepth','totalLength'];
  const required=input.activePatternId===PANTS_PATTERN_ID?PANTS_MEASUREMENT_FIELDS.map(f=>f.id):input.activePatternId===SKIRT_PATTERN_ID?SKIRT_MEASUREMENT_FIELDS.map(f=>f.id):upperKeys;
  const invalid=required.filter(key => typeof m[key] !== 'number' || !Number.isFinite(m[key]) || (key === 'shoulderSlope' ? Number(m[key]) < 0 : Number(m[key]) <= 0));
  if(invalid.length){
    const labels:Record<string,string>=input.activePatternId===PANTS_PATTERN_ID?Object.fromEntries(PANTS_MEASUREMENT_FIELDS.map(f=>[f.id,f.label])):input.activePatternId===SKIRT_PATTERN_ID?Object.fromEntries(SKIRT_MEASUREMENT_FIELDS.map(f=>[f.id,f.label])):
      {neckCirc:'颈围',hpsToBust:'HPS到胸围线',hpsToWaistBack:'HPS到后腰',waistToArmpit:'腰到腋下',shoulderSlope:'肩斜角',bust:'胸围',waist:'腰围',hip:'臀围',bicep:'上臂围',wristCirc:'腕围',shoulderWidth:'总肩宽',sleeveLength:'肩端到腕',hipDepth:'腰到臀线',totalLength:'HPS到下摆'};
    throw new Error(`制版输入缺失或无效：${invalid.map(key=>labels[key]??key).join('、')}；不能用演示尺寸补齐`);
  }
  // Preserve supplied direct measurements across domains without inventing unrelated inputs.
  const keys=upperKeys.filter(key=>m[key]!==undefined);
  if(keys.some(key=>typeof m[key]!=='number'||!Number.isFinite(m[key])||(key==='shoulderSlope'?Number(m[key])<0:Number(m[key])<=0)))throw new Error('已提供的身体测量无效，不能保存损坏的跨品类数据');
  for(const f of PANTS_MEASUREMENT_FIELDS){if(keys.includes(f.id)||m[f.id]===undefined)continue;if(typeof m[f.id]!=='number'||!Number.isFinite(m[f.id])||Number(m[f.id])<=0)throw Error('已提供的下身测量无效');keys.push(f.id);}
  for(const key of ['waistToFloor','skirtLength'])if(m[key]!==undefined){
    if(typeof m[key]!=='number'||!Number.isFinite(m[key])||Number(m[key])<=0)throw new Error('裙装测量或设计长度无效');
    if(!keys.includes(key))keys.push(key);
  }
  if(m.headCirc!==undefined){if(typeof m.headCirc!=='number'||!Number.isFinite(m.headCirc)||m.headCirc<=0)throw new Error('头围测量无效');keys.push('headCirc');}
  if(input.activePatternId==='hooded-zip-sweatshirt'&&m.headCirc===undefined)throw new Error('连帽模板缺少头围测量');
  if (typeof input.garmentColor !== 'string' || !/^#[\da-f]{6}$/i.test(input.garmentColor)) throw new Error('预览颜色格式无效');
  if (typeof input.fabricId !== 'string' || !input.fabricId || input.fabricId.length > 100) throw new Error('缺少有效的外观纹理标识');
  // Retain only consumed measurement semantics; discard obsolete simulated parameters.
  if(input.pieceDesign!==undefined&&!supportsPieceDesign(input.activePatternId))throw Error('此裁片组合仅支持配套针织T恤方法，不能跨方法套用');
  return { activePatternId: input.activePatternId, gender: input.gender as DesignConfiguration['gender'],
    standardSize: input.standardSize as DesignConfiguration['standardSize'], fit: input.fit as DesignConfiguration['fit'],
    measurements: Object.fromEntries(keys.map(key => [key,m[key]])) as unknown as DesignConfiguration['measurements'],
    engineVersion: ENGINE_VERSION, garmentColor: input.garmentColor, fabricId: input.fabricId,
    construction: readConstructionSelection(input.activePatternId, input.construction),
    ...(input.pieceDesign===undefined?{}:{pieceDesign:readPieceDesign(input.pieceDesign)}),
    ...(input.pieceComposition===undefined?{}:{pieceComposition:readPieceComposition(input.pieceComposition)}),
    ...(input.managedMaterials===undefined?{}:{managedMaterials:readManagedAssignments(input.managedMaterials)}) };
}
export function readPresentation(value: unknown): DesignPresentation {
  const p = record(value);
  if (typeof p.view !== 'string' || !['front','back'].includes(p.view) || typeof p.viewMode !== 'string' || !['clean','industrial'].includes(p.viewMode)) throw new Error('设计视图配置无效');
  return { view: p.view as DesignPresentation['view'], viewMode: p.viewMode as DesignPresentation['viewMode'], companyDraft: p.companyDraft === undefined ? undefined : readCompanyStyle(p.companyDraft) };
}
/** Read-time compatibility adapter. It never writes, runs a legacy solver, or invents dimensions. */
export function readDesignDocument(value: unknown): DesignDocument {
  const doc = record(value);
  if (typeof doc.id !== 'string' || !doc.id || typeof doc.name !== 'string') throw new Error('设计标识或名称缺失');
  if (![doc.createdAt,doc.updatedAt].every(v => typeof v === 'string' && Number.isFinite(Date.parse(v)))) throw new Error('设计时间信息无效');
  if (doc.schema && doc.schema !== DESIGN_SCHEMA) throw new Error('设计文档格式不兼容');
  let configuration: DesignConfiguration, display: DesignPresentation;
  if (doc.schema === DESIGN_SCHEMA) {
    configuration = readConfiguration(doc.configuration);
    display = readPresentation(doc.presentation);
  } else {
    if (!doc.draftInputs) throw new Error('旧设计缺少可追溯的制版输入，已拒绝载入；请补录原始测量');
    const original = record(doc.draftInputs);
    configuration = readConfiguration({ ...original, gender: doc.gender, activePatternId: doc.activePatternId,
      garmentColor: doc.garmentColor, fabricId: doc.fabricId });
    display = readPresentation({ view: doc.view ?? 'front', viewMode: doc.viewMode ?? 'clean' });
  }
  if (doc.gender !== configuration.gender) throw new Error('设计分组与原始输入不一致');
  if(display.companyDraft?.cadApplied&&companyStyleMaster(display.companyDraft.masterId).cadTemplateId!==configuration.activePatternId)throw Error('公司母版关联与当前裁片构型不一致');
  return { schema: DESIGN_SCHEMA, id: doc.id, name: doc.name, gender: configuration.gender,
    createdAt: doc.createdAt as string, updatedAt: doc.updatedAt as string,
    tags: Array.isArray(doc.tags) ? doc.tags.filter((tag): tag is string => typeof tag === 'string') : [], configuration, presentation: display };
}
