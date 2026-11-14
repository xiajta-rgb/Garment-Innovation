import { v5 as uuidv5 } from 'uuid';
import { readConfiguration } from './design-document';
import { createAssemblyRecord } from './assembly-record';
import { changeKnitOption,readConstructionSelection } from '@/lib/pattern/construction-selection';
import {foundationParameters} from '@/data/foundationMethods';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { generatePatternSheet } from '@/lib/svg-export/pattern-sheet-exporter';
import type { DesignConfiguration } from '@/types/design';
import type { DraftResult } from './draft-service';
import type {ConstructionSelection} from '@/types/construction';

export const STYLE_TEMPLATE_IDS=['t-shirt','womens-basic-tee','elastic-waist-pants','bound-tank','hooded-zip-sweatshirt'] as const;
export type StyleTemplateId=typeof STYLE_TEMPLATE_IDS[number];
export function supportsStylePlan(id:string):id is StyleTemplateId{return STYLE_TEMPLATE_IDS.some(template=>template===id);}

export type StylePlan =
  | { templateId:'bound-tank'; necklineDrop:number }
  | { templateId:'hooded-zip-sweatshirt'; pocket:boolean; ribbing:boolean }
  | { templateId:'t-shirt'|'womens-basic-tee'|'elastic-waist-pants'; options:ConstructionSelection['options'] };
export { readStyleObservation } from './style-observation';
export type { StyleObservation } from './style-observation';

export function configureStyle(base:DesignConfiguration, plan:StylePlan):DesignConfiguration {
  const prior=base.activePatternId===plan.templateId?base.construction:undefined;
  let construction:DesignConfiguration['construction'];
  if(plan.templateId==='bound-tank'){
    construction=changeKnitOption(plan.templateId,prior,'necklineDrop',plan.necklineDrop);
  }else if(plan.templateId==='hooded-zip-sweatshirt'){
    construction=changeKnitOption(plan.templateId,prior,'pocket',plan.pocket);
    construction=changeKnitOption(plan.templateId,construction,'ribbing',plan.ribbing);
  }else if(foundationParameters(plan.templateId)){
    const patch=readConstructionSelection(plan.templateId,{schema:'garment-os/construction/v1',options:plan.options})!;
    construction=readConstructionSelection(plan.templateId,{schema:'garment-os/construction/v1',options:{...prior?.options,...patch.options}});
  }else throw new Error('此款式尚无已审查的裁片映射');
  return readConfiguration({...base,activePatternId:plan.templateId,construction});
}

const NS='c8d32872-32e5-49c5-9de8-4b73080b08d3';
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(
  Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,entry])=>[key,stable(entry)])):value;
export function createStyleWorkflow(config:DesignConfiguration,draft:DraftResult) {
  const {assembly}=createAssemblyRecord(config,draft);
  if(draft.status!=='reference'||!assembly.integrityPass||assembly.status==='blocked'||!assembly.construction)throw new Error('裁片与构造检查未通过');
  const configuration=readConfiguration(config);
  const revisionId=uuidv5(JSON.stringify(stable({configuration,method:assembly.revision,construction:assembly.construction,
    paths:draft.paths.map(p=>[p.id,p.layer,p.data,p.transform]),materialCuts:assembly.pieces.map(p=>[p.id,p.materials])})),NS);
  const bom=assembly.pieces.flatMap(piece=>Object.entries(piece.materials).flatMap(([materialRole,cuts])=>cuts.map((cut,index)=>({
    id:`${piece.id}/${materialRole}/${index+1}`,pieceId:piece.id,pieceName:piece.name,source:piece.source,materialRole,
    cutQuantity:cut.cut,cutUnit:'片' as const,onFold:cut.onFold,materialSku:null,purchaseQuantity:null,purchaseUnit:null,
  }))));
  const pending=[
    ...assembly.pending.map(x=>x.message),
    ...assembly.construction.operations.flatMap(x=>x.requirements),
    '面辅料货号、实际用量、排料与损耗待确认。',
    ...(assembly.engine==='huey'?['拉链规格及完成长度、袋口与共缝区尚待确认。']:assembly.engine==='aaron'?['包条端头工艺与材料回弹尚待实测。']:[]),
  ];
  return {schema:'garment-os/style-workflow/v1',revisionId,configuration,productionApproved:false as const,
    stage:'reference-draft' as const,measurementProvenance:'unverified-input' as const,
    sourcePieceCount:assembly.pieces.length,primaryCutQuantity:assembly.pieces.reduce((n,p)=>n+p.quantity,0),
    assemblyRevision:assembly.revision,bom:{status:'draft' as const,lines:bom,missing:['实际面辅料规格','排料用量与损耗','工艺复核和放行']},
    technical:{status:'draft' as const,operations:assembly.construction.operations,joins:assembly.joins,requiredInputs:assembly.construction.requiredInputs,pending:[...new Set(pending)]},
    cad:{unit:'mm' as const,paths:draft.paths},};
}
export function createWorkflowSheet(name:string, work:ReturnType<typeof createStyleWorkflow>) {
  return generatePatternSheet(PATTERN_LIBRARY[work.configuration.activePatternId],work.cad.paths,{
    patternName:name,construction:work.configuration.construction,notes:`款式工作流参考版 ${work.revisionId}；整幅裁片图，非成衣正背技术稿。`,
  });
}
