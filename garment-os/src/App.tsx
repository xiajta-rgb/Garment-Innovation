import { useState, useCallback, useEffect } from 'react';
import { useParametricStore } from './store/parametricStore';
import { type PartType } from './data/garmentParts';
import { ErrorBanner } from './components/layout/ErrorBanner';
import { AppHeader } from './components/layout/AppHeader';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { CanvasArea } from './components/layout/CanvasArea';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import './App.css';

/**
 * 主应用组件 — 精简组合层
 * 子组件: AppHeader / LeftSidebar / CanvasArea / ErrorBanner
 */
export default function App() {
  useGlobalShortcuts();
  const designName = useParametricStore((s) => s.designName);
  const saveDesign = useParametricStore((s) => s.saveDesign);
  const lastError = useParametricStore((s) => s.lastError);
  const clearError = useParametricStore((s) => s.clearError);
  const setDesignName = useParametricStore((s) => s.setDesignName);
  const applyPreset = useParametricStore((s) => s.applyPreset);
  const gender = useParametricStore((s) => s.gender);
  const selectedColor = useParametricStore((s) => s.garmentColor);

  const [activeVariants, setActiveVariants] = useState<Partial<Record<PartType, string>>>({});
  const [showSketch, setShowSketch] = useState(true);
  const [showPattern, setShowPattern] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sketchZoom, setSketchZoom] = useState(1);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setActiveVariants({});
  }, [gender]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const handleSelectVariant = useCallback((partType: PartType, variantId: string) => {
    const presetId = `${gender}-${variantId}`;
    applyPreset(partType, presetId);
    setActiveVariants((prev) => ({ ...prev, [partType]: variantId }));
  }, [applyPreset, gender]);

  const handleSave = useCallback(() => {
    void saveDesign();
  }, [saveDesign]);

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
      <ErrorBanner error={lastError} onDismiss={clearError} />
      <AppHeader
        designName={designName}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSave={handleSave}
        onExport={handleExport}
        onRename={setDesignName}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LeftSidebar
          activeVariants={activeVariants}
          onSelectVariant={handleSelectVariant}
          onApplyColor={() => {}}
          onApplyFabric={() => {}}
        />
        <CanvasArea
          showSketch={showSketch}
          showPattern={showPattern}
          onToggleSketch={() => setShowSketch(!showSketch)}
          onTogglePattern={() => setShowPattern(!showPattern)}
          sketchZoom={sketchZoom}
          onSketchZoom={setSketchZoom}
          garmentColor={selectedColor}
        />
      </div>
    </div>
  );
}
