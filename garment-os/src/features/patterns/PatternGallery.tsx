/**
 * 模式库 (Pattern Gallery) UI
 *
 * 商业级 UI 设计:
 *  - 分类标签 (T-Shirt / Polo / Shirt)
 *  - 网格布局的模式卡片
 *  - 每张卡片显示: 缩略图 + 名称 + 简短描述
 *  - 当前激活的模式高亮
 *  - 点击即 applyPattern, 画布立即重渲染
 *
 * 与旧版"variant 切换"根本不同:
 *  - 旧版: 调 30+ 参数, 几何生成方式不变
 *  - 新版: 切换一组 Blocks, 几何真正改变
 */

import { useState } from 'react';
import { useParametricStore } from '@/store/parametricStore';
import { listPatterns, PATTERN_CATEGORIES } from '@/data/patternLibrary';
import type { PatternDefinition } from '@/lib/patterns/types';
import { AppstoreOutlined, SkinOutlined, TagOutlined, TagsOutlined } from '@ant-design/icons';

export function PatternGallery() {
  const activePatternId = useParametricStore((s) => s.activePatternId);
  const applyPattern = useParametricStore((s) => s.applyPattern);
  const [activeCategory, setActiveCategory] = useState<PatternDefinition['category']>('t-shirt');

  const patterns = listPatterns().filter((p) => p.category === activeCategory);

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
      {/* ─── 分类标签 ─── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
        {PATTERN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              flex: 1,
              padding: '4px 0',
              background: activeCategory === cat.id ? 'var(--accent)' : 'var(--bg-secondary)',
              color: activeCategory === cat.id ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (activeCategory === cat.id ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 3,
              fontSize: 9,
              fontWeight: activeCategory === cat.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ─── 模式卡片网格 ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 4,
        }}
      >
        {patterns.map((pattern) => {
          const isActive = pattern.id === activePatternId;
          return (
            <button
              key={pattern.id}
              onClick={() => applyPattern(pattern.id)}
              style={{
                padding: '6px 4px',
                background: isActive ? 'var(--accent)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : 'var(--text-primary)',
                border: '1.5px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                transition: 'all 0.15s',
                position: 'relative',
              }}
              title={pattern.description}
            >
              {/* 缩略图占位 (用 Block 数量代表复杂度) */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1.2',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'var(--bg-primary)',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                }}
              >
                <PatternThumbnail patternId={pattern.id} />
              </div>
              <div style={{ fontSize: 9, fontWeight: isActive ? 600 : 500, lineHeight: 1.2, textAlign: 'center' }}>
                {pattern.name}
              </div>
              <div
                style={{
                  fontSize: 7,
                  opacity: 0.7,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                {pattern.blocks.length} blocks
              </div>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#fff',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 模式 ID → 标准 icon 缩略图 (@ant-design/icons)
 *
 * 用 antd 标准库替代 emoji, 商业级 UI 标准
 * 通过 size/rotate 区分不同 Pattern 类型
 */
function PatternThumbnail({ patternId }: { patternId: string }) {
  const size = 28;
  switch (patternId) {
    case 't-shirt':
      return <SkinOutlined style={{ fontSize: size }} />;
    case 'v-neck-tee':
      return <SkinOutlined style={{ fontSize: size, color: '#1a5e20' }} />;
    case 'polo-shirt':
      return <AppstoreOutlined style={{ fontSize: size }} />;
    case 'button-up-shirt':
      return <TagOutlined style={{ fontSize: size }} />;
    case 'womens-blouse':
      return <TagOutlined style={{ fontSize: size, color: '#7b1fa2' }} />;
    default:
      return <TagsOutlined style={{ fontSize: size }} />;
  }
}
