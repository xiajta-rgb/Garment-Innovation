/**
 * API Key 设置面板
 * 从 DesignAssistant.tsx 拆分
 */

import { useState } from 'react';
import { setApiKey, isConfigured } from '@/lib/ai-service/minimax-client';

interface ApiKeySettingsProps {
  onClose: () => void;
  onError: (msg: string) => void;
}

export function ApiKeySettings({ onClose, onError }: ApiKeySettingsProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleSave = () => {
    if (apiKeyInput.trim().length > 10) {
      setApiKey(apiKeyInput.trim());
      setApiKeyInput('');
      onClose();
    } else {
      onError('API key 长度至少 10 字符');
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        padding: 6,
        marginBottom: 6,
      }}
    >
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 4 }}>
        输入 MiniMax API Key (保存在浏览器本地, 不上传服务器)
      </div>
      <input
        type="password"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        placeholder="sk-..."
        style={{
          width: '100%',
          padding: '4px 6px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: 9,
          fontFamily: 'monospace',
          borderRadius: 2,
          marginBottom: 4,
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '3px 0',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 2,
            fontSize: 9,
            cursor: 'pointer',
          }}
        >
          保存
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '3px 0',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            fontSize: 9,
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

/** 连接状态指示器按钮 */
export function ConnectionStatusButton({ onClick }: { onClick: () => void }) {
  const configured = isConfigured();
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: configured ? '#1a5e20' : '#b71c1c',
        fontSize: 9,
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}
      title={configured ? 'API key 已配置' : '点击配置 API key'}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: configured ? '#1a5e20' : '#b71c1c',
        }}
      />
      {configured ? '已连接' : '未配置'}
    </button>
  );
}
