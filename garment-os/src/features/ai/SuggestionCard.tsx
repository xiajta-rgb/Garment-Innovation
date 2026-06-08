/**
 * AI 设计建议卡片
 * 从 DesignAssistant.tsx 拆分
 */

import { CheckOutlined, ScissorOutlined } from '@ant-design/icons';
import { BLOCK_LIBRARY } from '@/lib/patterns/block-library';
import type { DesignSuggestion } from '@/lib/ai-service/prompts';

interface SuggestionCardProps {
  suggestion: DesignSuggestion;
  applied: boolean;
  onApply: () => void;
}

export function SuggestionCard({ suggestion, applied, onApply }: SuggestionCardProps) {
  return (
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
        onClick={onApply}
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
  );
}
