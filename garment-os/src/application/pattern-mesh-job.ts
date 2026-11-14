import { createPattern3d } from './pattern-3d';
import { prepareMeshRenderData } from '@/lib/pattern/mesh/render-data';
import type { DesignConfiguration } from '@/types/design';
import type { PatternMesh3d } from '@/types/pattern3d';
import type { MeshRenderData } from '@/lib/pattern/mesh/render-data';

export interface MeshJob { requestId:number;revision:string;configuration:DesignConfiguration }
export type MeshReply={requestId:number;revision:string;model:PatternMesh3d;renderData:MeshRenderData;durationMs:number;error?:never}|{requestId:number;revision:string;error:string};
export function runMeshJob(job:MeshJob):MeshReply {
  const start=performance.now();
  try {const model=createPattern3d(job.configuration);return {requestId:job.requestId,revision:job.revision,model,renderData:prepareMeshRenderData(model),durationMs:performance.now()-start};}
  catch(error){return {requestId:job.requestId,revision:job.revision,error:error instanceof Error?error.message:String(error)};}
}
