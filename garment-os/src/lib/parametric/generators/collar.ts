import type { GenePathData } from '@/types/gene';
import { num } from '../utils';
import { grainLine, notch } from '../markings';
import type { PartCtx } from './index';

/**
 * 衣领附加层生成器
 *
 * 关键设计: 领口形状已整合进大身轮廓 (由 body.ts 负责)
 * 本生成器只输出"独立领件":
 * - mandarin: 立领座 (绕颈的小立领)
 * - lapel:    翻领片 (深 V 两侧的三角翻领)
 * - halter:   挂脖带
 * - turtle:   高领筒
 *
 * 对于 round / v / square / boat 这类无独立领件的领型,
 * 本生成器返回空数组 (大身轮廓已包含所有领口信息)
 */
export function generateCollar(
  p: Record<string, number | string | boolean>,
  bodyCtx: PartCtx = { parameters: {}, anchors: {} }
): GenePathData[] {
  const bodyP = bodyCtx.parameters;
  const collarType = String(p.collarType ?? 'round');
  const collarHeight = num(p, 'collarHeight', 14);
  const collarSpread = num(p, 'collarSpread', 28);

  // 从衣身参数读取颈侧点位置 (与身体对齐)
  const shoulderY = num(bodyP, 'shoulderY', 48);
  const cfNeckY = num(bodyP, 'neckFrontY', 34);
  const snY = shoulderY - 6; // 颈侧点 y
  const cx = 100;

  const paths: GenePathData[] = [];

  switch (collarType) {
    case 'mandarin': {
      // 立领: 绕颈的小立领座
      // 大身已挖空高圆领口, 此处绘制立领本体 (在领口之上)
      const outerTopY = snY - 16 - collarHeight * 0.3;
      const innerTopY = snY - 6;
      const w = Math.max(20, collarSpread * 0.7); // 立领宽度
      paths.push({
        id: 'collar-mandarin-stand',
        data: `M${cx - w},${snY} C${cx - w + 4},${snY - 6} ${cx - w + 14},${outerTopY} ${cx},${outerTopY} C${cx + w - 14},${outerTopY} ${cx + w - 4},${snY - 6} ${cx + w},${snY} L${cx + w},${innerTopY} C${cx + w - 4},${snY - 2} ${cx + w - 14},${innerTopY + 2} ${cx},${innerTopY + 2} C${cx - w + 14},${innerTopY + 2} ${cx - w + 4},${snY - 2} ${cx - w},${innerTopY} Z`,
        fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      // 立领明线 (顶部边缘)
      paths.push({
        id: 'collar-mandarin-topstitch',
        data: `M${cx - w + 4},${snY - 4} C${cx - w + 10},${snY - 10} ${cx - w + 16},${outerTopY + 2} ${cx},${outerTopY + 2} C${cx + w - 16},${outerTopY + 2} ${cx + w - 10},${snY - 10} ${cx + w - 4},${snY - 4}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3,
        strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
      });
      // 领座结构线
      paths.push({
        id: 'collar-stand-line',
        data: `M${cx - w + 2},${snY - 2} C${cx - w + 8},${snY - 8} ${cx - w + 14},${innerTopY + 4} ${cx},${innerTopY + 4} C${cx + w - 14},${innerTopY + 4} ${cx + w - 8},${snY - 8} ${cx + w - 2},${snY - 2}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
      });
      break;
    }
    case 'lapel': {
      // 翻领: 深 V 两侧的三角翻领
      // 大身已挖空深 V 领口, 此处绘制翻领片
      const lapelBottomY = cfNeckY + collarHeight * 3.5;
      const lapelW = collarSpread * 0.7;
      // 左翻领
      paths.push({
        id: 'collar-lapel-left',
        data: `M${cx},${snY} L${cx},${lapelBottomY} L${cx - lapelW},${lapelBottomY - 14} L${cx - lapelW - 6},${snY + 6} L${cx - lapelW - 10},${snY} Z`,
        fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      // 右翻领
      paths.push({
        id: 'collar-lapel-right',
        data: `M${cx},${snY} L${cx},${lapelBottomY} L${cx + lapelW},${lapelBottomY - 14} L${cx + lapelW + 6},${snY + 6} L${cx + lapelW + 10},${snY} Z`,
        fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      // 翻领明线 (外缘)
      paths.push({
        id: 'collar-lapel-topstitch',
        data: `M${cx - lapelW - 10},${snY} L${cx - lapelW - 6},${snY + 6} L${cx - lapelW},${lapelBottomY - 14} M${cx + lapelW + 10},${snY} L${cx + lapelW + 6},${snY + 6} L${cx + lapelW},${lapelBottomY - 14}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3,
        strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
      });
      // 翻领翻折线 (结构线)
      paths.push({
        id: 'collar-lapel-fold-line',
        data: `M${cx - 4},${snY + 4} L${cx - lapelW - 4},${snY + 8} M${cx + 4},${snY + 4} L${cx + lapelW + 4},${snY + 8}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
      });
      break;
    }
    case 'turtle': {
      // 高领筒: 从大身高圆领口向上延伸
      const turtleTopY = snY - 24 - collarHeight;
      const w = Math.max(18, collarSpread * 0.65);
      paths.push({
        id: 'collar-turtle-tube',
        data: `M${cx - w},${snY - 4} L${cx - w},${turtleTopY} C${cx - w + 6},${turtleTopY - 4} ${cx + w - 6},${turtleTopY - 4} ${cx + w},${turtleTopY} L${cx + w},${snY - 4} C${cx + w - 4},${snY - 8} ${cx - w + 4},${snY - 8} ${cx - w},${snY - 4} Z`,
        fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      // 高领明线 (顶部)
      paths.push({
        id: 'collar-turtle-topstitch',
        data: `M${cx - w + 4},${turtleTopY + 1.5} C${cx - w + 8},${turtleTopY - 1.5} ${cx + w - 8},${turtleTopY - 1.5} ${cx + w - 4},${turtleTopY + 1.5}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3,
        strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
      });
      // 高领结构线 (底)
      paths.push({
        id: 'collar-turtle-rib-line',
        data: `M${cx - w + 2},${snY - 6} C${cx - w + 4},${snY - 8} ${cx + w - 4},${snY - 8} ${cx + w - 2},${snY - 6}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
      });
      break;
    }
    case 'halter': {
      // 挂脖: 颈后带
      const strapW = 6;
      const strapY = snY - 20;
      paths.push({
        id: 'collar-halter-strap',
        data: `M${cx - strapW / 2},${snY} L${cx - strapW / 2},${strapY} L${cx + strapW / 2},${strapY} L${cx + strapW / 2},${snY}`,
        fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'outline',
      });
      paths.push({
        id: 'collar-halter-topstitch',
        data: `M${cx - strapW / 2 - 1.5},${snY} L${cx - strapW / 2 - 1.5},${strapY} M${cx + strapW / 2 + 1.5},${snY} L${cx + strapW / 2 + 1.5},${strapY}`,
        fill: 'none', stroke: '#000000', strokeWidth: 0.3,
        strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
      });
      break;
    }
    // round / v / square / boat: 领口已整合进大身轮廓, 无独立领件
    case 'round':
    case 'v':
    case 'square':
    case 'boat':
    default:
      // 故意返回空数组 - 大身轮廓已包含领口形状
      break;
  }

  // ─── 工业级纸样符号 (Milestone B) ───
  // 独立领件的布纹线 (mandarin/lapel/turtle/halter)
  // 领件布纹线 = 垂直方向, 居中
  if (paths.length > 0) {
    const collarW = collarSpread * 2;
    paths.push(grainLine({
      cx, cy: snY - 6, length: collarW * 0.6, direction: 'vertical', idPrefix: 'collar',
    }));
    // 领底剪口 (左右颈侧点) - 与衣身对齐
    paths.push(notch({ x: 100 - collarSpread, y: snY, direction: 'top', idPrefix: 'collar-sn-l' }));
    paths.push(notch({ x: 100 + collarSpread, y: snY, direction: 'top', idPrefix: 'collar-sn-r' }));
  }

  return paths;
}
