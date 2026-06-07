/**
 * AI 设计助手 (Design Assistant) UI
 *
 * 商业化功能 - AI 辅助设计:
 *  - 用户输入自然语言需求 (e.g. "夏日通勤衬衫, 简约风格")
 *  - 调用 MiniMax API, 返回结构化设计建议
 *  - 用户一键应用: Block 组合 + 颜色 + 面料 全部套用
 *
 * 安全:
 *  - API key 优先从 env 读, fallback 到 localStorage (用户输入)
 *  - UI 提供密钥配置入口, 不在源码暴露
 */

import { useState } from 'react';
import {
  chatCompletion,
  setApiKey,
  isConfigured,
  parseJsonFromContent,
} from '@/lib/ai-service/minimax-client';
import { buildDesignPrompt, type DesignSuggestion } from '@/lib/ai-service/prompts';
import { useParametricStore } from '@/store/parametricStore';
import { BLOCK_LIBRARY } from '@/lib/patterns/block-library';
import { listPatterns } from '@/data/patternLibrary';
import { StarOutlined, CheckOutlined, LoadingOutlined, ScissorOutlined } from '@ant-design/icons';

export function DesignAssistant() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<DesignSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const applyPattern = useParametricStore((s) => s.applyPattern);
  const setColor = useParametricStore((s) => s.setColor);
  const setDesignName = useParametricStore((s) => s.setDesignName);

  const handleGenerate = async () => {
    if (!input.trim()) {
      setError('请输入设计需求');
      return;
    }
    if (!isConfigured()) {
      setShowSettings(true);
      setError('请先配置 API key');
      return;
    }
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setApplied(false);

    try {
      const messages = buildDesignPrompt(input);
      const response = await chatCompletion({ messages, temperature: 0.6, maxTokens: 1024 });
      const parsed = parseJsonFromContent(response.content) as DesignSuggestion;
      // 验证建议有效性
      validateSuggestion(parsed);
      setSuggestion(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 一键应用 AI 建议 - 智能 fallback 链:
   *  1. 精确匹配 category
   *  2. 相似 category 降级 (e.g. dress → shirt 作为休闲版)
   *  3. 完全没有匹配 → 仍应用颜色+名字, UI 提示用户
   */
  const handleApply = async () => {
    if (!suggestion) return;

    const allPatterns = listPatterns();
    // 1. 精确匹配
    let matched = allPatterns.find((p) => p.category === suggestion.category);

    // 2. 智能 fallback 链 (按相似度排序)
    if (!matched) {
      const fallbackMap: Record<string, string> = {
        'dress':    'shirt',     // 连衣裙 → 衬衫 (结构相似)
        'skirt':    't-shirt',   // 半身裙 → T恤
        'pants':    't-shirt',   // 裤 → T恤
        'jacket':   'shirt',     // 夹克 → 衬衫 (结构最接近)
      };
      const fallbackCat = fallbackMap[suggestion.category];
      if (fallbackCat) {
        matched = allPatterns.find((p) => p.category === fallbackCat);
      }
    }

    // 3. 最后兜底: 第一个可用的 Pattern
    if (!matched && allPatterns.length > 0) {
      matched = allPatterns[0];
    }

    if (matched) {
      applyPattern(matched.id);
    }

    // 应用第一个推荐颜色
    if (suggestion.colorSuggestions.length > 0) {
      setColor(suggestion.colorSuggestions[0]);
    }

    // 设置设计名
    setDesignName(suggestion.name);

    // UI 反馈
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

  const handleSaveKey = () => {
    if (apiKeyInput.trim().length > 10) {
      setApiKey(apiKeyInput.trim());
      setApiKeyInput('');
      setShowSettings(false);
      setError(null);
    } else {
      setError('API key 长度至少 10 字符');
    }
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
      {/* ─── 头部 + 设置按钮 ─── */}
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
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: 'transparent',
            border: 'none',
            color: isConfigured() ? '#1a5e20' : '#b71c1c',
            fontSize: 9,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
          title={isConfigured() ? 'API key 已配置' : '点击配置 API key'}
        >
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isConfigured() ? '#1a5e20' : '#b71c1c',
            }}
          />
          {isConfigured() ? '已连接' : '未配置'}
        </button>
      </div>

      {/* ─── API Key 设置面板 ─── */}
      {showSettings && (
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
              onClick={handleSaveKey}
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
            {isConfigured() && (
              <button
                onClick={() => {
                  setApiKey(null);
                  setApiKeyInput('');
                }}
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
                清除
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── 输入区 ─── */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="描述你的设计需求, 例: 夏日通勤衬衫, 简约风格"
        rows={3}
        style={{
          width: '100%',
          padding: 4,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: 9,
          fontFamily: 'inherit',
          borderRadius: 2,
          resize: 'vertical',
          marginBottom: 4,
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !input.trim()}
        style={{
          width: '100%',
          padding: '5px 0',
          background: loading ? 'var(--bg-secondary)' : 'var(--accent)',
          color: loading ? 'var(--text-muted)' : '#fff',
          border: 'none',
          borderRadius: 2,
          fontSize: 10,
          fontWeight: 500,
          cursor: loading ? 'wait' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {loading ? <><LoadingOutlined /> AI 思考中...</> : <><StarOutlined /> 生成设计建议</>}
      </button>

      {/* ─── 状态反馈 (apply 后 4s 显示) ─── */}
      {statusMsg && (
        <div
          style={{
            marginTop: 6,
            padding: '4px 6px',
            background: statusMsg.ok ? 'rgba(26, 94, 32, 0.15)' : 'rgba(230, 81, 0, 0.15)',
            border: '1px solid ' + (statusMsg.ok ? 'rgba(26, 94, 32, 0.3)' : 'rgba(230, 81, 0, 0.3)'),
            borderRadius: 2,
            color: statusMsg.ok ? '#1a5e20' : '#e65100',
            fontSize: 8,
            lineHeight: 1.4,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* ─── 错误提示 ─── */}
      {error && (
        <div
          style={{
            marginTop: 6,
            padding: '4px 6px',
            background: 'rgba(183, 28, 28, 0.15)',
            border: '1px solid rgba(183, 28, 28, 0.3)',
            borderRadius: 2,
            color: '#b71c1c',
            fontSize: 8,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* ─── AI 建议卡片 ─── */}
      {suggestion && (
        <div
          style={{
            marginTop: 6,
            padding: 6,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent)',
            borderRadius: 3,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 2 }}>
            {suggestion.name}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 4 }}>
            {suggestion.description}
          </div>

          {/* Block 组合 */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>
              推荐部件 ({suggestion.blocks.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {suggestion.blocks.map((b, i) => {
                const def = BLOCK_LIBRARY[b.blockId];
                return (
                  <span
                    key={i}
                    style={{
                      padding: '1px 5px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 2,
                      fontSize: 7,
                      color: 'var(--text-secondary)',
                    }}
                    title={def?.name ?? b.blockId}
                  >
                    {def?.name ?? b.blockId}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 颜色 */}
          {suggestion.colorSuggestions.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>
                配色
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {suggestion.colorSuggestions.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: 16,
                      height: 16,
                      background: c,
                      border: '1px solid var(--border)',
                      borderRadius: 2,
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 面料 */}
          {suggestion.fabricSuggestions.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>
                面料
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-secondary)' }}>
                {suggestion.fabricSuggestions.join(' · ')}
              </div>
            </div>
          )}

          {/* 理由 */}
          {suggestion.rationale && (
            <div
              style={{
                fontSize: 8,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                marginBottom: 4,
                lineHeight: 1.4,
              }}
            >
              "{suggestion.rationale}"
            </div>
          )}

          {/* 应用按钮 */}
          <button
            onClick={handleApply}
            disabled={applied}
            style={{
              width: '100%',
              padding: '5px 0',
              background: applied ? '#1a5e20' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 2,
              fontSize: 10,
              fontWeight: 500,
              cursor: applied ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {applied ? <><CheckOutlined /> 已应用</> : <><ScissorOutlined /> 一键应用此设计</>}
          </button>
        </div>
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
  // 验证每个 block 引用了真实存在的 Block
  for (const b of s.blocks) {
    if (!BLOCK_LIBRARY[b.blockId]) {
      throw new Error(`AI 引用了不存在的 Block: ${b.blockId}`);
    }
  }
  if (!Array.isArray(s.colorSuggestions)) s.colorSuggestions = [];
  if (!Array.isArray(s.fabricSuggestions)) s.fabricSuggestions = [];
}
