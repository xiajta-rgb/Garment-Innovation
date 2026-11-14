import { useDesignStore } from '@/store/useDesignStore';
import { emptyPieceComposition } from '@/lib/pattern/piece-composition';
import { DEFAULT_COMPOSITION_ELEMENTS } from '@/lib/pattern/composition-elements';
import { compositionSource,compositionTeeStarter } from '@/application/composition-catalogue';
import type { CompositionFabric } from '@/types/composition-elements';

/** Sidebar appearance controls edit the active composition when that editor is open. */
export function useCompositionAppearance(){
 const state=useDesignStore(),c=state.pieceComposition,p=c?.plans.find(p=>p.id===c.activePlanId);
 function apply(color?:string,fabric?:CompositionFabric){
  const state=useDesignStore.getState(),c=state.pieceComposition??emptyPieceComposition(crypto.randomUUID()),plan=c.plans.find(p=>p.id===c.activePlanId)!;
  const pieces=plan.pieces.length?plan.pieces:compositionTeeStarter(compositionSource(state.getConfiguration(),'t-shirt'),()=>crypto.randomUUID());
  const elements=structuredClone(plan.elements??DEFAULT_COMPOSITION_ELEMENTS);
  if(fabric){elements.fabric=fabric;delete elements.materials?.main;delete elements.materialImages?.main;}
  const next={...plan,pieces:color?pieces.map(p=>({...p,color})):pieces,elements};
  state.setPieceComposition({...c,plans:c.plans.map(p=>p.id===plan.id?next:p)});
 }
 return {color:p?.pieces.find(p=>p.assetKey==='body-front')?.color??state.garmentColor,fabric:p?.elements?.materials?.main?undefined:p?.elements?.fabric??'jersey',setColor:(color:string)=>apply(color),setFabric:(fabric:CompositionFabric)=>apply(undefined,fabric)};
}
