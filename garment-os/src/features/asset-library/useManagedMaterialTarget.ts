import { useEffect,useRef,useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { DEFAULT_COMPOSITION_ELEMENTS } from '@/lib/pattern/composition-elements';
import { canAssignMaterial } from '@/application/managed-materials';
import { materialRaster } from '@/features/piece-design/composition-raster';
import type { MaterialSlot } from '@/types/reusable-assets';
import type { ManagedMaterialAssignment } from '@/types/managed-material';

export function useManagedMaterialTarget(){
 const state=useDesignStore(),c=state.pieceComposition,plan=c?.plans.find(p=>p.id===c.activePlanId);
 const [choice,setChoice]=useState<'composition'|'pattern'>(plan?.pieces.length?'composition':'pattern'),[applying,setApplying]=useState(false);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const target=choice==='composition'&&plan?.pieces.length?'composition':'pattern';
 const linked=target==='composition'?plan?.elements?.materials:state.managedMaterials;
 async function assign(slot:MaterialSlot,value:ManagedMaterialAssignment,includePhoto=true){
  if(!canAssignMaterial(value.material))throw Error('只有明确启用的面料可新增关联');
  if(target==='pattern'){state.setManagedMaterial(slot,value);return false;}
  if(!['main','neck','cuff','hem'].includes(slot))throw Error('当前组合方案暂支持主体、领口、袖口与下摆套料');
  const token=++generation.current,session=state.sessionId,planId=plan!.id;setApplying(true);
  try{
   const image=includePhoto&&value.material.materialPic?await materialRaster(value.material):undefined;
   if(token!==generation.current)return false;
   const latest=useDesignStore.getState(),c=latest.pieceComposition,p=c?.plans.find(p=>p.id===planId);
   if(latest.sessionId!==session||c?.activePlanId!==planId||!p)throw Error('方案已切换，本次套料未应用，请重新选择');
   const e=p.elements??structuredClone(DEFAULT_COMPOSITION_ELEMENTS),images={...e.materialImages},key=slot as 'main'|'neck'|'cuff'|'hem';
   if(image)images[key]={...image,materialId:value.material.materialId};else delete images[key];
   const next={...p,elements:{...e,materials:{...e.materials,[slot]:value},materialImages:images,...(slot==='neck'?{neckContrast:true}:slot==='cuff'?{cuffContrast:true}:{})}};
   latest.setPieceComposition({...c,plans:c.plans.map(p=>p.id===planId?next:p)});return !!image;
  }finally{if(token===generation.current)setApplying(false);}
 }
 return {target,setTarget:setChoice,plan,linked,applying,assign};
}
