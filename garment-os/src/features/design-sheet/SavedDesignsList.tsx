import { useEffect, useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import type { DesignSummary } from '@/types/design';

interface SavedDesignsListProps {
  onClose: () => void;
}

/**
 * 已保存设计列表
 * - 从 IndexedDB 加载所有设计
 * - 单击载入, 右侧 × 按钮删除
 */
export function SavedDesignsList({ onClose }: SavedDesignsListProps) {
  const loadDesign = useDesignStore((s) => s.loadDesign);
  const deleteDesign = useDesignStore((s) => s.deleteDesign);
  const currentDesignId = useDesignStore((s) => s.currentDesignId);
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const listDesigns = useDesignStore(s => s.listDesigns);

  useEffect(() => {
    let active = true;
    listDesigns().then(rows => { if (active) setDesigns(rows); })
      .catch(e => { if (active) setError(`读取设计列表失败：${e instanceof Error ? e.message : String(e)}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [listDesigns]);

  const handleLoad = async (id: string) => {
    setPending(id); setError(null);
    if (await loadDesign(id)) onClose();
    else setError(useDesignStore.getState().lastError ?? '载入未完成，当前设计保持不变');
    setPending(null);
  };
  const handleDelete = async (id: string) => {
    setPending(id); setError(null);
    try { await deleteDesign(id); setDesigns(prev => prev.filter(d => d.id !== id)); }
    catch (e) { setError(`删除失败：${e instanceof Error ? e.message : String(e)}`); }
    finally { setPending(null); }
  };

  if (loading) {
    return <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 0' }}>Loading...</div>;
  }

  if (error && designs.length === 0) return <p role="alert">{error}</p>;

  if (designs.length === 0) {
    return <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 0' }}>No saved designs</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
      {error && <p role="alert">{error}</p>}
      {designs.map((doc) => (
        <div
          key={doc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px',
            borderRadius: 3,
            background: currentDesignId === doc.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            border: currentDesignId === doc.id ? '1px solid var(--accent)' : '1px solid var(--border)',
          }}
        >
          <button
            disabled={pending !== null}
            onClick={() => { void handleLoad(doc.id); }}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--text-primary)',
              fontSize: 9,
              fontWeight: currentDesignId === doc.id ? 600 : 400,
            }}
          >
            <span>{doc.name}</span>
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginLeft: 4 }}>
              {doc.gender === 'female' ? '女' : doc.gender === 'male' ? '男' : doc.gender === 'unisex' ? '通用' : '分组未知'}{doc.format === 'legacy' ? ' · 历史输入待核对' : ''}
            </span>
          </button>
          <button
            disabled={pending !== null}
            onClick={(e) => { e.stopPropagation(); void handleDelete(doc.id); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 10,
              padding: '0 2px',
            }}
            title="Delete"
          >
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
