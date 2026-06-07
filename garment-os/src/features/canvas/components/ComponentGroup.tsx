import { useRef, useEffect, useCallback } from 'react';
import type Konva from 'konva';
import { Group, Path, Transformer } from 'react-konva';
import { useCanvasStore } from '@/store/canvasStore';
import type { CanvasComponent } from '@/types';

interface Props {
  component: CanvasComponent;
  isSelected: boolean;
}

export default function ComponentGroup({ component, isSelected }: Props) {
  const { updateComponent, setSelectedId, pushHistory } = useCanvasStore();
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // 选中时挂载 Transformer
  useEffect(() => {
    if (!isSelected || !trRef.current || !groupRef.current) return;

    requestAnimationFrame(() => {
      if (trRef.current && groupRef.current) {
        trRef.current.nodes([groupRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    });
  }, [isSelected]);

  const handleDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      updateComponent(component.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [component.id, updateComponent]
  );

  const handleTransformStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleTransformEnd = useCallback(() => {
    const node = groupRef.current;
    if (!node) return;

    updateComponent(component.id, {
      x: node.x(),
      y: node.y(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
  }, [component.id, updateComponent]);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      setSelectedId(component.id);
    },
    [component.id, setSelectedId]
  );

  return (
    <>
      <Group
        ref={groupRef}
        id={component.id}
        x={component.x}
        y={component.y}
        scaleX={component.scaleX}
        scaleY={component.scaleY}
        rotation={component.rotation}
        draggable
        onClick={handleClick}
        onTap={handleClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTransformStart={handleTransformStart}
        onTransformEnd={handleTransformEnd}
      >
        {component.paths.map((path, index) => (
          <Path
            key={index}
            data={path.data}
            fill={path.fill}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
          />
        ))}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
          borderStroke="#e85d75"
          borderStrokeWidth={1}
          anchorStroke="#e85d75"
          anchorFill="#fff"
          anchorSize={8}
          anchorCornerRadius={2}
          rotateEnabled={true}
          keepRatio={false}
          padding={4}
        />
      )}
    </>
  );
}
