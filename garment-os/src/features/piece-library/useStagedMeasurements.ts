import { useState, type SetStateAction } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import type { BodyMeasurements } from '@/types/measurements';
/** Unapplied generator edits are scoped to the exact source snapshot they started from. */
export function useStagedMeasurements(source: BodyMeasurements) {
  const session=useDesignStore(s=>s.sessionId);
  const [staged,setStaged]=useState<{session:string;base:BodyMeasurements;values:BodyMeasurements}|null>(null);
  const active=staged?.base===source && staged.session===session;
  const measurements=active ? staged.values : source;
  const setMeasurements=(update:SetStateAction<BodyMeasurements>)=>setStaged({session,base:source,values:typeof update==='function'?update(measurements):update});
  return {measurements,setMeasurements,isStaged:active};
}
