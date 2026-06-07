import { useEffect, useState } from 'react';
import { useParametricStore } from '@/store/parametricStore';
import type { DesignDocument } from '@/types/gene';

interface SavedDesignsListProps {
  onClose: () => void;
}

/**
 * 已保存设计列表
 * - 从 IndexedDB 加载所有设计
 * - 单击载入, 右侧 × 按钮删除
 */
export function SavedDesignsList({ onClose }: SavedDesignsListProps) {
  const loadDesign = useParametricStore((s) => s.loadDesign);
  const deleteDesign = useParametricStore((s) => s.deleteDesign);
  const currentDesignId = useParametricStore((s) => s.currentDesignId);
  const [designs, setDesigns] = useState<DesignDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { db } = await import('@/lib/db/design-db');
        const all = await db.getAllDesigns();
        setDesigns(all);
      } catch (e) {
        console.error('Failed to load designs:', e);
      }
      setLoading(false);
    })();
  }, []);

  const handleLoad = async (id: string) => {
    await loadDesign(id);
    onClose();
  };

  const handleDelete = async (id: string) => {
    await deleteDesign(id);
    setDesigns((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) {
    return <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 0' }}>Loading...</div>;
  }

  if (designs.length === 0) {
    return <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 0' }}>No saved designs</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
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
            onClick={() => handleLoad(doc.id)}
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
              {doc.gender === 'female' ? 'F' : 'M'}
            </span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
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
