import type { GenePathData } from '@/types/gene';
import { num } from '../utils';
import type { PartCtx } from './index';

/**
 * 口袋生成器
 *
 * 整合点 (R6):
 * - 默认 Y 位置从 bodyCtx.anchors['waist-line']/['hip-line'] 读取
 *   不再硬编码 132, 改大身 waistY/hipY 时口袋自动跟随
 * - 贴袋/嵌线袋沿中心线左右对称分布
 *
 * 支持: patch (贴袋) / welt (嵌线袋) / breast (胸袋)
 * 每种口袋输出: 轮廓线 + 明线
 */
export function generatePocket(
  p: Record<string, number | string | boolean>,
  bodyCtx: PartCtx = { parameters: {}, anchors: {} }
): GenePathData[] {
  const bodyP = bodyCtx.parameters;
  const bodyA = bodyCtx.anchors;
  const pocketType = String(p.pocketType ?? 'none');
  if (pocketType === 'none') return [];

  const pocketW = num(p, 'pocketWidth', 26);
  const pocketH = num(p, 'pocketHeight', 36);

  // R6: 口袋 Y 位置基于 body waist-line 锚点联动
  // 默认: 在腰线下方 8mm (自然贴袋位置)
  // 用户可覆盖 pocketY 参数
  const waistLineY = bodyA['waist-line']?.y ?? 140;
  const defaultPocketY = waistLineY + 8; // 腰下 8mm
  const pocketY = num(p, 'pocketY', defaultPocketY);

  // 胸袋默认基于 bust-line 上方
  const bustLineY = bodyA['bust-line']?.y ?? 100;

  // 口袋左右位置: 基于肩宽 (cx ± gap + pocketW)
  const shoulderW = num(bodyP, 'shoulderWidth', 32);
  const pocketGap = Math.max(4, shoulderW * 0.18);
  const lx = 100 - pocketGap - pocketW;  // 左贴袋 x
  const rx = 100 + pocketGap;            // 右贴袋 x

  switch (pocketType) {
    case 'patch': {
      const ts = 1.5;
      return [
        {
          id: 'pocket-patch-outline',
          data: `M${lx},${pocketY} L${lx},${pocketY + pocketH} L${lx + pocketW},${pocketY + pocketH} L${lx + pocketW},${pocketY} M${rx},${pocketY} L${rx},${pocketY + pocketH} L${rx + pocketW},${pocketY + pocketH} L${rx + pocketW},${pocketY}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
        },
        {
          id: 'pocket-patch-topstitch',
          data: `M${lx + ts},${pocketY + ts} L${lx + ts},${pocketY + pocketH - ts} L${lx + pocketW - ts},${pocketY + pocketH - ts} L${lx + pocketW - ts},${pocketY + ts} M${rx + ts},${pocketY + ts} L${rx + ts},${pocketY + pocketH - ts} L${rx + pocketW - ts},${pocketY + pocketH - ts} L${rx + pocketW - ts},${pocketY + ts}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.3,
          strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
        },
      ];
    }
    case 'welt': {
      return [
        {
          id: 'pocket-welt-outline',
          data: `M${lx},${pocketY} L${lx + pocketW},${pocketY} M${lx},${pocketY + 4} L${lx + pocketW},${pocketY + 4} M${rx},${pocketY} L${rx + pocketW},${pocketY} M${rx},${pocketY + 4} L${rx + pocketW},${pocketY + 4}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
        },
        {
          id: 'pocket-welt-topstitch',
          data: `M${lx},${pocketY - 1.5} L${lx + pocketW},${pocketY - 1.5} M${lx},${pocketY + 5.5} L${lx + pocketW},${pocketY + 5.5} M${rx},${pocketY - 1.5} L${rx + pocketW},${pocketY - 1.5} M${rx},${pocketY + 5.5} L${rx + pocketW},${pocketY + 5.5}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.3,
          strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
        },
      ];
    }
    case 'breast': {
      // 胸袋: 位于 bust-line 上方 (胸口位置)
      const breastY = bustLineY - pocketH * 0.6;
      const bx = 100 + Math.max(6, shoulderW * 0.2);
      const ts = 1.5;
      return [
        {
          id: 'pocket-breast-outline',
          data: `M${bx},${breastY} L${bx + pocketW},${breastY} L${bx + pocketW},${breastY + pocketH * 0.6} L${bx},${breastY + pocketH * 0.6}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
        },
        {
          id: 'pocket-breast-topstitch',
          data: `M${bx + ts},${breastY + ts} L${bx + pocketW - ts},${breastY + ts} L${bx + pocketW - ts},${breastY + pocketH * 0.6 - ts} L${bx + ts},${breastY + pocketH * 0.6 - ts}`,
          fill: 'none', stroke: '#000000', strokeWidth: 0.3,
          strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
        },
      ];
    }
    default:
      return [];
  }
}
