import { useMemo, useState } from 'react';
import { DESK_AXES, DESK_SCHEMA, buildDeskMatrix, deskLabel, deskMatrixRows, deskTemplates, newDeskCustomization, readDeskCustomization, readDeskSession } from '@/application/design-desk';
import type { DeskAxis, DeskCandidate, DeskCustomization, DeskSession } from '@/application/design-desk';
import { auditTemplateStructure } from '@/application/template-structural-audit';
import { templateAuditSheet } from '@/lib/pattern/template-audit-sheet';
import { useDesignStore } from '@/store/useDesignStore';
import { newTeeBase } from '@/application/tee-matrix';
import { computeDraft } from '@/application/draft-service';
import type { DesignConfiguration } from '@/types/design';
import { downloadText } from '@/features/files/browser-files';
import { useDeskPreviews } from './useDeskPreviews';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { COMPANY_TEE_GUIDE_ID } from '@/lib/pattern/company-tee-flat';
import { MiniOptionThumb } from '@/features/piece-design/CompositionElementPicker';
import './design-desk.css';

const STORAGE = DESK_SCHEMA;
function load() {
  const session: DeskSession = { schema: DESK_SCHEMA, customization: newDeskCustomization(), selections: [] };
  try { const saved = localStorage.getItem(STORAGE); return { session: saved ? readDeskSession(JSON.parse(saved)) : session, error: '' }; }
  catch { return { session, error: '上次的设计台记录暂时无法读取，原记录仍保留；本次从基础款开始。' }; }
}
function Drawing({ svg, name, small = false }: { svg: string; name: string; small?: boolean }) {
  return <img className={small ? 'desk-drawing small' : 'desk-drawing'} data-desk-drawing alt={`${name}，正背侧三视图参考`} src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)} />;
}
function SourceDrawing({ templateId, size, configuration, expanded = false }: { templateId: string; size: DeskCustomization['size']; configuration?: DesignConfiguration; expanded?: boolean }) {
  const serialized = JSON.stringify(configuration);
  const audit = useMemo(() => {
    const reference = auditTemplateStructure(templateId, size);
    if (!serialized) return reference;
    const actual: DesignConfiguration = JSON.parse(serialized), draft = computeDraft(actual);
    return { ...reference, configuration: actual, pieces: draft.pieces, assembly: draft.assembly, issues: draft.issues,
      findings: [...(draft.error ? [draft.error] : []), ...reference.findings] };
  }, [templateId, size, serialized]);
  const svg = useMemo(() => templateAuditSheet(audit), [audit]);
  return <>{svg ? <div className={expanded ? undefined : 'desk-source-preview'} data-desk-source dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="desk-stage-placeholder"><h3>{audit.status === 'retired' ? '此模板已停用' : '配套裁片尚未建立'}</h3><p>{audit.findings[0]}</p></div>}{expanded && <ul>{audit.findings.slice(0, 3).map(f => <li key={f}>{f}</li>)}</ul>}</>;
}
export function DesignDesk({onReview,onFoundation}:{onReview:()=>void;onFoundation:()=>void}) {
  const workbench = useDesignStore();
  const baseConfiguration = workbench.getConfiguration();
  const [initial] = useState(load), [session, setSession] = useState(initial.session), [error, setError] = useState(initial.error);
  const [tab, setTab] = useState<'design' | 'selections'>('design'), [selectedId, setSelectedId] = useState(''), [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState(false),[companyReference,setCompanyReference]=useState(false);
  const guide=companyStyleMaster(COMPANY_TEE_GUIDE_ID);
  const c: DeskCustomization = { ...session.customization, templateId: baseConfiguration.activePatternId, size: baseConfiguration.standardSize, color: baseConfiguration.garmentColor, baseConfiguration };
  const templates = useMemo(() => deskTemplates(), []), template = templates.find(t => t.id === c.templateId)!;
  let candidates: DeskCandidate[] = [], configurationError = '';
  try { candidates = buildDeskMatrix(c); }
  catch (e) { configurationError = e instanceof Error ? e.message : String(e); }
  const rows = deskMatrixRows(c, candidates);
  const pageCount = Math.ceil(rows.length / 3), currentPage = Math.min(page, Math.max(0, pageCount - 1)), visibleRows = rows.slice(currentPage * 3, currentPage * 3 + 3);
  const savedSelection = selectedId.startsWith('saved:') ? session.selections.find(s => 'saved:' + s.id === selectedId) : undefined;
  const selected = savedSelection?.candidate ?? candidates.find(item => item.id === selectedId) ?? candidates[0];
  const inspectedId = savedSelection?.customization.templateId ?? c.templateId, inspectedSize = savedSelection?.customization.size ?? c.size;
  const inspectedConfiguration = selected?.configuration ?? savedSelection?.customization.baseConfiguration ?? baseConfiguration;
  const visible = tab === 'selections' ? session.selections.map(s => s.candidate) : visibleRows.flatMap(row => row.candidates);
  // Saved records may share a candidate ID but have different colors or sizes. Prefix the preview key with the selection ID.
  const previewCandidates = tab === 'selections' ? session.selections.map(s => ({ ...s.candidate, id: 'saved:' + s.id })) : visible;
  const selectedPreviewKey = savedSelection ? 'saved:' + savedSelection.id : selected?.id;
  const selectedRequest = selected && selectedPreviewKey ? { ...selected, id: selectedPreviewKey } : undefined;
  const requests = [...previewCandidates, ...(selectedRequest && !previewCandidates.some(item => item.id === selectedPreviewKey) ? [selectedRequest] : [])];
  const previews = useDeskPreviews(requests), preview = selectedPreviewKey ? previews[selectedPreviewKey] : undefined;
  function commit(next: DeskSession) {
    setSession(next); setNotice('');
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setError(''); }
    catch { setError('浏览器保存失败，当前修改仍在页面中，请导出选款备份。'); }
  }
  function customize(patch: Partial<DeskCustomization>) {
    commit({ ...session, customization: readDeskCustomization({ ...c, ...patch }) }); setSelectedId(''); setPage(0); setTab('design'); setDetails(false);
  }
  function toggle(axis: DeskAxis, value: string) {
    const values = c.choices[axis] as string[];
    if (values.includes(value) && values.length === 1) { setNotice('每个维度至少保留一项'); return; }
    customize({ choices: { ...c.choices, [axis]: values.includes(value) ? values.filter(v => v !== value) : [...values, value] } });
  }
  function save() {
    if (!selected) return;
    const customization = savedSelection?.customization ?? c;
    if (session.selections.some(s => s.candidate.id === selected.id && JSON.stringify(s.customization) === JSON.stringify(customization))) { setNotice('这个方案已在选款夹'); return; }
    if (session.selections.length >= 24) { setNotice('选款夹最多24款，请先导出或移除'); return; }
    commit({ ...session, selections: [...session.selections, { id: crypto.randomUUID(), customization: structuredClone(customization), candidate: structuredClone(selected) }] });
    setNotice(selected.previewAvailable ? '已加入选款夹，定制设定已保留' : '已保留设计需求，结构缺口随方案保存');
  }
  function card(candidate: DeskCandidate, key = candidate.id) {
    const p = previews[key];
    return <button className="desk-card" key={key} data-desk-candidate={key} data-preview-supported={candidate.previewAvailable} aria-pressed={selectedPreviewKey === key} aria-label={`查看方案 ${candidate.name}`} onClick={() => { setSelectedId(key); setDetails(false); }}>
      <div className="desk-card-top"><span>{key.startsWith('saved:') ? `${deskLabel('neckline', candidate.intent.neckline)} · ${deskLabel('shoulder', candidate.intent.shoulder)}` : deskLabel(c.columnAxis, candidate.intent[c.columnAxis])}</span><small>{candidate.previewAvailable ? '裁片参考' : '待补结构'}</small></div>
      {p?.svg ? <Drawing svg={p.svg} name={candidate.name} small /> : <div className="desk-card-placeholder">{candidate.previewAvailable ? <><span>{p?.error ? '预览未完成' : '正在计算三视图…'}</span><small>{p?.error ?? '使用配套衣身与袖片'}</small></> : <><span>{deskLabel('shoulder', candidate.intent.shoulder)} / {deskLabel('neckline', candidate.intent.neckline)}</span><small>{candidate.blockers[0]}</small></>}</div>}
      <div className="desk-card-tags">{(['fit', 'sleeve', 'fabric'] as const).map(axis => <span key={axis}>{deskLabel(axis, candidate.intent[axis])}</span>)}</div>
    </button>;
  }
  const previewCount = candidates.filter(v => v.previewAvailable).length;
  function applySelected() {
    if (!selected?.configuration || !preview?.svg) return;
    try { workbench.applyReviewedConfiguration(selected.configuration); setNotice('已应用到当前款式，可继续编辑、查看二维裁片或使用原工作台保存；支持撤销。'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function restore(customization: DeskCustomization) {
    try {
      const base = customization.baseConfiguration ?? { ...newTeeBase(customization.size), garmentColor: customization.color };
      workbench.applyReviewedConfiguration(base);
      commit({ ...session, customization }); setTab('design'); setPage(0); setSelectedId('');
      setNotice('已恢复这款的基版、尺寸、配色和定制选项；原选款保留。');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function exportSelected() {
    if (preview?.svg) downloadText(preview.svg, '当前方案-参考三视图.svg', 'image/svg+xml');
    else downloadText(JSON.stringify({ customization: savedSelection?.customization ?? c, candidate: selected ?? null, productionApproved: false }, null, 2), '当前方案-设计需求.json', 'application/json');
  }
  return <section className="design-desk desk-embedded" data-testid="design-desk"><div className="desk-module-toolbar"><nav aria-label="矩阵模块视图"><button aria-pressed={tab === 'design'} onClick={() => { setTab('design'); setSelectedId(''); }}>组合方案</button><button aria-pressed={tab === 'selections'} onClick={() => { setTab('selections'); setSelectedId(session.selections[0] ? 'saved:' + session.selections[0].id : ''); }}>选款夹 <b>{session.selections.length}</b></button></nav><div><button data-workbench-export onClick={exportSelected}>导出当前方案</button><button onClick={onFoundation}>基础裁片核对</button><button onClick={onReview}>模板审查</button></div></div>
    <div className="desk-layout">
    <main className="desk-main"><div className="desk-intro"><div><h1>{tab === 'design' ? '当前款式 · 定制矩阵' : '保留值得继续的方向。'}</h1><p>{tab === 'design' ? '沿用左侧模板与尺寸 → 定制组合 → 自动展开 → 应用到当前款式' : '每款保留当时的定制内容，可恢复为新的设计起点。'}</p></div><span className="desk-autosave">选款本机保存</span></div>
      {error && <p role="alert" className="desk-notice error">{error}</p>}{configurationError && <p role="alert" className="desk-notice error">{configurationError}；请在左侧修正后继续。</p>}{notice && <p role="status" className="desk-notice">{notice}</p>}
      <section className="desk-stage" aria-label="当前设计"><div className="desk-stage-heading"><div><h2>{savedSelection ? '已选方案' : template.name}</h2><p>{selected?.name ?? template.scope}</p></div><span>{selected ? selected.previewAvailable ? '三视图参考 · 结构待完善' : '设计需求 · 待补结构' : '模板参考'}</span></div>
        {configurationError && !savedSelection ? <div className="desk-stage-placeholder"><h3>先补齐当前款式的尺寸</h3><p>在左侧修正尺寸后，三视图与矩阵会自动恢复。</p></div> : selected ? preview?.svg ? <Drawing svg={preview.svg} name={selected.name} /> : <div className="desk-stage-placeholder">{selected.previewAvailable ? <><strong>{preview?.error ?? '正在计算配套三视图…'}</strong><p>正背遵循公司稿规范，侧面为设计补充。</p></> : <><span className="desk-request-icon">＋</span><h3>保留这个设计方向，先补齐结构。</h3><p>{selected.blockers.join(' ')}</p><small>不会用其他袖型或面料图冒充当前方案。</small></>}</div> : <SourceDrawing templateId={inspectedId} size={inspectedSize} configuration={inspectedConfiguration} />}
        {companyReference&&<figure className="desk-company-reference"><img src={guide.source.image} alt="COT25M002 公司原始设计稿"/><figcaption>原稿为微落肩；当前为装袖派生款式图，同款裁片尚未接通。</figcaption></figure>}
        {preview?.specification&&<details className="desk-fit-spec"><summary>参考裁片规格 · mm · 展开核对</summary><p>此表量取Teagan参考净样。主图按公司稿表达款式比例，尚未验证同款纸样对应；侧面是设计补充。</p><table><thead><tr><th>量点</th><th>净样 mm</th><th>量法</th></tr></thead><tbody>{preview.specification.rows.map(r=><tr key={r.id}><td>{r.label}</td><td>{r.valueMm.toFixed(1)}</td><td>{r.definition}</td></tr>)}</tbody></table></details>}
        <div className="desk-stage-footer"><button aria-pressed={companyReference} onClick={()=>setCompanyReference(!companyReference)}>{companyReference?'收起公司原稿':'对照公司原稿'}</button><button onClick={() => setDetails(!details)} aria-expanded={details}>裁片与模板说明 {details ? '−' : '＋'}</button>{selected && <><button data-testid="apply-matrix-to-workbench" disabled={!selected.configuration || !preview?.svg} onClick={applySelected}>应用到当前款式</button><button className="desk-primary" onClick={save}>{selected.previewAvailable ? '＋ 加入选款夹' : '＋ 保留设计需求'}</button></>}</div>
        {details && <div className="desk-construction"><p>{selected?.previewAvailable ? '衣身与袖片来自配套Teagan；领条为尺寸化草案，材料回弹和完成态工艺未验收。款式图参照公司原稿绘制，未取得同款毫米净样，亦无垂坠验证。' : templates.find(t => t.id === inspectedId)?.scope}</p><SourceDrawing templateId={inspectedId} size={inspectedSize} configuration={inspectedConfiguration} expanded /><button onClick={onReview}>查看完整结构审查</button></div>}
      </section>
      {tab === 'design' ? <section className="desk-matrix-section" aria-label="自动设计矩阵"><div className="desk-matrix-heading"><div><h2>定制矩阵 <b data-desk-count>{candidates.length}</b></h2><p>{c.templateId === 't-shirt' && workbench.gender === 'male' ? `${previewCount}款有裁片参考 · ${candidates.length - previewCount}款待补结构，修改右侧选项即更新` : '当前模板可查看原始裁片，定制矩阵尚未接入。'}</p></div>{candidates.length > 0 && <label>横向比较<select aria-label="矩阵横向比较" value={c.columnAxis} onChange={e => customize({ columnAxis: e.target.value as DeskAxis })}>{(Object.keys(DESK_AXES) as DeskAxis[]).map(a => <option key={a} value={a}>{DESK_AXES[a].label}</option>)}</select></label>}</div>
        {candidates.length > 0 ? <><div className="desk-matrix-scroll"><div className="desk-auto-matrix" style={{ gridTemplateColumns: `86px repeat(${c.choices[c.columnAxis].length}, minmax(220px, 1fr))` }}><div className="desk-matrix-corner">组合 ↓<small>{DESK_AXES[c.columnAxis].label} →</small></div>{c.choices[c.columnAxis].map(value => <div className="desk-column" key={value}>{deskLabel(c.columnAxis, value)}</div>)}{visibleRows.map(row => <div className="desk-matrix-row" key={row.key}><div className="desk-row-label">{row.label}</div>{row.candidates.map(item => card(item))}</div>)}</div></div><div className="desk-pagination"><span>{rows.length}组 × {c.choices[c.columnAxis].length}列 · 第 {currentPage + 1} / {pageCount} 页</span><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><button disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>下一页</button></div></> : <p className="desk-empty">选左侧「圆领短袖T恤」开始定制；其他模板保留真实范围与待完成项。</p>}
      </section> : <section className="desk-shortlist"><div className="desk-matrix-heading"><h2>选款夹 · {session.selections.length}款</h2><button disabled={!session.selections.length} onClick={() => downloadText(JSON.stringify({ ...session, productionApproved: false }, null, 2), '设计台-选款方案.json', 'application/json')}>导出方案</button></div>{session.selections.length ? <div className="desk-saved-grid">{session.selections.map(s => <article key={s.id}>{card(s.candidate, 'saved:' + s.id)}<div className="desk-saved-actions"><span>{s.customization.size}参考样本 <i style={{ background: s.customization.color }} /></span><button onClick={() => { restore(s.customization); }}>继续定制</button><button onClick={() => { commit({ ...session, selections: session.selections.filter(item => item.id !== s.id) }); if (selectedId === 'saved:' + s.id) setSelectedId(''); }}>移除</button></div></article>)}</div> : <p className="desk-empty">选中一个方案，点击「加入选款夹」或「保留设计需求」。</p>}</section>}
    </main>
    <aside className="desk-customization" aria-label="定制选项"><div className="desk-panel-heading"><h2>定制你的款</h2><button disabled={!!configurationError} onClick={() => customize({choices:newDeskCustomization().choices,columnAxis:newDeskCustomization().columnAxis})}>重置</button></div><p className="desk-custom-intro">每项可多选，自动组合成矩阵。</p>
      {c.templateId === 't-shirt' && workbench.gender === 'male' ? <>{(Object.keys(DESK_AXES) as DeskAxis[]).map(axis => <fieldset key={axis} disabled={!!configurationError}><legend>{DESK_AXES[axis].label}<small>已选 {c.choices[axis].length}</small></legend><div className="desk-option-grid">{Object.entries(DESK_AXES[axis].values).map(([value, label]) => <button key={value} data-desk-option={`${axis}-${value}`} aria-pressed={(c.choices[axis] as string[]).includes(value)} onClick={() => toggle(axis, value)}><MiniOptionThumb kind={axis} value={value}/><span>{label}</span></button>)}</div></fieldset>)}
        <div className="desk-current-base"><span>沿用当前款式</span><strong>{c.size} · {workbench.gender === 'male' ? '男款' : '当前性别'}<i style={{background:c.color}} /></strong><p>模板、人体尺寸和配色在左侧统一调整。</p></div><div className="desk-summary"><strong>{Object.values(c.choices).map(a => a.length).join(' × ')} = {candidates.length}款</strong><p>按你的选择展开，逐页比较。</p></div><p className="desk-fineprint">当前为设计与裁片参考。未配套的结构保留为需求；领条、材料和工艺仍需完善。</p></> : <div className="desk-template-pending"><p>{template.scope}</p><p>这款还未接入定制选项，先查看配套裁片和缺口。</p><button onClick={() => { if(workbench.gender !== 'male') { setNotice('请先在左侧选择男款，再选圆领短T。'); return; } workbench.applyPattern('t-shirt'); }}>选用当前尺寸的基础短T</button></div>}
    </aside></div></section>;
}
