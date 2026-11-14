import { useState } from 'react';
import { REDESIGN_METHODS, REDESIGN_SOURCE } from '@/data/redesignMethods';
import { createRedesign, GRAPHIC_TECHNIQUES, planSignature, redesignAssetChoices } from '@/application/redesign-workflow';
import type { RedesignRequest } from '@/application/redesign-workflow';
import type { CompositionPlan, CompositionSource } from '@/types/piece-composition';
import type { RedesignMethodId } from '@/types/redesign-method';
import './redesign-methods.css';

export function RedesignOriginNote({plan,plans}:{plan:CompositionPlan;plans:CompositionPlan[]}){
 const matrix=plan.matrix;
 if(matrix){const base=plans.find(p=>p.id===matrix.basePlanId);return <details className="redesign-origin"><summary>批量改款记录</summary><p>{!base?'原方案已删除':planSignature(base)!==matrix.baseSignature?'原方案已修改，当前比对基准与创建时不同':`原方案：${base.name} · 内容与创建时一致`}</p><p>设计想法：{matrix.brief}</p><p>后续手动编辑以当前图为准，批量记录保留创建时的选项。</p>{matrix.pendingRequirements.map(s=><p key={s}>{s}</p>)}<a href={REDESIGN_SOURCE.url} target="_blank" rel="noreferrer">查看方法原文</a></details>;}
 const r=plan.redesign;if(!r)return null;
 const base=plans.find(p=>p.id===r.basePlanId),method=REDESIGN_METHODS.find(m=>m.id===r.methodId);
 return <details className="redesign-origin"><summary>改款记录 · {method?.name}</summary><p>{!base?'原方案已删除':planSignature(base)!==r.baseSignature?'原方案已修改，当前比对基准与创建时不同':`原方案：${base.name} · 内容与创建时一致`}</p><p>创建时改变：{r.changed.join('；')}</p><p>创建时保留：{r.preserved.join('；')}</p><p>后续手动编辑以当前图为准。</p><a href={REDESIGN_SOURCE.url} target="_blank" rel="noreferrer">查看方法原文</a></details>;
}

export function RedesignMethodControls({plan,plans,source,onCreatePlan,onReferences}:{onReferences?:()=>void;plan:CompositionPlan;plans:CompositionPlan[];source:CompositionSource;onCreatePlan:(p:CompositionPlan)=>void}){
 const [request,setRequest]=useState<RedesignRequest>({methodId:'replacement'});
 const method=REDESIGN_METHODS.find(m=>m.id===request.methodId)!;
 const patch=(p:Partial<RedesignRequest>)=>setRequest({...request,...p});
 const choices=redesignAssetChoices(method.id),graphics=plan.elements?.graphics??[];
 const donors=plans.filter(p=>p.id!==plan.id&&p.pieces.length&&p.pieces.every(piece=>piece.source.templateId==='t-shirt'));
 const requestWithDonor={...request,donor:plans.find(p=>p.id===request.donor?.id)};
 let preview:CompositionPlan|undefined,reason='';let counter=0;
 try{preview=createRedesign(requestWithDonor,plan,source,()=>`preview-${++counter}`);}catch(error){reason=error instanceof Error?error.message:String(error);}
 const chooseMethod=(id:RedesignMethodId)=>setRequest({methodId:id});
 return <div className="redesign-methods" data-testid="redesign-methods">
  <p className="composition-element-help">以当前方案为主款，每次明确一个主要变化。创建后保留原款，可在上方并排比对。</p>
  <div className="composition-craft-fields"><label>改款方法<select aria-label="改款方法" value={method.id} onChange={event=>chooseMethod(event.target.value as RedesignMethodId)}>{(['迁移','重组','生长','加减'] as const).map(group=><optgroup key={group} label={group}>{REDESIGN_METHODS.filter(m=>m.group===group).map(m=><option key={m.id} value={m.id}>{m.name}{!m.implemented?' · 待接通品类':''}</option>)}</optgroup>)}</select></label>
   {choices.length>0&&<label>目标素材<select aria-label="改款目标素材" value={request.assetId??''} onChange={event=>patch({assetId:event.target.value})}><option value="">请选择素材</option>{choices.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
   {['detail-transfer','detail-extension','change-form','reduce-pattern'].includes(method.id)&&<label>指定图形<select aria-label="改款指定图形" value={request.graphicId??''} onChange={event=>patch({graphicId:event.target.value})}><option value="">请选择已有图形</option>{graphics.map((g,i)=><option key={g.id} value={g.id}>{i+1}. {g.text} · {g.view==='front'?'正面':g.view==='back'?'背面':'侧面'}</option>)}</select></label>}
   {['detail-transfer','detail-extension'].includes(method.id)&&<label>目标部位<select aria-label="改款目标视图" value={request.targetView??''} onChange={event=>patch({targetView:event.target.value as 'front'|'back'})}><option value="">请选择不同视图</option><option value="front">正面</option><option value="back">背面</option></select></label>}
   {method.id==='style-combination'&&<><label>部件来源方案<select aria-label="改款来源方案" value={request.donor?.id??''} onChange={event=>patch({donor:donors.find(p=>p.id===event.target.value)})}><option value="">请选择另一短T方案</option>{donors.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>借用部件<select aria-label="改款借用部件" value={request.donorPart??''} onChange={event=>patch({donorPart:event.target.value as 'neck'|'shoulder'})}><option value="">请选择部件</option><option value="neck">领口 / 开合组合</option><option value="shoulder">肩袖构型</option></select></label></>}
   {method.id==='change-form'&&<label>加工工艺意向<select aria-label="改款加工工艺" value={request.technique??''} onChange={event=>patch({technique:event.target.value as RedesignRequest['technique']})}><option value="">请选择工艺</option>{GRAPHIC_TECHNIQUES.filter(([id])=>id!=='artwork').map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
   {method.id==='remove-part'&&<label>移除部位<select aria-label="改款移除部位" value={request.removeId??''} onChange={event=>patch({removeId:event.target.value})}><option value="">请选择已有部位</option>{plan.pieces.filter(p=>p.assetKey.includes('pocket')).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{plan.elements?.details?.hood&&plan.elements.details.hood!=='none'&&<option value="hood">帽体及帽口绳组件</option>}{plan.elements?.details?.panel&&plan.elements.details.panel!=='none'&&<option value="panel">衣身分割拼片</option>}</select></label>}
   {method.id==='reduce-decoration'&&<label>减少装饰<select aria-label="改款装饰处理" value={request.decoration??''} onChange={event=>patch({decoration:event.target.value as 'contrast'|'piping'})}><option value="">请选择处理</option><option value="contrast">关闭领 / 袖 / 袖口撞色</option><option value="piping">去除拼缝嵌边</option></select></label>}
   {method.id==='reduce-pattern'&&<label>图形处理<select aria-label="改款图形处理" value={request.patternAction??''} onChange={event=>patch({patternAction:event.target.value as 'shrink'|'remove'})}><option value="">请选择处理</option><option value="shrink">等比缩至65%</option><option value="remove">移除指定图形</option></select></label>}
  </div>
  <p>{method.summary}</p><p className="composition-element-help">当前可用范围：{method.scope}</p>
  {preview?<div className="redesign-preview" data-testid="redesign-preview"><p><strong>改变：</strong>{preview.redesign!.changed.join('；')}</p><p><strong>保留：</strong>{preview.redesign!.preserved.join('；')}</p><details><summary>设计与配套注意事项</summary>{preview.redesign!.notes.map((n,i)=><p key={i}>{n}</p>)}</details></div>:<p role="status">{reason}</p>}
  <button className="piece-primary" data-create-redesign disabled={!preview||plans.length>=12} onClick={()=>onCreatePlan(createRedesign(requestWithDonor,plan,source,()=>crypto.randomUUID()))}>保留原款并创建方案</button>{plans.length>=12&&<p role="status">已达12个方案，请先整理或删除方案。</p>}
  <RedesignOriginNote plan={plan} plans={plans}/>
  <div className="redesign-sources"><a href={REDESIGN_SOURCE.url} target="_blank" rel="noreferrer">方法来源 · 已读正文</a>{onReferences&&<button onClick={onReferences}>查看改款文献与19篇索引</button>}</div>
 </div>;
}
