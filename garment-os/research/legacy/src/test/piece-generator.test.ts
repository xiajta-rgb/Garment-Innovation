/**
 * 裁片生成器测试
 *  G1 确定性: 同关键数据恒同结果
 *  G2 尺寸驱动: 关键数据变化 → 裁片尺寸单调联动
 *  G3 推档: 标准尺码批量生成, 尺寸随尺码单调递增
 *  G4 关键数据隔离: 改袖长不影响衣长 (数据→裁片映射正确)
 */

import { describe, it, expect } from 'vitest';
import { generatePieces, generateGraded, KEY_FIELDS } from '@/lib/pattern/piece-generator';
import { getMeasurementsBySize } from '@/data/sizeCharts';
import type { BodyMeasurements } from '@/types/measurements';

const S = getMeasurementsBySize('male', 'S');
const M = getMeasurementsBySize('male', 'M');
const XL = getMeasurementsBySize('male', 'XL');

describe('piece-generator: 裁片生成器', () => {
  it('G1 确定性: 同关键数据两次生成结果一致', () => {
    const r1 = generatePieces(M, { gender: 'male', fit: 'regular' });
    const r2 = generatePieces(M, { gender: 'male', fit: 'regular' });
    expect(JSON.stringify(r1.pieces.map((p) => p.keyDims))).toBe(JSON.stringify(r2.pieces.map((p) => p.keyDims)));
    expect(r1.fabricUsage.lengthM).toBe(r2.fabricUsage.lengthM);
  });

  it('G2 尺寸驱动: 胸围增大 → 半胸宽单调增大', () => {
    const small = generatePieces(S, { gender: 'male', fit: 'regular' });
    const big = generatePieces(XL, { gender: 'male', fit: 'regular' });
    const fw = (r: ReturnType<typeof generatePieces>) =>
      r.pieces.find((p) => p.id === 'front-body')!.keyDims.find((d) => d.label === '半胸围线宽')!.value;
    expect(fw(big), `XL 半胸宽 ${fw(big)} 应 > S ${fw(small)}`).toBeGreaterThan(fw(small));
  });

  it('G2b 关键数据隔离: 改袖长只影响袖片, 不影响衣长', () => {
    const base = generatePieces(M, { gender: 'male', fit: 'regular' });
    const mod: BodyMeasurements = { ...M, sleeveLength: M.sleeveLength + 50 };
    const modded = generatePieces(mod, { gender: 'male', fit: 'regular' });
    const sl = (r: ReturnType<typeof generatePieces>) =>
      r.pieces.find((p) => p.id === 'sleeve')!.keyDims.find((d) => d.label === '袖长')!.value;
    const bl = (r: ReturnType<typeof generatePieces>) =>
      r.pieces.find((p) => p.id === 'front-body')!.keyDims.find((d) => d.label === '衣长 (颈点→下摆)')!.value;
    expect(sl(modded) - sl(base)).toBeCloseTo(50, 0);
    expect(bl(modded)).toBe(bl(base));
  });

  it('G3 推档: S→XL 各尺码衣长单调递增且与尺码表一致', () => {
    const graded = generateGraded('male', ['S', 'M', 'XL'], { fit: 'regular' });
    const hem = (g: typeof graded[number]) =>
      g.result.pieces.find((p) => p.id === 'front-body')!.keyDims.find((d) => d.label === '衣长 (颈点→下摆)')!.value;
    const [gS, gM, gXL] = graded;
    expect(gS.size).toBe('S');
    expect(hem(gXL)).toBeGreaterThan(hem(gM));
    expect(hem(gM)).toBeGreaterThan(hem(gS));
    // 与尺码表驱动一致: 前片衣长 = totalLength + (frontLength - backLength)
    expect(hem(gM)).toBeCloseTo(M.totalLength + (M.frontLength - M.backLength), 0);
  });

  it('G4 全套裁片数量与关键数据字段完备', () => {
    const r = generatePieces(M, { gender: 'male', fit: 'regular' });
    expect(r.pieces.length).toBe(7);
    for (const p of r.pieces) {
      expect(p.keyDims.length, `${p.name} 应有特征尺寸`).toBeGreaterThan(0);
      expect(p.grossAreaMm2, `${p.name} 应有毛样面积`).toBeGreaterThan(0);
      expect(p.edges.length, `${p.name} 应有角色边`).toBeGreaterThan(0);
    }
    expect(KEY_FIELDS.length).toBeGreaterThanOrEqual(13);
  });
});
