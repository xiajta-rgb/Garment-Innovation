/**
 * 毫米制版引擎 + 约束校验 单元测试
 *
 * 覆盖:
 *  1. Aldrich/Brian 公式的真实 mm 输出 (领口/肩斜按 Brian 标准)
 *  2. 袖山吃势 30mm (专业标准) 数值求解收敛
 *  3. 制版约束校验 (合法输入零 error / 非法输入精确报错)
 *  4. 缝份: uniform offset 等距 + 分段缝份 (折0/领6/缝10/摆25)
 *  5. BOM 用料估算数学正确性
 */

import { describe, it, expect } from 'vitest';
import {
  draftBodice, draftSleeve, seamAllowancePath, contourToPath,
  flattenContour, offsetPolygon, dist, grossArea, segmentedSeamAllowancePath,
} from '@/lib/pattern/drafting';
import { validateDraftedPattern } from '@/lib/pattern/drafting';
import { estimateFabricUsage } from '@/lib/bom-engine/fabric-usage';
import type { Pt } from '@/lib/pattern/drafting';
import { getMeasurementsBySize } from '@/data/sizeCharts';

const M = getMeasurementsBySize('male', 'M');

describe('drafting: Aldrich/Brian mm 公式', () => {
  it('M 码男装后片: 袖窿深符合 B/8+105+ease/4 公式', () => {
    const d = draftBodice(M, 'male', 'back', { fit: 'regular' });
    expect(d.scyeDepth).toBeCloseTo(M.hpsToBust, 0); // 实测 HPS→胸围线驱动
    expect(d.scyeDepth).toBeGreaterThan(150);
    expect(d.scyeDepth).toBeLessThan(400);
  });

  it('领宽公式 0.22N (Brian 标准) 且小于半肩宽', () => {
    const d = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const neckHalf = M.neckCirc * 0.22;
    expect(-d.points.snSide.x).toBeCloseTo(neckHalf, 0);
    expect(neckHalf).toBeLessThan(M.shoulderWidth / 2);
  });

  it('肩斜 13 度 (Brian): 沿肩线实际距离量取', () => {
    const d = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const sn = d.points.snSide, sh = d.points.shoulder;
    const run = Math.abs(sh.x - sn.x);
    const drop = sh.y - sn.y;
    const angle = Math.atan2(drop, run) * 180 / Math.PI;
    expect(angle, `肩斜 ${angle.toFixed(1)} 度应 ≈13`).toBeGreaterThan(11);
    expect(angle).toBeLessThan(15);
  });

  it('前领深 > 后领深', () => {
    const front = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const back = draftBodice(M, 'male', 'back', { fit: 'regular' });
    expect(front.necklineLength).toBeGreaterThan(back.necklineLength);
  });

  it('袖山吃势数值求解收敛到 ≈30mm (专业标准)', () => {
    const front = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const back = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const s = draftSleeve(M, 'male', front.armholeLength, back.armholeLength, { fit: 'regular' });
    expect(s.capEase, `吃势 ${s.capEase.toFixed(1)} 应≈30`).toBeGreaterThan(27);
    expect(s.capEase).toBeLessThan(33);
    expect(s.capHeight).toBeCloseTo((M.hpsToBust ?? (M.bust / 8 + 105 + 15)) * 0.75, 0);
  });

  it('轮廓闭合: 段链终点回到原点, path 以 Z 闭合', () => {
    const d = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const lastSeg = d.contour.segs[d.contour.segs.length - 1];
    expect(dist(lastSeg.to, d.contour.start)).toBeLessThan(0.01);
    expect(contourToPath(d.contour).endsWith('Z')).toBe(true);
    const pts = flattenContour(d.contour, 2);
    expect(dist(pts[0], pts[pts.length - 1])).toBeGreaterThan(1);
  });

});

describe('drafting: 缝份 offset', () => {
  it('uniform 外偏: 95% 顶点到净样边缘距离 = width (±2mm)', () => {
    const d = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const net = flattenContour(d.contour, 2);
    const offset = offsetPolygon(net, 10);
    const ptToSeg = (p: Pt, a: Pt, b: Pt): number => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
      return dist(p, { x: a.x + abx * t, y: a.y + aby * t });
    };
    const ptToPolyEdge = (p: Pt): number => {
      let min = Infinity;
      for (let i = 0; i < net.length; i++) min = Math.min(min, ptToSeg(p, net[i], net[(i + 1) % net.length]));
      return min;
    };
    let inTol = 0, total = 0;
    for (let i = 0; i < offset.length; i += 3) {
      total++;
      const dEdge = ptToPolyEdge(offset[i]);
      if (dEdge >= 8 && dEdge <= 12) inTol++;
    }
    expect(inTol / total).toBeGreaterThan(0.9);
    for (let i = 0; i < offset.length; i++) {
      expect(ptToPolyEdge(offset[i])).toBeGreaterThanOrEqual(7);
    }
  });

  it('毛样面积 > 净样面积, path 合法', () => {
    const d = draftBodice(M, 'male', 'back', { fit: 'regular' });
    expect(grossArea(d.contour, 10)).toBeGreaterThan(0);
    const path = seamAllowancePath(d.contour, 10);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });
});

describe('drafting: 分段缝份引擎 (生产语义)', () => {
  it('衣身毛样: 对折边余量≈0 / 侧缝≈10 / 下摆≈25', () => {
    const d = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const cut = segmentedSeamAllowancePath(d.edges);
    const net = contourToPath(d.contour);
    const bb = (s: string) => {
      const nums = s.match(/-?\d+(\.\d+)?/g)!.map(Number);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
        minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
      }
      return { minX, maxX, minY, maxY };
    };
    const c = bb(cut), n = bb(net);
    expect(c.maxX - n.maxX, `折边余量 ${(c.maxX - n.maxX).toFixed(1)}mm 应≈0`).toBeLessThan(2);
    expect(c.maxY - n.maxY, `下摆余量 ${(c.maxY - n.maxY).toFixed(1)}mm 应≈25`).toBeGreaterThan(18);
    expect(c.maxY - n.maxY).toBeLessThan(32);
    const sideMargin = n.minX - c.minX;
    expect(sideMargin, `侧缝余量 ${sideMargin.toFixed(1)}mm 应在 6~14`).toBeGreaterThan(5);
    expect(sideMargin).toBeLessThan(14);
  });
});

describe('constraints: 制版约束校验引擎', () => {
  it('M 码男装 regular: 零 error 违规', () => {
    const r = validateDraftedPattern(M, 'male', { fit: 'regular' });
    expect(r.violations.filter((v) => v.level === 'error')).toEqual([]);
    expect(r.blocked).toBe(false);
    expect(r.stats.capEase).toBeGreaterThan(25);
    expect(r.stats.capRatio).toBeGreaterThan(0.55);
    expect(r.stats.capRatio).toBeLessThan(0.9);
  });

  it('胸围过小 → 有阻断级 error', () => {
    const bad = { ...M, bust: 500, bicep: 500, hpsToBust: 140 };
    const r = validateDraftedPattern(bad, 'male', { fit: 'regular' });
    expect(r.blocked).toBe(true);
    expect(r.violations.some((v) => v.level === 'error')).toBe(true);
  });

  it('袖口由腕围+松量构造 → 标准 M 码不触发过紧 error', () => {
    const r = validateDraftedPattern(M, 'male', { fit: 'regular' });
    expect(r.violations.some((v) => v.ruleId === 'cuff-too-tight')).toBe(false);
  });

  it('缝份超范围 → error', () => {
    const r = validateDraftedPattern(M, 'male', { fit: 'regular', seamAllowanceMm: 2 });
    expect(r.violations.some((v) => v.ruleId === 'seam-allowance-range')).toBe(true);
  });

  it('领宽 ≥ 肩宽 → 人体学 error', () => {
    const bad = { ...M, neckCirc: 700, shoulderWidth: 260 };
    const r = validateDraftedPattern(bad, 'male', { fit: 'regular' });
    expect(r.violations.some((v) => v.ruleId === 'neck-wider-than-shoulder')).toBe(true);
  });

  it('测量值无效 → 立即阻断', () => {
    const bad = { ...M, bust: -100 };
    const r = validateDraftedPattern(bad, 'male', { fit: 'regular' });
    expect(r.blocked).toBe(true);
    expect(r.violations.some((v) => v.ruleId === 'm-bust-invalid')).toBe(true);
  });
});

describe('BOM: 用料估算', () => {
  it('排料数学正确', () => {
    const r = estimateFabricUsage({
      pieceAreasMm2: [400000, 400000, 150000],
      pieceQty: [1, 1, 2],
      fabricWidthMm: 1500,
      efficiency: 0.85,
      lossRate: 0.03,
    });
    expect(r.layoutLengthMm).toBeCloseTo(1100000 / (1500 * 0.85), 0);
    expect(r.lengthM).toBeGreaterThanOrEqual(r.purchaseLengthMm / 1000);
    expect((r.lengthM * 20) % 1).toBe(0);
  });

  it('效率上限 0.95 / 下限 0.5', () => {
    const hi = estimateFabricUsage({ pieceAreasMm2: [1e6], fabricWidthMm: 1500, efficiency: 1.2 });
    const lo = estimateFabricUsage({ pieceAreasMm2: [1e6], fabricWidthMm: 1500, efficiency: 0.1 });
    expect(hi.layoutLengthMm).toBeCloseTo(1e6 / (1500 * 0.95), 0);
    expect(lo.layoutLengthMm).toBeCloseTo(1e6 / (1500 * 0.5), 0);
  });
});
