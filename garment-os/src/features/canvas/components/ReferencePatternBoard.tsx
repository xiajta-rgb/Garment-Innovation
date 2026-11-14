import { ReferenceSymbols } from '@/features/canvas/components/ReferenceSymbols';
import { cuttingLabel } from '@/lib/pattern/piece-tags';
import { usePieceQC } from '@/features/piece-library/usePieceQC';
import { measurePieceBboxFull } from '@/lib/pattern/piece-registry';

/** Pattern view reads the exact same checked paths as Sketch and the piece library. */
export default function ReferencePatternBoard() {
  const { visiblePieces: visible } = usePieceQC();
  return <div data-testid="reference-pattern-board" style={{ height: '100%', overflowY: 'auto', padding: 16, boxSizing: 'border-box', color: 'var(--text-primary)' }}>
    <div style={{ fontSize: 13, fontWeight: 600 }}>裁片总览 · {visible.length} 片</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 14px' }}>与生成器和画布共用参考几何 · 坐标为 mm · 显示缩放 · 生产待验收</div>
    {visible.length === 0 && <div data-testid="reference-board-empty" style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>当前没有通过参考检查且符合筛选的裁片。</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      {visible.map(piece => {
        const b = measurePieceBboxFull(piece.paths);
        const w = b.maxX - b.minX, h = b.maxY - b.minY, margin = 22;
        return <article key={piece.key} data-board-piece={piece.key} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{piece.name} · {cuttingLabel(piece.paths[0])}</div>
          <svg viewBox={`${b.minX - margin} ${b.minY - margin} ${w + margin * 2} ${h + margin * 2}`} style={{ width: '100%', height: 330, display: 'block', background: '#fafaf8' }}>
            <ReferenceSymbols />
            {piece.paths.map(p => <path key={p.id} data-board-source={p.id} d={p.data} markerStart={p.markerStart} markerEnd={p.markerEnd} transform={p.transform} fill="none" stroke={p.layer === 'seam-line' ? '#2563eb' : p.layer === 'cutting-line' ? '#64748b' : '#0f766e'} strokeWidth={p.layer === 'seam-line' ? 1.5 : 0.9} strokeDasharray={p.strokeDasharray ?? (p.layer === 'seam-line' ? '4 3' : undefined)} />)}
          </svg>
          <div style={{ fontSize: 10, padding: '8px 12px', color: 'var(--text-muted)' }}>图示外包范围 {w.toFixed(2)} × {h.toFixed(2)} mm · 净样/缝份/剪口/布纹</div>
        </article>;
      })}
    </div>
  </div>;
}
