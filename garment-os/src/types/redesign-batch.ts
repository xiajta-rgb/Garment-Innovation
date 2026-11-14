import type { CompositionPlan } from './piece-composition';
export type RedesignAxis='neck'|'shoulder'|'fabric'|'pocket'|'finish'|'panel'|'contrast';
export interface RedesignBatchRequest {
 schema:'garment-os/redesign-batch-request/v1';brief:string;
 choices:Record<RedesignAxis,string[]>;locks:RedesignAxis[];
 maxChangedAxes:number;maxCandidates:number;accentColor:string;
 pendingRequirements:string[];allowPartial:boolean;
}
export interface RedesignMatrixOrigin {
 schema:'garment-os/redesign-matrix-origin/v1';batchId:string;basePlanId:string;baseSignature:string;
 brief:string;options:Record<RedesignAxis,string>;changedAxes:RedesignAxis[];
 sourceFileId:string;sourceBlockIds:string[];pendingRequirements:string[];
}
export interface RedesignBatchCandidate {
 id:string;plan:CompositionPlan;options:Record<RedesignAxis,string>;changedAxes:RedesignAxis[];
 tagCodes:string[];needs:string[];
}
export interface RedesignBatchResult {
 schema:'garment-os/redesign-batch/v1';id:string;request:RedesignBatchRequest;base:CompositionPlan;baseSignature:string;
 candidates:RedesignBatchCandidate[];rejected:{options:Record<RedesignAxis,string>;reason:string}[];
 counts:{combinations:number;unchanged:number;overBudget:number;conflicting:number;duplicates:number;eligible:number;truncated:number};
 knowledge:{read:number;indexed:number;complete:boolean};productionApproved:false;
}
