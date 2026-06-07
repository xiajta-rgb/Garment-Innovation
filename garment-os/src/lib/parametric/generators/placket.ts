import type { GenePathData } from '@/types/gene';
import { num } from '../utils';
import type { PartCtx } from './index';

/**
 * 门襟生成器
 *
 * 整合点 (R8):
 * - 起点 Y 从 collar 锚点 (collar-bottom) 读取, 感知领型 (V/lapel 深 V / 立领 / 圆领)
 * - 终点 Y 从 body 锚点 (cf-hem) 读取
 * - 改 collar 或 body 时门襟自动跟随
 *
 * 支持: center (明门襟) / hidden (暗门襟) / double (双排扣)
 * 输出: 门襟轮廓线 + 明线 + 扣位
 */
export function generatePlacket(
  p: Record<string, number | string | boolean>,
  bodyCtx: PartCtx = { parameters: {}, anchors: {} }
): GenePathData[] {
  const bodyP = bodyCtx.parameters;
  const bodyA = bodyCtx.anchors;
  const placketType = String(p.placketType ?? 'none');
  if (placketType === 'none') return [{ id: 'placket-none', data: '', fill: 'none', stroke: '#000000', strokeWidth: 0.8 }];

  const placketWidth = num(p, 'placketWidth', 6);
  const buttonCount = num(p, 'buttonCount', 5);

  // R8: 起点 Y 从 collar-bottom 锚点读取 (感知领型)
  // collar-bottom 已在 dag-solver 中按 collarType 计算:
  //   - V/lapel: 领口底 = neckFrontY + collarHeight * 2.5/3.5
  //   - mandarin/turtle: 领座顶
  //   - round/square/boat: 领口底 = neckFrontY
  const collarBottomY = bodyA['collar-bottom']?.y ?? num(bodyP, 'neckFrontY', 34);
  const startY = collarBottomY + 4;  // 领底下方 4mm 开始扣位

  // 终点 Y 从 cf-hem 锚点读取 (前中心下摆)
  const cfHemY = bodyA['cf-hem']?.y ?? num(bodyP, 'hemLength', 224) + 4;
  const endY = cfHemY - 4;

  const hw = placketWidth / 2;
  const paths: GenePathData[] = [];

  switch (placketType) {
    case 'center': {
      paths.push({
        id: 'placket-center-outline',
        data: `M${100 - hw},${startY} L${100 - hw},${endY} M${100 + hw},${startY} L${100 + hw},${endY}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      paths.push({
        id: 'placket-center-topstitch',
        data: `M${100 - hw - 1.5},${startY} L${100 - hw - 1.5},${endY} M${100 + hw + 1.5},${startY} L${100 + hw + 1.5},${endY}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3,
        strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
      });
      // 圆形扣位
      const spacing = (endY - startY - 20) / (buttonCount - 1);
      let btnData = '';
      const btnR = 2;
      for (let i = 0; i < buttonCount; i++) {
        const by = startY + 16 + spacing * i;
        btnData += ` M${100 - btnR},${by} A${btnR},${btnR} 0 1,0 ${100 + btnR},${by} A${btnR},${btnR} 0 1,0 ${100 - btnR},${by}`;
      }
      paths.push({
        id: 'placket-center-buttons',
        data: btnData,
        fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
      });
      break;
    }
    case 'hidden': {
      paths.push({
        id: 'placket-hidden-line',
        data: `M100,${startY} L100,${endY}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
      });
      // 暗扣位 (×标记)
      const spacing = (endY - startY - 20) / (buttonCount - 1);
      let btnData = '';
      for (let i = 0; i < buttonCount; i++) {
        const by = startY + 16 + spacing * i;
        btnData += ` M${100 - 2},${by - 2} L${100 + 2},${by + 2} M${100 + 2},${by - 2} L${100 - 2},${by + 2}`;
      }
      paths.push({
        id: 'placket-hidden-buttons',
        data: btnData,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3, layer: 'detail',
      });
      break;
    }
    case 'double': {
      const offset = 12;
      paths.push({
        id: 'placket-double-outline',
        data: `M${100 - offset},${startY + 14} L${100 - offset},${endY} M${100 + offset},${startY + 14} L${100 + offset},${endY}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      paths.push({
        id: 'placket-double-topstitch',
        data: `M${100 - offset - 1.5},${startY + 14} L${100 - offset - 1.5},${endY} M${100 + offset + 1.5},${startY + 14} L${100 + offset + 1.5},${endY}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3,
        strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
      });
      // 双排扣位
      const spacing = (endY - startY - 30) / (buttonCount - 1);
      let btnData = '';
      const btnR = 2;
      for (let i = 0; i < buttonCount; i++) {
        const by = startY + 30 + spacing * i;
        btnData += ` M${100 - offset - btnR},${by} A${btnR},${btnR} 0 1,0 ${100 - offset + btnR},${by} A${btnR},${btnR} 0 1,0 ${100 - offset - btnR},${by}`;
        btnData += ` M${100 + offset - btnR},${by} A${btnR},${btnR} 0 1,0 ${100 + offset + btnR},${by} A${btnR},${btnR} 0 1,0 ${100 + offset - btnR},${by}`;
      }
      paths.push({
        id: 'placket-double-buttons',
        data: btnData,
        fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
      });
      break;
    }
  }

  return paths;
}
