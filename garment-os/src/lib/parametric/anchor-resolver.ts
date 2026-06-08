/**
 * 锚点解析逻辑
 * 从 dag-solver.ts 拆分
 */

import type { GeneInstance } from '@/types/gene';

type AnchorMap = Record<string, { x: number; y: number; meta?: any }>;

/** 安全取数值参数 */
function num(p: Record<string, number | string | boolean>, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === 'number' && !isNaN(v) ? v : fallback;
}

/** Cubic Bezier 弧长近似 (Gauss-Legendre 3点) */
function cubicBezierArcLength(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
): number {
  const N = 20;
  let len = 0;
  let px = x0, py = y0;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const cx = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
    const cy = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    len += Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
    px = cx; py = cy;
  }
  return len;
}

/**
 * 解析基因实例的锚点
 * 根据 category 和参数值计算所有锚点坐标
 */
export function resolveAnchors(
  instance: GeneInstance,
  allInstances: GeneInstance[],
): AnchorMap {
  const p = instance.parameterValues;
  const anchors: AnchorMap = {};
  const cx = 100; // 中心 X

  // 获取 body 实例的锚点 (其他部件依赖)
  const bodyInst = allInstances.find((i) => i.category === 'body');
  const bodyAnchors: AnchorMap = bodyInst?.resolvedAnchors ?? {};

  switch (instance.category) {
    case 'body': {
      const nfy = num(p, 'neckFrontY', 34);
      const sy = num(p, 'shoulderY', 48);
      const sw = num(p, 'shoulderWidth', 40) / 2;
      const ad = num(p, 'armholeDepth', 96);
      const wy = num(p, 'waistY', 142);
      const hy = num(p, 'hipY', 174);
      const hyY = num(p, 'hemLength', 228);
      const hw = num(p, 'hemWidth', 44) / 2;

      anchors['cf-neck'] = { x: cx, y: nfy };
      anchors['cf-shoulder'] = { x: cx, y: sy };
      anchors['cf-waist'] = { x: cx, y: wy };
      anchors['cf-hip'] = { x: cx, y: hy };
      anchors['cf-hem'] = { x: cx, y: hyY + 4 };

      const waistSuppression = num(p, 'waistSuppression', 8);
      const sideWaistOffset = waistSuppression * 0.3;
      anchors['side-waist-left'] = { x: cx - sw + sideWaistOffset, y: wy };
      anchors['side-waist-right'] = { x: cx + sw - sideWaistOffset, y: wy };
      anchors['side-hem-left'] = { x: cx - hw, y: hyY };
      anchors['side-hem-right'] = { x: cx + hw, y: hyY };

      anchors['bust-line'] = { x: cx, y: ad + 4, meta: { width: sw * 2 } };
      anchors['waist-line'] = { x: cx, y: wy, meta: { width: (sw - sideWaistOffset) * 2 } };
      anchors['hip-line'] = { x: cx, y: hy, meta: { width: hw * 2 } };

      const ahCtrlX = Math.max(2, sw * 0.12);
      const ahCtrlY1 = sy + (ad - sy) * 0.15;
      const ahCtrlY2 = sy + (ad - sy) * 0.35;
      const seg1 = cubicBezierArcLength(
        cx + sw, sy,
        cx + sw - ahCtrlX, sy + 1,
        cx + sw - ahCtrlX - 4, ahCtrlY1,
        cx + sw - ahCtrlX - 6, ahCtrlY2
      );
      const seg2 = cubicBezierArcLength(
        cx + sw - ahCtrlX - 6, ahCtrlY2,
        cx + sw - ahCtrlX - 2, sy + (ad - sy) * 0.55,
        cx + sw + 1, sy + (ad - sy) * 0.75,
        cx + sw - 4, ad
      );
      const armholeCurveLen = (seg1 + seg2) * 2;
      anchors['armhole-curve-length'] = { x: 0, y: 0, meta: { length: armholeCurveLen } };
      break;
    }
    case 'collar': {
      const spread = num(p, 'collarSpread', 28);
      const collarHeight = num(p, 'collarHeight', 14);
      const collarType = String(p.collarType ?? 'round');
      anchors['sn-left'] = { x: 100 - spread, y: 42 };
      anchors['sn-right'] = { x: 100 + spread, y: 42 };
      const nfy = bodyAnchors['cf-neck']?.y ?? 34;
      let collarBottomY: number;
      switch (collarType) {
        case 'v': collarBottomY = nfy + collarHeight * 2.5; break;
        case 'lapel': collarBottomY = nfy + collarHeight * 3.5; break;
        case 'mandarin': case 'turtle': collarBottomY = 42 - 16; break;
        default: collarBottomY = nfy;
      }
      anchors['collar-bottom'] = { x: 100, y: collarBottomY };
      break;
    }
    case 'sleeve': {
      if (bodyAnchors['sp-left']) {
        anchors['sp-left'] = bodyAnchors['sp-left'];
        anchors['sp-right'] = bodyAnchors['sp-right'];
        anchors['ap-left'] = bodyAnchors['ap-left'];
        anchors['ap-right'] = bodyAnchors['ap-right'];
      }
      const sleeveLength = num(p, 'sleeveLength', 160);
      const cuffW = num(p, 'cuffWidth', 14);
      const spY = anchors['sp-right']?.y ?? 48;
      const spX = anchors['sp-right']?.x ?? 132;
      const cuffY = spY + sleeveLength;
      const dropOffset = sleeveLength * 0.25;
      const rSleeveEndX = spX - dropOffset;
      anchors['cuff-top-left'] = { x: 100 - rSleeveEndX + cuffW, y: cuffY };
      anchors['cuff-top-right'] = { x: rSleeveEndX, y: cuffY };
      const armholeCurveLen = bodyAnchors['armhole-curve-length']?.meta?.length ?? 0;
      anchors['sleeve-cap-arc-length'] = { x: 0, y: 0, meta: { length: armholeCurveLen } };
      break;
    }
    case 'cuff': {
      const sleeveInst = allInstances.find((i) => i.category === 'sleeve');
      if (sleeveInst?.resolvedAnchors) {
        const sa = sleeveInst.resolvedAnchors;
        if (sa['cuff-top-left'] && sa['cuff-top-right']) {
          anchors['cuff-top-left'] = sa['cuff-top-left'];
          anchors['cuff-top-right'] = sa['cuff-top-right'];
          const cuffH = num(p, 'cuffHeight', 14);
          anchors['cuff-bottom-left'] = { x: sa['cuff-top-left'].x, y: sa['cuff-top-left'].y + cuffH };
          anchors['cuff-bottom-right'] = { x: sa['cuff-top-right'].x, y: sa['cuff-top-right'].y + cuffH };
        }
      }
      break;
    }
  }

  return anchors;
}
