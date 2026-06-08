import { EditOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { useParametricStore } from '@/store/parametricStore';
import { navBtnStyle } from './shared-styles';

interface AppHeaderProps {
  designName: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSave: () => void;
  onExport: () => void;
  onRename: (name: string) => void;
}

export function AppHeader({ designName, theme, onToggleTheme, onSave, onExport, onRename }: AppHeaderProps) {
  const canUndo = useParametricStore((s) => s.canUndo);
  const canRedo = useParametricStore((s) => s.canRedo);
  const undo = useParametricStore((s) => s.undo);
  const redo = useParametricStore((s) => s.redo);

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
        <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.5, fontFamily: 'monospace' }} data-version="v2026-06-08-fix-1">
          v2026-06-08-fix-1
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
        <button
          onClick={undo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
          style={{
            ...navBtnStyle,
            opacity: canUndo ? 1 : 0.35,
            cursor: canUndo ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <UndoOutlined style={{ fontSize: 12 }} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="重做 (Ctrl+Shift+Z)"
          style={{
            ...navBtnStyle,
            opacity: canRedo ? 1 : 0.35,
            cursor: canRedo ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RedoOutlined style={{ fontSize: 12 }} />
        </button>
        <span style={{ color: 'var(--border-light)', fontSize: 12 }}>|</span>
        <button className="theme-toggle-btn" onClick={onToggleTheme} title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}>
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 9.3A6.5 6.5 0 016.7 2 6.5 6.5 0 108 14.5a6.47 6.47 0 006-5.2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button style={navBtnStyle} onClick={onSave}>Save</button>
        <button style={navBtnStyle} onClick={onExport}>Export</button>
      </div>
    </header>
  );
}
