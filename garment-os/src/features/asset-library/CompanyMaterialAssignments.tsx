import { MATERIAL_ASSETS,MATERIAL_SLOT_LABELS } from '@/data/reusableAssets';
import { materialComposition,removeMaterialAsset } from '@/lib/pattern/reusable-assets';
import { useDesignStore } from '@/store/useDesignStore';
import type { MaterialSlot } from '@/types/reusable-assets';

export function CompanyMaterialAssignments(){
  const d=useDesignStore(s=>s.companyDraft),set=useDesignStore(s=>s.setCompanyDraft);
  const entries=Object.entries(d?.assets?.materials??{});
  if(!d||!entries.length)return <p className="asset-muted">尚未选用结构化面料资产。</p>;
  return <ul className="asset-assignments">{entries.map(([slot,r])=>{const m=MATERIAL_ASSETS.find(m=>m.id===r.id)!;return <li key={slot}><span>{MATERIAL_SLOT_LABELS[slot as MaterialSlot]} · {m.name}<small>{materialComposition(m)||'成分待确认'} · {m.weightLabel||'克重待确认'}</small></span><button aria-label={`解除${MATERIAL_SLOT_LABELS[slot as MaterialSlot]}关联`} onClick={()=>set(removeMaterialAsset(d,slot as MaterialSlot))}>解除</button></li>;})}</ul>;
}
