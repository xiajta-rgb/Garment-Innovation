import { REDESIGN_AXES, batchOption } from '@/data/redesignBatchAxes';
import { REDESIGN_METHODS, REDESIGN_SOURCE } from '@/data/redesignMethods';
import type { RedesignAxis, RedesignMatrixOrigin } from '@/types/redesign-batch';
export function readRedesignMatrixOrigin(input:unknown):RedesignMatrixOrigin {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('矩阵来源格式无效');
 const v=input as Record<string,unknown>;
 const text=(s:unknown,max=160)=>{if(typeof s!=='string'||!s.trim()||s.length>max)throw Error('矩阵来源文字无效');return s;};
 if(v.schema!=='garment-os/redesign-matrix-origin/v1'||v.sourceFileId!==REDESIGN_SOURCE.fileId)throw Error('矩阵来源不匹配');
 const o=v.options as Record<string,unknown>;if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==REDESIGN_AXES.length)throw Error('矩阵选项不完整');
 const options=Object.fromEntries(REDESIGN_AXES.map(a=>{const id=text(o[a]);if(!batchOption(a,id))throw Error('矩阵选项不存在');return [a,id];})) as Record<RedesignAxis,string>;
 if(!Array.isArray(v.changedAxes)||!v.changedAxes.length||new Set(v.changedAxes).size!==v.changedAxes.length||v.changedAxes.some(a=>!REDESIGN_AXES.includes(a)))throw Error('矩阵差异维度无效');
 if(!Array.isArray(v.sourceBlockIds)||!v.sourceBlockIds.length||v.sourceBlockIds.some(b=>!REDESIGN_METHODS.some(m=>m.sourceBlockId===b&&m.implemented)))throw Error('矩阵方法来源无效');
 if(!Array.isArray(v.pendingRequirements)||v.pendingRequirements.length>30)throw Error('矩阵待办格式无效');
 return {schema:'garment-os/redesign-matrix-origin/v1',batchId:text(v.batchId),basePlanId:text(v.basePlanId),baseSignature:text(v.baseSignature),brief:text(v.brief,2000),options,changedAxes:v.changedAxes as RedesignAxis[],sourceFileId:REDESIGN_SOURCE.fileId,sourceBlockIds:v.sourceBlockIds.map(b=>text(b)),pendingRequirements:v.pendingRequirements.map(s=>text(s,200))};
}
