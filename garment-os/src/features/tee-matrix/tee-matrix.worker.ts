import { createPieceDesign } from '@/application/piece-design';
import type { DesignConfiguration } from '@/types/design';
let latest='';
const cache=new Map<string,ReturnType<typeof createPieceDesign>>();
self.onmessage=async(event:MessageEvent<{revision:string;items:{id:string;configuration:DesignConfiguration}[];scale:number}>)=>{
  const {revision,items,scale}=event.data;latest=revision;
  for(const item of items){
    await new Promise(resolve=>setTimeout(resolve,0));if(latest!==revision)return;
    try{
      const key=JSON.stringify([item.configuration,scale]);
      let result=cache.get(key);
      if(!result){result=createPieceDesign(item.configuration,scale);cache.set(key,result);if(cache.size>80)cache.delete(cache.keys().next().value!);}
      self.postMessage({revision,id:item.id,result});
    }catch(error){self.postMessage({revision,id:item.id,error:error instanceof Error?error.message:String(error)});}
  }
};
