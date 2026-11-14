import { useState } from 'react';
import { DesignerStudyControls } from './DesignerStudyControls';
import { REDESIGN_AXES, REDESIGN_AXIS_LABELS, REDESIGN_BATCH_OPTIONS } from '@/data/redesignBatchAxes';
import { batchPackage, readBatchRequest, emptyBatchRequest, generateRedesignBatch, importBatchSelection, suggestBatchRequest } from '@/application/redesign-batch';
import { planSignature } from '@/application/redesign-workflow';
import { downloadText } from '@/features/files/browser-files';
import { CompositionCanvas } from './CompositionCanvas';
import type { CompositionPlan, CompositionSource, CompositionView, PieceComposition } from '@/types/piece-composition';
import type { RedesignBatchRequest, RedesignBatchResult } from '@/types/redesign-batch';
import './redesign-methods.css';

interface Props {plan:CompositionPlan;plans:CompositionPlan[];source:CompositionSource;onCreatePlans:(plans:CompositionPlan[])=>void;onReferences?:()=>void}
export function RedesignBatchControls({plan,plans,source,onCreatePlans,onReferences}:Props){
 const [request,setRequest]=useState<RedesignBatchRequest>(()=>emptyBatchRequest()),[result,setResult]=useState<RedesignBatchResult>(),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[page,setPage]=useState(0),[view,setView]=useState<CompositionView>('front');
 const [json,setJson]=useState('');
 const patch=(v:Partial<RedesignBatchRequest>)=>{setRequest({...request,...v});setError('');};
 const stale=!!result&&planSignature(plan)!==result.baseSignature,edited=!!result&&JSON.stringify(request)!==JSON.stringify(result.request);
 function generate(){try{const next=generateRedesignBatch(request,plan,source,()=>crypto.randomUUID());setResult(next);setSelected([]);setPage(0);setError(next.candidates.length?'':'没有可执行的差异方案，请查看排除原因或增加可变化选项');}catch(e){setError(e instanceof Error?e.message:String(e));}}
 function add(){if(!result)return;try{if(edited)throw Error('选项已修改，请重新生成');const current:PieceComposition={schema:'garment-os/piece-composition-editor/v1',activePlanId:plan.id,plans};const next=importBatchSelection(current,result,selected);onCreatePlans(next.plans.slice(plans.length));}catch(e){setError(e instanceof Error?e.message:String(e));}}
 if(source.templateId==='elastic-waist-pants')return <div className="redesign-batch redesign-methods" data-testid="redesign-batch">
  <DesignerStudyControls plan={plan} plans={plans} templateId={source.templateId} onCreatePlans={onCreatePlans}/>
  <section className="redesign-preview" data-testid="pants-batch-boundary"><strong>男裤矩阵边界</strong><p>本轮先用三条真实可运行的结构方向做审查：标准直筒、宽腿九分、微锥加长。前后裤片、腰头和正背侧位置固定，选款后可继续在设计台调整腰头完成高与裤长参数。</p><ul><li>已接通：Paco 前裤片、后裤片、连裁松紧腰头、13项下身测量。</li><li>待补素材：斜插袋、后嵌线袋、工装立体袋、腰袢、门襟、结构膝片及同源完成态装配。</li></ul><small>袋型与门襟未补齐前，不把图片或通用短T裁片当作男裤裁片。</small></section>
 </div>;
 return <div className="redesign-batch redesign-methods" data-testid="redesign-batch">
  <DesignerStudyControls plan={plan} plans={plans} templateId={source.templateId} onCreatePlans={onCreatePlans}/>
  <p>以当前短T为基款，保留原款和Logo，按选定部位组合。先生成候选，再选款加入设计台。</p>
  <label>改款想法<textarea aria-label="批量改款想法" maxLength={2000} value={request.brief} placeholder="例如：插肩袖、V领、华夫格、胸贴袋，做一组休闲短T" onChange={e=>patch({brief:e.target.value})}/></label>
  <div className="redesign-batch-actions"><button onClick={()=>{setRequest(suggestBatchRequest(request.brief));setError('');}}>识别素材关键词</button><button onClick={onReferences}>查看逐篇阅读与素材缺口</button></div>
  <div className="redesign-batch-axes">{REDESIGN_AXES.map(axis=><fieldset key={axis}><legend>{REDESIGN_AXIS_LABELS[axis]}</legend><label><input type="checkbox" aria-label={`锁定${REDESIGN_AXIS_LABELS[axis]}`} checked={request.locks.includes(axis)} onChange={e=>patch({locks:e.target.checked?[...request.locks,axis]:request.locks.filter(a=>a!==axis),choices:{...request.choices,[axis]:['keep']}})}/>锁定当前</label><div>{REDESIGN_BATCH_OPTIONS[axis].map(o=><label key={o.id}><input type="checkbox" aria-label={`矩阵选项${o.name}`} checked={request.choices[axis].includes(o.id)} disabled={request.locks.includes(axis)} onChange={e=>patch({choices:{...request.choices,[axis]:e.target.checked?[...request.choices[axis],o.id]:request.choices[axis].filter(id=>id!==o.id)}})}/>{o.name}</label>)}</div></fieldset>)}</div>
  <div className="composition-craft-fields"><label>每款最多变化维度<select aria-label="最多变化维度" value={request.maxChangedAxes} onChange={e=>patch({maxChangedAxes:Number(e.target.value)})}>{[1,2,3,4,5,6,7].map(n=><option key={n}>{n}</option>)}</select></label><label>候选上限<select aria-label="候选上限" value={request.maxCandidates} onChange={e=>patch({maxCandidates:Number(e.target.value)})}>{[12,24,48].map(n=><option key={n}>{n}</option>)}</select></label><label>撞色<input aria-label="矩阵撞色" type="color" value={request.accentColor} onChange={e=>patch({accentColor:e.target.value})}/></label></div>
  {request.pendingRequirements.length>0&&<div className="redesign-preview" role="status"><strong>需核对或待补</strong><ul>{request.pendingRequirements.map(s=><li key={s}>{s}</li>)}</ul><label><input type="checkbox" aria-label="仅生成可执行部分" checked={request.allowPartial} onChange={e=>patch({allowPartial:e.target.checked})}/>我已核对选项，仅生成已接通部分；其余要求随方案保留</label></div>}
  <details><summary>载入Agent请求</summary><p>Agent会完整拆解想法、保留项和缺口。这里可载入同一份批量请求。</p><textarea aria-label="Agent请求JSON" value={json} onChange={e=>setJson(e.target.value)}/><button onClick={()=>{try{const v=readBatchRequest(JSON.parse(json));setRequest(v);setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}}>载入请求</button></details>
  <button className="piece-primary" data-generate-redesign-batch disabled={!plan.pieces.length} onClick={generate}>生成改款矩阵</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<section className="redesign-batch-results" aria-label="改款矩阵候选"><header><strong>{result.candidates.length}个候选 · 原款保留</strong><span>{result.counts.combinations}个组合：不变{result.counts.unchanged}、超出变化范围{result.counts.overBudget}、冲突{result.counts.conflicting}、重复{result.counts.duplicates}、上限外{result.counts.truncated}</span></header>
   {(stale||edited)&&<p role="status">{stale?'基款已修改':'生成条件已修改'}，请重新生成后选款。</p>}
   <div className="redesign-batch-actions">{(['front','back','side'] as const).map((v,i)=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{['矩阵正面','矩阵背面','矩阵侧面'][i]}</button>)}<button onClick={()=>downloadText(JSON.stringify(batchPackage(result),null,2),'改款矩阵.json','application/json')}>下载矩阵与配套清单</button></div>
   <div className="redesign-batch-grid">{result.candidates.slice(page*6,page*6+6).map(c=><article key={c.id} data-batch-candidate={c.id}><label><input type="checkbox" aria-label={`选款${c.plan.name}`} checked={selected.includes(c.id)} disabled={stale||edited} onChange={e=>setSelected(e.target.checked?[...selected,c.id]:selected.filter(id=>id!==c.id))}/><strong>{c.plan.name}</strong></label><CompositionCanvas plan={c.plan} focusView={view} showGrid={false}/><small>{c.changedAxes.map(a=>REDESIGN_AXIS_LABELS[a]).join(' / ')}</small><details><summary>配套待核验</summary><ul>{c.needs.map(n=><li key={n}>{n}</li>)}</ul></details></article>)}</div>
   <div className="redesign-batch-actions"><button disabled={page===0} onClick={()=>setPage(page-1)}>上一组</button><span>{page+1} / {Math.max(1,Math.ceil(result.candidates.length/6))}</span><button disabled={(page+1)*6>=result.candidates.length} onClick={()=>setPage(page+1)}>下一组</button><button data-import-redesign-batch disabled={stale||edited||!selected.length||selected.length>12-plans.length} onClick={add}>加入设计台（{selected.length}）</button><small>设计台还可加入 {12-plans.length} 款</small></div>
   {!!result.rejected.length&&<details><summary>查看冲突组合（{result.rejected.length}）</summary><ul>{result.rejected.slice(0,30).map((r,i)=><li key={i}>{REDESIGN_AXES.filter(a=>r.options[a]!=='keep').map(a=>REDESIGN_BATCH_OPTIONS[a].find(o=>o.id===r.options[a])?.name).join(' / ')}：{r.reason}</li>)}</ul>{result.rejected.length>30&&<p>完整排除记录见下载清单。</p>}</details>}
  </section>}
 </div>;
}


