import { useCallback, useEffect, useState } from 'react';
import { designAssetRepository } from '@/lib/db/design-asset-repository';
import type { DesignAssetPage, DesignAssetRecord } from '@/types/design-library';
import { useDesignStore } from '@/store/useDesignStore';
import { CompositionCanvas } from '@/features/piece-design/CompositionCanvas';

interface Props { onDesign?: () => void }

const EMPTY: DesignAssetPage = { items: [], total: 0, offset: 0, limit: 24, hasMore: false };

export function DesignAssetLibrary({ onDesign }: Props) {
  const setPieceComposition = useDesignStore(s => s.setPieceComposition);
  const setDesignName = useDesignStore(s => s.setDesignName);
  const [mode, setMode] = useState<'active' | 'trash'>('active');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<DesignAssetPage>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<DesignAssetRecord>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async (nextOffset = offset) => {
    try {
      const result = await designAssetRepository.list({ status: mode, query, offset: nextOffset, limit: 24 });
      setPage(result); setOffset(result.offset); setSelected(undefined); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [mode, query, offset]);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(0); }, 0); return () => window.clearTimeout(timer); }, [mode, query, refresh]);

  async function openAsset(id: string) {
    try { const asset = await designAssetRepository.get(id); if (!asset) throw new Error('资产不存在或已被清理'); setSelected(asset); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  async function move(id: string, action: 'trash' | 'restore' | 'purge') {
    try {
      if (action === 'trash') await designAssetRepository.moveToTrash(id);
      if (action === 'restore') await designAssetRepository.restore(id);
      if (action === 'purge') await designAssetRepository.purge(id);
      setNotice(action === 'trash' ? '已移入垃圾桶，可在垃圾桶中恢复。' : action === 'restore' ? '已恢复到设计资产。' : '已永久删除，无法恢复。');
      await refresh(offset);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function continueEditing(asset: DesignAssetRecord) {
    setPieceComposition({ schema: 'garment-os/piece-composition-editor/v1', activePlanId: asset.composition.id, plans: [structuredClone(asset.composition)] });
    setDesignName(asset.name);
    setNotice('已载入设计台，可继续编辑；资产原记录仍保留。');
    onDesign?.();
  }

  return <section className="design-asset-library" data-testid="design-asset-library">
    <header className="design-asset-heading">
      <div><h3>三视图设计资产</h3><p>设计台保存后自动沉淀；每个方案保留来源、矩阵批次和审核边界。</p></div>
      <div className="design-asset-switch"><button aria-pressed={mode === 'active'} onClick={() => setMode('active')}>设计资产</button><button aria-pressed={mode === 'trash'} onClick={() => setMode('trash')}>垃圾桶</button></div>
    </header>
    <div className="design-asset-tools"><input aria-label="搜索设计资产" type="search" value={query} placeholder="搜索名称、标签、基型、批次" onChange={e => { setQuery(e.target.value); setOffset(0); }}/><span role="status">{mode === 'trash' ? '垃圾桶' : '可用资产'} · {page.total} 款</span></div>
    {notice && <p className="asset-notice" role="status">{notice}</p>}{error && <p className="asset-error" role="alert">{error}</p>}
    {!page.total && <p className="asset-empty">{mode === 'trash' ? '垃圾桶为空。' : '还没有沉淀的三视图资产。请在设计台点击顶部 Save 保存当前设计。'}</p>}
    <div className="design-asset-grid">{page.items.map(item => <article key={item.id} data-asset-id={item.id}>
      <button className="design-asset-card" onClick={() => void openAsset(item.id)}><div className="design-asset-thumb"><span>三视图</span></div><strong>{item.name}</strong><small>{item.patternId} · v{item.version}</small><small>{item.tags.slice(0, 4).join(' · ') || '未加标签'}</small></button>
      <div className="design-asset-card-actions">{mode === 'active' ? <><button onClick={() => void openAsset(item.id)}>查看</button><button onClick={() => void move(item.id, 'trash')}>移入垃圾桶</button></> : <><button onClick={() => void move(item.id, 'restore')}>恢复</button><button className="composition-delete" onClick={() => void move(item.id, 'purge')}>永久删除</button></>}</div>
    </article>)}</div>
    {selected && <section className="design-asset-detail" aria-label="设计资产详情"><header><div><h4>{selected.name}</h4><p>{selected.patternId} · {selected.gender} · {selected.standardSize} · {selected.reviewStatus}</p></div><button onClick={() => setSelected(undefined)}>关闭</button></header><CompositionCanvas plan={selected.composition} showGrid={false}/><p className="asset-muted">来源设计：{selected.sourceDesignId ?? '未关联'} · 来源方案：{selected.sourcePlanId} · 版本 {selected.version}</p><p className="asset-muted">生产批准：否。当前为设计表达资产，需完成纸样、配缝、样衣和专业审核。</p>{mode === 'active' && <button className="piece-primary" onClick={() => continueEditing(selected)}>继续编辑此资产</button>}</section>}
    <div className="design-asset-pagination"><button disabled={offset === 0} onClick={() => void refresh(Math.max(0, offset - page.limit))}>上一页</button><span>{page.total ? `${offset + 1}–${Math.min(offset + page.limit, page.total)} / ${page.total}` : '0 / 0'}</span><button disabled={!page.hasMore} onClick={() => void refresh(offset + page.limit)}>下一页</button></div>
  </section>;
}
