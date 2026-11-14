import { createPieceDesign } from '@/application/piece-design';
import type { DesignConfiguration } from '@/types/design';
import { companyTeeDrawingSvg } from '@/lib/pattern/company-tee-flat';
self.onmessage = (event: MessageEvent<{ revision: string; items: Array<{ id: string; configuration: DesignConfiguration }> }>) => {
  const { revision, items } = event.data;
  const results=items.map(item=>{try{return {...item,result:createPieceDesign(item.configuration),error:undefined};}catch(e){return {...item,result:undefined,error:e instanceof Error?e.message:String(e)};}});
  const scale=Math.min(...results.flatMap(r=>r.result?[r.result.styleDrawing.scale]:[]));
  for (const item of items) {
    try {
      const computed=results.find(r=>r.id===item.id)!;
      if(!computed.result)throw Error(computed.error);
      const result=computed.result;
      self.postMessage({ revision, id: item.id, svg:companyTeeDrawingSvg(result.styleDrawing,result.metadata,scale), specification:result.flatSpecification, pieces: result.pieces.length });
    } catch (e) { self.postMessage({ revision, id: item.id, error: e instanceof Error ? e.message : String(e) }); }
  }
};
