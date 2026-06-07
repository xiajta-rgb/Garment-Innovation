import { useState, type ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * 左侧面板折叠区块
 * 标题 + 可折叠内容区
 */
export function SidebarSection({ title, defaultExpanded = true, children }: SidebarSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        {title}
        <svg
          className={`collapse-arrow ${expanded ? '' : 'collapsed'}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={`sidebar-section-content ${expanded ? 'expanded' : 'collapsed'}`}
        style={{ maxHeight: expanded ? '600px' : '0' }}
      >
        <div style={{ padding: '0 13px 14px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
