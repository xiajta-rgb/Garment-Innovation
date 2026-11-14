import { ProfessionalAssetLibrary } from '@/features/piece-design/ProfessionalAssetLibrary';
import { compositionSource } from '@/application/composition-catalogue';
import { emptyPieceComposition } from '@/lib/pattern/piece-composition';
import {PANTS_PATTERN_ID} from '@/data/foundationMethods';
import { useEffect,useMemo,useRef,useState } from 'react';
import { COMPANY_STYLE_MASTERS,companyStyleMaster } from '@/data/companyStyleMasters';
import { MATERIAL_ASSETS,FINISH_ASSETS,STRUCTURE_ASSETS,COLOR_ASSETS,MATERIAL_SLOT_LABELS } from '@/data/reusableAssets';
import { listPatterns,PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS,isReferencePattern } from '@/data/patternReview';
import { newCompanyStyle } from '@/lib/pattern/company-style';
import { applyColorAsset,applyFinishAsset,applyMaterialAsset,compatibleMaterial,materialComposition,materialSlotAvailable } from '@/lib/pattern/reusable-assets';
import { exportAssetHandoff,previewStructureAsset } from '@/application/asset-library';
import { readConfiguration } from '@/application/design-document';
import { assetPiecePreviews } from '@/lib/pattern/asset-preview';
import { useDesignStore } from '@/store/useDesignStore';
import { downloadText } from '@/features/files/browser-files';
import type { MaterialSlot } from '@/types/reusable-assets';
import { CompanyMaterialAssignments } from './CompanyMaterialAssignments';
import { GARMENT_CATEGORIES,garmentCategory } from '@/data/garmentCategories';
import { SKIRT_PATTERN_ID } from '@/data/skirtMethods';
import type { AssetLibraryTab } from '@/types/category-workbench';
import './asset-library.css';
import { ManagedMaterialLibrary } from './ManagedMaterialLibrary';
import { ManagedMaterialAssignments } from './ManagedMaterialAssignments';
import { DesignAssetLibrary } from './DesignAssetLibrary';

const tabs=[['design','设计素材'],['material','面料库'],['finish','工艺方案'],['structure','结构组合'],['template','裁片模板'],['color','配色库']] as const;
type Tab=AssetLibraryTab;
export function AssetLibrary({onCompany,onPattern,initialTab='material',categoryId,onCategories,onDesign}:{onCompany:()=>void;onPattern:()=>void;initialTab?:Tab;categoryId?:string;onCategories?:()=>void;onDesign?:()=>void}){
  const s=useDesignStore(),d=s.companyDraft??newCompanyStyle(),master=companyStyleMaster(d.masterId);
  const [tab,setTab]=useState<Tab>(initialTab),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[compatibleOnly,setCompatibleOnly]=useState(false),[slot,setSlot]=useState<MaterialSlot>('main');
  const [materialSource,setMaterialSource]=useState<'managed'|'reference'>('managed');
  const [categoryFilter,setCategoryFilter]=useState(categoryId??'all');
  const category=categoryFilter==='all'?null:garmentCategory(categoryFilter);
  const categoryKinds=category?COMPANY_STYLE_MASTERS.filter(m=>category.companyMasterIds.includes(m.id)).map(m=>m.kind):null;
  const [selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const previewRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(tab==='structure'&&selected)previewRef.current?.scrollIntoView?.({behavior:'smooth',block:'start'});},[tab,selected]);
  const currentSlot=materialSlotAvailable(d,slot)?slot:'main';
  const matches=(...text:string[])=>text.join(' ').toLowerCase().includes(query.trim().toLowerCase());
  const groups=tab==='material'?Object.entries(MATERIAL_SLOT_LABELS).map(([id,label])=>({id,label})):tab==='structure'?[...new Set(STRUCTURE_ASSETS.map(a=>a.templateId))].map(id=>({id,label:PATTERN_LIBRARY[id].name})):tab==='template'?[{id:'executable',label:'有源制图方法'},{id:'blocked',label:'待重建 / 已停用'}]:tab==='color'?[...new Set(COLOR_ASSETS.map(c=>c.group))].map(id=>({id,label:id})):[];
  const run=(fn:()=>void,message:string)=>{try{fn();setError('');setNotice(message);}catch(e){setError(e instanceof Error?e.message:String(e));setNotice('');}};
  const choose=(id:Tab)=>{setTab(id);setFilter('all');setSelected(null);setNotice('');setError('');};
  const preview=useMemo(()=>{
    if(tab!=='structure'||!selected)return null;
    try{const p=previewStructureAsset(s.getConfiguration(),selected);return {...p,error:null};}catch(e){return {error:e instanceof Error?e.message:String(e)};}
  },[tab,selected,s]);
  const previewPieces=useMemo(()=>preview&&'draft'in preview&&preview.draft.status==='reference'?assetPiecePreviews(preview.draft.paths):[],[preview]);
  const previewIsSkirt=preview&&'configuration'in preview&&preview.configuration.activePatternId===SKIRT_PATTERN_ID;
  const previewIsPants=preview&&'configuration'in preview&&preview.configuration.activePatternId===PANTS_PATTERN_ID;
  const lengthLabel=previewIsPants?'前片外侧缝长':previewIsSkirt?'成品裙长（含腰头）':'衣长';
  const previewLength=previewIsPants&&'draft'in preview?preview.draft.assembly?.boundaries.find(b=>b.piece==='paco.front'&&b.id==='outseam')?.lengthMm:preview&&'configuration'in preview?preview.configuration.measurements[previewIsSkirt?'skirtLength':'totalLength']:undefined;
  const currentLength=previewIsPants?(s.activePatternId===PANTS_PATTERN_ID?s.draft.assembly?.boundaries.find(b=>b.piece==='paco.front'&&b.id==='outseam')?.lengthMm:undefined):s.measurements[previewIsSkirt?'skirtLength':'totalLength'];
  const materials=MATERIAL_ASSETS.filter(m=>(!categoryKinds||m.kinds.some(k=>categoryKinds.includes(k)))&&matches(m.name,m.code??'',m.structure,materialComposition(m))&&(filter==='all'||m.slots.includes(filter as MaterialSlot))&&(!compatibleOnly||compatibleMaterial(d,m,currentSlot)));
  const finishes=FINISH_ASSETS.filter(f=>(!category||f.masterIds.some(id=>category.companyMasterIds.includes(id)))&&matches(f.name)&&(!compatibleOnly||f.masterIds.includes(d.masterId)));
  const structures=STRUCTURE_ASSETS.filter(a=>(!category||category.templateIds.includes(a.templateId))&&matches(a.name,a.description,...a.tags)&&(filter==='all'||a.templateId===filter));
  const templates=listPatterns().filter(p=>(!category||category.templateIds.includes(p.id))&&matches(p.name,p.id,p.description)&&(filter==='all'||(filter==='executable')===isReferencePattern(p.id)));
  const colors=COLOR_ASSETS.filter(c=>matches(c.name,c.hex,c.group)&&(filter==='all'||c.group===filter));
  const count={design:0,material:materials.length,finish:finishes.length,structure:structures.length,template:templates.length,color:colors.length}[tab];
  return <section className="asset-library" data-testid="asset-library">
    <header className="asset-heading"><div><h2>资产库</h2><p>选择面料、工艺、结构组合与模板，应用到当前款式。</p></div>{onCategories&&categoryId&&<button onClick={onCategories}>返回品类与功能</button>}<button onClick={()=>run(()=>downloadText(JSON.stringify(exportAssetHandoff(s.getConfiguration(),s.draft,d),null,2),'服装造型-资产关联候选.json','application/json'),'已导出当前款式的资产关联候选。')}>导出资产关联候选</button></header>
    {tab==='design'&&error&&<p className="asset-error" role="alert">{error}</p>}
    {!(tab==='material'&&materialSource==='managed')&&<details className="asset-context"><summary>应用范围 · {PATTERN_LIBRARY[s.activePatternId].name} / {master.source.styleCode}</summary><div><label>参考母版<select aria-label="资产目标母版" value={d.masterId} onChange={e=>run(()=>s.setCompanyDraft(newCompanyStyle(e.target.value)),'已切换目标母版，原方案可撤销恢复。')}>{COMPANY_STYLE_MASTERS.map(m=><option key={m.id} value={m.id}>{m.source.styleCode} · {m.name}</option>)}</select></label><button onClick={onCompany}>查看参考资料</button><span>当前裁片：{PATTERN_LIBRARY[s.activePatternId].name}</span></div></details>}
    <nav className="asset-tabs" aria-label="资产分类">{tabs.map(([id,name])=><button key={id} aria-pressed={tab===id} onClick={()=>choose(id)}>{name}</button>)}</nav>
    {tab==='material'&&<nav className="asset-material-source" aria-label="面料来源"><button aria-pressed={materialSource==='managed'} onClick={()=>setMaterialSource('managed')}>面料管理</button><button aria-pressed={materialSource==='reference'} onClick={()=>setMaterialSource('reference')}>原稿面料</button></nav>}
    {tab==='design'?<><DesignAssetLibrary onDesign={onDesign}/><details className="professional-asset-section"><summary>设计元素与素材组合</summary><ProfessionalAssetLibrary plan={(s.pieceComposition??emptyPieceComposition('asset-plan')).plans.find(p=>p.id===(s.pieceComposition?.activePlanId??'asset-plan'))!} source={compositionSource(s.getConfiguration(),'t-shirt')} onChange={plan=>{const current=s.pieceComposition??emptyPieceComposition(plan.id);s.setPieceComposition({...current,plans:current.plans.map(p=>p.id===plan.id?plan:p)});}} onError={setError} onApplied={onDesign}/></details></>:tab==='material'&&materialSource==='managed'?<ManagedMaterialLibrary key={s.sessionId}/>:<>
    <div className="asset-tools"><select aria-label="资产所属服装品类" value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setSelected(null);setFilter('all');}}><option value="all">全部服装品类</option>{GARMENT_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><input type="search" aria-label="搜索资产" value={query} placeholder="搜索名称、货号、标签" onChange={e=>{setQuery(e.target.value);setSelected(null);}}/>{groups.length>0&&<select aria-label="资产细分类" value={filter} onChange={e=>{setFilter(e.target.value);setSelected(null);}}><option value="all">全部分类</option>{groups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select>}
      {tab==='material'&&<label>用料部位<select aria-label="选用面料部位" value={currentSlot} onChange={e=>setSlot(e.target.value as MaterialSlot)}>{(Object.keys(MATERIAL_SLOT_LABELS) as MaterialSlot[]).filter(k=>materialSlotAvailable(d,k)).map(k=><option key={k} value={k}>{MATERIAL_SLOT_LABELS[k]}</option>)}</select></label>}
      {(tab==='material'||tab==='finish')&&<label><input type="checkbox" checked={compatibleOnly} onChange={e=>setCompatibleOnly(e.target.checked)}/>仅显示当前可用</label>}<span role="status">显示 {count} 项</span>
    </div>
    {notice&&<p className="asset-notice" role="status">{notice}</p>}{error&&<p className="asset-error" role="alert">{error}</p>}
    <div className="asset-content"><div className="asset-main">
      {count===0&&<p className="asset-empty">没有符合筛选条件的资产。</p>}
      <div className="asset-grid">
      {tab==='material'&&materials.map(m=><article key={m.id} data-asset-id={m.id}><span className="asset-tag">{m.structure} · 原稿资料</span><h3>{m.name}</h3><dl><dt>成分</dt><dd>{materialComposition(m)||'待确认'}</dd><dt>原稿克重</dt><dd>{m.weightLabel||'待确认'}</dd><dt>单位面积克重</dt><dd>待确认 g/m²</dd><dt>门幅 / 伸缩 / 缩水</dt><dd>待测</dd><dt>可用部位</dt><dd>{m.slots.map(k=>MATERIAL_SLOT_LABELS[k]).join('、')}</dd></dl><p className="asset-muted">来源 {m.sourceMasterIds.map(id=>companyStyleMaster(id).source.styleCode).join(' / ')}</p><details><summary>资料说明</summary>{m.notes.map(t=><p key={t}>{t}</p>)}</details><button disabled={!compatibleMaterial(d,m,currentSlot)} onClick={()=>run(()=>s.setCompanyDraft(applyMaterialAsset(d,m.id,currentSlot)),`已选用${MATERIAL_SLOT_LABELS[currentSlot]}：${m.name}`)}>选用为{MATERIAL_SLOT_LABELS[currentSlot]}</button>{!compatibleMaterial(d,m,currentSlot)&&<small>与当前母版或用料部位不兼容</small>}</article>)}
      {tab==='finish'&&finishes.map(f=><article key={f.id} data-asset-id={f.id}><span className="asset-tag">公司原稿工艺</span><h3>{f.name}</h3><dl>{([['neckWidthMm','领高'],['bodyHemMm','摆折边'],['sleeveHemMm','袖口折边'],['needleGaugeMm','双针间距']] as const).map(([key,name])=><div key={key}><dt>{name}</dt><dd>{f.settings[key]} mm · {f.sourcedFields.includes(key)?'原稿标注':'设计设定'}</dd></div>)}</dl>{f.assumptions.map(t=><p key={t} className="asset-muted">{t}</p>)}<button disabled={!f.masterIds.includes(d.masterId)} onClick={()=>run(()=>s.setCompanyDraft(applyFinishAsset(d,f.id)),'工艺方案已应用，二维设定同步更新。')}>选用工艺方案</button></article>)}
      {tab==='structure'&&structures.map(a=><article key={a.id} data-asset-id={a.id} className={selected===a.id?'asset-selected':''}><span className="asset-tag">{a.tags.join(' · ')}</span><h3>{a.name}</h3><p>{a.description}</p>{a.lengthBonus!==undefined&&<p>含源参考衣长方案：后腰节长与腰臀长之和，再加长{a.lengthBonus*100}%。应用会更新衣长。</p>}<p className="asset-muted">{a.source}</p><button aria-pressed={selected===a.id} onClick={()=>{setSelected(a.id);setNotice('');setError('');}}>预览此结构</button></article>)}
      {tab==='template'&&templates.map(p=>{const review=PATTERN_REVIEWS[p.id],available=isReferencePattern(p.id);return <article key={p.id} data-asset-id={p.id}><span className="asset-tag">{available?'毫米参考裁片':review.disposition==='retired'?'已停用':'待重建'}</span><h3>{p.name}</h3><p>{review.reason}</p><p>{available?'可用于二维裁片参考与结构审查':review.limitations}</p>{available&&<details><summary>交付限制</summary><p>{review.limitations}</p></details>}<button disabled={!available} onClick={()=>run(()=>{s.applyReviewedConfiguration(readConfiguration({...s.getConfiguration(),activePatternId:p.id,construction:undefined}));onPattern();},'已生成此模板的参考裁片。')}>使用裁片模板</button></article>;})}
      {tab==='color'&&colors.map(c=><article key={c.id} data-asset-id={c.id}><div className="asset-swatch" style={{background:c.hex}}/><h3>{c.name}</h3><p>{c.hex}</p><p className="asset-muted">屏幕色；实物色卡与色差未核验</p><button onClick={()=>run(()=>s.setCompanyDraft(applyColorAsset(d,c.id)),`已选用${c.name}，当前设计稿已更新。`)}>选用配色</button></article>)}
      </div>
      {tab==='structure'&&preview&&<section ref={previewRef} className="asset-preview" aria-label="结构裁片预览">{'draft'in preview?<><h3>实际参考裁片预览</h3><p>{preview.draft.pieces.length} 种源裁片 · {preview.draft.status==='reference'?'制图检查通过':'制图被阻止'} · {s.gender} / {s.standardSize} · 方案{lengthLabel} {previewLength?.toFixed(1)??'待输入'} mm（当前 {currentLength?.toFixed(1)??'待输入'} mm）</p>{preview.draft.error&&<p role="alert">{preview.draft.error}</p>}<p className="asset-muted">逐片适配视窗；下列毫米值为源图纸外廓，含缝份与源制图标记，不是成衣尺寸。</p><button disabled={preview.draft.status!=='reference'} onClick={()=>run(()=>s.applyReviewedConfiguration(preview.configuration),'结构组合已应用，裁片、装配关系及裁片BOM同步更新。')}>应用预览结构到当前裁片</button><button onClick={onPattern}>查看当前裁片</button>{previewPieces.length>0&&<div data-testid="asset-cad-preview" className="asset-piece-grid">{previewPieces.map(p=><figure key={p.id}><div dangerouslySetInnerHTML={{__html:p.svg}}/><figcaption><strong>{p.name}</strong><span>{p.widthMm.toFixed(1)} × {p.heightMm.toFixed(1)} mm</span><span>源裁剪 {p.quantity??'待确认'} 片 · {p.onFold?'对折裁剪':'对折方式见源图纸'}</span></figcaption></figure>)}</div>}</>:<p role="alert">{preview.error}</p>}</section>}
    </div><aside className="asset-inspector"><h3>当前款式面料</h3><ManagedMaterialAssignments/><h3>参考母版用料</h3><p>{master.source.styleCode} · {d.name}</p><CompanyMaterialAssignments/><h3>已选工艺 / 配色</h3><p>{FINISH_ASSETS.find(f=>f.id===d.assets?.finish?.id)?.name??'自定义 / 母版初始工艺'}</p><p>{COLOR_ASSETS.find(c=>c.id===d.assets?.color?.id)?.name??'自定义 / 母版初始配色'} · {d.color}</p><p className="asset-muted">解除用料关联会保留设计稿文字；手工修改主料、成分或克重后，主料资产关联自动解除。</p><p className="asset-muted">选用资产支持撤销、重做，随顶部保存和重新打开恢复。导出为关联候选，尚未写入飞书。</p></aside></div>
    </>}
  </section>;
}
