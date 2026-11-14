import { useEffect,useMemo,useRef,useState } from 'react';
import { COMPANY_STYLE_MASTERS,companyStyleMaster } from '@/data/companyStyleMasters';
import { newCompanyStyle } from '@/lib/pattern/company-style';
import { exportStyleThreeViewSvg } from '@/lib/pattern/style-variation-drawing';
import { hasStyleVariations } from '@/lib/pattern/style-variation';
import { StyleVariationControls } from './StyleVariationControls';
import { StyleDesignSenlingPanel } from './StyleDesignSenlingPanel';
import { downloadStylePng } from './style-image-reference';
import { useDesignStore } from '@/store/useDesignStore';
import { downloadText } from '@/features/files/browser-files';
import type { CompanyStyleDraft } from '@/types/company-style';
import { CompanyMaterialAssignments } from '@/features/asset-library/CompanyMaterialAssignments';
import { SweatshirtResearchPilot } from './SweatshirtResearchPilot';
import '../asset-library/asset-library.css';
import './company-design.css';

const initialDraft=newCompanyStyle();
export function CompanyDesignBoard({onMapping,onLibrary}:{onMapping:()=>void;onLibrary?:()=>void}){
  const saved=useDesignStore(s=>s.companyDraft),setDraft=useDesignStore(s=>s.setCompanyDraft),apply=useDesignStore(s=>s.applyCompanyDraft);
  const d=saved??initialDraft,m=companyStyleMaster(d.masterId),svg=useMemo(()=>exportStyleThreeViewSvg(d),[d]);
  const [reference,setReference]=useState(false),[error,setError]=useState(''),[senling,setSenling]=useState(false),senlingHost=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(senling)senlingHost.current?.scrollIntoView?.({block:'start',behavior:'smooth'});},[senling]);
  const update=(patch:Partial<CompanyStyleDraft>)=>{try{setDraft({...d,...patch});setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
  const finish=(key:'neckWidthMm'|'bodyHemMm'|'sleeveHemMm'|'needleGaugeMm',value:string)=>{
    if(!value.trim()){setError('工艺参数不能为空');return;}
    update({finish:{...d.finish,[key]:Number(value)}});
  };
  const knit=m.kind==='short-tee'||m.kind==='long-tee';
  return <section id="company-design-board" className="company-board" data-testid="company-design-board">
    <header className="company-heading"><div><h2>三视图 2D 创作</h2><p>沿用公司母版，组合设计改款，再用森灵测试效果。</p></div><div className="company-actions">
      <button aria-pressed={reference} onClick={()=>setReference(v=>!v)}>{reference?'返回派生稿':'对照公司原稿'}</button>
      <button onClick={()=>downloadText(svg,`${d.styleCode||m.source.styleCode}-设计草案.svg`,'image/svg+xml')}>下载设计稿</button>
      <button onClick={()=>void downloadStylePng(svg,`${d.styleCode||m.source.styleCode}-三视图.png`).catch(e=>setError(String(e)))}>下载三视图 PNG</button>
      <button onClick={()=>downloadText(JSON.stringify({draft:d,source:m.source,masterRevision:m.revision,cadStatus:hasStyleVariations(d)?'variation-needs-drafting':m.cadTemplateId?'reference-method':'unconnected',productionApproved:false},null,2),`${d.styleCode||m.source.styleCode}-母版关联.json`,'application/json')}>下载关联数据</button>
      <button aria-pressed={senling} onClick={()=>setSenling(v=>!v)}>森灵测试</button>
    </div></header>
    <SweatshirtResearchPilot onSelect={draft=>{setDraft(draft);setReference(false);setError('');}}/>
    <div className="company-layout"><div className="company-main">
      <div className="company-master-picker" aria-label="公司基础版型">{COMPANY_STYLE_MASTERS.map(master=><button key={master.id} aria-pressed={d.masterId===master.id} onClick={()=>{setDraft(newCompanyStyle(master.id));setError('');}}><strong>{master.name}</strong><span>{master.source.styleCode} · {master.cadTemplateId?'可关联参考裁片':'裁片待接通'}</span></button>)}</div>
      {reference?<figure className="company-reference"><img src={m.source.image} alt={`${m.source.styleCode} 公司原始设计稿`}/><figcaption>原稿 {m.source.styleCode} · <a href={m.source.url} target="_blank" rel="noreferrer">查看源图</a></figcaption></figure>:<div className="company-sheet" data-testid="company-design-sheet" dangerouslySetInnerHTML={{__html:svg}}/>}
      <div hidden={!senling} ref={senlingHost}><StyleDesignSenlingPanel draft={d}/></div>
    </div><aside className="company-inspector" aria-label="公司母版设定">
      <StyleVariationControls draft={d} onChange={update}/>
      <h3>派生款信息</h3><p className="company-source">参考 {m.source.styleCode} / 母版 v{m.revision}</p>
      <label>新款款号<input aria-label="新款款号" value={d.styleCode} maxLength={60} placeholder="待填写" onChange={e=>update({styleCode:e.target.value})}/></label>
      <label>品名<input aria-label="公司款式品名" value={d.name} maxLength={100} onChange={e=>update({name:e.target.value})}/></label>
      <label>颜色<input aria-label="公司款式颜色" type="color" value={d.color} onChange={e=>update({color:e.target.value})}/></label>
      <label>面料<input aria-label="公司款式面料" value={d.fabric} maxLength={200} onChange={e=>update({fabric:e.target.value,composition:'',weight:''})}/></label>
      <label>成分<input aria-label="公司款式成分" value={d.composition} placeholder="换料后待确认" maxLength={200} onChange={e=>update({composition:e.target.value})}/></label>
      <label>克重<input aria-label="公司款式克重" value={d.weight} placeholder="换料后待确认" maxLength={100} onChange={e=>update({weight:e.target.value})}/></label>
      <CompanyMaterialAssignments/>{onLibrary&&<button onClick={onLibrary}>从资产库选用面料 / 工艺</button>}
      <h3>工艺设定</h3>
      {knit?<div className="company-finish" key={m.id}>{([
        ['neckWidthMm','罗纹领高 mm'],['bodyHemMm','下摆折边 mm'],['sleeveHemMm','袖口折边 mm'],['needleGaugeMm','双针间距 mm'],
      ] as const).map(([key,label])=><label key={key}>{label}<input key={d.finish[key]} aria-label={label} type="number" step="0.5" defaultValue={d.finish[key]} onBlur={e=>finish(key,e.target.value)}/></label>)}</div>:<p>独立罗纹、帽袋按原稿表达，尚未接通其毫米裁片组合。</p>}
      <details><summary>原稿工艺参考</summary><ul>{m.knownFinishes.map(t=><li key={t}>{t}</li>)}</ul></details>
      <label>改款说明<textarea aria-label="改款说明" value={d.notes} maxLength={1000} rows={3} onChange={e=>update({notes:e.target.value})}/></label>
      {error&&<p role="alert" className="company-error">{error}</p>}
      <button className="company-primary" disabled={!m.cadTemplateId||hasStyleVariations(d)} onClick={()=>{try{apply(d);onMapping();}catch(e){setError(e instanceof Error?e.message:String(e));}}}>使用此母版查看二维裁片</button>
      {hasStyleVariations(d)&&<p className="company-source">当前改款用于二维创作与森灵测试。对应裁片需单独制版后再进入专业审查。</p>}
      <p className="company-source">{m.cadTemplateId?'裁片使用同构型的参考制图方法；公司原稿未提供同款毫米净样。':'此母版的裁片方法待接通，暂不进入二维组合。'} 图稿与工艺随顶部“保存”一起保存，支持撤销。</p>
      <details><summary>来源与待核对项</summary><p>研发货盘 · 设计稿字段<br/>记录 {m.source.recordId}</p><ul>{m.pending.map(t=><li key={t}>{t}</li>)}</ul></details>
    </aside></div>
  </section>;
}
