/**
 * 模板管理库
 *
 * 功能:
 *  1. 模板切换 (T-Shirt / Polo / Shirt 等)
 *  2. 素材替换:
 *     - 颜色选择 (30色)
 *     - 面料纹理 (6种)
 *     - 部件变体 (领型/袖型/口袋/门襟/袖口)
 *  3. 实时预览 - 切换立即生效
 */

import { useState, useCallback, type ReactNode } from 'react';
import { useParametricStore } from '@/store/parametricStore';
import { listPatterns, PATTERN_CATEGORIES } from '@/data/patternLibrary';
import { FABRIC_COLORS, FABRIC_PATTERNS } from '@/data/fabrics';
import { PART_CATEGORIES, type PartType } from '@/data/garmentParts';
import { getPresetValues } from '@/data/geneLibrary';
import type { PatternDefinition } from '@/lib/patterns/types';

export function TemplateManager() {
  const activePatternId = useParametricStore((s) => s.activePatternId);
  const applyPattern = useParametricStore((s) => s.applyPattern);
  const garmentColor = useParametricStore((s) => s.garmentColor);
  const setColor = useParametricStore((s) => s.setColor);
  const fabricId = useParametricStore((s) => s.fabricId);
  const setFabric = useParametricStore((s) => s.setFabric);
  const gender = useParametricStore((s) => s.gender);
  const applyPreset = useParametricStore((s) => s.applyPreset);
  const [activeCategory, setActiveCategory] = useState<PatternDefinition['category']>('t-shirt');
  const [activeTab, setActiveTab] = useState<'template' | 'color' | 'fabric' | 'parts'>('template');

  const patterns = listPatterns().filter((p) => p.category === activeCategory);

  const handleApplyColor = useCallback((color: string) => {
    setColor(color);
  }, [setColor]);

  const handleApplyFabric = useCallback((id: string) => {
    setFabric(id);
  }, [setFabric]);

  const handleSelectVariant = useCallback((partType: PartType, variantId: string) => {
    const presetId = `${gender}-${variantId}`;
    applyPreset(partType, presetId);
  }, [applyPreset, gender]);

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'template', label: '模板' },
    { key: 'color', label: '颜色' },
    { key: 'fabric', label: '面料' },
    { key: 'parts', label: '部件' },
  ];

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        fontSize: 10,
        color: 'var(--text-primary)',
      }}
    >
      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '5px 0',
              background: activeTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: 9,
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '6px 8px' }}>
        {activeTab === 'template' && (
          <TemplateTab
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            patterns={patterns}
            activePatternId={activePatternId}
            onApplyPattern={applyPattern}
          />
        )}
        {activeTab === 'color' && (
          <ColorTab
            selectedColor={garmentColor}
            onApplyColor={handleApplyColor}
          />
        )}
        {activeTab === 'fabric' && (
          <FabricTab
            selectedFabric={fabricId}
            onApplyFabric={handleApplyFabric}
          />
        )}
        {activeTab === 'parts' && (
          <PartsTab
            gender={gender}
            onSelectVariant={handleSelectVariant}
          />
        )}
      </div>
    </div>
  );
}

// ─── 模板 Tab ───

function TemplateTab({
  activeCategory,
  onCategoryChange,
  patterns,
  activePatternId,
  onApplyPattern,
}: {
  activeCategory: PatternDefinition['category'];
  onCategoryChange: (cat: PatternDefinition['category']) => void;
  patterns: PatternDefinition[];
  activePatternId: string;
  onApplyPattern: (id: string) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
        {PATTERN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            style={{
              flex: 1,
              padding: '3px 0',
              background: activeCategory === cat.id ? 'var(--accent)' : 'var(--bg-primary)',
              color: activeCategory === cat.id ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (activeCategory === cat.id ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 3,
              fontSize: 8,
              fontWeight: activeCategory === cat.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
        {patterns.map((pattern) => {
          const isActive = pattern.id === activePatternId;
          return (
            <button
              key={pattern.id}
              onClick={() => onApplyPattern(pattern.id)}
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
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1.2',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'var(--bg-primary)',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                <PatternThumbnail id={pattern.id} />
              </div>
              <div style={{ fontSize: 9, fontWeight: isActive ? 600 : 500, textAlign: 'center', lineHeight: 1.2 }}>
                {pattern.name}
              </div>
              <div style={{ fontSize: 7, opacity: 0.7, color: isActive ? '#fff' : 'var(--text-muted)', textAlign: 'center' }}>
                {pattern.blocks.length} blocks
              </div>
              {isActive && (
                <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
              )}
            </button>
          );
        })}
        {patterns.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', fontSize: 9, padding: '12px 0' }}>
            暂无此分类模板
          </div>
        )}
      </div>
    </>
  );
}

function PatternThumbnail({ id }: { id: string }) {
  // 每种模板用极简 SVG 线稿缩略图
  const thumbnails: Record<string, ReactNode> = {
    't-shirt': (
      <svg viewBox="0 0 40 44" width="32" height="35" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12,4 C12,2 28,2 28,4 L32,6 L38,10 L34,18 L28,16 L28,40 L12,40 L12,16 L6,18 L2,10 L8,6 Z" />
      </svg>
    ),
    'v-neck-tee': (
      <svg viewBox="0 0 40 44" width="32" height="35" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12,2 L8,6 L2,10 L6,18 L12,16 L12,40 L28,40 L28,16 L34,18 L38,10 L32,6 L28,2 L20,14 Z" />
      </svg>
    ),
    'polo-shirt': (
      <svg viewBox="0 0 40 48" width="32" height="38" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12,4 C12,2 28,2 28,4 L32,6 L38,10 L34,18 L28,16 L28,44 L12,44 L12,16 L6,18 L2,10 L8,6 Z" />
        <path d="M16,4 L16,10 M24,4 L24,10 M16,10 L24,10" strokeWidth="0.8" />
        <path d="M14,2 C14,0 26,0 26,2" strokeWidth="0.8" />
      </svg>
    ),
    'button-up-shirt': (
      <svg viewBox="0 0 40 52" width="32" height="42" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12,4 C12,2 28,2 28,4 L32,6 L38,10 L34,18 L28,16 L28,48 L12,48 L12,16 L6,18 L2,10 L8,6 Z" />
        <path d="M20,6 L20,44" strokeWidth="0.8" strokeDasharray="1,2" />
        <circle cx="20" cy="12" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="20" cy="20" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="20" cy="28" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="20" cy="36" r="0.8" fill="currentColor" stroke="none" />
        <path d="M14,2 C14,0 26,0 26,2" strokeWidth="0.8" />
      </svg>
    ),
    'womens-blouse': (
      <svg viewBox="0 0 40 44" width="32" height="35" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12,4 C12,2 28,2 28,4 L32,6 L38,10 L34,18 L28,16 L28,40 L12,40 L12,16 L6,18 L2,10 L8,6 Z" />
        <path d="M14,18 L14,28 M26,18 L26,28" strokeWidth="0.6" strokeDasharray="1,1.5" />
      </svg>
    ),
  };
  return thumbnails[id] || (
    <svg viewBox="0 0 40 44" width="32" height="35" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M12,4 L8,6 L2,10 L6,18 L12,16 L12,40 L28,40 L28,16 L34,18 L38,10 L32,6 L28,4 Z" />
    </svg>
  );
}

// ─── 颜色 Tab ───

function ColorTab({
  selectedColor,
  onApplyColor,
}: {
  selectedColor: string;
  onApplyColor: (color: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
      {FABRIC_COLORS.map((colorItem) => {
        const isActive = selectedColor === colorItem.hex;
        return (
          <button
            key={colorItem.hex}
            onClick={() => onApplyColor(colorItem.hex)}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: colorItem.hex,
              cursor: 'pointer',
              border: isActive ? '2px solid var(--accent)' : colorItem.hex === '#FFFFFF' ? '2px solid var(--border-light)' : '2px solid transparent',
              boxShadow: isActive ? '0 0 0 2px var(--accent-dim)' : 'none',
              transition: 'all 0.15s',
            }}
            title={colorItem.name}
          />
        );
      })}
    </div>
  );
}

// ─── 面料 Tab ───

function FabricTab({
  selectedFabric,
  onApplyFabric,
}: {
  selectedFabric: string;
  onApplyFabric: (id: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {FABRIC_PATTERNS.map((fabric) => {
        const isActive = selectedFabric === fabric.id;
        return (
          <button
            key={fabric.id}
            onClick={() => onApplyFabric(fabric.id)}
            style={{
              aspectRatio: '1',
              borderRadius: 6,
              cursor: 'pointer',
              background: fabric.bg,
              border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
              boxShadow: isActive ? '0 0 0 2px var(--accent-dim)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              overflow: 'hidden',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 8, color: '#333', background: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: 2, marginBottom: 3 }}>
              {fabric.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── 部件 Tab ───

function PartsTab({
  gender,
  onSelectVariant,
}: {
  gender: string;
  onSelectVariant: (partType: PartType, variantId: string) => void;
}) {
  const [expandedPart, setExpandedPart] = useState<PartType>('body');

  return (
    <div>
      {PART_CATEGORIES.map((cat) => (
        <div key={cat.type} style={{ marginBottom: 6 }}>
          <button
            onClick={() => setExpandedPart(expandedPart === cat.type ? '' as PartType : cat.type)}
            style={{
              width: '100%',
              padding: '4px 6px',
              background: expandedPart === cat.type ? 'var(--accent-dim)' : 'var(--bg-secondary)',
              color: expandedPart === cat.type ? 'var(--accent)' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{cat.label}</span>
            <span style={{ fontSize: 7, opacity: 0.6 }}>{expandedPart === cat.type ? '▲' : '▼'}</span>
          </button>
          {expandedPart === cat.type && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginTop: 3 }}>
              {cat.variants.map((variant) => {
                // 检查当前预设是否存在
                const presetId = `${gender}-${variant.id}`;
                const hasPreset = !!getPresetValues(cat.type, presetId);
                return (
                  <button
                    key={variant.id}
                    onClick={() => onSelectVariant(cat.type, variant.id)}
                    disabled={!hasPreset}
                    style={{
                      padding: '4px 2px',
                      background: 'var(--bg-primary)',
                      color: hasPreset ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      fontSize: 8,
                      cursor: hasPreset ? 'pointer' : 'not-allowed',
                      opacity: hasPreset ? 1 : 0.4,
                      textAlign: 'center',
                    }}
                    title={hasPreset ? variant.name : `${variant.name} (暂不支持)`}
                  >
                    {variant.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
