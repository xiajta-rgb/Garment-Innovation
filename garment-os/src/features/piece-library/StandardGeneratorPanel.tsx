import {PANTS_PATTERN_ID,PANTS_MEASUREMENT_FIELDS} from '@/data/foundationMethods';
import { PieceFilterControls } from './PieceFilterControls';
import { ReferenceSymbols } from '@/features/canvas/components/ReferenceSymbols';
import { useMemo, useState } from 'react';
import { useStagedMeasurements } from './useStagedMeasurements';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { REFERENCE_FIELDS } from '@/lib/pattern/reference/generator';
import { groupSolutionPieces, measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import { cuttingLabel, matchesTagFilter } from '@/lib/pattern/piece-tags';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { SKIRT_PATTERN_ID,SKIRT_MEASUREMENT_FIELDS } from '@/data/skirtMethods';
const button: React.CSSProperties = { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 9px', cursor: 'pointer', fontSize: 11 };
const upperBodyFields = [...REFERENCE_FIELDS, { id: 'waist' as const, label: '腰围', min: 400, max: 1800, unit: 'mm', step: 1 }, { id: 'hip' as const, label: '臀围', min: 500, max: 1900, unit: 'mm', step: 1 }];
export function StandardGeneratorPanel() {
  const id = useDesignStore(s => s.activePatternId), original = useDesignStore(s => s.measurements), fit = useDesignStore(s => s.fit);
  const fields = id===PANTS_PATTERN_ID?PANTS_MEASUREMENT_FIELDS.map(f=>({...f,unit:'mm',step:1})):id===SKIRT_PATTERN_ID?SKIRT_MEASUREMENT_FIELDS:id==='hooded-zip-sweatshirt'?[...upperBodyFields,{id:'headCirc' as const,label:'头围',min:400,max:750,unit:'mm',step:1}]:upperBodyFields;
  const construction = useDesignStore(s => s.construction);
  const { measurements:m, setMeasurements:setM } = useStagedMeasurements(original);
  const [selectedId, setSelectedId] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [showCut, setShowCut] = useState(true);
  const [showGrain, setShowGrain] = useState(true);
  const filter = usePieceLibraryStore(s => s.tagFilter), toggle = usePieceLibraryStore(s => s.toggleTagFilter), clear = usePieceLibraryStore(s => s.clearTagFilter);
  const generated = useMemo(() => {
    try { return { draft: draftStandard(id, m, fit, construction), error: '' }; }
    catch (err) { return { draft: null, error: err instanceof Error ? err.message : String(err) }; }
  }, [id, m, fit, construction]);
  const pieces = generated.draft?.pieces ?? [];
  const groups = groupSolutionPieces(pieces.flatMap(p => p.paths));
  const visible = pieces.filter(p => matchesTagFilter(groups.find(g => g.key === p.id)?.tags ?? [], filter));
  const selected = visible.find(p => p.id === selectedId) ?? visible[0];
  const bounds = selected ? measurePieceBboxFull(selected.paths.map(p => ({ ...p, transform: undefined }))) : null;
  return <section data-testid="standard-generator" style={{ width: '100%', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)' }}>
    <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <strong>{PATTERN_LIBRARY[id]?.name} · 参数生成器</strong><span style={{ flex: 1 }} />
      <button style={button} disabled={!generated.draft} data-testid="standard-apply" onClick={() => useDesignStore.getState().updateMeasurements(m)}>应用参数到画布</button>
    </div>
    <div style={{ padding: '8px 12px', color: '#874d00', background: '#fff7e6', fontSize: 11, lineHeight: 1.6 }}>{PATTERN_REVIEWS[id]?.limitations} 净样、源裁边及裁剪数量来自同一完整制图。展示位置不代表排料。</div>
    <div className="pattern-generator-layout" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <aside className="pattern-generator-controls" style={{ width: 265, flexShrink: 0, overflowY: 'auto', padding: 12, borderRight: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11 }}>{id===PANTS_PATTERN_ID?'基础裤装使用独立下身测量；前后腰臀弧和裆弧必须实测，不能当作围度的一半。裤长变化、脚口和腰头在工艺构成中联动调整。':id===SKIRT_PATTERN_ID?'只使用裙装所需的身体数据。成品裙长为腰头顶至裙摆的设计长度，包含腰头高度；参考款默认取源样本腰到膝长度，可独立修改。胸围、肩宽和上装衣长不参与裙装解算。':`人体测量与成衣衣长分别输入。${['t-shirt','womens-basic-tee'].includes(id)?'短袖延伸和袖口宽度可在部件构型中修改；实际成品袖长以源关键点与报告为准。':id==='hooded-zip-sweatshirt'?'头围为独立测量，帽底由领窝真实弧长驱动。':id==='bound-tank'?'无袖衣身与四折包条同步解算。':'长短袖和配套片按当前构型解算。'}`}</p>
        {fields.map(f => <label key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, marginBottom: 7 }}>
          <span style={{ width: 100 }}>{f.label}</span><input aria-label={f.label} data-testid={`standard-input-${f.id}`} type="number" min={f.min} max={f.max} step={f.step} value={Number.isFinite(m[f.id]) ? m[f.id] : ''} onChange={e => setM(prev => ({ ...prev, [f.id]: e.target.value === '' ? undefined : Number(e.target.value) }))} style={{ ...button, width: 79 }} /><span>{f.unit}</span>
        </label>)}
        <PieceFilterControls filter={filter} toggle={toggle} clear={clear} prefix="standard" />
      </aside>
      <main className="pattern-generator-preview" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 14 }}>
        {generated.error && <div role="alert">生成已阻断：{generated.error}</div>}
        {generated.draft && <p data-testid="standard-checks" style={{ fontSize: 11 }}>{generated.draft.checks.length?`${generated.draft.checks.map(c => `${c.id}: ${c.valueMm.toFixed(3)} / ≤${c.toleranceMm} mm`).join('；')}（制图迭代阈值，生产公差待确认）`:id===SKIRT_PATTERN_ID?'裙幅半径、含腰头裙长、折返高度及源裁法已核对；腰头请求高度与源实际高度见工艺构成报告。开口与完成态配缝待验证。':'源裁片几何已核对；完成态配缝及生产公差待验证。'}</p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{visible.map(p => <button key={p.id} data-standard-piece={p.id} onClick={() => setSelectedId(p.id)} style={{ ...button, borderColor: selected?.id === p.id ? '#2563eb' : undefined }}>{p.name} · {cuttingLabel(p.paths[0])}</button>)}</div>
        {!selected && !generated.error && <p data-testid="standard-empty">当前筛选没有裁片。</p>}
        {selected && bounds && <>
          <p style={{ fontSize: 11 }}>{selected.id} · 上游原始坐标 mm · 净样蓝色 · 源裁边灰色 · 生产待验收</p>
          {selected.id === 'simon.collar' && <p style={{ fontSize: 11, color: '#ad6800' }}>领底参考线与其缝份用虚线保留。领面 / 领底差异尚未拆为独立生产裁片，不能把两片视作相同形状下料。</p>}
          <div style={{ display: 'flex', gap: 14, fontSize: 11, marginBottom: 8 }}><label><input type="checkbox" checked={showCut} onChange={e => setShowCut(e.target.checked)} />源裁边</label><label><input type="checkbox" checked={showGrain} onChange={e => setShowGrain(e.target.checked)} />布纹 / 对折</label><label><input type="checkbox" checked={showControls} onChange={e => setShowControls(e.target.checked)} />点号与坐标</label></div>
          <svg data-testid="standard-preview" data-piece-id={selected.id} viewBox={`${bounds.minX-30} ${bounds.minY-30} ${bounds.maxX-bounds.minX+60} ${bounds.maxY-bounds.minY+60}`} style={{ width: '100%', height: 480, display: 'block', background: '#fafaf8', border: '1px solid #ddd' }}>
            <ReferenceSymbols />
            {selected.paths.filter(p => (showCut || p.layer !== 'cutting-line') && (showGrain || p.layer !== 'grain-line')).map(p => <path key={p.id} data-source-path={p.id} d={p.data} markerStart={p.markerStart} markerEnd={p.markerEnd} fill="none" stroke={p.layer === 'seam-line' ? '#2563eb' : p.layer === 'cutting-line' ? '#64748b' : '#0f766e'} strokeWidth={1} strokeDasharray={p.strokeDasharray ?? (p.layer === 'fold-line' ? '4 3' : undefined)} />)}
            {showControls && Object.entries(selected.points).map(([key,p]) => <g key={key}><circle cx={p.x} cy={p.y} r={1.5} fill="#333" /><text x={p.x+3} y={p.y-3} fontSize={6} fill="#333">{key}</text></g>)}
          </svg>
          <p style={{ fontSize: 11 }}>净样外包尺寸（不是缝合尺寸）：{(() => { const b = measurePieceBboxFull([{ ...selected.paths[0], transform: undefined }]); return `${(b.maxX-b.minX).toFixed(3)} × ${(b.maxY-b.minY).toFixed(3)} mm`; })()}<br />{selected.paths[0]?.referenceCutMode==='source-net-as-cut'?'源展开裁边（不另加缝份）':'上游缝份段'} {Object.keys(selected.cutPaths).length}；{Object.keys(selected.grainPaths).length ? '方向标记已保留' : '上游未标布纹：生产交付缺口'}</p>
          <details open><summary>轮廓逐段实长与端点</summary><table style={{ fontSize: 11 }}><thead><tr><th>段</th><th>类型</th><th>长度 mm</th><th>起点 → 终点 mm</th></tr></thead><tbody>{selected.edges.map(e => <tr key={e.index}><td>{e.index}</td><td>{e.kind}</td><td>{e.lengthMm.toFixed(3)}</td><td>({e.from.x.toFixed(2)}, {e.from.y.toFixed(2)}) → ({e.to.x.toFixed(2)}, {e.to.y.toFixed(2)})</td></tr>)}</tbody></table></details>
          <details><summary>关键点与控制点坐标（{Object.keys(selected.points).length}）</summary><table style={{ fontSize: 11 }}><thead><tr><th>点号</th><th>x mm</th><th>y mm</th></tr></thead><tbody>{Object.entries(selected.points).map(([key,p]) => <tr key={key}><td>{key}</td><td>{p.x.toFixed(6)}</td><td>{p.y.toFixed(6)}</td></tr>)}</tbody></table></details>
          <details><summary>上游裁剪指令</summary><pre style={{ fontSize: 11 }}>{JSON.stringify(selected.cutInstructions, null, 2)}</pre></details>
        </>}
      </main>
    </div>
  </section>;
}
