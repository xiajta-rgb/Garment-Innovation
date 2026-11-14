import { useDesignStore } from '@/store/useDesignStore';
import { MATERIAL_SLOT_LABELS } from '@/data/reusableAssets';
import type { MaterialSlot } from '@/types/reusable-assets';
import { materialValue } from '@/application/managed-materials';
import { useState } from 'react';
import type { ManagedMaterial } from '@/types/managed-material';
import { MaterialImagePreview } from './MaterialImage';

export function ManagedMaterialAssignments({composition=false}:{composition?:boolean}){
  const state=useDesignStore(),c=state.pieceComposition,plan=c?.plans.find(p=>p.id===c.activePlanId);
  const materials=composition?plan?.elements?.materials:state.managedMaterials;
  function set(slot:MaterialSlot){
   if(!composition){state.setManagedMaterial(slot,null);return;}
   if(!c||!plan?.elements)return;
   const materials={...plan.elements.materials},images={...plan.elements.materialImages};delete materials[slot];delete images[slot as 'main'];
   const next={...plan,elements:{...plan.elements,materials,materialImages:images}};
   state.setPieceComposition({...c,plans:c.plans.map(p=>p.id===plan.id?next:p)});
  }
  const entries=Object.entries(materials??{});
  return <div data-testid="managed-material-assignments">{entries.length?<ul className="asset-assignments">{entries.map(([slot,a])=><li key={slot}><span>{MATERIAL_SLOT_LABELS[slot as MaterialSlot]} · {a.material.materialName}<small>{a.material.materialCode??a.material.materialId} · {materialValue('ingredients',a.material.ingredients)}</small><small>幅宽 {materialValue('rangeWidth',a.material.rangeWidth)} · 克重 {materialValue('gramWeight',a.material.gramWeight)}（原值）</small><small>选用时状态：{materialValue('status',a.material.status)}；当前状态需重新查询</small></span><button aria-label={`解除中台${MATERIAL_SLOT_LABELS[slot as MaterialSlot]}关联`} onClick={()=>set(slot as MaterialSlot)}>解除</button></li>)}</ul>:<p className="asset-muted">尚未关联面料管理中的面料。</p>}</div>;
}
export function ManagedMaterialSummary({onManage}:{onManage:()=>void}){
  const state=useDesignStore(),c=state.pieceComposition,plan=c?.plans.find(p=>p.id===c.activePlanId);
  const compositionMaterials=plan?.elements?.materials,materials=Object.keys(compositionMaterials??{}).length?compositionMaterials:state.managedMaterials,main=materials?.main,entries=Object.values(materials??{});
  const [preview,setPreview]=useState<ManagedMaterial|null>(null);
  if(!entries.length)return null;
  return <div className="workbench-material-summary" data-testid="workbench-material-summary"><span>{materials===compositionMaterials?`组合方案 ${plan?.name}`:'原始裁片'}面料 · {main?.material.materialCode??entries[0].material.materialCode} {main?.material.materialName??entries[0].material.materialName}{entries.length>1?` · ${entries.length}个部位`:''}</span><div className="workbench-material-images">{Object.entries(materials??{}).filter(([,a])=>a.material.materialPic).map(([slot,a])=><button key={slot} onClick={()=>setPreview(a.material)}>{MATERIAL_SLOT_LABELS[slot as MaterialSlot]}图片</button>)}</div><button onClick={onManage}>管理面料</button>{preview&&<MaterialImagePreview key={preview.materialId} material={preview} onClose={()=>setPreview(null)}/>}</div>;
}
