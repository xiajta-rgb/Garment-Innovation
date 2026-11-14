import { useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { SavedDesignsList } from '@/features/design-sheet/SavedDesignsList';

/**
 * 设计管理工具栏
 * - 设计名称输入
 * - New / Save / List 三个操作按钮
 * - 内嵌已保存设计列表 (展开态)
 */
export function DesignToolbar() {
  const designName = useDesignStore((s) => s.designName);
  const setDesignName = useDesignStore((s) => s.setDesignName);
  const saveDesign = useDesignStore((s) => s.saveDesign);
  const isSaving = useDesignStore(s => s.isSaving);
  const newDesign = useDesignStore((s) => s.newDesign);
  const [showSaved, setShowSaved] = useState(false);

  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* 设计名称 */}
      <input
        type="text"
        value={designName}
        onChange={(e) => setDesignName(e.target.value)}
        style={{
          width: '100%',
          padding: '4px 8px',
          fontSize: 11,
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          outline: 'none',
          fontWeight: 500,
        }}
        placeholder="Design name..."
      />

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => newDesign()}
          title="New Design"
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: 9,
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontWeight: 500,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="6" y1="2" x2="6" y2="10" /><line x1="2" y1="6" x2="10" y2="6" /></svg>
          New
        </button>
        <button
          onClick={() => { void saveDesign().catch(() => {}); }}
          title="Save Design"
          data-testid="design-save" disabled={isSaving} aria-busy={isSaving}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: 9,
            borderRadius: 3,
            border: '1px solid var(--accent)',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontWeight: 600,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2h6l2 2v6H2V2z" /><polyline points="5,2 5,4 8,4" /></svg>
          {isSaving ? '保存中…' : 'Save'}
        </button>
        <button
          onClick={() => setShowSaved(!showSaved)}
          title="Saved Designs"
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: 9,
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: showSaved ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
            color: showSaved ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontWeight: 500,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="1" width="10" height="10" rx="1" /><line x1="4" y1="4" x2="8" y2="4" /><line x1="4" y1="6" x2="8" y2="6" /><line x1="4" y1="8" x2="6" y2="8" /></svg>
          List
        </button>
      </div>

      {/* 已保存设计列表 */}
      {showSaved && <SavedDesignsList onClose={() => setShowSaved(false)} />}
    </div>
  );
}
