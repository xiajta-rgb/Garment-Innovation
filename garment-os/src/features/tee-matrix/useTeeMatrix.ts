import { useEffect,useRef,useState } from 'react';
import type { DesignConfiguration } from '@/types/design';
import type { PieceDesignResult } from '@/application/piece-design';
type Entry={result?:PieceDesignResult;error?:string};
export function useTeeMatrix(items:{id:string;configuration:DesignConfiguration}[],scale:number){
  const worker=useRef<Worker|null>(null),revision=JSON.stringify({items,scale});
  const [reply,setReply]=useState<{revision:string;entries:Record<string,Entry>}>({revision:'',entries:{}});
  useEffect(()=>{
    const w=new Worker(new URL('./tee-matrix.worker.ts',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=(event:MessageEvent<Entry&{id:string;revision:string}>)=>{
      const {id,revision,...entry}=event.data;
      setReply(prev=>({revision,entries:{...(prev.revision===revision?prev.entries:{}),[id]:entry}}));
    };
    w.onerror=()=>setReply({revision:'worker-error',entries:{}});
    return ()=>{w.terminate();worker.current=null;};
  },[]);
  useEffect(()=>{worker.current?.postMessage({revision,...JSON.parse(revision)});},[revision]);
  return {entries:reply.revision===revision?reply.entries:{},workerError:reply.revision==='worker-error'};
}
