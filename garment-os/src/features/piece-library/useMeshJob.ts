import { useEffect,useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import type { MeshReply } from '@/application/pattern-mesh-job';

let sequence=0;
/** Stale results are withdrawn during render; cancelled jobs cannot restore old geometry. */
export function useMeshJob(revision:string,blocked:boolean){
  const [reply,setReply]=useState<MeshReply|null>(null);
  useEffect(()=>{
    if(blocked)return;
    const requestId=++sequence;let active=true,worker:Worker|undefined;
    const fail=(error:string)=>{if(active)setReply({requestId,revision,error});};
    try{
      worker=new Worker(new URL('./mesh.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent<MeshReply>)=>{if(active&&event.data.requestId===requestId&&event.data.revision===revision)setReply(event.data);};
      worker.onerror=()=>fail('后台网格计算不可用，请重新生成。');
      worker.postMessage({requestId,revision,configuration:useDesignStore.getState().getConfiguration()});
    }catch{queueMicrotask(()=>fail('此环境不支持后台网格计算。'));}
    return ()=>{active=false;worker?.terminate();};
  },[revision,blocked]);
  return !blocked&&reply?.revision===revision?reply:null;
}
