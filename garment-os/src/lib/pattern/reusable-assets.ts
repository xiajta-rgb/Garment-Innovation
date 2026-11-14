import { COLOR_ASSETS,FINISH_ASSETS,MATERIAL_ASSETS } from '@/data/reusableAssets';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import type { AssetRef,CompanyAssetLinks,MaterialAsset,MaterialSlot } from '@/types/reusable-assets';
import type { CompanyStyleDraft } from '@/types/company-style';

export const materialComposition=(m:MaterialAsset)=>m.composition?.map(c=>`${c.fiber}${c.percent}%`).join(' / ')??'';
export function materialSlotAvailable(d:CompanyStyleDraft,slot:MaterialSlot){
  const kind=companyStyleMaster(d.masterId).kind;
  return slot==='main'||slot==='neck'&&kind!=='pullover-hoodie'||(slot==='cuff'||slot==='hem')&&(kind==='crew-sweatshirt'||kind==='pullover-hoodie');
}
export function compatibleMaterial(d:CompanyStyleDraft,m:MaterialAsset,slot:MaterialSlot){
  return materialSlotAvailable(d,slot)&&m.slots.includes(slot)&&m.kinds.includes(companyStyleMaster(d.masterId).kind);
}
const ref=(a:AssetRef):AssetRef=>({id:a.id,revision:a.revision});
function readRef(value:unknown,list:readonly AssetRef[]):AssetRef{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('资产引用无效');
  const v=value as AssetRef,a=list.find(x=>x.id===v.id&&x.revision===v.revision);
  if(!a||Object.keys(v).some(k=>k!=='id'&&k!=='revision'))throw Error('资产不存在或版本不兼容');return ref(a);
}
export function readAssetLinks(value:unknown,d:CompanyStyleDraft):CompanyAssetLinks|undefined{
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('资产关联格式无效');
  const input=value as CompanyAssetLinks;
  if(Object.keys(input).some(k=>!['materials','color','finish'].includes(k))||!input.materials||typeof input.materials!=='object'||Array.isArray(input.materials))throw Error('资产关联字段无效');
  const links:CompanyAssetLinks={materials:{}};
  for(const [key,v] of Object.entries(input.materials)){
    if(!['main','neck','cuff','hem'].includes(key))throw Error('未声明的用料部位');
    const r=readRef(v,MATERIAL_ASSETS),m=MATERIAL_ASSETS.find(m=>m.id===r.id)!;
    if(!compatibleMaterial(d,m,key as MaterialSlot))throw Error('材料与当前母版或用料部位不兼容');
    links.materials[key as MaterialSlot]=r;
  }
  if(input.color!==undefined)links.color=readRef(input.color,COLOR_ASSETS);
  if(input.finish!==undefined){
    links.finish=readRef(input.finish,FINISH_ASSETS);
    if(!FINISH_ASSETS.find(f=>f.id===links.finish!.id)!.masterIds.includes(d.masterId))throw Error('工艺方案与当前母版不兼容');
  }
  return links;
}
/** Manual changes detach only the stale link; independent trims remain assigned. */
export function reconcileCompanyAssets(d:CompanyStyleDraft):CompanyStyleDraft{
  if(!d.assets)return d;
  const links:CompanyAssetLinks=structuredClone(d.assets),main=MATERIAL_ASSETS.find(m=>m.id===links.materials.main?.id);
  if(main&&(d.fabric!==main.name||d.composition!==materialComposition(main)||d.weight!==(main.weightLabel??'')))delete links.materials.main;
  const color=COLOR_ASSETS.find(c=>c.id===links.color?.id);if(color&&color.hex.toLowerCase()!==d.color.toLowerCase())delete links.color;
  const finish=FINISH_ASSETS.find(f=>f.id===links.finish?.id);if(finish&&Object.keys(finish.settings).some(k=>finish.settings[k as keyof typeof finish.settings]!==d.finish[k as keyof typeof finish.settings]))delete links.finish;
  return {...d,assets:links};
}
export function assertLinkedFields(d:CompanyStyleDraft){
  if(JSON.stringify(reconcileCompanyAssets(d).assets)!==JSON.stringify(d.assets))throw Error('资产引用与当前自定义字段不一致');
}
export function applyMaterialAsset(d:CompanyStyleDraft,id:string,slot:MaterialSlot):CompanyStyleDraft{
  const m=MATERIAL_ASSETS.find(m=>m.id===id);if(!m||!compatibleMaterial(d,m,slot))throw Error('该面料不能用于当前母版的此部位');
  return {...d,...(slot==='main'?{fabric:m.name,composition:materialComposition(m),weight:m.weightLabel??''}:{}),
    assets:{...d.assets,materials:{...d.assets?.materials,[slot]:ref(m)}}};
}
export function removeMaterialAsset(d:CompanyStyleDraft,slot:MaterialSlot):CompanyStyleDraft{
  const materials={...d.assets?.materials};delete materials[slot];return {...d,assets:{...d.assets,materials}};
}
export function applyFinishAsset(d:CompanyStyleDraft,id:string):CompanyStyleDraft{
  const f=FINISH_ASSETS.find(f=>f.id===id);if(!f||!f.masterIds.includes(d.masterId))throw Error('该工艺方案与当前公司母版不兼容');
  return {...d,finish:{...f.settings},assets:{...d.assets,materials:{...d.assets?.materials},finish:ref(f)}};
}
export function applyColorAsset(d:CompanyStyleDraft,id:string):CompanyStyleDraft{
  const c=COLOR_ASSETS.find(c=>c.id===id);if(!c)throw Error('配色不存在');
  return {...d,color:c.hex,assets:{...d.assets,materials:{...d.assets?.materials},color:ref(c)}};
}
