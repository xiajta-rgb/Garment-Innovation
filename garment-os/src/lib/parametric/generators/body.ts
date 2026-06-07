import type { GenePathData } from '@/types/gene';
import { num } from '../utils';
import { grainLine, foldLine, notch } from '../markings';
import type { PartCtx } from './index';

/**
 * 衣身生成器
 *
 * 关键设计:
 * 1. 领口形状直接整合进大身轮廓, 与 collar 类型联动
 *    - round/v/square/boat/mandarin/lapel/turtle/halter 共 8 种领型
 * 2. 工业级纸样符号 (Milestone B):
 *    - cutting-line: 净样线 (大身轮廓, 粗实线 0.8mm)
 *    - grain-line: 布纹线 (前中心垂直, 标识 fabric 经向)
 *    - fold-line: 折叠线 (后中心垂直虚线, 标识对称裁剪)
 *    - notch: 剪口 (肩点/颈侧/袖窿底/腰点/下摆, 拼合对位)
 *    - dart: 省道 (腰省/胸省)
 *    - stitch/detail: 明线/结构线
 *
 * - round: U 形领口 (默认)
 * - v:     V 形领口, 大身轮廓从颈侧直线下降到 V 底
 * - square: 方形领口, 颈侧垂直下降再水平连接
 * - boat:   横向浅弧, 领口延展到肩部外侧
 * - mandarin: 高圆领 (贴合立领底座), 立领作为独立部件叠加
 * - lapel:  深 V 形 (大身负责挖空, 翻领作为独立部件叠加)
 * - turtle: 高圆紧贴颈, 高领作为独立部件叠加
 * - halter: 抹胸 + 颈部 V 挖空
 */
export function generateBody(
  p: Record<string, number | string | boolean>,
  collarCtx: PartCtx = { parameters: {}, anchors: {} }
): GenePathData[] {
  const collarP = collarCtx.parameters;
  const collarType = String(collarP.collarType ?? 'round');
  const collarSpread = num(collarP, 'collarSpread', 28);
  const collarHeight = num(collarP, 'collarHeight', 14);

  // 基础锚点
  const neckFront = num(p, 'neckFrontY', 34);
  const shoulderY = num(p, 'shoulderY', 48);
  const shoulderW = num(p, 'shoulderWidth', 32);
  const armholeDepth = num(p, 'armholeDepth', 96);
  const waistY = num(p, 'waistY', 140);
  const waistSuppression = num(p, 'waistSuppression', 8);
  const hipY = num(p, 'hipY', 172);
  const hemY = num(p, 'hemLength', 224);
  const hemW = num(p, 'hemWidth', 42);

  const cx = 100; // 中心线 x
  const neckSideY = shoulderY - 6;

  // 袖窿弧线控制点
  const ahCtrlX = Math.max(2, shoulderW * 0.12);
  const ahCtrlY1 = shoulderY + (armholeDepth - shoulderY) * 0.15;
  const ahCtrlY2 = shoulderY + (armholeDepth - shoulderY) * 0.35;
  const ahCtrlY3 = shoulderY + (armholeDepth - shoulderY) * 0.55;

  const waistOffset = waistSuppression * 0.3;

  // ─── 领口形状 (按 collar 类型分支) ───
  // 形状: 从左颈侧点到右颈侧点的 path 段
  const necklinePath = buildNecklinePath(cx, neckFront, shoulderW, neckSideY, shoulderY, collarType, collarSpread, collarHeight);

  // ─── 衣身轮廓: 整合领口形状 ───
  const outlinePath = [
    // 领口 (由 buildNecklinePath 决定)
    ...necklinePath,
    // 右肩 → 袖窿 → 侧缝 → 下摆 → 左缝 → 袖窿 → 左肩
    `L${cx + shoulderW},${shoulderY}`,
    `C${cx + shoulderW - ahCtrlX},${shoulderY + 1} ${cx + shoulderW - ahCtrlX - 4},${ahCtrlY1} ${cx + shoulderW - ahCtrlX - 6},${ahCtrlY2}`,
    `C${cx + shoulderW - ahCtrlX - 2},${ahCtrlY3} ${cx + shoulderW + 1},${shoulderY + (armholeDepth - shoulderY) * 0.75} ${cx + shoulderW - 4},${armholeDepth}`,
    `L${cx + shoulderW - 2},${armholeDepth + 12}`,
    `C${cx + shoulderW - 4},${armholeDepth + 24} ${cx + shoulderW - 4 - waistOffset},${armholeDepth + 34} ${cx + shoulderW - 2 - waistOffset},${waistY}`,
    `L${cx + shoulderW - waistOffset + 2},${waistY + 8}`,
    `C${cx + shoulderW - waistOffset + 4},${waistY + 16} ${cx + hemW - 2},${waistY + 22} ${cx + hemW},${hipY}`,
    `L${cx + hemW + 2},${hipY + 12}`,
    `C${cx + hemW + 4},${hipY + 28} ${cx + hemW + 4},${hipY + 40} ${cx + hemW},${hemY}`,
    `L${cx},${hemY + 4}`,
    `L${cx - hemW},${hemY}`,
    `C${cx - hemW - 4},${hipY + 40} ${cx - hemW - 4},${hipY + 28} ${cx - hemW - 2},${hipY + 12}`,
    `L${cx - hemW},${hipY}`,
    `C${cx - hemW + 2},${waistY + 22} ${cx - shoulderW + waistOffset - 4},${waistY + 16} ${cx - shoulderW + waistOffset - 2},${waistY + 8}`,
    `L${cx - shoulderW + waistOffset + 2},${waistY}`,
    `C${cx - shoulderW + waistOffset + 4},${armholeDepth + 34} ${cx - shoulderW + 4},${armholeDepth + 24} ${cx - shoulderW + 2},${armholeDepth + 12}`,
    `L${cx - shoulderW + 4},${armholeDepth}`,
    `C${cx - shoulderW - 1},${shoulderY + (armholeDepth - shoulderY) * 0.75} ${cx - shoulderW + ahCtrlX + 2},${ahCtrlY3} ${cx - shoulderW + ahCtrlX + 6},${ahCtrlY2}`,
    `C${cx - shoulderW + ahCtrlX + 4},${ahCtrlY1} ${cx - shoulderW + ahCtrlX},${shoulderY + 1} ${cx - shoulderW},${shoulderY}`,
    'Z',
  ].join(' ');

  const paths: GenePathData[] = [
    { id: 'body-outline', data: outlinePath, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'cutting-line' },
  ];

  // ─── 明线 (topstitching) ───
  const tsOffset = 1.5;
  // 袖窿明线
  const rAhTs = [
    `M${cx + shoulderW - tsOffset},${shoulderY + tsOffset}`,
    `C${cx + shoulderW - ahCtrlX - tsOffset},${shoulderY + 1 + tsOffset} ${cx + shoulderW - ahCtrlX - 4 - tsOffset},${ahCtrlY1 + tsOffset * 0.5} ${cx + shoulderW - ahCtrlX - 6 - tsOffset},${ahCtrlY2}`,
    `C${cx + shoulderW - ahCtrlX - 2 - tsOffset},${ahCtrlY3} ${cx + shoulderW + 1 - tsOffset},${shoulderY + (armholeDepth - shoulderY) * 0.75 + tsOffset * 0.5} ${cx + shoulderW - 4 - tsOffset},${armholeDepth - tsOffset}`,
  ].join(' ');
  const lAhTs = [
    `M${cx - shoulderW + tsOffset},${shoulderY + tsOffset}`,
    `C${cx - shoulderW + ahCtrlX + tsOffset},${shoulderY + 1 + tsOffset} ${cx - shoulderW + ahCtrlX + 4 + tsOffset},${ahCtrlY1 + tsOffset * 0.5} ${cx - shoulderW + ahCtrlX + 6 + tsOffset},${ahCtrlY2}`,
    `C${cx - shoulderW + ahCtrlX + 2 + tsOffset},${ahCtrlY3} ${cx - shoulderW - 1 + tsOffset},${shoulderY + (armholeDepth - shoulderY) * 0.75 + tsOffset * 0.5} ${cx - shoulderW + 4 + tsOffset},${armholeDepth - tsOffset}`,
  ].join(' ');
  paths.push({
    id: 'body-topstitch-armhole', data: `${rAhTs} ${lAhTs}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.3,
    strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
  });

  // 下摆明线
  paths.push({
    id: 'body-topstitch-hem',
    data: `M${cx - hemW + 2},${hemY - tsOffset} L${cx + hemW - 2},${hemY - tsOffset}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.3,
    strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
  });

  // 领口明线 (沿真实领口形状, 比 outline 内缩 1.5mm)
  const necklineTsPath = buildNecklinePath(
    cx, neckFront, shoulderW, neckSideY, shoulderY,
    collarType, collarSpread, collarHeight,
    tsOffset, // 缩进量
    true       // 翻转方向 (内缩 vs 外扩)
  );
  if (necklineTsPath.length > 0) {
    paths.push({
      id: 'body-topstitch-neckline',
      data: necklineTsPath.join(' '),
      fill: 'none', stroke: '#000000', strokeWidth: 0.3,
      strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
    });
  }

  // ─── 结构线 ───
  // 肩线
  paths.push({
    id: 'body-shoulder-line',
    data: `M${cx - shoulderW + 44},${neckSideY} L${cx - shoulderW},${shoulderY} M${cx + shoulderW},${shoulderY} L${cx + shoulderW - 44},${neckSideY}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
  });

  // 侧缝线
  paths.push({
    id: 'body-side-seam',
    data: `M${cx + shoulderW - 4},${armholeDepth} L${cx + shoulderW - 2 - waistOffset},${waistY} L${cx + hemW},${hipY} L${cx + hemW},${hemY}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
  });
  paths.push({
    id: 'body-side-seam-left',
    data: `M${cx - shoulderW + 4},${armholeDepth} L${cx - shoulderW + waistOffset + 2},${waistY} L${cx - hemW},${hipY} L${cx - hemW},${hemY}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
  });

  // 腰省
  const dartW = waistSuppression * 0.4;
  const dartEndY = waistY - 8;
  paths.push({
    id: 'body-dart-rf',
    data: `M${cx + shoulderW * 0.35},${armholeDepth - 6} L${cx + shoulderW * 0.35 - dartW / 2},${dartEndY} L${cx + shoulderW * 0.35 + dartW / 2},${dartEndY}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'dart',
  });
  paths.push({
    id: 'body-dart-lf',
    data: `M${cx - shoulderW * 0.35},${armholeDepth - 6} L${cx - shoulderW * 0.35 - dartW / 2},${dartEndY} L${cx - shoulderW * 0.35 + dartW / 2},${dartEndY}`,
    fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'dart',
  });

  // ─── 工业级纸样符号 (Milestone B) ───

  // 布纹线 (Grain Line) - 前中心垂直, 标识 fabric 经向
  // 长度 = 衣长 * 0.5, 居中放在前中心
  const grainLen = (hemY - shoulderY) * 0.45;
  const grainCy = shoulderY + grainLen / 2 + 4;
  paths.push(grainLine({ cx, cy: grainCy, length: grainLen, direction: 'vertical', idPrefix: 'body-front' }));

  // 折叠线 (Fold Line) - 后中心垂直虚线 (标识对称纸样)
  paths.push(...foldLine({
    x1: cx, y1: shoulderY - 4,
    x2: cx, y2: hemY + 8,
    idPrefix: 'body-back',
  }));

  // 剪口 (Notches) - 关键拼合对位点
  // 1. 颈侧点 (sn-left/right) - 与领子对齐
  paths.push(notch({ x: cx - shoulderW + 44, y: neckSideY, direction: 'top', idPrefix: 'sn-left' }));
  paths.push(notch({ x: cx + shoulderW - 44, y: neckSideY, direction: 'top', idPrefix: 'sn-right' }));
  // 2. 肩点 (sp-left/right) - 与袖子对齐
  paths.push(notch({ x: cx - shoulderW, y: shoulderY, direction: 'out', idPrefix: 'sp-left' }));
  paths.push(notch({ x: cx + shoulderW, y: shoulderY, direction: 'out', idPrefix: 'sp-right' }));
  // 3. 袖窿底 (ap-left/right) - 与袖山对齐
  paths.push(notch({ x: cx - shoulderW + 4, y: armholeDepth, direction: 'out', idPrefix: 'ap-left' }));
  paths.push(notch({ x: cx + shoulderW - 4, y: armholeDepth, direction: 'out', idPrefix: 'ap-right' }));
  // 4. 侧缝腰点 (side-waist)
  paths.push(notch({ x: cx + shoulderW - waistOffset, y: waistY, direction: 'right', idPrefix: 'side-waist-r' }));
  paths.push(notch({ x: cx - shoulderW + waistOffset, y: waistY, direction: 'left', idPrefix: 'side-waist-l' }));
  // 5. 下摆点 (side-hem)
  paths.push(notch({ x: cx + hemW, y: hemY, direction: 'right', idPrefix: 'side-hem-r' }));
  paths.push(notch({ x: cx - hemW, y: hemY, direction: 'left', idPrefix: 'side-hem-l' }));

  return paths;
}

/**
 * 构建领口路径 (从左颈侧点到右颈侧点)
 *
 * @param cx 中心线 x
 * @param neckFront 前颈点 y
 * @param shoulderW 半肩宽
 * @param neckSideY 颈侧点 y
 * @param collarType 领型
 * @param collarSpread 领口左右延展
 * @param collarHeight 领高
 * @param inset 向内缩进量 (用于明线), 正值表示向内
 * @param reverse 翻转方向 (明线用)
 */
function buildNecklinePath(
  cx: number,
  neckFront: number,
  shoulderW: number,
  neckSideY: number,
  shoulderY: number,
  collarType: string,
  collarSpread: number,
  collarHeight: number,
  inset: number = 0,
  reverse: boolean = false
): string[] {
  // 颈侧点位置 (左/右)
  const leftNx = cx - shoulderW + 44;
  const rightNx = cx + shoulderW - 44;
  // 颈前点
  const fxY = neckFront;

  // 用于反向路径 (明线, 从右到左)
  const dir = reverse ? -1 : 1;

  switch (collarType) {
    case 'v': {
      // V 形领: 从左颈侧 → V 底 → 右颈侧
      const vDepth = neckFront + collarHeight * 2.5 + inset * dir;
      if (reverse) {
        return [
          `M${rightNx},${neckSideY - inset}`,
          `L${cx},${vDepth}`,
          `L${leftNx},${neckSideY - inset}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `C${leftNx + 8},${neckSideY - 2} ${leftNx + 14},${neckSideY - 4} ${cx - collarSpread + 18},${neckSideY}`,
        `L${cx},${vDepth}`,
        `L${cx + collarSpread - 18},${neckSideY}`,
        `C${cx + shoulderW - 14},${neckSideY - 4} ${cx + shoulderW - 8},${neckSideY - 2} ${rightNx},${neckSideY}`,
      ];
    }
    case 'square': {
      // 方形领: 左颈侧 → 垂直下 → 横过 → 垂直上 → 右颈侧
      const sqDepth = neckFront + collarHeight + inset * dir;
      const sqSpread = collarSpread;
      if (reverse) {
        return [
          `M${rightNx},${neckSideY - inset}`,
          `L${cx + sqSpread - inset},${neckSideY - inset}`,
          `L${cx + sqSpread - inset},${sqDepth + (reverse ? 0 : 0)}`,
          `L${cx - sqSpread + inset},${sqDepth + (reverse ? 0 : 0)}`,
          `L${cx - sqSpread + inset},${neckSideY - inset}`,
          `L${leftNx},${neckSideY - inset}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `L${cx - sqSpread},${neckSideY}`,
        `L${cx - sqSpread},${sqDepth}`,
        `L${cx + sqSpread},${sqDepth}`,
        `L${cx + sqSpread},${neckSideY}`,
        `L${rightNx},${neckSideY}`,
      ];
    }
    case 'boat': {
      // 船领: 横向浅弧, 延展到肩部外侧
      const boatSpread = collarSpread * 1.3;
      if (reverse) {
        return [
          `M${cx + boatSpread - inset},${neckSideY + inset * 0.3}`,
          `C${cx + boatSpread * 0.5 - inset},${fxY - inset * 0.5} ${cx - boatSpread * 0.5 + inset},${fxY - inset * 0.5} ${cx - boatSpread + inset},${neckSideY + inset * 0.3}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `L${cx - boatSpread},${neckSideY}`,
        `C${cx - boatSpread * 0.5},${fxY} ${cx + boatSpread * 0.5},${fxY} ${cx + boatSpread},${neckSideY}`,
        `L${rightNx},${neckSideY}`,
      ];
    }
    case 'mandarin':
    case 'turtle': {
      // 高圆领 (立领/高领底座): 紧贴颈部
      const highSpread = Math.max(20, collarSpread * 0.7);
      const highY = neckSideY - collarHeight * 0.3;
      if (reverse) {
        return [
          `M${cx + highSpread - inset},${highY + inset}`,
          `C${cx + highSpread * 0.5 - inset},${fxY + inset * 0.5} ${cx - highSpread * 0.5 + inset},${fxY + inset * 0.5} ${cx - highSpread + inset},${highY + inset}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `L${cx - highSpread},${highY}`,
        `C${cx - highSpread * 0.5},${fxY} ${cx + highSpread * 0.5},${fxY} ${cx + highSpread},${highY}`,
        `L${rightNx},${neckSideY}`,
      ];
    }
    case 'lapel': {
      // 翻领底座: 深 V
      const lapelDepth = neckFront + collarHeight * 3.5;
      if (reverse) {
        return [
          `M${rightNx},${neckSideY - inset}`,
          `L${cx},${lapelDepth + inset}`,
          `L${leftNx},${neckSideY - inset}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `L${cx - collarSpread},${neckSideY}`,
        `L${cx},${lapelDepth}`,
        `L${cx + collarSpread},${neckSideY}`,
        `L${rightNx},${neckSideY}`,
      ];
    }
    case 'halter': {
      // 挂脖底座: 抹胸 + 颈后 V
      const halterDepth = neckFront + collarHeight * 2;
      if (reverse) {
        return [
          `M${rightNx},${neckSideY - inset}`,
          `L${cx},${halterDepth + inset}`,
          `L${leftNx},${neckSideY - inset}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `L${cx - collarSpread * 1.5},${shoulderY - 12}`,
        `L${cx - collarSpread * 1.5},${shoulderY}`,
        `L${cx + collarSpread * 1.5},${shoulderY}`,
        `L${cx + collarSpread * 1.5},${shoulderY - 12}`,
        `L${rightNx},${neckSideY}`,
      ];
    }
    case 'round':
    default: {
      // 圆领 (默认)
      const rSpread = collarSpread;
      if (reverse) {
        return [
          `M${cx + rSpread - inset},${neckSideY - inset * 0.5}`,
          `C${cx + rSpread * 0.5 - inset},${fxY + inset} ${cx - rSpread * 0.5 + inset},${fxY + inset} ${cx - rSpread + inset},${neckSideY - inset * 0.5}`,
        ];
      }
      return [
        `M${leftNx},${neckSideY}`,
        `C${leftNx + 8},${neckSideY - 2} ${leftNx + 16},${fxY} ${cx - rSpread},${fxY}`,
        `C${cx - rSpread * 0.5},${fxY} ${cx + rSpread * 0.5},${fxY} ${cx + rSpread},${fxY}`,
        `C${cx + shoulderW - 16},${fxY} ${cx + shoulderW - 8},${neckSideY - 2} ${rightNx},${neckSideY}`,
      ];
    }
  }
}
