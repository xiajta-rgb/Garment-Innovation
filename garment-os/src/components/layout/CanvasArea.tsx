import { PART_CATEGORIES } from '@/data/garmentParts';
import { useParametricStore } from '@/store/parametricStore';
import { PART_ICONS } from '@/components/icons/PartIcons';
import { viewToggleBtnStyle } from '@/components/layout/shared-styles';
import { CanvasMenu } from '@/features/canvas/components/CanvasMenu';
import { GarmentSketch } from '@/features/canvas/components/GarmentSketch';
import DesignCanvas from '@/features/canvas/components/DesignCanvas';
import { useRef, useCallback, useState } from 'react';

interface CanvasAreaProps {
  showSketch: boolean;
  showPattern: boolean;
  onToggleSketch: () => void;
  onTogglePattern: () => void;
  sketchZoom: number;
  onSketchZoom: (updater: (z: number) => number) => void;
  garmentColor: string;
}

export function CanvasArea({
  showSketch,
  showPattern,
  onToggleSketch,
  onTogglePattern,
  sketchZoom,
  onSketchZoom,
  garmentColor,
}: CanvasAreaProps) {
  const storeView = useParametricStore((s) => s.view);
  const setView = useParametricStore((s) => s.setView);
  const activePart = useParametricStore((s) => s.activePart);

  // 画布平移状态
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 中键拖拽 或 Space+左键拖拽
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleResetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    onSketchZoom(() => 1);
  }, [onSketchZoom]);

  return (
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
          onClick={onToggleSketch}
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
          onClick={onTogglePattern}
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
          {Math.round(sketchZoom * 100)}%
        </span>
      </div>

      {/* 双画布 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左：成衣线稿 */}
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
                onClick={() => onSketchZoom(z => Math.max(0.3, z - 0.2))}
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
                onClick={() => onSketchZoom(z => Math.min(3, z + 0.2))}
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
                onClick={handleResetView}
                style={{
                  height: 24, padding: '0 8px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 9, fontWeight: 500,
                }}
                title="Reset Zoom & Pan"
              >
                Fit
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 8, color: 'var(--text-muted)', opacity: 0.5 }}>Scroll=Zoom  Alt+Drag=Pan</span>
            </div>

            {/* 可缩放/平移画布区域 */}
            <div
              style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPanning.current ? 'grabbing' : 'default' }}
              onWheel={(e) => {
                e.preventDefault();
                onSketchZoom(z => Math.min(3, Math.max(0.3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
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
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}>
                <GarmentSketch view={storeView} garmentColor={garmentColor} />
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
  );
}
