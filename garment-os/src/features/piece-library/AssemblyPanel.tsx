import { PIECE_MATERIALS } from '@/data/pieceTaxonomy';
import { useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceQC } from './usePieceQC';
import { createAssemblyRecord } from '@/application/assembly-record';
import { downloadText } from '@/features/files/browser-files';
import { flattenSvgPathD } from '@/lib/pattern/geometry';
import type { AssemblyReport, BoundaryUse, JoinResult } from '@/types/assembly';
import type { PatternPath } from '@/types/pattern';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { PieceFilterControls } from './PieceFilterControls';

const box = { border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginBottom: 12 };
const button = { padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' };
const mm = (value: number | null) => value === null ? '未计算' : `${value.toFixed(3)} mm`;
const stateLabel = { passed: '走缝通过', pending: '完成态待核验', failed: '已阻断' };
const stateColor = { passed: '#237b49', pending: '#ad6800', failed: '#cf1322' };
const stationLabels: Record<string, string> = { 'armhole-top': '袖窿肩端', neck: '颈点', hem: '下摆端', underarm: '腋下', cuff: '袖下口',
  'underarm-front': '前腋下', 'underarm-back': '后腋下', shoulder: '肩缝接点', 'yoke-junction': '后袖窿过肩接点', 'yoke-armhole': '过肩袖窿端', 'center-back': '后中心' };

function InterfaceDrawing({ use, report, paths }: { use: BoundaryUse; report: AssemblyReport; paths: PatternPath[] }) {
  const piece = report.pieces.find(p => p.id === use.piece), boundary = report.boundaries.find(b => b.piece === use.piece && b.id === use.boundary);
  const contour = paths.find(p => p.pieceId === use.piece && p.layer === 'seam-line');
  if (!piece || !boundary) return <p role="alert">接口缺失：{use.piece}/{use.boundary}</p>;
  const samples = contour ? flattenSvgPathD(contour.data, 48) : [];
  const xs = samples.map(p => p.x), ys = samples.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  return <article data-assembly-interface={`${use.piece}/${use.boundary}`} style={{ ...box, minWidth: 180, flex: '1 1 180px' }}>
    <div style={{ fontWeight: 600 }}>{piece.name} · {boundary.label}</div>
    {contour && <svg aria-label={`${piece.name}${boundary.label}净边定位`} viewBox={`${minX - 15} ${minY - 15} ${width + 30} ${height + 30}`} style={{ width: '100%', height: 210, background: '#fafaf8' }}>
      <path d={contour.data} fill="none" stroke="#9ca3af" strokeWidth={1} />
      <path data-assembly-edge={`${use.piece}/${use.boundary}`} d={boundary.pathD} fill="none" stroke="#c2410c" strokeWidth={2.5} />
    </svg>}
    <div>{mm(boundary.lengthMm)} × {use.runs} 遍 · {use.layers} 层</div>
    {boundary.stations && <div>配缝方向：{(use.reverse ? [...boundary.stations].reverse() : boundary.stations).map(s => stationLabels[s] ?? s).join(' → ')}（{use.reverse ? '逆源边方向' : '顺源边方向'}）</div>}
    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>橙线为源净边；层数计入用片，走缝长度按遍数计算。</div>
  </article>;
}

function JoinDetails({ join, report, paths, visible }: { join: JoinResult; report: AssemblyReport; paths: PatternPath[]; visible: Set<string> }) {
  const sides: Array<[string, BoundaryUse[]]> = [['A', join.a], ['B', join.b]];
  return <div data-testid="assembly-join-details" style={box}>
    <b>{join.label}</b> · <span style={{ color: stateColor[join.status] }}>{stateLabel[join.status]}</span>
    <p>{join.basis}</p>
    {join.directionChecked && <p>起止语义与连续配缝顺序已检查。</p>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {sides.map(([side, uses]) => <div key={side} style={{ flex: '1 1 250px' }}>
        <b>{side} 侧</b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{uses.filter(u => visible.has(u.piece)).map((u, i) => <InterfaceDrawing key={`${u.piece}/${u.boundary}/${i}`} use={u} report={report} paths={paths} />)}</div>
        {uses.some(u => !visible.has(u.piece)) && <p style={{ color: 'var(--text-muted)' }}>筛选已隐藏其他裁片图形，完整关系仍参与检查。</p>}
      </div>)}
    </div>
    <p>A 侧合计 {mm(join.aLengthMm)} · B 侧合计 {mm(join.bLengthMm)} · A−B {mm(join.deltaMm)}</p>
    {join.status === 'pending' && <p style={{ color: '#ad6800' }}>此表显示原始净边；部件组合页已计算设计量与去褶基准，尚未执行褶量、翻折或搭门的完整几何变换，长度相近也不会自动通过。</p>}
  </div>;
}

/** Filtering changes the inspection view, never the complete assembly that is audited. */
export function AssemblyPanel() {
  const draft = useDesignStore(s => s.draft), { visiblePieces } = usePieceQC();
  const filter = usePieceLibraryStore(s => s.tagFilter), toggleFilter = usePieceLibraryStore(s => s.toggleTagFilter), clearFilter = usePieceLibraryStore(s => s.clearTagFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const report = draft.assembly;
  if (!report) return <div role="alert" style={{ padding: 20 }}>当前没有可用结构检查：{draft.error ?? '请先选择已审查模板。'}</div>;
  const visible = new Set(visiblePieces.map(p => p.key));
  // A blocked report remains available for diagnosis after render paths have been withdrawn.
  const visibleJoins = report.joins.filter(j => report.status === 'blocked' || [...j.a, ...j.b].some(u => visible.has(u.piece)));
  const selected = visibleJoins.find(j => j.id === selectedId) ?? visibleJoins[0];
  const exportRecord = () => {
    try {
      const s = useDesignStore.getState();
      const record = createAssemblyRecord(s.getConfiguration(), s.draft);
      downloadText(JSON.stringify(record, null, 2), `${s.activePatternId}-${s.standardSize}-结构验收.json`, 'application/json');
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <div data-testid="assembly-panel" style={{ flex: 1, overflow: 'auto', padding: 16, color: 'var(--text-primary)', fontSize: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <h3 style={{ marginTop: 0 }}>裁片组成与装配</h3><button style={button} onClick={exportRecord}>导出本例验收记录</button>
    </div>
    <div data-testid="assembly-summary" style={box}>
      <b>{report.integrityPass ? '结构完整性检查通过' : '结构检查已阻断'}</b> · {report.pieces.length} 种源裁片 · {report.coverage.classifiedEdges}/{report.coverage.totalEdges} 条净边已分类<br />
      {report.joins.filter(j => j.status === 'passed').length} 组走缝通过 · {report.joins.filter(j => j.status === 'pending').length} 组装配待定义 · {report.engine} {report.version}<br />
      完整模板始终参与检查；筛选只影响下方明细。源裁片种类与实际裁剪片数分别计数。
    </div>
    {(error || report.errors.length > 0) && <div role="alert" style={{ ...box, color: '#cf1322' }}>{error}{report.errors.map((e, i) => <p key={i}>{e.subject}：{e.message}</p>)}</div>}
    <details style={box}>
      <summary>裁剪组成清单（{report.pieces.length} 种，含材料层指令）</summary>
      <table style={{ width: '100%', marginTop: 10, textAlign: 'left' }}><thead><tr><th>裁片</th><th>主材料</th><th>裁剪数量</th><th>对折</th><th>衬料数量</th></tr></thead>
        <tbody>{report.pieces.filter(p => report.status === 'blocked' || visible.has(p.id)).map(p => <tr key={p.id} data-assembly-piece={p.id}><td>{p.name}</td><td>{PIECE_MATERIALS.find(m=>m.id===(p.primaryMaterial??'fabric'))?.label??p.primaryMaterial}</td><td>{p.quantity}</td><td>{p.onFold ? '是' : '否'}</td><td>{p.materials.interfacing?.reduce((sum, c) => sum + c.cut, 0) ?? '未声明'}</td></tr>)}</tbody>
      </table>
      <p style={{ color: 'var(--text-muted)' }}>数量来自上游材料裁剪指令；对折展开不增加裁剪片数。衬料未声明保留未知；本清单尚不包含排料和采购用量。</p>
    </details>
    <div aria-label="组成明细筛选" style={box}>
      <PieceFilterControls filter={filter} toggle={toggleFilter} clear={clearFilter} prefix="assembly" clearLabel="清除组成筛选" />
    </div>
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table aria-label="裁片装配关系" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead><tr><th>关系（点击定位净边）</th><th>A−B 净边差</th><th>阈值</th><th>结果</th></tr></thead>
        <tbody>{visibleJoins.map(j => <tr key={j.id} data-assembly-join={j.id} data-status={j.status} style={{ borderBottom: '1px solid var(--border)' }}>
          <td><button style={{ ...button, margin: '4px 0' }} onClick={() => setSelectedId(j.id)} aria-pressed={selected?.id === j.id}>{j.label}</button></td>
          <td>{mm(j.deltaMm)}</td><td>{j.toleranceMm === null ? '待定义' : `≤ ${mm(j.toleranceMm)}`}</td><td style={{ color: stateColor[j.status] }}>{stateLabel[j.status]}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {selected ? <JoinDetails join={selected} report={report} paths={draft.paths} visible={visible} /> : <p data-testid="assembly-empty">当前筛选没有对应装配关系。</p>}
    <details style={box}><summary>尚未完成的装配规则（{report.pending.length} 项）</summary>{report.pending.map((p, i) => <p key={i}>{p.message}</p>)}</details>
  </div>;
}
