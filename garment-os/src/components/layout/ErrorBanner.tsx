import { CloseCircleOutlined } from '@ant-design/icons';

interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      style={{
        background: 'rgba(183, 28, 28, 0.92)',
        color: '#fff',
        padding: '8px 20px',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
        zIndex: 1000,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CloseCircleOutlined style={{ fontSize: 14 }} />
        {error}
      </span>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.4)',
          color: '#fff',
          borderRadius: 2,
          padding: '2px 8px',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
