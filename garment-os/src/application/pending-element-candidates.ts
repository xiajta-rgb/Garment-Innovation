import {foundationParameters,PANTS_PATTERN_ID,PANTS_MEASUREMENT_FIELDS} from '@/data/foundationMethods';
import {FOUNDATION_MODULES} from '@/data/foundationModules';
import { PENDING_PATTERN_IDS } from '@/data/pendingElementRegistrations';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { SKIRT_PATTERN_ID,SKIRT_PARAMETERS,SKIRT_MEASUREMENT_FIELDS } from '@/data/skirtMethods';
import { requireSourcePieceRole } from '@/data/pieceRoleBindings';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';

/** Metadata proposal only: no live Feishu read, mutation or invented record ID. */
export function createPendingElementCandidates(){
  const measurements=getReferenceMeasurements('male','M');
  return {schema:'garment-os/element-candidates/v1',localOnly:true,remoteWritten:false,productionApproved:false,
    componentContracts:FOUNDATION_MODULES,
    methods:PENDING_PATTERN_IDS.map(id=>{
      const draft=draftStandard(id,measurements),sourceId=`garment-os://pattern/${id}`;
      return {sourceId,feishuRecordId:null,name:PATTERN_LIBRARY[id].name,domain:'服装造型域',type:'服装模板',engine:draft.engine,sourceVersion:'4.10.2',license:'MIT',status:'参考待验收',
        taxonomyVersion:PIECE_TAXONOMY_VERSION,parameters:id===SKIRT_PATTERN_ID?SKIRT_PARAMETERS:foundationParameters(id)??KNIT_PARAMETERS[id],
        measurementDefinitions:id===PANTS_PATTERN_ID?PANTS_MEASUREMENT_FIELDS:id===SKIRT_PATTERN_ID?SKIRT_MEASUREMENT_FIELDS:null,
        limitations:PATTERN_REVIEWS[id].limitations,
        componentSourceIds:draft.pieces.map(p=>`garment-os://block/${p.id}`),
        components:draft.pieces.map(p=>{const b=requireSourcePieceRole(p.id);return {sourceId:`garment-os://block/${p.id}`,feishuRecordId:null,name:p.name,domain:'服装造型域',type:'结构部件模板',
          sourcePieceId:p.id,role:b.role,family:b.definition.family,material:b.material,quantity:p.qty,onFold:p.onFold,cutMode:b.cutMode??'source-sa',unit:'mm',engine:draft.engine,sourceVersion:'4.10.2',
          methodSourceId:sourceId,exactSource:`@freesewing/${draft.engine}@4.10.2`,status:'参考待验收',productionApproved:false};}),
      };
    })};
}
