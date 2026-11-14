import { useMemo, useState } from 'react';
import { buildTeeFoundation, requireTeeFoundationCombination } from '@/application/tee-foundation';
import type { TeeFoundationFamily } from '@/application/tee-foundation';
import type { StandardSize } from '@/types/measurements';
import { flattenSvgPathD } from '@/lib/pattern/geometry';
import type { BoundaryResult } from '@/types/assembly';
import './tee-foundation-studio.css';

const families = [{ id: 'set-in', label: '装袖短T', status: '主体配套' }, { id: 'raglan', label: '插肩结构', status: '源版核对' }, { id: 'drop', label: '落肩短T', status: '缺配套基版' }] as const;
const colors = ['#246c85', '#b26b2f', '#7a5b98', '#3b8063', '#b15361'];
const describe = (id: string, piece: string) => ({ frontNotch: '前袖剪口', backNotch: '后袖剪口（双）', armholeNotch: piece.endsWith('.back') ? '后袖窿剪口（双）' : '前袖窿剪口', sleeveNotch: piece.endsWith('.back') ? '后插肩剪口（双）' : '前插肩剪口', shoulderNotch: '肩部定位剪口' })[id] ?? id;
function boundaryPoint(b: BoundaryResult) {
  const points = flattenSvgPathD(b.pathD, 24); return points[Math.floor(points.length / 2)];
}

export function TeeFoundationStudio() {
  const [family, setFamily] = useState<TeeFoundationFamily>('set-in');
  const [size, setSize] = useState<StandardSize>('M');
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [cut, setCut] = useState(true);
  const state = useMemo(() => {
    try { return { data: buildTeeFoundation(family, size), error: null }; }
    catch (e) { return { data: null, error: String(e) }; }
  }, [family, size]);
  const d = state.data;
  const layout = useMemo(() => {
    const measured = (d?.pieces ?? []).map(p => {
      const samples = flattenSvgPathD([p.netPath, ...p.cutPaths].join(' '), 48);
      const minX = Math.min(...samples.map(p => p.x)), minY = Math.min(...samples.map(p => p.y));
      const width = Math.max(...samples.map(p => p.x)) - minX, h = Math.max(...samples.map(p => p.y)) - minY;
      return { ...p, minX, minY, width, height: h };
    });
    const pieces = measured.map((p, i) => ({ ...p, x: 22 + measured.slice(0, i).reduce((sum, prev) => sum + prev.width + 65, 0) }));
    return { pieces, width: 32 + measured.reduce((sum, p) => sum + p.width + 65, 0), height: Math.max(0, ...measured.map(p => p.height)) + 140 };
  }, [d]);
  const download = () => {
    const content = JSON.stringify({ schema: 'garment-os/tee-foundation-audit/v1', referenceSize: size, ...d }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = `裁片基础库-${family}-${size}-核对记录.json`; a.click(); URL.revokeObjectURL(url);
  };
  return <main className="tee-foundation" data-testid="tee-foundation-studio">
    <header><div><span className="foundation-eyebrow">GARMENT / PATTERN FOUNDATION</span><h1>男士短T · 基础裁片库</h1><p>原始毫米裁片与配缝关系</p></div><label>参考样本<select aria-label="基础库参考尺码" value={size} onChange={e => { setSize(e.target.value as StandardSize); setSelected(''); }}>
      {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => <option key={s}>{s}</option>)}</select><small>源人体样本别名，非企业尺码表</small></label></header>
    <p className="foundation-withdrawn">基础库以实际裁片与配缝为准。未配套结构暂不可选，款式扩展待基版核对后恢复。</p>
    <nav aria-label="基础袖型">{families.map(f => <button key={f.id} aria-pressed={family === f.id} onClick={() => { setFamily(f.id); setActive(null); setSelected(''); }}><strong>{f.label}</strong><span>{f.status}</span></button>)}</nav>
    {state.error && <p role="alert">裁片读取失败，已停止组合：{state.error}</p>}
    {d && <><section className="foundation-intro"><div><h2>{d.title}</h2><p>{d.source ?? '尚无可执行的源裁片方法'}</p></div><span className={d.selectable ? 'foundation-state' : 'foundation-state blocked'}>{d.selectable ? '主体结构可核对 · 成衣未验收' : '禁止进入短T选款'}</span></section>
      <div className="foundation-workspace"><section className="foundation-drawing"><div className="foundation-board-toolbar"><strong>裁片与接口</strong><label><input type="checkbox" checked={cut} onChange={e => setCut(e.target.checked)} />显示源裁边</label></div>
        {d.pieces.length ? <><p className="foundation-hint">三片保持同一比例；前后身显示半片，对折裁。点击配缝行可高亮相配边。</p><div className="foundation-svg-scroll"><svg role="img" aria-label={`${d.title}真实裁片及配缝接口`} data-foundation-cad={family} viewBox={`0 0 ${layout.width} ${layout.height}`}>
          <rect width={layout.width} height={layout.height} fill="#fff" />
          {layout.pieces.map(p => <g key={p.id} data-foundation-piece={p.id} transform={`translate(${p.x - p.minX} ${65 - p.minY})`}>
            <text x={p.minX} y={p.minY - 32} fontSize="15" fontWeight="600">{p.name}</text><text x={p.minX} y={p.minY - 12} fontSize="11" fill="#606c65">裁{p.quantity}片 · {p.onFold ? '中心对折裁' : '左右袖成对，正反面需核对'}</text>
            <path d={p.netPath} fill="#f4f5f1" stroke="#293b34" strokeWidth="1.1" />
            {cut && p.cutPaths.map((path, i) => <path key={i} d={path} fill="none" stroke="#aa9273" strokeWidth=".8" strokeDasharray="4 3" />)}
            {p.grainPaths.map((path, i) => <path key={i} d={path} fill="none" stroke="#597b9d" strokeWidth=".8" />)}
            {d.report?.boundaries.filter(b => b.piece === p.id).map(b => {
              const matches = d.report!.joins.map((j, i) => ({ j, i })).filter(({ j }) => [...j.a, ...j.b].some(u => u.piece === p.id && u.boundary === b.id));
              const index = (matches.find(({ j }) => j.id === active) ?? matches[0])?.i ?? -1;
              const j = d.report!.joins[index], highlighted = !active || j?.id === active, anchor = boundaryPoint(b);
              return <g key={b.id} data-boundary={b.id} data-join={j?.id ?? ''} opacity={highlighted ? 1 : .13}>
                <path d={b.pathD} fill="none" stroke={index < 0 ? '#98a39c' : colors[index % colors.length]} strokeWidth={active === j?.id ? 4 : 2} />
                {anchor && <text x={anchor.x + 5} y={anchor.y - 5} fontSize="10" fill={index < 0 ? '#69756e' : colors[index % colors.length]} paintOrder="stroke" stroke="white" strokeWidth="3">{b.label}</text>}
              </g>;
            })}
            {p.notches.map((n, i) => <g key={i} data-source-notch={n.label}><path d={`M${n.x - 3} ${n.y - 3}l6 6m-6 0l6 -6`} stroke="#343c39" strokeWidth="1" /><text x={n.x + 6} y={n.y + 12} fontSize="9">{describe(n.label, p.id)}</text></g>)}
          </g>)}
          <g transform={`translate(24 ${layout.height - 25})`}><path d="M0 -4V4M0 0H100M100 -4V4" stroke="#293b34" /><text x="110" y="4" fontSize="11">100 mm / 净样与裁边均取自源版</text></g>
        </svg></div></> : <div className="foundation-empty"><strong>暂无配套裁片</strong><p>先建立落肩衣身与低袖山袖片，完成接口核对后再开放组合。</p></div>}
        {family === 'raglan' && <p className="foundation-structure-note">这套插肩袖延伸至领口，袖片顶端弧线参与组成领圈；前、后插肩缝分别配对。衣身上不保留普通装袖的肩缝与完整袖窿。</p>}
      </section><aside><h3>配缝核对</h3><p className="foundation-hint">颜色对应裁片接口。差值＝A侧−B侧；表内按单条缝显示，左右分别使用同一源版。</p>
        {d.report ? <><table><thead><tr><th>接口</th><th>A / B mm</th><th>差值</th></tr></thead><tbody>{d.report.joins.map((j, i) => {
          const runs = j.a[0]?.runs ?? 1;
          return <tr key={j.id} data-seam-status={j.status} className={active === j.id ? 'active' : ''}><td><button onClick={() => setActive(active === j.id ? null : j.id)} aria-pressed={active === j.id}><i style={{ background: colors[i % colors.length] }} />{j.label.replace('两袖', '').replace('左右', '')}<small>{j.status === 'passed' ? '长度 / 方向核对通过' : j.status === 'failed' ? '不通过，已阻断' : '待定义'}</small></button></td><td>{j.aLengthMm === null ? '未知' : (j.aLengthMm / runs).toFixed(1)} / {j.bLengthMm === null ? '未知' : (j.bLengthMm / runs).toFixed(1)}</td><td>{j.deltaMm === null ? '未知' : (j.deltaMm / runs).toFixed(2)}</td></tr>;
        })}</tbody></table><p className="foundation-hint">{d.report.coverage.classifiedEdges} / {d.report.coverage.totalEdges}条源轮廓边已分类。长度一致不代表穿着效果已验证。</p></> : <p>缺少裁片，无法计算配缝。</p>}
        <h3>未完成项</h3><ul>{d.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
        <button className="foundation-use" disabled={!d.selectable} onClick={() => { requireTeeFoundationCombination(d, d.pieces.map(p => p.id)); setSelected('已采用装袖主体组合：前身 ×1对折、后身 ×1对折、短袖 ×2。领条与工艺仍需核对。'); }}>采用此主体组合</button>
        {selected && <p role="status" data-combination-selection>{selected}</p>}
        <button className="foundation-export" onClick={download}>导出核对记录</button>
      </aside></div><footer>当前只核对基础裁片。领型、面料肌理和改款矩阵待基版配套后恢复；未提交任何生图任务。</footer>
    </>}
  </main>;
}
