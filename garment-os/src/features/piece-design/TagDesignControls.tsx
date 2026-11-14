import { useMemo, useState } from 'react';
import { applyTagDesign, designCapabilityAudit, resolveTagDesign } from '@/application/tag-design';
import { PROFESSIONAL_DESIGN_ASSETS } from '@/data/professionalDesignAssets';
import { COMPANY_CRAFT_REFERENCES } from '@/data/designCapabilities';
import { downloadText } from '@/features/files/browser-files';
import type { CompositionPlan, CompositionSource } from '@/types/piece-composition';
import type { TagDesignRequest } from '@/application/tag-design';

const presets=[
 {name:'亨利领 · 胸贴袋',reference:'L23M973D',tags:['亨利领开口','半开襟','纽扣','贴袋','胸袋']},
 {name:'拉链 Polo · 珠地',reference:'LT25M1354',tags:['Polo领','半开襟','拉链','珠地']},
 {name:'插肩 · 立领半拉链',reference:'AT25M3275',tags:['插肩','立领','半开襟','拉链']},
 {name:'圆领 · 包边撞色',reference:'COT25M002',tags:['圆领','包边','撞色']},
] as const;
function TagPresetThumb({tags}:{tags:readonly string[]}){
 const has=(word:string)=>tags.some(tag=>tag.includes(word));
 return <span className="tag-preset-preview" aria-hidden="true"><svg viewBox="0 0 120 74"><path d="M40 12 24 20 9 36l13 9 8-8v27h60V37l8 8 13-9-15-16-16-8q-20 13-40 0Z" fill="#e8eee6" stroke="#3d5b4a" strokeWidth="1.5"/><path d={has('V领')?'M42 12l18 23 18-23':has('立领')?'M43 12h34v10H43Z':has('Polo')?'M42 12q18 14 36 0v15H42Z':'M42 12q18 20 36 0'} fill="#789477" stroke="#3d5b4a"/><path d={has('插肩')?'M29 14q8 20 31 21 23-1 31-21':has('落肩')?'M30 17 22 28':'M30 14q30 18 60 0'} fill="none" stroke="#789477" strokeWidth="2"/>{has('拉链')&&<path d="M60 14v31" stroke="#3d5b4a" strokeWidth="2"/>}{has('纽扣')&&<path d="M60 18v25m-2-18h4m-4 8h4m-4 8h4" stroke="#fff" strokeWidth="1.5"/>}{has('贴袋')&&<path d="M68 34h17v15H68z" fill="#789477" stroke="#3d5b4a"/>}{has('撞色')&&<path d="M9 36l13 9 8-8v27h7V20l-13 0Z" fill="#b9c99d" opacity=".9"/>}</svg><small>组合结构示意</small></span>;
}
export function TagDesignControls({plan,source,onChange,onError}:{plan:CompositionPlan;source:CompositionSource;onChange:(p:CompositionPlan)=>void;onError:(message:string)=>void}){
 const [input,setInput]=useState(()=>plan.elements?.tagIntent?.codes.join('，')??''),[bindingPart,setBindingPart]=useState<string>(()=>plan.elements?.tagIntent?.bindingPart??''),[colourPart,setColourPart]=useState<string>(()=>plan.elements?.tagIntent?.colourPart??''),[applied,setApplied]=useState('');
 const [finishPart,setFinishPart]=useState<string>(()=>plan.elements?.tagIntent?.finishPart??''),[panelPart,setPanelPart]=useState<string>(()=>plan.elements?.tagIntent?.panelPart??''),[hoodType,setHoodType]=useState<string>(()=>plan.elements?.tagIntent?.hoodType??'');
 const request:TagDesignRequest={tags:input.split(/[,，+\n;；]+/).map(t=>t.trim()).filter(Boolean),bindingPart:bindingPart?bindingPart as TagDesignRequest['bindingPart']:undefined,colourPart:colourPart?colourPart as TagDesignRequest['colourPart']:undefined,finishPart:finishPart?finishPart as TagDesignRequest['finishPart']:undefined,panelPart:panelPart?panelPart as TagDesignRequest['panelPart']:undefined,hoodType:hoodType?hoodType as TagDesignRequest['hoodType']:undefined};
 const result=resolveTagDesign(request,plan.elements),audit=useMemo(()=>designCapabilityAudit(),[]);
 return <div className="composition-tag-design" data-testid="tag-design-controls">
  <h4>标签组合设计</h4><p>输入已有标签词或稳定编码，以逗号分隔；检查匹配素材和缺项后应用到当前三视图。</p>
  <div className="composition-craft-presets">{presets.map(p=><button key={p.name} data-tag-preset={p.reference} onClick={()=>{setInput(p.tags.join('，'));setApplied('');setFinishPart('');setPanelPart('');setHoodType('');setBindingPart(p.reference==='COT25M002'?'neck':'');setColourPart(p.reference==='COT25M002'?'neck':'');}}><TagPresetThumb tags={p.tags}/><strong>{p.name}</strong><small>参照 {p.reference} · 短袖派生</small></button>)}</div>
  <label>设计标签组合<textarea aria-label="设计标签组合" value={input} rows={2} placeholder="例如：插肩，立领，半开襟，拉链" onChange={e=>{setInput(e.target.value);setApplied('');}}/></label>
  <div className="composition-craft-fields">
   <label>包边部位<select aria-label="标签包边部位" value={bindingPart} onChange={e=>setBindingPart(e.target.value)}><option value="">请选择部位</option><option value="neck">领口边缘</option><option value="back-neck">后领内侧</option></select></label>
   <label>罗纹收口部位<select aria-label="标签收口部位" value={finishPart} onChange={e=>setFinishPart(e.target.value)}><option value="">请选择部位</option><option value="cuff">袖口</option><option value="hem">下摆</option></select></label>
   <label>拼片部位<select aria-label="标签拼片部位" value={panelPart} onChange={e=>setPanelPart(e.target.value)}><option value="">请选择分割</option><option value="yoke">弧线育克</option><option value="side">侧身拼片</option></select></label>
   <label>帽体构造<select aria-label="标签帽体构造" value={hoodType} onChange={e=>setHoodType(e.target.value)}><option value="">请选择帽体</option><option value="two-piece">两片帽</option><option value="three-piece">三片帽</option></select></label>
   <label>撞色部位<select aria-label="标签撞色部位" value={colourPart} onChange={e=>setColourPart(e.target.value)}><option value="">请选择部位</option><option value="neck">领口</option><option value="sleeve">袖片</option><option value="cuff">袖口</option></select></label>
  </div>
  {!!request.tags.length&&<div aria-live="polite" className="composition-tag-result">
   {result.matches.map(m=><div key={m.code} className="composition-tag-match"><span className="tag-match-preview"><TagPresetThumb tags={[m.name]}/></span><strong>{m.name}</strong><span>{m.axis} · {m.preview?'已接绘图':'待补素材'}</span><small>{m.code}</small><small>{m.sources.length?m.sources.map(s=>s.replace('garment-os://','')).join(' / '):'配套素材待登记'}</small></div>)}
   {result.assetIds.length>0&&<p data-matched-design-assets>匹配设计素材：{result.assetIds.map(id=>PROFESSIONAL_DESIGN_ASSETS.find(a=>a.id===id)?.name).join('、')}</p>}
   {result.issues.length>0?<ul role="status">{result.issues.map(i=><li key={i}>{i}</li>)}</ul>:<p role="status">可以生成设计三视图；对应毫米裁片尚需完善。</p>}
   {result.warnings.map(w=><p key={w} className="composition-element-help">{w}</p>)}
   {result.matches.some(m=>m.missing.length>0)&&<details><summary>本次组合还缺哪些裁片与工艺</summary><ul>{[...new Set(result.matches.flatMap(m=>m.missing))].map(m=><li key={m}>{m}</li>)}</ul></details>}
  </div>}
  <div className="composition-tag-actions"><button data-apply-tag-design disabled={!result.previewReady} onClick={()=>{try{onChange(applyTagDesign(result,plan,source,()=>crypto.randomUUID()));setApplied('已应用标签组合，三视图已更新');onError('');}catch(e){onError(String(e));}}}>应用标签组合</button><button onClick={()=>downloadText(JSON.stringify({request,result,audit},null,2),'标签与素材配套检查.json','application/json')}>下载配套检查</button></div>
  {applied&&<p role="status">{applied}</p>}
  <details className="composition-capability-audit"><summary>标签与素材待完善清单 · {audit.capabilities.length} 类</summary><p>{audit.tagCount} 个字典标签，已接通 {audit.localDesignAssets.length} 项本地设计素材；企业镜像有 {audit.assetCount} 项元素素材；满足“可用＋标签已核验＋正式编码与版本”的素材 {audit.verifiedTaggedAssets} 项。此处匹配为本地绘图规则，尚未冒充正式素材审核。</p>
   <div className="composition-audit-scroll"><table><thead><tr><th>类型 / 标签</th><th>当前素材</th><th>需要完善</th></tr></thead><tbody>{audit.capabilities.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.priority} · {c.preview?'可做设计表达':'绘图待补'}</small><small>{c.tags.map(t=>t?.name).join(' / ')||'标签待确认'}</small></td><td>{c.localAssets.length>0&&<p>设计可选：{c.localAssets.map(a=>a.name).join('、')}</p>}{c.assets.length?c.assets.map(a=><p key={a.sourceId}>{a.sourceId.replace('garment-os://','')}<small>{a.status} · {a.labelStatus}</small></p>):'配套素材待登记'}<small>毫米配套待核对</small></td><td><ul>{c.needs.map(n=><li key={n}>{n}</li>)}</ul></td></tr>)}</tbody></table></div>
  </details>
  <details><summary>对照公司工艺稿</summary><div className="composition-company-craft-refs">{COMPANY_CRAFT_REFERENCES.map(r=><figure key={r.code}><a href={`/company-reference/craft-${r.code}.webp`} target="_blank" rel="noreferrer"><img src={`/company-reference/craft-${r.code}.webp`} alt={`${r.code} 公司设计稿`} loading="lazy"/></a><figcaption>{r.code} · {r.description}</figcaption></figure>)}</div></details>
 </div>;
}
