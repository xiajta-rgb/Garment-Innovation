import { useEffect,useState } from 'react';
import type { DesignConfiguration } from '@/types/design';
import type { PieceDesignResult } from '@/application/piece-design';
type Reply={revision:string;result?:PieceDesignResult;error?:string};
export function usePieceDesign(configuration:DesignConfiguration,enabled=true){
  const revision=JSON.stringify(configuration),[reply,setReply]=useState<Reply>();
  useEffect(()=>{
    if(!enabled)return;
    let current=true;const worker=new Worker(new URL('./piece-design.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=(event:MessageEvent<Reply>)=>{if(current&&event.data.revision===revision)setReply(event.data);};
    worker.onerror=()=>{if(current)setReply({revision,error:'裁片组合计算未完成，请检查尺寸后重试。'});};
    worker.postMessage({revision,configuration:JSON.parse(revision)});
    return ()=>{current=false;worker.terminate();};
  },[revision,enabled]);
  return enabled&&reply?.revision===revision?{...reply,loading:false}:{loading:enabled,result:undefined,error:undefined};
}
