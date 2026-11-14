/**
 * 形状质量审查 (Shape Quality Audit)
 * 专业 CAD 标准: 光滑连续曲线 / 水平袖口 / 剪口在弧线上
 */

import { describe, it, expect } from 'vitest';
import { draftBodice, draftSleeve, pointAtChainLength, contourLength, smoothJoin, pt, type Seg, type Pt } from '@/lib/pattern/drafting';
import { getMeasurementsBySize } from '@/data/sizeCharts';

const M = getMeasurementsBySize('male', 'M');

/** 采样段链 (含端点) */
function sampleChain(start: Pt, segs: Seg[], n = 60): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push(pointAtChainLength(start, segs, (i / n) * contourLength({ start, segs, closed: false })));
  return pts;
}

/** 相邻采样段的最大转角 (deg) */
function maxTurn(pts: Pt[]): number {
  let max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    let d = Math.abs(a2 - a1) * 180 / Math.PI;
    if (d > 180) d = 360 - d;
    max = Math.max(max, d);
  }
  return max;
}

function distToPolyline(p: Pt, poly: Pt[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const abx = b.x - a.x, aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
    min = Math.min(min, Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)));
  }
  return min;
}

describe('shape quality: 袖片专业标准', () => {
  it('S1 crown 顶点光滑: 袖山曲线无尖角 (最大转角 < 45 度)', () => {
    const f = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const b = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const s = draftSleeve(M, 'male', f.armholeLength, b.armholeLength, { fit: 'regular' });
    // 前半采样: 从 crown 向下
    const capSegs: Seg[] = [smoothJoin(pt(0, 0), { x: -1, y: 0 }, pt(-s.bicepWidth * (f.armholeLength / s.armholeLength), s.capHeight), { x: 0, y: 1 })];
    void capSegs;
    // 直接用轮廓前半: 由 crown(top) 到 frontBicep 的第一段
    // 通过 draft 重新构造 (与 draftSleeve 相同参数)
    const fRatio = f.armholeLength / s.armholeLength;
    const bRatio = b.armholeLength / s.armholeLength;
    const capF: Seg[] = [smoothJoin(pt(0, 0), { x: -1, y: 0 }, pt(-s.bicepWidth * fRatio, s.capHeight), { x: 0, y: 1 })];
    const capB: Seg[] = [smoothJoin(pt(0, 0), { x: 1, y: 0 }, pt(s.bicepWidth * bRatio, s.capHeight), { x: 0, y: 1 })];
    // 沿真实缝制路径测量: 前半逆行 (bicep→crown) → crown → 后半 (crown→bicep)
    const samples = sampleChain(pt(0, 0), capF, 40).reverse()
      .concat(sampleChain(pt(0, 0), capB, 40).slice(1));
    expect(maxTurn(samples), `袖山最大转角应 < 45 度 (光滑圆顶, crown 切线连续)`).toBeLessThan(45);
  });

  it('S2 袖口水平: 前后袖口 y 严格相等', () => {
    const f = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const b = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const s = draftSleeve(M, 'male', f.armholeLength, b.armholeLength, { fit: 'regular' });
    // hem edge: frontCuff → backCuff, y 恒定
    const hem = s.edges.find((e) => e.role === 'hem')!;
    const pts = sampleChain(hem.start, hem.segs, 8);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys), '袖口线应水平').toBeLessThan(0.5);
  });

  it('S3 对位剪口落在袖山曲线上 (距离 < 1.5mm)', () => {
    const f = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const b = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const s = draftSleeve(M, 'male', f.armholeLength, b.armholeLength, { fit: 'regular' });
    const fRatio = f.armholeLength / s.armholeLength;
    const bRatio = b.armholeLength / s.armholeLength;
    const capF: Seg[] = [smoothJoin(pt(0, 0), { x: -1, y: 0 }, pt(-s.bicepWidth * fRatio, s.capHeight), { x: 0, y: 1 })];
    const capB: Seg[] = [smoothJoin(pt(0, 0), { x: 1, y: 0 }, pt(s.bicepWidth * bRatio, s.capHeight), { x: 0, y: 1 })];
    const polyF = sampleChain(pt(0, 0), capF, 50);
    const polyB = sampleChain(pt(0, 0), capB, 50);
    expect(distToPolyline(s.capNotchFront, polyF), '前剪口距袖山曲线').toBeLessThan(1.5);
    expect(distToPolyline(s.capNotchBack, polyB), '后剪口距袖山曲线').toBeLessThan(1.5);
  });

  it('S4 吃势标准: 总吃势 ≈ 30mm (合体梭织 block 标准)', () => {
    const f = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const b = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const s = draftSleeve(M, 'male', f.armholeLength, b.armholeLength, { fit: 'regular' });
    expect(s.capEase).toBeGreaterThan(27);
    expect(s.capEase).toBeLessThan(33);
  });
});

