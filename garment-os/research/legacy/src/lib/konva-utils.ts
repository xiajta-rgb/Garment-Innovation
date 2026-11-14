import Konva from 'konva';

/**
 * 获取指定坐标处的组件
 */
export function getComponentAtPoint(
  stage: Konva.Stage,
  x: number,
  y: number
): Konva.Node | null {
  const shape = stage.getIntersection({ x, y });
  return shape ?? null;
}
