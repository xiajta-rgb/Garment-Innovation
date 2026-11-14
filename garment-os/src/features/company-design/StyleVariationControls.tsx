import { DEFAULT_STYLE_VARIATION,STYLE_VARIATION_LABELS,STYLE_VARIATION_OPTIONS,STYLE_VARIATION_PRESETS } from '@/data/styleVariations';
import { styleVariation } from '@/lib/pattern/style-variation';
import type { CompanyStyleDraft } from '@/types/company-style';
import type { StyleVariation } from '@/types/style-variation';
export function StyleVariationControls({draft,onChange}:{draft:CompanyStyleDraft;onChange:(patch:Partial<CompanyStyleDraft>)=>void}){
 const current=styleVariation(draft),update=(patch:Partial<StyleVariation>)=>onChange({design:{...current,...patch},cadApplied:false});
 return <section className="company-variations" aria-label="二维设计改款"><h3>设计改款</h3><p className="company-source">各项可叠加，正面、背面和侧面同步更新。</p>
  <div className="company-presets">{STYLE_VARIATION_PRESETS.map(p=><button key={p.id} onClick={()=>update(p.patch)}>{p.name}</button>)}</div>
  <div className="company-variation-grid">{Object.entries(STYLE_VARIATION_OPTIONS).map(([key,options])=><label key={key}>{STYLE_VARIATION_LABELS[key as keyof typeof STYLE_VARIATION_OPTIONS]}<select aria-label={`改款${STYLE_VARIATION_LABELS[key as keyof typeof STYLE_VARIATION_OPTIONS]}`} value={current[key as keyof StyleVariation]} onChange={e=>update({[key]:e.target.value})}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>)}</div>
  <label>拼色颜色<input type="color" aria-label="改款拼色颜色" value={current.accentColor} onChange={e=>update({accentColor:e.target.value})}/></label>
  <button onClick={()=>onChange({design:{...DEFAULT_STYLE_VARIATION},cadApplied:false})}>恢复母版设计</button>
 </section>;
}
