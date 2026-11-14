import { downloadText } from '@/features/files/browser-files';
import { exportGarmentFinishCad } from '@/lib/pattern/mesh/garment-finish-plan';
import type { GarmentFinishPlan,GarmentFinishSettings } from '@/types/garment3d';
const inputs=[['neckWidthMm','罗纹领成品宽 mm',8,35,.5],['neckRatio','领条净长比例',.75,1,.01],['seamAllowanceMm','领条缝份 mm',3,12,.5],['bodyHemMm','下摆折深 mm',10,50,1],['sleeveHemMm','袖口折深 mm',10,40,1],['needleGaugeMm','双针间距 mm',2,6,.5],['stitchPitchMm','线迹针距 mm',2,5,.5]] as const;
export function GarmentFinishControls({templateId,plan,onChange}:{templateId:string;plan:GarmentFinishPlan;onChange:(next:GarmentFinishSettings)=>void}){
  return <section className="mesh-inspector-section"><h4>领口、袖口与下摆工艺</h4>
    <label><input aria-label="显示成衣工艺" type="checkbox" checked={plan.settings.enabled} onChange={e=>onChange({...plan.settings,enabled:e.target.checked})}/>显示领条、内折层与车缝</label>
    <p>{plan.neckband?'圆领针织工艺示例；领条缩率尚需材料伸长与回复测试。':'当前衣身折边与车缝示例；领口及袖窿包条尚未组装。'}下列值为可编辑设计设定。</p>
    {inputs.filter(([key])=>!(['neckWidthMm','neckRatio','seamAllowanceMm'].includes(key)&&!plan.neckband)&&!(key==='sleeveHemMm'&&!plan.hems.some(h=>h.openingId.startsWith('sleeve')))).map(([key,label,min,max,step])=><label key={key} className="mesh-field">{label}<input aria-label={label} disabled={!plan.settings.enabled} type="number" min={min} max={max} step={step} key={`${key}:${plan.settings[key]}`} defaultValue={plan.settings[key]} onBlur={e=>{const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)&&n>=min&&n<=max)onChange({...plan.settings,[key]:n});else e.currentTarget.value=String(plan.settings[key]);}}/></label>)}
    <p data-testid="garment-finish-summary">{plan.operations.length} 项工艺 · {plan.neckband?'罗纹领条 + ':''}{plan.hems.length} 处折边{plan.operations.some(o=>o.id.startsWith('cap'))?' · 装袖接缝':''}{plan.hems.length?' · 双针线迹':''}</p>
    {plan.neckband&&<><small>领条裁剪 {plan.neckband.cutLengthMm.toFixed(1)} × {plan.neckband.cutWidthMm.toFixed(1)} mm，1片；装领净圈 {plan.neckband.netLengthMm.toFixed(1)} mm，后中闭合、四等分配接。</small><button onClick={()=>downloadText(exportGarmentFinishCad(plan),`${templateId}-领条裁片草案.svg`,'image/svg+xml')}>导出领条裁片草案</button></>}
    <button onClick={()=>downloadText(JSON.stringify({schema:'garment-os/finish-draft/v1',templateId,assetStatus:'design-example',plan,bomDraft:plan.neckband?[{piece:plan.neckband.id,materialRole:'ribbing',materialId:null,quantity:1,cutLengthMm:plan.neckband.cutLengthMm,cutWidthMm:plan.neckband.cutWidthMm}]:[],productionApproved:false},null,2),`${templateId}-成衣工艺草案.json`,'application/json')}>导出工艺与用料草案</button>
  </section>;
}
