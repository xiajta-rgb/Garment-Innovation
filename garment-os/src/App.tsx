import { useState, useCallback, useEffect } from 'react';
import { useCanvasStore } from './store/canvasStore';
import {
  PART_CATEGORIES,
  type PartType,
} from './data/garmentParts';
import { useParametricStore } from './store/parametricStore';
import { PART_ICONS } from './components/icons/PartIcons';
import { FABRIC_COLORS, FABRIC_PATTERNS } from './data/fabrics';
import { SidebarSection } from './components/layout/SidebarSection';
import { MeasurementInput } from './features/measurements/MeasurementInput';
import { PatternGallery } from './features/patterns/PatternGallery';
import { DesignAssistant } from './features/ai/DesignAssistant';
import { viewToggleBtnStyle, navBtnStyle } from './components/layout/shared-styles';
import { CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import { CanvasMenu } from './features/canvas/components/CanvasMenu';
import { GarmentSketch } from './features/canvas/components/GarmentSketch';
import { VariantThumb } from './features/canvas/components/VariantThumb';
import { DesignToolbar } from './features/design-sheet/DesignToolbar';
import { ParamSliders } from './features/right-panel/components/ParamSliders';
import { BomCostPanel } from './features/right-panel/components/BomCostPanel';
import { GenderSwitcher } from './features/right-panel/components/GenderSwitcher';
import DesignCanvas from './features/canvas/components/DesignCanvas';
import './App.css';

/**
 * 主应用组件
 * 负责:
 * - 顶部导航 (标题、主题切换、Save/Export)
 * - 左侧面板 (设计管理 / 性别 / 部件 / 颜色 / 面料 / 参数 / BOM)
 * - 中央双画布 (成衣线稿 + 裁剪画布)
 * - 视图切换 (Sketch/Pattern, Front/Back)
 * - 主题管理 (light/dark)
 */
export default function App() {
  const { selectedId, components, pushHistory } = useCanvasStore();
  // 设计状态统一从 parametricStore 读取，避免多源同步问题
  const activePart = useParametricStore((s) => s.activePart);
  const setActivePart = useParametricStore((s) => s.setActivePart);
  const selectedColor = useParametricStore((s) => s.garmentColor);
  const selectedFabric = useParametricStore((s) => s.fabricId);
  const paramSetColor = useParametricStore((s) => s.setColor);
  const paramSetFabric = useParametricStore((s) => s.setFabric);
  const applyPreset = useParametricStore((s) => s.applyPreset);
  const gender = useParametricStore((s) => s.gender);
  const designName = useParametricStore((s) => s.designName);
  const saveDesign = useParametricStore((s) => s.saveDesign);
  // 修复 #3: 错误反馈 (lastError 变化时显示 banner)
  const lastError = useParametricStore((s) => s.lastError);
  const clearError = useParametricStore((s) => s.clearError);
  // 修复 #12: setDesignName UI 入口
  const setDesignName = useParametricStore((s) => s.setDesignName);
  // 当前选中的变体 (按部件) - 用于 UI 高亮
  // 实际渲染由 parametricStore 驱动，本地仅追踪 UI 状态
  const [activeVariants, setActiveVariants] = useState<Partial<Record<PartType, string>>>({});
  const [showSketch, setShowSketch] = useState(true);
  const [showPattern, setShowPattern] = useState(false);
  // 修复 Issue 7: view 状态从 store 读取, 这样 applyPattern 才能拿到正确的 view
  const storeView = useParametricStore((s) => s.view);
  const setView = useParametricStore((s) => s.setView);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sketchZoom, setSketchZoom] = useState(1);

  // 应用主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 性别切换时清空变体高亮 - parametric store 会重新初始化所有实例参数
  // 否则旧的 activeVariants 仍指向原性别的 variant，造成高亮与实际参数不匹配
  useEffect(() => {
    setActiveVariants({});
  }, [gender]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  // 选中部件变体 - 触发 parametric store 重新解算 + 渲染
  // 注意: variant.id 格式为 "body-slim"，而 preset.id 格式为 "male-body-slim"，需补上性别前缀
  const handleSelectVariant = useCallback((partType: PartType, variantId: string) => {
    const presetId = `${gender}-${variantId}`;
    applyPreset(partType, presetId);
    setActiveVariants((prev) => ({ ...prev, [partType]: variantId }));
  }, [applyPreset, gender]);

  // 应用颜色 - 同步更新 parametric store (用于保存/加载) + 画布选中组件
  const handleApplyColor = useCallback((color: string) => {
    paramSetColor(color);
    if (selectedId) {
      const comp = components.find((c) => c.id === selectedId);
      if (comp) {
        pushHistory();
        useCanvasStore.getState().updateComponentPaths(selectedId, comp.paths.map((p) => ({ ...p, fill: color })));
      }
    }
  }, [paramSetColor, selectedId, components, pushHistory]);

  // 应用面料 - 同步更新 parametric store + 画布选中组件
  const handleApplyFabric = useCallback((fabricId: string) => {
    paramSetFabric(fabricId);
    if (selectedId) {
      const comp = components.find((c) => c.id === selectedId);
      if (comp) {
        pushHistory();
        useCanvasStore.getState().updateComponentPaths(selectedId, comp.paths.map((p) => ({ ...p, fill: selectedColor })));
      }
    }
  }, [paramSetFabric, selectedId, components, pushHistory, selectedColor]);

  const activeCategory = PART_CATEGORIES.find((c) => c.type === activePart);

  // 顶部 Save 按钮：保存当前设计到 IndexedDB
  const handleSave = useCallback(() => {
    void saveDesign();
  }, [saveDesign]);

  // 顶部 Export 按钮：导出当前成衣线稿为 SVG 文件
  const handleExport = useCallback(() => {
    const container = document.getElementById('sketch-canvas');
    const svgEl = container?.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `${designName || 'garment'}-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [designName]);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden', userSelect: 'none' }}>
      {/* 修复 #3: 错误 Banner (applyPattern 失败时显示) */}
      {lastError && (
        <div
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
            {lastError}
          </span>
          <button
            onClick={clearError}
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
      )}
      {/* ── 顶部导航 ── */}
      <header className="top-nav" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.02em' }}>
            GarmentOS
          </span>
          <span style={{ color: 'var(--border-light)', fontSize: 12 }}>|</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em' }}>
            {designName || 'UNTITLED DESIGN'}
          </span>
          {/* 修复 #12: 重命名按钮 (双击或点击编辑) */}
          <button
            onClick={() => {
              const newName = window.prompt('输入新设计名', designName || 'Untitled Design');
              if (newName && newName.trim()) setDesignName(newName.trim());
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
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}>
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
          <button style={navBtnStyle} onClick={handleSave}>Save</button>
          <button style={navBtnStyle} onClick={handleExport}>Export</button>
        </div>
      </header>

      {/* ── 主体 ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 左侧面板 ── */}
        <aside className="left-panel" style={{ width: 220, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>

          <DesignToolbar />

          <SidebarSection title="Gender" defaultExpanded={true}>
            <GenderSwitcher />
          </SidebarSection>

          <SidebarSection title="模式库 (Pattern Library)" defaultExpanded={true}>
            <PatternGallery />
          </SidebarSection>

          <SidebarSection title="AI 设计助理" defaultExpanded={true}>
            <DesignAssistant />
          </SidebarSection>

          <SidebarSection title="Size & Measurements" defaultExpanded={true}>
            <MeasurementInput />
          </SidebarSection>

          <SidebarSection title="Parts" defaultExpanded={true}>
            {/* 部件类型标签 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {PART_CATEGORIES.map((cat) => (
                <button
                  key={cat.type}
                  onClick={() => setActivePart(cat.type)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: activePart === cat.type ? 'var(--accent)' : 'var(--border)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                    background: activePart === cat.type ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                    color: activePart === cat.type ? 'var(--accent)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>{PART_ICONS[cat.icon]}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 当前部件的变体列表 */}
            {activeCategory && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxHeight: 280, overflowY: 'auto', padding: 6, margin: -6, paddingRight: 10 }}>
                {activeCategory.variants.map((variant) => {
                  const isActive = activeVariants[activeCategory.type] === variant.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => handleSelectVariant(activeCategory.type, variant.id)}
                      className={`template-thumb ${isActive ? 'active' : ''}`}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 6,
                        background: isActive ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <VariantThumb variant={variant} partType={activeCategory.type} />
                      <span style={{
                        fontSize: 9,
                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                        marginTop: 2,
                        fontWeight: isActive ? 600 : 400,
                      }}>
                        {variant.name}
                      </span>
                      {isActive && (
                        <div style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </SidebarSection>

          <SidebarSection title="Color" defaultExpanded={false}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, padding: 6, margin: -6 }}>
              {FABRIC_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleApplyColor(color)}
                  className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
                  style={{
                    width: 28, height: 28,
                    borderRadius: '50%',
                    backgroundColor: color,
                    cursor: 'pointer',
                    border: color === '#FFFFFF' ? '2px solid var(--border-light)' : undefined,
                  }}
                  title={color}
                />
              ))}
            </div>
          </SidebarSection>

          <SidebarSection title="Fabric" defaultExpanded={false}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: 6, margin: -6 }}>
              {FABRIC_PATTERNS.map((fabric) => (
                <button
                  key={fabric.id}
                  onClick={() => handleApplyFabric(fabric.id)}
                  className={`fabric-card ${selectedFabric === fabric.id ? 'active' : ''}`}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: fabric.bg,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: 8, color: '#333', background: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: 2, marginBottom: 3 }}>
                    {fabric.name}
                  </span>
                </button>
              ))}
            </div>
          </SidebarSection>

          <SidebarSection title="Parameters" defaultExpanded={true}>
            <ParamSliders />
          </SidebarSection>

          <SidebarSection title="BOM / Cost" defaultExpanded={false}>
            <BomCostPanel />
          </SidebarSection>
        </aside>

        {/* ── 画布区域 ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 视图切换工具栏 */}
          <div style={{
            height: 36,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setShowSketch(!showSketch)}
              className={`view-toggle ${showSketch ? 'active' : ''}`}
              style={viewToggleBtnStyle(showSketch)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 5h6M4 7h6M4 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              Sketch
            </button>
            <button
              onClick={() => setShowPattern(!showPattern)}
              className={`view-toggle ${showPattern ? 'active' : ''}`}
              style={viewToggleBtnStyle(showPattern)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1h5v5H1zM8 1h5v5H8zM1 8h5v5H1zM8 8h5v5H8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              Pattern
            </button>

            {showSketch && (
              <>
                <span style={{ color: 'var(--border-light)', fontSize: 12, margin: '0 4px' }}>|</span>
                <button
                  onClick={() => setView('front')}
                  className={`view-toggle ${storeView === 'front' ? 'active' : ''}`}
                  style={viewToggleBtnStyle(storeView === 'front')}
                >
                  Front
                </button>
                <button
                  onClick={() => setView('back')}
                  className={`view-toggle ${storeView === 'back' ? 'active' : ''}`}
                  style={viewToggleBtnStyle(storeView === 'back')}
                >
                  Back
                </button>
              </>
            )}

            <div style={{ flex: 1 }} />

            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
              {Math.round(useCanvasStore.getState().zoom * 100)}%
            </span>
          </div>

          {/* 双画布 */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* 左：成衣线稿（前/后视图） */}
            {showSketch && (
              <div className="canvas-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                {/* 缩放工具栏 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => setSketchZoom(z => Math.max(0.3, z - 0.2))}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 500,
                    }}
                    title="Zoom Out"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="5" cy="5" r="3.5" /><line x1="8" y1="8" x2="11" y2="11" /><line x1="3" y1="5" x2="7" y2="5" />
                    </svg>
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 36, textAlign: 'center', fontWeight: 500 }}>
                    {Math.round(sketchZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setSketchZoom(z => Math.min(3, z + 0.2))}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 500,
                    }}
                    title="Zoom In"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="5" cy="5" r="3.5" /><line x1="8" y1="8" x2="11" y2="11" /><line x1="3" y1="5" x2="7" y2="5" /><line x1="5" y1="3" x2="5" y2="7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSketchZoom(1)}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 4, border: '1px solid var(--border)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 9, fontWeight: 500,
                    }}
                    title="Reset Zoom"
                  >
                    Fit
                  </button>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', opacity: 0.5 }}>Scroll to zoom</span>
                </div>

                {/* 可缩放画布区域 */}
                <div
                  style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                  onWheel={(e) => {
                    e.preventDefault();
                    setSketchZoom(z => Math.min(3, Math.max(0.3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
                  }}
                >
                  <div id="sketch-canvas" style={{
                    width: 300 * sketchZoom,
                    maxWidth: 'none',
                    aspectRatio: '5/7',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    boxShadow: '0 4px 24px var(--shadow)',
                    transition: 'width 0.15s ease, height 0.15s ease',
                    flexShrink: 0,
                  }}>
                    <GarmentSketch
                      view={storeView}
                      garmentColor={selectedColor}
                    />
                    {/* 当前编辑部件提示 */}
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 10,
                      fontSize: 9,
                      color: 'var(--accent)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      background: 'var(--accent-dim)',
                      padding: '2px 8px',
                      borderRadius: 3,
                    }}>
                      {PART_ICONS[PART_CATEGORIES.find((c) => c.type === activePart)?.icon ?? 'body']}
                      {' '}{PART_CATEGORIES.find((c) => c.type === activePart)?.label}
                    </div>
                    <CanvasMenu canvasId="sketch-canvas" />
                  </div>
                </div>
              </div>
            )}

            {/* 分隔线 */}
            {showSketch && showPattern && <div className="divider-v" />}

            {/* 右：裁剪画布 */}
            {showPattern && (
              <div id="pattern-canvas" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <CanvasMenu canvasId="pattern-canvas" capabilities={{ svg: false, png: false, sheet: true }} />
                <DesignCanvas />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
