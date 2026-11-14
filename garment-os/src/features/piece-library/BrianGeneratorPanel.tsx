import { PieceFilterControls } from './PieceFilterControls';
import { useMemo, useState } from 'react';
import { useStagedMeasurements } from './useStagedMeasurements';
import { ReferenceSymbols } from '@/features/canvas/components/ReferenceSymbols';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { matchesTagFilter } from '@/lib/pattern/piece-tags';
import { getReferenceMeasurements, referenceProfileId } from '@/data/referenceMeasurements';
import { generateReferencePieces, generateReferenceSizes, REFERENCE_FIELDS, type ReferenceGeneratedPiece } from '@/lib/pattern/reference/generator';
import { BRIAN_VERSION } from '@/lib/pattern/reference/brian';
import { flattenChain } from '@/lib/pattern/geometry';
import type { BodyMeasurements, StandardSize } from '@/types/measurements';

const button: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 5, padding: '5px 10px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 };
const SIZES: StandardSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#ea580c', '#db2777', '#57534e'];
export function BrianGeneratorPanel() {
  const storeMeasurements = useDesignStore(s => s.measurements);
  const gender = useDesignStore(s => s.gender);
  const fit = useDesignStore(s => s.fit);
  const { measurements:m, setMeasurements:setM,isStaged } = useStagedMeasurements(storeMeasurements);
  const [size, setSize] = useState<StandardSize>('M');
  const [source, setSource] = useState('当前设计测量值');
  const [pieceId, setPieceId] = useState('front-body');
  const [overlay, setOverlay] = useState(true);
  const [controls, setControls] = useState(false);
  const [showCut, setShowCut] = useState(false);
  const [grading, setGrading] = useState(false);
  const filter = usePieceLibraryStore(s => s.tagFilter);
  const toggle = usePieceLibraryStore(s => s.toggleTagFilter);
  const clear = usePieceLibraryStore(s => s.clearTagFilter);
  const generated = useMemo(() => {
    try { return { result: generateReferencePieces(m, { fit }), error: '' }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [m, fit]);
  const visible = generated.result?.pieces.filter(p => matchesTagFilter(p.tags, filter)) ?? [];
  const selected = visible.find(p => p.id === pieceId) ?? visible[0];
  const setField = (field: keyof BodyMeasurements, value: number | undefined) => {
    setM(prev => ({ ...prev, [field]: value })); setSource('自定义测量值 · 待复核');
  };
  const loadSample = () => { setM(getReferenceMeasurements(gender, size)); setSource(`${referenceProfileId(gender, size)} · 测试样本`); };
  const apply = () => {
    if (!generated.result?.draft.geometryPass) return;
    const store = useDesignStore.getState();
    store.updateMeasurements(m);
    store.applyPattern('brian-reference');
  };
  return <div data-testid="brian-generator" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', color: 'var(--text-primary)' }}>
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <strong>参数化裁片 · Brian 参考基型</strong>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>FreeSewing {BRIAN_VERSION} · 前片 / 后片 / 装袖 · 毫米坐标</span>
      <span style={{ flex: 1 }} />
      <button style={button} data-testid="reference-apply" disabled={!generated.result?.draft.geometryPass} onClick={apply}>应用这套基型到画布</button>
    </div>
    <div style={{ padding: '7px 16px', fontSize: 11, lineHeight: 1.7, background: '#fff7e6', color: '#874d00', borderBottom: '1px solid #ffe7ba' }}>
      参考实现用于男装基础衣身。几何对照与生产验收分开：尚未完成试坯、面料工艺校准和生产交换文件核验。领、袖口、门襟、口袋仍待单独建立标准。
    </div>
    <div className="pattern-generator-layout" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <aside className="pattern-generator-controls" style={{ width: 282, padding: 12, overflowY: 'auto', borderRight: '1px solid var(--border)', flexShrink: 0 }}>
        <strong style={{ fontSize: 12 }}>测量来源</strong>
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          <select aria-label="参考样本尺码" style={{ ...button, padding: 4 }} value={size} onChange={e => setSize(e.target.value as StandardSize)}>{SIZES.map(s => <option key={s}>{s}</option>)}</select>
          <button style={button} onClick={loadSample} data-testid="load-reference-sample">载入参考样本</button>
        </div>
        <div data-testid="measurement-source" style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6, margin: '6px 0 12px' }}>{isStaged ? source : '当前设计测量值'}<br />XS～XXXL 是项目样本别名，非认证尺码表。</div>
        <strong style={{ fontSize: 12 }}>制版输入</strong>
        {REFERENCE_FIELDS.map(f => <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, fontSize: 11 }}>
          <span style={{ width: 94 }}>{f.label}</span>
          <input aria-label={f.label} data-testid={`reference-input-${f.id}`} type="number" min={f.min} max={f.max} step={f.step} value={Number.isFinite(m[f.id]) ? m[f.id] : ''} onChange={e => setField(f.id, e.target.value === '' ? undefined : Number(e.target.value))}
            style={{ width: 86, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-muted)' }}>{f.unit}</span>
        </label>)}
        <button style={{ ...button, marginTop: 10 }} onClick={() => { setM({ ...storeMeasurements }); setSource('当前设计测量值'); }}>读取当前设计</button>
        <div style={{ margin: '15px 0 8px', fontSize: 12, fontWeight: 600 }}>裁片类型筛选</div>
        <PieceFilterControls filter={filter} toggle={toggle} clear={clear} prefix="reference" />
      </aside>
      <main className="pattern-generator-preview" style={{ flex: 1, overflowY: 'auto', padding: 14, minWidth: 0 }}>
        {generated.error && <div role="alert" data-testid="reference-error" style={{ padding: 18, color: '#b91c1c', background: '#fef2f2' }}>{generated.error}。已停止生成，请补齐或修正测量数据。</div>}
        {generated.result && <>
          <div data-testid="reference-checks" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, marginBottom: 12 }}>
            {generated.result.draft.checks.map(c => <span key={c.id} style={{ border: '1px solid var(--border)', padding: '5px 9px', borderRadius: 5, color: c.pass ? '#166534' : '#b91c1c' }} data-check={c.id} data-pass={c.pass}>{c.label} {c.valueMm.toFixed(3)} mm / ≤{c.toleranceMm} mm</span>)}
          </div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
            {visible.map(p => <button key={p.id} data-testid={`reference-piece-${p.id}`} style={{ ...button, borderColor: selected?.id === p.id ? '#2563eb' : 'var(--border)', color: selected?.id === p.id ? '#2563eb' : 'var(--text-primary)' }} onClick={() => { setPieceId(p.id); setGrading(false); }}>{p.name} · {p.onFold ? '半片对折裁 ×1' : '镜像对裁 ×2'}</button>)}
          </div>
          {!selected && <div data-testid="reference-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>当前筛选没有已建立参考的裁片。该类型仍待建库。</div>}
          {selected && <>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, flexWrap: 'wrap', margin: '8px 0' }}>
              <label><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} /> 叠加上游净样</label>
              <label><input type="checkbox" checked={controls} onChange={e => setControls(e.target.checked)} /> 控制点与点号</label>
              <label><input type="checkbox" checked={showCut} onChange={e => setShowCut(e.target.checked)} /> 上游缝份 10 mm</label>
              <button style={{ ...button, padding: '1px 8px' }} onClick={() => setGrading(!grading)}>{grading ? '返回单片' : '多样本尺寸对照'}</button>
            </div>
            {grading ? <SampleNest gender={gender} pieceId={selected.id} fit={fit} /> : <ReferencePreview piece={selected} overlay={overlay} controls={controls} showCut={showCut} />}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 7, lineHeight: 1.8 }}>蓝色：本地净样 橙色虚线：上游净样 灰色：缝份。坐标与长度均为 mm；显示缩放不改变原始数据。<br />净样材料面积（对折片已展开计数）：{(generated.result.netAreaPerGarmentMm2 / 1e6).toFixed(4)} m²；含缝份用料与排料待核验。</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <table data-testid="reference-dimensions" style={{ fontSize: 11, borderCollapse: 'collapse', flex: 1 }}><caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: 8 }}>逐边净样尺寸 · {selected.upstreamPart}</caption><thead><tr><th>边</th><th>语义</th><th>弧/线长 mm</th><th>起点 → 终点</th></tr></thead><tbody>{selected.dimensions.map((d, i) => <tr key={i} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: 5 }}>{d.label}</td><td>{d.role}</td><td style={{ textAlign: 'right', padding: 5 }}>{d.lengthMm.toFixed(3)}</td><td style={{ padding: 5 }}>({d.from.x.toFixed(2)}, {d.from.y.toFixed(2)}) → ({d.to.x.toFixed(2)}, {d.to.y.toFixed(2)})</td></tr>)}</tbody></table>
              <table style={{ fontSize: 11, borderCollapse: 'collapse' }}><caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: 8 }}>关键尺寸</caption><tbody>{selected.keyDims.map(d => <tr key={d.label} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: 5 }}>{d.label}</td><td style={{ textAlign: 'right', padding: 5 }}>{d.value.toFixed(3)} mm</td></tr>)}</tbody></table>
            </div>
            <details style={{ marginTop: 14, fontSize: 11 }}><summary>全部关键点及控制点坐标（{selected.points.length}）</summary><table><tbody>{selected.points.map(p => <tr key={p.label}><td>{p.label}</td><td>{p.x.toFixed(6)}</td><td>{p.y.toFixed(6)}</td></tr>)}</tbody></table></details>
          </>}
        </>}
      </main>
    </div>
  </div>;
}

function bounds(pieces: ReferenceGeneratedPiece[]) {
  const points = pieces.flatMap(p => p.edges.flatMap(e => flattenChain(e.start, e.segs, 1)));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x = Math.min(...xs) - 45, y = Math.min(...ys) - 45;
  return { x, y, w: Math.max(...xs) - x + 45, h: Math.max(...ys) - y + 45 };
}
function ReferencePreview({ piece, overlay, controls, showCut }: { piece: ReferenceGeneratedPiece; overlay: boolean; controls: boolean; showCut: boolean }) {
  const b = bounds([piece]);
  const controlLines = piece.edges.flatMap(e => e.segs.filter(s => s.kind === 'C').map(s => s.kind === 'C' ? `M${e.start.x} ${e.start.y}L${s.c1.x} ${s.c1.y}M${s.to.x} ${s.to.y}L${s.c2.x} ${s.c2.y}` : ''));
  return <svg data-testid="reference-preview" data-piece-id={piece.id} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={{ width: '100%', height: 470, display: 'block', background: '#fafaf8', border: '1px solid #e2e8f0', borderRadius: 6 }}>
    <defs><pattern id="ref-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" stroke="#e5e7eb" strokeWidth="0.4" fill="none" /></pattern></defs>
    <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="url(#ref-grid)" />
    {showCut && <path data-layer="cutting" d={piece.cuttingPathD} fill="none" stroke="#64748b" strokeWidth="1" />}
    <path data-layer="net" d={piece.netPathD} fill="#eff6ff" fillOpacity="0.65" stroke="#2563eb" strokeWidth="1.4" />
    <ReferenceSymbols />
    <path data-layer="grain" d={piece.grainPathD} markerStart={piece.grainMarkerStart} markerEnd={piece.grainMarkerEnd} fill="none" stroke="#0f766e" strokeWidth="1" />
    {overlay && <path data-layer="reference" d={piece.referencePathD} fill="none" stroke="#ea580c" strokeWidth="1" strokeDasharray="5 4" />}
    {controls && <g>{controlLines.map((d, i) => <path key={i} d={d} stroke="#94a3b8" strokeWidth="0.7" fill="none" />)}{piece.points.filter(p => !['title', 'logo', 'gridAnchor'].includes(p.label)).map(p => <g key={p.label}><circle cx={p.x} cy={p.y} r="1.8" fill="#0f172a" /><text x={p.x + 3} y={p.y - 3} fontSize="7" fill="#334155">{p.label}</text></g>)}</g>}
    <text x={b.x + 8} y={b.y + 16} fontSize="10" fill="#475569">{piece.upstreamPart} · 10 mm 网格</text>
  </svg>;
}
function SampleNest({ gender, pieceId, fit }: { gender: 'male' | 'female' | 'unisex'; pieceId: string; fit: 'slim' | 'regular' | 'loose' }) {
  const samples = useMemo(() => generateReferenceSizes(gender, SIZES, { fit }).map(g => ({ size: g.size, piece: g.result.pieces.find(p => p.id === pieceId)! })), [gender, pieceId, fit]);
  const b = bounds(samples.map(s => s.piece));
  return <div><svg data-testid="reference-size-overlay" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} style={{ width: '100%', height: 470, background: '#fafaf8' }}>{samples.map((s, i) => <path key={s.size} data-size={s.size} d={s.piece.netPathD} fill="none" stroke={COLORS[i]} strokeWidth="1.2" />)}</svg><div style={{ display: 'flex', gap: 14, fontSize: 11 }}>{samples.map((s, i) => <span key={s.size} style={{ color: COLORS[i] }}>{s.size}</span>)}</div><p style={{ fontSize: 11, color: 'var(--text-muted)' }}>每个样本独立重制图，用于参数响应对照；尚未建立生产放码规则。</p></div>;
}
