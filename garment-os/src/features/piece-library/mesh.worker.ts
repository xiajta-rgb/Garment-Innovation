import { runMeshJob } from '@/application/pattern-mesh-job';
import type { MeshJob } from '@/application/pattern-mesh-job';

self.onmessage=(event:MessageEvent<MeshJob>)=>{
  const reply=runMeshJob(event.data);
  const transfer='renderData' in reply?reply.renderData.geometries.flatMap(g=>[g.positions.buffer,g.indices.buffer]):[];
  self.postMessage(reply,{transfer:transfer as ArrayBuffer[]});
};
