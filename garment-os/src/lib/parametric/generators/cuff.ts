import type { GenePathData } from '@/types/gene';
import { num } from '../utils';
import type { PartCtx } from './index';

/**
 * 袖口生成器
 *
 * 整合点 (R9):
 * - 位置从 sleeve 锚点 (cuff-top-left/right) 读取
 * - 宽度从 sleeve.cuffWidth 参数读取 (而非 cuff 自己的 cuffHeight)
 * - 袖口高度按 cuffHeight 参数 (默认 14mm, 等于 sleeve cuffWidth)
 *
 * 支持: plain (平袖口) / button (扣袖口) / turnback (翻折袖口)
 * 输出: 袖口轮廓线 + 明线 (+ 扣位/翻折线)
 */
export function generateCuff(
  p: Record<string, number | string | boolean>,
  sleeveCtx: PartCtx = { parameters: {}, anchors: {} },
  _bodyCtx: PartCtx = { parameters: {}, anchors: {} } // eslint-disable-line @typescript-eslint/no-unused-vars
): GenePathData[] {
  const sleeveP = sleeveCtx.parameters;
  const cuffType = String(p.cuffType ?? 'plain');

  // R9: 从 sleeve 锚点读取袖口位置
  const cuffTopLeft = sleeveCtx.anchors['cuff-top-left'];
  const cuffTopRight = sleeveCtx.anchors['cuff-top-right'];
  if (!cuffTopLeft || !cuffTopRight) {
    return []; // 无 sleeve 锚点, 不绘制袖口
  }

  // R9: 袖口宽度从 sleeve.cuffWidth 联动 (而非 cuff 自身)
  const sleeveCuffW = num(sleeveP, 'cuffWidth', 14);
  // cuffHeight 可独立调整 (默认等于 sleeve cuffWidth)
  const cuffHeight = num(p, 'cuffHeight', sleeveCuffW);

  const sleeveType = String(sleeveP.sleeveType ?? 'long');
  if (sleeveType === 'sleeveless') return [];

  // 袖口 y = sleeve cuff-top 锚点的 y (已在 dag-solver 中计算)
  const cuffY = cuffTopLeft.y;

  // 右袖口位置 (从 sleeve 锚点)
  const rCuffLeftX = cuffTopRight.x;
  const rSleeveEndX = rCuffLeftX + sleeveCuffW;
  // 左袖口位置
  const lCuffRightX = cuffTopLeft.x;
  const lSleeveEndX = lCuffRightX - sleeveCuffW;

  switch (cuffType) {
    case 'plain': {
      return [
        {
          id: 'cuff-plain-line',
          data: `M${rCuffLeftX},${cuffY} L${rSleeveEndX},${cuffY} M${lSleeveEndX},${cuffY} L${lCuffRightX},${cuffY}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
        },
        {
          id: 'cuff-plain-topstitch',
          data: `M${rCuffLeftX + 1.5},${cuffY + 1.5} L${rSleeveEndX - 1.5},${cuffY + 1.5} M${lSleeveEndX + 1.5},${cuffY + 1.5} L${lCuffRightX - 1.5},${cuffY + 1.5}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.3,
          strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
        },
      ];
    }
    case 'button': {
      return [
        {
          id: 'cuff-button-outline',
          data: `M${rCuffLeftX},${cuffY} L${rCuffLeftX},${cuffY + cuffHeight} L${rSleeveEndX},${cuffY + cuffHeight} L${rSleeveEndX},${cuffY} M${lSleeveEndX},${cuffY} L${lSleeveEndX},${cuffY + cuffHeight} L${lCuffRightX},${cuffY + cuffHeight} L${lCuffRightX},${cuffY}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
        },
        {
          id: 'cuff-button-topstitch',
          data: `M${rCuffLeftX + 1.5},${cuffY + 1.5} L${rCuffLeftX + 1.5},${cuffY + cuffHeight - 1.5} L${rSleeveEndX - 1.5},${cuffY + cuffHeight - 1.5} L${rSleeveEndX - 1.5},${cuffY + 1.5} M${lSleeveEndX + 1.5},${cuffY + 1.5} L${lSleeveEndX + 1.5},${cuffY + cuffHeight - 1.5} L${lCuffRightX - 1.5},${cuffY + cuffHeight - 1.5} L${lCuffRightX - 1.5},${cuffY + 1.5}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.3,
          strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
        },
        {
          id: 'cuff-button-buttons',
          data: `M${rCuffLeftX + 3},${cuffY + cuffHeight / 2 - 2} A2,2 0 1,0 ${rCuffLeftX + 7},${cuffY + cuffHeight / 2 - 2} A2,2 0 1,0 ${rCuffLeftX + 3},${cuffY + cuffHeight / 2 - 2} M${lSleeveEndX + 3},${cuffY + cuffHeight / 2 - 2} A2,2 0 1,0 ${lSleeveEndX + 7},${cuffY + cuffHeight / 2 - 2} A2,2 0 1,0 ${lSleeveEndX + 3},${cuffY + cuffHeight / 2 - 2}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
        },
      ];
    }
    case 'turnback': {
      return [
        {
          id: 'cuff-turnback-outline',
          data: `M${rCuffLeftX},${cuffY} L${rSleeveEndX},${cuffY} L${rSleeveEndX},${cuffY + cuffHeight} L${rCuffLeftX},${cuffY + cuffHeight} Z M${lSleeveEndX},${cuffY} L${lCuffRightX},${cuffY} L${lCuffRightX},${cuffY + cuffHeight} L${lSleeveEndX},${cuffY + cuffHeight} Z`,
          fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
        },
        {
          id: 'cuff-turnback-fold',
          data: `M${rCuffLeftX},${cuffY + cuffHeight * 0.4} L${rSleeveEndX},${cuffY + cuffHeight * 0.4} M${lSleeveEndX},${cuffY + cuffHeight * 0.4} L${lCuffRightX},${cuffY + cuffHeight * 0.4}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
        },
        {
          id: 'cuff-turnback-topstitch',
          data: `M${rCuffLeftX + 1.5},${cuffY + cuffHeight * 0.4 + 1.5} L${rSleeveEndX - 1.5},${cuffY + cuffHeight * 0.4 + 1.5} M${lSleeveEndX + 1.5},${cuffY + cuffHeight * 0.4 + 1.5} L${lCuffRightX - 1.5},${cuffY + cuffHeight * 0.4 + 1.5}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.3,
          strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
        },
      ];
    }
    default:
      return [];
  }
}
