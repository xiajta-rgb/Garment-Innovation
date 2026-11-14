import { readConfiguration } from './design-document';
import { computeDraft,type DraftResult } from './draft-service';
import { createAssemblyRecord } from './assembly-record';
import { readCompanyStyle } from '@/lib/pattern/company-style';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { MATERIAL_ASSETS,FINISH_ASSETS,STRUCTURE_ASSETS } from '@/data/reusableAssets';
import { ELEMENT_LIBRARY,ELEMENT_REGISTRY } from '@/data/elementRegistry';
import {FOUNDATION_MODULES} from '@/data/foundationModules';
import type { CompanyStyleDraft } from '@/types/company-style';
import type { DesignConfiguration } from '@/types/design';

export function configureStructureAsset(base:DesignConfiguration,id:string):DesignConfiguration{
  const a=STRUCTURE_ASSETS.find(a=>a.id===id);if(!a)throw Error('结构方案不存在');
  // Component patches preserve other host settings; full presets clear incompatible dormant options.
  let construction=structuredClone(a.selection);
  if(a.componentId){
    const module=FOUNDATION_MODULES.find(m=>m.id===a.componentId);
    if(!module||module.stage!=='parameterized'||!module.templateIds.includes(a.templateId)||Object.keys(a.selection.options).some(k=>!module.optionKeys.includes(k)))throw Error('部件方案与已审查接口不一致');
    construction={schema:'garment-os/construction/v1',options:{...(base.activePatternId===a.templateId?base.construction?.options:{}),...construction.options}};
  }
  const measurements={...base.measurements};
  if(a.lengthBonus!==undefined){
    if(!Number.isFinite(measurements.hpsToWaistBack)||!Number.isFinite(measurements.hipDepth))throw Error('参考衣长方案缺少HPS至后腰或腰臀长');
    measurements.totalLength=(measurements.hpsToWaistBack!+measurements.hipDepth)*(1+a.lengthBonus);
  }
  return readConfiguration({...base,measurements,activePatternId:a.templateId,construction});
}
export function previewStructureAsset(base:DesignConfiguration,id:string){
  const configuration=configureStructureAsset(base,id);return {configuration,draft:computeDraft(configuration)};
}
/** Candidate linkage for the existing element library and a later BOM; no remote write or purchase quantities. */
export function exportAssetHandoff(configuration:DesignConfiguration,draft:DraftResult,value:CompanyStyleDraft){
  configuration=readConfiguration(configuration);
  if(draft.status==='reference')createAssemblyRecord(configuration,draft);
  const d=readCompanyStyle(value),master=companyStyleMaster(d.masterId),linked=d.cadApplied&&master.cadTemplateId===configuration.activePatternId;
  const assignments=Object.entries(d.assets?.materials??{}).map(([slot,r])=>{
    const material=MATERIAL_ASSETS.find(m=>m.id===r.id)!;
    return {slot,asset:structuredClone(material),sourceRecords:material.sourceMasterIds.map(id=>companyStyleMaster(id).source.recordId),purchaseQuantity:null,materialValidated:false};
  });
  return {schema:'garment-os/asset-handoff/v1',productionApproved:false,remoteSync:'not-performed',
    elementLibraryTarget:{...ELEMENT_LIBRARY.source,snapshotAt:ELEMENT_LIBRARY.syncedAt,status:'candidate-only'},
    existingSnapshotLinks:[`garment-os://pattern/${configuration.activePatternId}`,...(d.assets?.color?[`garment-os://color/${d.color.slice(1).toLowerCase()}`]:[])].map(sourceId=>({sourceId,feishuRecordId:ELEMENT_REGISTRY.find(e=>e.sourceId===sourceId&&!['隔离','弃用'].includes(e.status))?.feishuRecordId??null})),
    company:{draft:d,source:master.source},configuration,
    materialAssignments:assignments,
    managedMaterialAssignments:configuration.managedMaterials??{},
    finish:d.assets?.finish?FINISH_ASSETS.find(f=>f.id===d.assets!.finish!.id):null,
    cad:{companyLinked:linked,unit:'mm',status:draft.status,
      // Only explicit same-template application may claim company linkage.
      sourceCuts:draft.status==='reference'?draft.paths.filter(p=>p.layer==='seam-line').map(p=>({pieceId:p.pieceId,pieceName:p.pieceName,role:p.pieceRole,materialRole:p.materialRole,quantity:p.cutQty??null,onFold:p.cutOnFold??null})):[],
      manufacturingApproved:false},
    pending:['原稿比例不是同款毫米净样。','面料门幅、单位面积克重、伸缩、缩水及实物色卡待确认。','实际排料、用量、损耗与工厂工序待确认。',...(!linked?['公司设计稿尚未关联当前裁片，不能作为同款BOM。']:[])],
  };
}
