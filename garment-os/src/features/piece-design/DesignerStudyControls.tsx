import { useState } from 'react';
import { designerStudyUrl, readDesignerStudy, selectStudyPlans } from '@/application/designer-study';
import type { DesignerStudy } from '@/application/designer-study';
import type { CompositionPlan, CompositionView } from '@/types/piece-composition';
import { CompositionCanvas } from './CompositionCanvas';

interface Props {plan:CompositionPlan;plans:CompositionPlan[];onCreatePlans:(plans:CompositionPlan[])=>void;templateId?:string}
export function DesignerStudyControls({plan,plans,onCreatePlans,templateId:templateProp}:Props){
 const [study,setStudy]=useState<DesignerStudy>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [group,setGroup]=useState('A'),[view,setView]=useState<CompositionView>('front'),[selected,setSelected]=useState<string[]>([]),[showBase,setShowBase]=useState(false);
 const templateId=templateProp??plan.pieces.find(p=>p.source.templateId)?.source.templateId??'t-shirt';
 const studyUrl=designerStudyUrl(templateId);
 async function load(){setLoading(true);setError('');try{const r=await fetch(studyUrl+'/manifest.json');if(!r.ok)throw Error('提案暂时无法读取');setStudy(readDesignerStudy(await r.json()));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}}
 function add(){if(!study)return;try{const adding=selectStudyPlans(study,selected,{schema:'garment-os/piece-composition-editor/v1',activePlanId:plan.id,plans});onCreatePlans(adding);setSelected([]);}catch(e){setError(e instanceof Error?e.message:String(e));}}
  return <section className="designer-study" data-testid="designer-study">
  <header><strong>{templateId==='elastic-waist-pants'?'男裤设计探索 · 3个审查样本':'本轮设计探索 · 12款'}</strong><p>{templateId==='elastic-waist-pants'?'直筒 / 宽腿 / 工装功能':'复古运动 / 城市轻商务 / 自然肌理 / 都市工装'}</p><small>证据等级 E0–E2：方法与软件检查已记录；E3版师审查、E4样衣/反馈尚未完成</small></header>
  {!study&&<button onClick={load} disabled={loading}>{loading?'正在读取提案…':'查看本轮设计提案'}</button>}
  {error&&<p role="alert">{error}</p>}
  {study&&<>
   <p>{study.baseNotice} 可将选款和参考基款一起加入当前设计台。这里用于积累设计经验和审美判断，不能视为生产批准。</p>
   <div className="redesign-batch-actions">{study.groups.map(g=><button key={g.id} aria-pressed={group===g.id} onClick={()=>{setGroup(g.id);setError('');}}>{g.name}</button>)}</div>
   <p>{study.groups.find(g=>g.id===group)?.intent}</p>
   <div className="redesign-batch-actions">{(['front','back','side'] as const).map((v,i)=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{['提案正面','提案背面','提案侧面'][i]}</button>)}<label><input type="checkbox" checked={showBase} onChange={e=>setShowBase(e.target.checked)}/>显示参考基款</label></div>
   {showBase&&<div className="designer-study-base"><strong>参考基款 · {templateId==='elastic-waist-pants'?'男士松紧腰直筒裤':'圆领装袖短T'}</strong><CompositionCanvas plan={study.base} focusView={view} showGrid={false}/></div>}
   <div className="redesign-batch-grid">{study.designs.filter(d=>d.group===group).map(d=>{
    const imported=plans.some(p=>p.id===d.plan.id);
    return <article key={d.id} data-study-option={d.id}><label><input type="checkbox" aria-label={`选择提案${d.id}`} disabled={imported} checked={selected.includes(d.id)} onChange={e=>{setSelected(e.target.checked?[...selected,d.id]:selected.filter(id=>id!==d.id));setError('');}}/><strong>{d.id} · {d.name}{imported?' · 已加入':''}</strong></label><CompositionCanvas plan={d.plan} focusView={view} showGrid={false}/><p>{d.intent}</p><details><summary>设计与配套</summary><p>{d.method}</p><p>{d.compare}</p><ul>{d.checks.map(s=><li key={s}>{s}</li>)}</ul><small>肌理为设计示意；真实面料、净样与样衣待核验。</small></details><a href={`${studyUrl}/${d.id}-three-views.svg`} download={`${d.id}-三视图.svg`}>下载三视图</a></article>;
   })}</div>
   <div className="redesign-batch-actions"><button data-add-study disabled={!selected.length} onClick={add}>加入选款与参考基款（{selected.length}）</button><small>当前还可加入{Math.max(0,12-plans.length)}款</small></div>
  </>}
 </section>;
}
