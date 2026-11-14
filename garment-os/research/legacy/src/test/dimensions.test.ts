/**
 * 完整尺寸定位测试 (Full Dimensional Definition)
 *  D1 每片规格完备: 每条边有名称+实测长度+起终点, 每个关键点有坐标
 *  D2 长度守恒: 各边净样长之和 = 轮廓总长 (采样一致)
 *  D3 边长随关键数据联动: 胸围增大 → 袖窿弧线变长
 *  D4 点坐标有界: 全部关键点在裁片 bbox 内
 */

import { describe, it, expect } from 'vitest';
import { generatePieces } from '@/lib/pattern/piece-generator';
import { getMeasurementsBySize } from '@/data/sizeCharts';
import { flattenChain } from '@/lib/pattern/drafting';

const M = getMeasurementsBySize('male', 'M');

describe('dimensions: 单片尺寸完全定位', () => {
  const r = generatePieces(M, { gender: 'male', fit: 'regular' });

  it('D1 每片规格完备 (边有名称+长度+端点, 点有坐标)', () => {
    for (const p of r.pieces) {
      expect(p.dimensions.length, `${p.name} 边数 (袖口三段链为合法分段)`).toBeGreaterThanOrEqual(3);
      for (const d of p.dimensions) {
        expect(d.label.length, `${p.name} 边应有名称`).toBeGreaterThan(0);
        expect(d.lengthMm, `${p.name}/${d.label} 长度应 > 0`).toBeGreaterThan(0);
        expect(Number.isFinite(d.from.x + d.from.y + d.to.x + d.to.y)).toBe(true);
      }
      expect(p.points.length, `${p.name} 关键点数`).toBeGreaterThanOrEqual(4);
      for (const pt of p.points) {
        expect(Number.isFinite(pt.x + pt.y), `${p.name}/${pt.label} 坐标有效`).toBe(true);
      }
    }
  });

  it('D2 长度守恒: 边长之和 ≈ 轮廓周长 (采样一致性, ±2mm)', () => {
    for (const p of r.pieces) {
      const chainSum = p.edges.reduce((s, e) => {
        // 用同样的展平步长求链长 (与 joinOffset 前净样一致)
        const pts = flattenChain(e.start, e.segs, 0.8);
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
          len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        return s + len;
      }, 0);
      const declared = p.dimensions.reduce((s, d) => s + d.lengthMm, 0);
      expect(Math.abs(declared - chainSum), `${p.name} 边长声明应守恒`).toBeLessThan(2);
    }
  });

  it('D3 边长随关键数据联动: 胸围增大 → 袖窿弧线增长', () => {
    const XL = getMeasurementsBySize('male', 'XL');
    const rXL = generatePieces(XL, { gender: 'male', fit: 'regular' });
    const ah = (rr: typeof r) =>
      rr.pieces.find((p) => p.id === 'front-body')!.dimensions.find((d) => d.label === '袖窿弧线')!.lengthMm;
    expect(ah(rXL), `XL 袖窿 ${ah(rXL)} 应 > M ${ah(r)}`).toBeGreaterThan(ah(r));
  });

  it('D4 点坐标有界: 关键点全部在裁片 bbox 内', () => {
    for (const p of r.pieces) {
      const xs = p.dimensions.flatMap((d) => [d.from.x, d.to.x]);
      const ys = p.dimensions.flatMap((d) => [d.from.y, d.to.y]);
      const minX = Math.min(...xs) - 25, maxX = Math.max(...xs) + 25;
      const minY = Math.min(...ys) - 25, maxY = Math.max(...ys) + 25;
      for (const pt of p.points) {
        expect(pt.x, `${p.name}/${pt.label} x`).toBeGreaterThanOrEqual(minX);
        expect(pt.x, `${p.name}/${pt.label} x`).toBeLessThanOrEqual(maxX);
        expect(pt.y, `${p.name}/${pt.label} y`).toBeGreaterThanOrEqual(minY);
        expect(pt.y, `${p.name}/${pt.label} y`).toBeLessThanOrEqual(maxY);
      }
    }
  });
});

