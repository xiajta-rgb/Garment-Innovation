/**
 * AI 设计助手 (Design Assistant) UI
 *
 * 商业化功能 - AI 辅助设计:
 *  - 用户输入自然语言需求 → 调用 MiniMax API → 返回结构化设计建议
 *  - 用户一键应用: Block 组合 + 颜色 + 面料 全部套用
 *
 * 子组件已拆分至:
 * - ApiKeySettings.tsx (API Key 设置面板 + 连接状态)
 * - SuggestionCard.tsx (AI 建议卡片)
 */

import { useState } from 'react';
import {
  chatCompletion,
  isConfigured,
  parseJsonFromContent,
} from '@/lib/ai-service/minimax-client';
import { buildDesignPrompt, type DesignSuggestion } from '@/lib/ai-service/prompts';
import { useParametricStore } from '@/store/parametricStore';
import { listPatterns } from '@/data/patternLibrary';
import { BLOCK_LIBRARY } from '@/lib/patterns/block-library';
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

  const applyPattern = useParametricStore((s) => s.applyPattern);
  const setColor = useParametricStore((s) => s.setColor);
  const setDesignName = useParametricStore((s) => s.setDesignName);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    if (!isConfigured()) {
      setError('请先配置 API Key');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const messages = buildDesignPrompt(input.trim());
      const { content } = await chatCompletion({ messages });
      const parsed = parseJsonFromContent(content) as DesignSuggestion;
      validateSuggestion(parsed);
      setSuggestion(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!suggestion) return;

    const allPatterns = listPatterns();
    let matched = allPatterns.find((p) => p.category === suggestion.category);

    if (!matched) {
      const fallbackMap: Record<string, string> = {
        'dress': 'shirt',
        'skirt': 't-shirt',
        'pants': 't-shirt',
        'jacket': 'shirt',
      };
      const fallbackCat = fallbackMap[suggestion.category];
      if (fallbackCat) {
        matched = allPatterns.find((p) => p.category === fallbackCat);
      }
    }

    if (!matched && allPatterns.length > 0) {
      matched = allPatterns[0];
    }

    if (matched) {
      applyPattern(matched.id);
    }

    if (suggestion.colorSuggestions.length > 0) {
      setColor(suggestion.colorSuggestions[0]);
    }

    setDesignName(suggestion.name);

    if (matched && matched.category === suggestion.category) {
      setStatusMsg({ text: `已应用: ${matched.name}`, ok: true });
    } else if (matched) {
      setStatusMsg({
        text: `AI 建议 ${suggestion.category}, 当前无对应模板, 已降级为 ${matched.name}`,
        ok: false,
      });
    } else {
      setStatusMsg({ text: '未应用任何模板, 仅应用颜色和设计名', ok: false });
    }
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      setStatusMsg(null);
    }, 4000);
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

/** 验证 AI 返回的建议是否符合规范 */
function validateSuggestion(s: any): asserts s is DesignSuggestion {
  if (!s || typeof s !== 'object') throw new Error('AI 返回无效');
  if (typeof s.name !== 'string' || s.name.length === 0) throw new Error('AI 建议缺少 name');
  if (typeof s.description !== 'string') throw new Error('AI 建议缺少 description');
  if (!Array.isArray(s.blocks) || s.blocks.length === 0) throw new Error('AI 建议 blocks 无效');
  for (const b of s.blocks) {
    if (!BLOCK_LIBRARY[b.blockId]) {
      throw new Error(`AI 引用了不存在的 Block: ${b.blockId}`);
    }
  }
  if (!Array.isArray(s.colorSuggestions)) s.colorSuggestions = [];
  if (!Array.isArray(s.fabricSuggestions)) s.fabricSuggestions = [];
}
