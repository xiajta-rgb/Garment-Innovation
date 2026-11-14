import { useState, useCallback } from 'react';
import { useDesignStore } from './store/useDesignStore';
import { ErrorBanner } from './components/layout/ErrorBanner';
import { AppHeader } from './components/layout/AppHeader';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { CanvasArea } from './components/layout/CanvasArea';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { exportSVG } from './features/canvas/components/canvas-export';
import './App.css';
import './workbench-ui.css';

/**
 * 主应用组件 — 精简组合层
 * 子组件: AppHeader / LeftSidebar / CanvasArea / ErrorBanner
 */
function AdvancedApp() {
  useGlobalShortcuts();
  const designName = useDesignStore((s) => s.designName);
  const saveDesign = useDesignStore((s) => s.saveDesign);
  const lastError = useDesignStore((s) => s.lastError);
  const clearError = useDesignStore((s) => s.clearError);
  const setDesignName = useDesignStore((s) => s.setDesignName);
  const selectedColor = useDesignStore((s) => s.garmentColor);

  const [showSketch, setShowSketch] = useState(true);
  const [showPattern, setShowPattern] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sketchZoom, setSketchZoom] = useState(1);
  const [exportError,setExportError]=useState<string|null>(null);

  const handleSave = useCallback(() => { void saveDesign().catch(() => {}); }, [saveDesign]);
  const handleExport = useCallback(() => {try{setExportError(exportSVG('sketch-canvas')?null:'当前页面没有可导出的设计，请在设计台打开待导出的方案；比对时需先点击继续编辑。');}catch(error){setExportError(`导出未完成：${error instanceof Error?error.message:String(error)}`);}}, []);

  return (
    <div className="workbench-shell" data-testid="workbench-shell" data-sidebar-open={sidebarOpen} style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden', userSelect: 'none' }}>
      <ErrorBanner error={lastError??exportError} onDismiss={()=>{clearError();setExportError(null);}} />
      <AppHeader
        designName={designName}
        onSave={handleSave}
        onExport={handleExport}
        onRename={setDesignName}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sidebarOpen && <><button className="workbench-sidebar-backdrop" aria-label="收起模板与尺寸面板" onClick={() => setSidebarOpen(false)} /><button className="workbench-sidebar-close" aria-label="关闭模板与尺寸面板" onClick={() => setSidebarOpen(false)}>×</button></>}
        <LeftSidebar />
        <CanvasArea
          showSketch={showSketch}
          showPattern={showPattern}
          onToggleSketch={() => setShowSketch(!showSketch)}
          onTogglePattern={() => setShowPattern(!showPattern)}
          sketchZoom={sketchZoom}
          onSketchZoom={setSketchZoom}
          garmentColor={selectedColor}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>
    </div>
  );
}

export default function App(){
  return <AdvancedApp/>;
}
