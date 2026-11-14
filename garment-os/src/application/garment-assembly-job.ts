import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import type { PatternMesh3d } from '@/types/pattern3d';
import type { GarmentAssembly3d } from '@/types/garment3d';
export interface GarmentJob{requestId:number;revision:string;model:PatternMesh3d}
export type GarmentReply={requestId:number;revision:string;model:GarmentAssembly3d;durationMs:number;error?:never}|{requestId:number;revision:string;error:string};
export function runGarmentJob(job:GarmentJob):GarmentReply{
  const start=performance.now();try{return {requestId:job.requestId,revision:job.revision,model:assembleGarment(job.model),durationMs:performance.now()-start};}
  catch(error){return {requestId:job.requestId,revision:job.revision,error:error instanceof Error?error.message:String(error)};}
}
