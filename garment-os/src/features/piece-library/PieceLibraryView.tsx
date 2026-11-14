import { PieceFilterControls } from './PieceFilterControls';
import { ReferenceSymbols } from '@/features/canvas/components/ReferenceSymbols';

import { lazy,Suspense,useEffect, useMemo, useState } from 'react';
import { usePieceQC } from './usePieceQC';
import { PieceGeneratorPanel } from './PieceGeneratorPanel';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { pieceIsMapped } from '@/lib/pattern/preview-gate';
import { measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import { matchesTagFilter } from '@/lib/pattern/piece-tags';
import type { PatternPath } from '@/types/pattern';
import { AssemblyPanel } from './AssemblyPanel';
import { ConstructionPanel } from './ConstructionPanel';
import { PieceTaxonomyPanel } from './PieceTaxonomyPanel';
import type { PieceLibraryViewId } from '@/types/category-workbench';

const ReferenceCatalogue=lazy(()=>import('./ReferenceCatalogue').then(m=>({default:m.ReferenceCatalogue})));

const LAYER_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'cutting-line', label: '毛样', color: '#1a1a1a' },
  { key: 'seam-line', label: '净样', color: '#1a1a1a' },
  { key: 'grain-line', label: '布纹', color: '#1a1a1a' },
  { key: 'fold-line', label: '折叠', color: '#555' },
  { key: 'notch', label: '剪口', color: '#1a1a1a' },
  { key: 'detail', label: '细节', color: '#555' },
  { key: 'annotation', label: '标注', color: '#888' },
  { key: 'stitch', label: '明线', color: '#666' },
];

export function PieceLibraryView({initialView='generator'}:{initialView?:PieceLibraryViewId}={}) {
  const [view, setView] = useState<PieceLibraryViewId>(initialView);
  const { gateKey, pieces, hiddenPieceKeys } = usePieceQC();
  const selectedPieceKey = usePieceLibraryStore((s) => s.selectedPieceKey);
  const selectPiece = usePieceLibraryStore((s) => s.selectPiece);
  const showAllChecked = usePieceLibraryStore((s) => s.showAllChecked);

  const passCount = pieces.filter((p) => p.pass).length;
  const mappedCount = pieces.filter((p) => pieceIsMapped(p, hiddenPieceKeys)).length;
  const tagFilter = usePieceLibraryStore((s) => s.tagFilter);
  const toggleTagFilter = usePieceLibraryStore((s) => s.toggleTagFilter);
  const clearTagFilter = usePieceLibraryStore((s) => s.clearTagFilter);
  const [failedOnly, setFailedOnly] = useState(false);
  const visiblePieces = pieces.filter(
    (p) => matchesTagFilter(p.tags, tagFilter) && (!failedOnly || !p.pass),
  );
  const selected = visiblePieces.find((p) => p.key === selectedPieceKey) ?? visiblePieces[0];
  // 筛选后自动聚焦第一个可见裁片
  useEffect(() => {
    const next = visiblePieces.find(p => p.key === selectedPieceKey)?.key ?? visiblePieces[0]?.key ?? null;
    if (next !== selectedPieceKey) selectPiece(next);
  }, [visiblePieces, selectedPieceKey, selectPiece]);

  return (
    <div data-testid="piece-library" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <header className="piece-library-heading"><h2>裁片库</h2><p>查看源裁片、生成参考纸样，检查分类、裁法与配缝。</p></header>
      {/* 视图切换: 检验 / 生成器 */}
      <div className="piece-library-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {([['qc', '裁片检验 (QC)'], ['generator', '裁片生成器'], ['reference','全量参考图'], ['assembly', '裁片组成'], ['construction', '部件组合'], ['taxonomy', '分类总览']] as const).map(([k, label]) => (
          <button key={k} aria-pressed={view===k} onClick={() => setView(k)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid ' + (view === k ? 'var(--accent)' : 'var(--border)'),
              background: view === k ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: view === k ? '#fff' : 'var(--text-secondary)',
            }}
          >{label}</button>
        ))}
      </div>
      {view === 'reference' ? <Suspense fallback={<p>正在加载参考裁片库…</p>}><ReferenceCatalogue onCurrent={(family,role)=>{
        usePieceLibraryStore.getState().setTagFilter(family?[family,...(role?[`role:${role}`]:[])]:[]);setView('qc');
      }}/></Suspense> : view === 'taxonomy' ? <PieceTaxonomyPanel onInspect={()=>setView('qc')} /> : view === 'construction' ? <ConstructionPanel /> : view === 'assembly' ? <AssemblyPanel /> : view === 'generator' ? (
        <div className="piece-generator-host" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <PieceGeneratorPanel />
        </div>
      ) : (
      <div className="piece-qc-layout" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* 左: 裁片清单 */}
      <div className="piece-qc-list" style={{
        width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>裁片标准化库</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.6 }}>
            检验 <b style={{ color: passCount === pieces.length ? '#389e0d' : '#d46b08' }}>{passCount}/{pieces.length}</b> 通过
            · 已映射 <b style={{ color: '#1677ff' }}>{mappedCount}</b>
          </div>
          <button
            onClick={showAllChecked}
            style={{
              marginTop: 6, width: '100%', padding: '4px 0', fontSize: 11, fontWeight: 600,
              border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer',
              background: 'var(--accent)', color: '#fff',
            }}
            title="仅显示检查通过的参考裁片；不能绕过失败项，生产验收另行进行"
          >显示通过检查的裁片</button>
        </div>
          {/* 标签筛选 + 状态筛选 */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <PieceFilterControls filter={tagFilter} toggle={toggleTagFilter} clear={clearTagFilter} prefix="qc" clearLabel="清除标签筛选" />
            <button
              onClick={() => setFailedOnly((v) => !v)}
              style={{
                fontSize: 10, width: '100%', padding: '3px 0', borderRadius: 4, cursor: 'pointer',
                border: `1px solid ${failedOnly ? '#cf1322' : 'var(--border)'}`,
                background: failedOnly ? '#fff2f0' : 'var(--bg-tertiary)',
                color: failedOnly ? '#cf1322' : 'var(--text-secondary)',
                fontWeight: failedOnly ? 700 : 400,
              }}
            >{failedOnly ? '只看未通过 (开)' : '只看未通过'}</button>
          </div>
          {visiblePieces.map(p=>{
            const mapped=pieceIsMapped(p,hiddenPieceKeys),isSelected=p.key===selected?.key;
            return <button key={p.key} onClick={()=>selectPiece(p.key)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',border:'none',textAlign:'left',cursor:'pointer',background:isSelected?'var(--accent-dim, rgba(22,119,255,0.08))':'transparent',borderBottom:'1px solid var(--border)',borderLeft:isSelected?'3px solid var(--accent)':'3px solid transparent'}}>
              <span style={{width:18,height:18,borderRadius:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,background:mapped?'#389e0d':'#cf1322',color:'#fff'}}>{mapped?'✓':'✕'}</span>
              <span style={{flex:1,minWidth:0}}><span style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text-primary)'}}>{p.name}</span><span style={{display:'block',fontSize:10,color:'var(--text-muted)'}}>{p.bbox.width.toFixed(0)} × {p.bbox.height.toFixed(0)} mm · {p.paths.length} 层</span></span>
            </button>;
          })}
      </div>

      {/* 右: 选中裁片精细预览 */}
      {selected ? <PieceDetail key={selected.key} piece={selected} gateKey={gateKey} /> : <div style={{ padding: 20 }}>
        <p role="status">当前筛选没有裁片。</p><p>当前款式未包含所选部位时，可查看独立参考库。</p>
        <button onClick={()=>setView('reference')}>查看全量参考图</button>
      </div>}
    </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 单片精细预览
// ════════════════════════════════════════════════════════════

function PieceDetail({ piece, gateKey }: { piece: ReturnType<typeof usePieceQC>['pieces'][number]; gateKey: string }) {
  const { hiddenPieceKeys } = usePieceQC();
  const setHidden = usePieceLibraryStore((s) => s.setHidden);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());

  const bboxFull = useMemo(() => measurePieceBboxFull(piece.paths), [piece.paths]);
  const margin = 40;
  const vb = `${bboxFull.minX - margin} ${bboxFull.minY - margin} ${(bboxFull.maxX - bboxFull.minX) + margin * 2} ${(bboxFull.maxY - bboxFull.minY) + margin * 2}`;
  const w = bboxFull.maxX - bboxFull.minX;
  const h = bboxFull.maxY - bboxFull.minY;

  const toggleLayer = (key: string) => {
    setHiddenLayers((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const renderPath = (p: PatternPath, idx: number) => {
    if (hiddenLayers.has(p.layer ?? '')) return null;
    return <path key={idx} d={p.data} markerStart={p.markerStart} markerEnd={p.markerEnd} transform={p.transform} fill={p.fill} stroke={p.stroke}
      strokeWidth={p.strokeWidth} strokeDasharray={p.strokeDasharray} strokeLinecap={p.strokeLinecap} />;
  };

  const mapped = pieceIsMapped(piece, hiddenPieceKeys);

  return (
    <div className="piece-qc-detail" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{piece.name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {w.toFixed(0)} × {h.toFixed(0)} mm · {piece.category} · {piece.view === 'all' ? '前后共用' : piece.view === 'front' ? '前视图' : '后视图'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
          background: mapped ? '#f6ffed' : '#fff2f0',
          color: mapped ? '#389e0d' : '#cf1322', border: `1px solid ${mapped ? '#b7eb8f' : '#ffccc7'}`,
        }}>{mapped ? '参考预览 · 生产待验收' : piece.pass ? '已隐藏参考预览' : '检查未通过 · 已阻断映射'}</span>
        <button
          onClick={() => setHidden(gateKey, piece.key, mapped)}
          disabled={!piece.pass}
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
          }}
          title={mapped ? '隐藏该参考裁片' : '显示通过检查的参考裁片，不能绕过失败项'}
        >{mapped ? '隐藏预览' : '显示参考预览'}</button>
      </div>

      {/* 层显隐 */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        {LAYER_META.map((lm) => {
          const has = piece.paths.some((p) => p.layer === lm.key);
          if (!has) return null;
          const off = hiddenLayers.has(lm.key);
          return (
            <button
              key={lm.key}
              onClick={() => toggleLayer(lm.key)}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${off ? 'var(--border)' : lm.color}`,
                background: off ? 'transparent' : 'var(--bg-tertiary)',
                color: off ? 'var(--text-muted)' : 'var(--text-primary)',
                opacity: off ? 0.5 : 1,
              }}
            >{off ? '○' : '●'} {lm.label}</button>
          );
        })}
      </div>

      {/* 主体: 网格预览 + 检验明细 */}
      <div className="piece-qc-preview-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="piece-qc-canvas" style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#fbfbf8' }}>
          <svg viewBox={vb} style={{ width: '100%', height: '100%' }} data-piece-key={piece.key}>
            <ReferenceSymbols />
            <defs>
              <pattern id="grid-10" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e8e8e2" strokeWidth="0.3" />
              </pattern>
              <pattern id="grid-100" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#grid-10)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d8d8cc" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect x={bboxFull.minX - margin} y={bboxFull.minY - margin}
              width={w + margin * 2} height={h + margin * 2} fill="url(#grid-100)" />
            {piece.paths.map(renderPath)}
            {/* 尺寸标注 (宽) */}
            <g stroke="#1677ff" strokeWidth="1" fill="#1677ff">
              <line x1={bboxFull.minX} y1={bboxFull.maxY + 20} x2={bboxFull.maxX} y2={bboxFull.maxY + 20} />
              <text x={(bboxFull.minX + bboxFull.maxX) / 2} y={bboxFull.maxY + 34}
                fontSize="12" textAnchor="middle" stroke="none">宽 {w.toFixed(0)} mm</text>
            </g>
            <g stroke="#1677ff" strokeWidth="1" fill="#1677ff">
              <line x1={bboxFull.maxX + 20} y1={bboxFull.minY} x2={bboxFull.maxX + 20} y2={bboxFull.maxY} />
              <text x={bboxFull.maxX + 24} y={(bboxFull.minY + bboxFull.maxY) / 2}
                fontSize="12" textAnchor="start" stroke="none">高 {h.toFixed(0)} mm</text>
            </g>
          </svg>
          {/* 比例尺 */}
          <div style={{
            position: 'absolute', left: 12, bottom: 10, fontSize: 10,
            color: 'var(--text-muted)', background: 'rgba(255,255,255,0.85)',
            padding: '2px 8px', borderRadius: 4,
          }}>
            网格: 细线 10mm / 粗线 100mm · 坐标单位 mm
          </div>
        </div>

        {/* 检验明细 */}
        <div className="piece-qc-inspector" style={{
          width: 260, flexShrink: 0, borderLeft: '1px solid var(--border)',
          overflowY: 'auto', padding: '10px 12px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>CAD 检验项</div>
          {piece.checks.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{
                width: 16, height: 16, borderRadius: 8, flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                background: c.pass ? '#389e0d' : c.level === 'warning' ? '#d46b08' : '#cf1322', color: '#fff',
              }}>{c.pass ? '✓' : c.level === 'warning' ? '!' : '✕'}</span>
              <span style={{ fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.label}</span>
                {c.detail && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10 }}>{c.detail}</span>}
              </span>
            </div>
          ))}
          <div style={{
            marginTop: 10, padding: '8px 10px', borderRadius: 6,
            background: 'var(--bg-tertiary)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
          }}>
            裁片键 <code>{piece.key}</code><br />
            检验通过 → 自动映射画布; 失败项阻断映射；人工操作不能绕过失败项。<br />
            换模板或改尺寸将自动重新检验。
          </div>
        </div>
      </div>
    </div>
  );
}





