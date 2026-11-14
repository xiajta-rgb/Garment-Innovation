import { createPieceDesign } from '@/application/piece-design';
import type { DesignConfiguration } from '@/types/design';
self.onmessage=(event:MessageEvent<{revision:string;configuration:DesignConfiguration}>)=>{
  const {revision,configuration}=event.data;
  try{self.postMessage({revision,result:createPieceDesign(configuration)});}catch(error){self.postMessage({revision,error:error instanceof Error?error.message:String(error)});}
};
