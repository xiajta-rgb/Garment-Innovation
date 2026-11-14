/** Optional AI suggestions reference reviewed templates only. */
import { useState } from 'react';
import {
  chatCompletion,
  isConfigured,
  parseJsonFromContent,
} from '@/lib/ai-service/minimax-client';
import { buildDesignPrompt } from '@/lib/ai-service/prompts';
import { readDesignSuggestion, type DesignSuggestion } from '@/application/design-suggestion';
import { useDesignStore } from '@/store/useDesignStore';
import { StarOutlined, LoadingOutlined } from '@ant-design/icons';
import { ApiKeySettings, ConnectionStatusButton } from './ApiKeySettings';
import { SuggestionCard } from './SuggestionCard';

export function DesignAssistant() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<DesignSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [applied, setApplied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);


  const handleSubmit = async () => {
    if (!input.trim()) return;
    if (!isConfigured()) {
      setError('请先配置 API Key');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null); setApplied(false); setStatusMsg(null);

    try {
      const messages = buildDesignPrompt(input.trim());
      const { content } = await chatCompletion({ messages });
      const parsed = readDesignSuggestion(parseJsonFromContent(content));
      setSuggestion(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion?.templateId || suggestion.unmetRequirements.length) return;
    const verified = readDesignSuggestion(suggestion);
    useDesignStore.getState().applyPattern(verified.templateId!);
    const state = useDesignStore.getState();
    const ok = state.activePatternId === verified.templateId && state.draft.status === 'reference';
    setApplied(ok);
    setStatusMsg({ text: ok ? '已选择该参考模板；尺寸与材料仍需核验。' : state.lastError ?? '模板应用受阻', ok });
  };

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '6px 8px',
        fontSize: 10,
        color: 'var(--text-primary)',
      }}
    >
      {/* 头部 + 设置按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <StarOutlined style={{ fontSize: 11 }} />
          AI 设计助理
        </span>
        <ConnectionStatusButton onClick={() => setShowSettings(!showSettings)} />
      </div>

      {/* API Key 设置面板 */}
      {showSettings && (
        <ApiKeySettings
          onClose={() => setShowSettings(false)}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="描述你想要的设计..."
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{
            flex: 1,
            padding: '4px 6px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: 9,
            borderRadius: 2,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '4px 8px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 2,
            fontSize: 9,
            cursor: loading ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? <LoadingOutlined /> : '生成'}
        </button>
      </div>

      {/* 状态消息 */}
      {statusMsg && (
        <div
          style={{
            fontSize: 8,
            color: statusMsg.ok ? '#1a5e20' : '#b71c1c',
            marginBottom: 4,
            lineHeight: 1.4,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* 错误消息 */}
      {error && (
        <div
          style={{
            fontSize: 8,
            color: '#b71c1c',
            marginBottom: 4,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* AI 建议卡片 */}
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          applied={applied}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
