import { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '@/store/canvasStore';
import { getInitialTemplates } from '@/data/templates';
import ComponentGroup from './ComponentGroup';

export default function DesignCanvas() {
  const { components, selectedId, addComponent, setSelectedId, zoom } = useCanvasStore();
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // 初始化一个默认设计
  useEffect(() => {
    if (components.length === 0) {
      const templates = getInitialTemplates();
      templates.forEach((t, i) => {
        addComponent({
          ...t,
          x: 100 + (i % 2) * 250,
          y: 50 + Math.floor(i / 2) * 200,
        });
      });
    }
  }, [components.length, addComponent]);

  // 响应式大小
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      if (entries[0]) {
        setStageSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) {
        setSelectedId(null);
      }
    },
    [setSelectedId]
  );

  // 滚轮缩放
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const currentZoom = useCanvasStore.getState().zoom;
    const delta = e.evt.deltaY > 0 ? -0.05 : 0.05;
    useCanvasStore.getState().setZoom(Math.max(0.3, Math.min(2, currentZoom + delta)));
  }, []);

  // 拖放处理
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!stageRef.current || !containerRef.current) return;

      const data = e.dataTransfer.getData('application/json');
      if (!data) return;

      const template = JSON.parse(data);
      const stageBox = containerRef.current.getBoundingClientRect();

      const currentZoom = useCanvasStore.getState().zoom;
      const x = (e.clientX - stageBox.left) / currentZoom;
      const y = (e.clientY - stageBox.top) / currentZoom;

      addComponent({
        ...template,
        x,
        y,
      });
    },
    [addComponent]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: 'var(--canvas-bg, #fafafa)' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* 网格背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-color, rgba(0,0,0,0.05)) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-color, rgba(0,0,0,0.05)) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={zoom}
        scaleY={zoom}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onWheel={handleWheel}
      >
        <Layer>
          {components.map((comp) => (
            <ComponentGroup key={comp.id} component={comp} isSelected={selectedId === comp.id} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
