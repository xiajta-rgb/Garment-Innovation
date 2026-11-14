/**
 * ─────────────────────────────────────────────────────────────
 *  缝份引擎 (Seam Allowance Engine)
 * ─────────────────────────────────────────────────────────────
 *
 *  净样轮廓 → 毛样轮廓 (含缝份), 工业纸样的关键一步。
 *  没有缝份的纸样无法直接排料裁剪。
 *
 *  工业标准缝份 (可按部位分段):
 *   - 肩线/侧缝/袖缝: 10mm
 *   - 领口:           6mm  (滚边/罗纹时 0)
 *   - 下摆折边:       25mm (T 恤卷边 20-25)
 */

import { Point, Path } from '@freesewing/core';
import type { Contour, Pt, Seg } from './geometry';
import {
  flattenContour, offsetPolygon, polygonToPath,
  flattenChain, flattenSvgPathD, offsetChain, joinOffsetChains, polygonIsClockwise,
} from './geometry';
import type { DraftEdge, SeamWidths } from './aldrich';
import { INDUSTRIAL_WIDTHS } from './aldrich';

export interface SeamConfig {
  /** 默认缝份 (mm) */
  default: number;
  /** 下摆折边 (mm, 0 = 不加) */
  hem?: number;
}

/** 工业默认缝份配置 */
export const INDUSTRIAL_SEAM: SeamConfig = { default: 10, hem: 25 };

/**
 * 净样轮廓 → 毛样轮廓 path (等距外偏)
 * 返回裁剪线 (cutting line) 的 path 字符串
 */
export function seamAllowancePath(net: Contour, width = INDUSTRIAL_SEAM.default): string {
  const poly = flattenContour(net, 1.5);
  const offset = offsetPolygon(poly, width);
  return polygonToPath(offset);
}

/**
 * 下摆折边线 (内部参考线): 距净样下摆 hem mm 的平行线
 * 返回从净样轮廓两侧下摆点内缩后的水平线 path (仅适用于下摆为水平直线的 T 恤基型)
 */
export function hemFoldPath(net: Contour, points: { hemSide: Pt; hemCenter: Pt }, hem = 25): string | null {
  void net;
  if (!hem || hem <= 0) return null;
  const y = points.hemCenter.y - hem;
  const halfW = Math.abs(points.hemSide.x) - hem * 0.6; // 折边线略窄, 表意
  // 对折裁剪 (半片): 折边线只画在裁片一侧 (x<0), 留 5mm 避开折叠线
  return `M${(-halfW).toFixed(2)} ${y.toFixed(2)} L-5.00 ${y.toFixed(2)}`;
}

/**
 * 毛样面积 (mm²) — BOM 用料计算输入
 * 毛样 = 净样面积 + 缝份面积 (offset 后精确积分)
 */
export function grossArea(net: Contour, width = INDUSTRIAL_SEAM.default): number {
  const poly = flattenContour(net, 1.5);
  const offset = offsetPolygon(poly, width);
  // offsetPolygon 返回点数与输入相同, 用鞋带公式
  let area2 = 0;
  for (let i = 0; i < offset.length; i++) {
    const a = offset[i], b = offset[(i + 1) % offset.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2) / 2;
}



// ════════════════════════════════════════════════════════════
// 分段缝份引擎 (Segmented Seam Allowance)
// ─────────────────────────────────────────────────────────────
// 按边角色施加缝份: 对折边 0 / 领口 6 / 缝合边 10 / 下摆折边 25
// 这是生产对接的正确语义 — 对折裁剪的边不允许有缝份
// ════════════════════════════════════════════════════════════

/** 顺序偏移各边并拼角, 输出毛样顶点列 */
/** FreeSewing 真曲线偏移单链 → 采样点列 (bezier-js 保证等距精确) */
function fsOffsetChain(start: Pt, segs: Seg[], width: number): Pt[] {
  const p = new Path().move(new Point(start.x, start.y));
  for (const s of segs) {
    if (s.kind === 'L') p.line(new Point(s.to.x, s.to.y));
    else p.curve(new Point(s.c1.x, s.c1.y), new Point(s.c2.x, s.c2.y), new Point(s.to.x, s.to.y));
  }
  const off = p.offset(width);
  return flattenSvgPathD(off.asPathstring(), 12) as Pt[];
}

function centroidOf(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

/** 顺序偏移各边并拼角, 输出毛样顶点列
 *  内核: FreeSewing Path.offset (bezier-js 真曲线偏移, 角部/等距精确)
 *  方向: ±width 双候选, 取距裁片质心更远者 (向外); FS 异常回退手搓 offsetChain
 */
export function segmentedOffset(edges: DraftEdge[], widths: SeamWidths = INDUSTRIAL_WIDTHS): Pt[] {
  const netPts: Pt[] = [];
  for (const e of edges) {
    const pts = flattenChain(e.start, e.segs, 1.5);
    for (let i = netPts.length > 0 ? 1 : 0; i < pts.length; i++) netPts.push(pts[i]);
  }
  const centroid = centroidOf(netPts);

  const chains: Pt[][] = [];
  const chainWidths: number[] = [];
  for (const e of edges) {
    const w = widths[e.role];
    let chosen: Pt[] | null = null;
    try {
      const cands = [fsOffsetChain(e.start, e.segs, w), fsOffsetChain(e.start, e.segs, -w)];
      let bestDist = -1;
      for (const cand of cands) {
        const c = centroidOf(cand);
        const d = Math.hypot(c.x - centroid.x, c.y - centroid.y);
        if (d > bestDist) { bestDist = d; chosen = cand; }
      }
    } catch {
      chosen = null;
    }
    if (!chosen) {
      const cw = polygonIsClockwise(netPts);
      chosen = offsetChain(flattenChain(e.start, e.segs, 0.8), w, cw);
    }
    chains.push(chosen);
    chainWidths.push(w);
  }
  return joinOffsetChains(chains, chainWidths);
}

/** 分段毛样裁剪线 path */
export function segmentedSeamAllowancePath(edges: DraftEdge[], widths: SeamWidths = INDUSTRIAL_WIDTHS): string {
  return polygonToPath(segmentedOffset(edges, widths));
}

/** 分段毛样面积 (mm²) — BOM 用料输入 */
export function segmentedGrossArea(edges: DraftEdge[], widths: SeamWidths = INDUSTRIAL_WIDTHS): number {
  const pts = segmentedOffset(edges, widths);
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2) / 2;
}



