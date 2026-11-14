import { EditOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { useDesignStore } from '@/store/useDesignStore';
import { ENGINE_VERSION } from '@/types/design';
import { UiButton } from '@/design-system';

interface AppHeaderProps {
  designName: string;
  onSave: () => void;
  onExport: () => void;
  onRename: (name: string) => void;
}

export function AppHeader({ designName, onSave, onExport, onRename }: AppHeaderProps) {
  const isSaving = useDesignStore(s => s.isSaving);
  const canUndo = useDesignStore((s) => s.canUndo);
  const canRedo = useDesignStore((s) => s.canRedo);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);

  return (
    <header className="top-nav" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.02em' }}>
          GarmentOS
        </span>
        <span style={{ color: 'var(--border-light)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>
          {designName || 'UNTITLED DESIGN'}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.5, fontFamily: 'monospace' }} data-version={ENGINE_VERSION}>
          参考制图 {ENGINE_VERSION}
        </span>
        <button
          onClick={() => {
            const newName = window.prompt('输入新设计名', designName || 'Untitled Design');
            if (newName && newName.trim()) onRename(newName.trim());
          }}
          title="重命名"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <EditOutlined style={{ fontSize: 11 }} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <UiButton
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
        >
          <UndoOutlined style={{ fontSize: 12 }} />
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title="重做 (Ctrl+Shift+Z)"
        >
          <RedoOutlined style={{ fontSize: 12 }} />
        </UiButton>
        <span style={{ color: 'var(--border-light)', fontSize: 12 }}>|</span>
        <UiButton size="sm" onClick={onSave} disabled={isSaving} aria-busy={isSaving}>{isSaving ? '保存中…' : 'Save'}</UiButton>
        <UiButton size="sm" onClick={onExport}>Export</UiButton>
      </div>
    </header>
  );
}
