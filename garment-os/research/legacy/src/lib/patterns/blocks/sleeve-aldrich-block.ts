/**
 * ─────────────────────────────────────────────────────────────
 *  Aldrich 袖子 Block (毫米制版, 吃势数值求解)
 * ─────────────────────────────────────────────────────────────
 *
 *  袖山弧长与袖窿弧长的匹配是装袖工艺的核心:
 *  本 Block 用数值迭代求袖肥, 保证 袖山弧长 = 袖窿弧长 + 吃势,
 *  吃势量在 solve 结果中显式暴露 (可审计)。
 */

import type { BlockDefinition, BlockOutput } from '../types';
import type { GenePathData } from '@/types/gene';
import {
  draftBodice, draftSleeve, segmentedSeamAllowancePath, contourToPath, INDUSTRIAL_SEAM, INDUSTRIAL_WIDTHS,
  type SeamWidths, type DraftOptions, type Pt,
} from '../../pattern/drafting';

/** 剪口标记: 落位在曲线计算点上的菱形对位符 */
function notchMark(p: Pt, id: string): GenePathData {
  const s = 5;
  return {
    id,
    data: `M${(p.x - s).toFixed(2)} ${p.y.toFixed(2)} L${p.x.toFixed(2)} ${(p.y - s).toFixed(2)} L${(p.x + s).toFixed(2)} ${p.y.toFixed(2)} L${p.x.toFixed(2)} ${(p.y + s).toFixed(2)} Z`,
    fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
    layer: 'notch', category: 'sleeve', view: 'all',
  };
}

export const SleeveAldrichBlock: BlockDefinition = {
  id: 'sleeve-aldrich',
  name: '装袖原型 (Aldrich mm 制版)',
  category: 'sleeve',
  inputs: {
    anchors: [],
    params: ['fit', 'seamAllowance'],
  },
  solve: (ctx) => {
    const m = ctx.measurements;
    if (!m) throw new Error('sleeve-aldrich 需要人体测量值 (measurements)');
    const fit = (String(ctx.params.fit ?? 'regular') as DraftOptions['fit']);
    const seamW = Number(ctx.params.seamAllowance ?? INDUSTRIAL_SEAM.default);
    const gender = ctx.gender ?? 'unisex';

    // 前后片袖窿弧长 (重新计算, 与衣身 Block 使用同一公式引擎, 数据一致)
    const front = draftBodice(m, gender, 'front', { fit });
    const back = draftBodice(m, gender, 'back', { fit });
    const sleeveLengthMm = ctx.params.sleeveLengthMm != null ? Number(ctx.params.sleeveLengthMm) : undefined;
    const sleeve = draftSleeve(m, gender, front.armholeLength, back.armholeLength, { fit, seamAllowanceMm: seamW, sleeveLengthMm });

    const paths: GenePathData[] = [
      // 毛样裁剪线 (分段: 袖口折边 20mm)
      {
        id: 'sleeve-cutting',
        data: segmentedSeamAllowancePath(sleeve.edges, { ...INDUSTRIAL_WIDTHS, seam: seamW, hem: 20 } as SeamWidths),
        fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2,
        layer: 'cutting-line', category: 'sleeve', view: 'all',
      },
      // 净样线
      {
        id: 'sleeve-net',
        data: contourToPath(sleeve.contour),
        fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
        layer: 'seam-line', category: 'sleeve', view: 'all',
      },
      // 布纹线 (袖中竖直)
      {
        id: 'sleeve-grain',
        data: [
          `M0 ${(sleeve.capHeight + 20).toFixed(2)} L0 ${(sleeve.sleeveLength - 15).toFixed(2)}`,
          `M-3 ${(sleeve.capHeight + 23).toFixed(2)} L0 ${(sleeve.capHeight + 20).toFixed(2)} L3 ${(sleeve.capHeight + 23).toFixed(2)}`,
        ].join(' '),
        fill: 'none', stroke: '#1a1a1a', strokeWidth: 1.5,
        layer: 'grain-line', category: 'sleeve', view: 'all',
      },
      // 袖山对位剪口 (弧长精确落位, 与衣身袖窿剪口配对)
      notchMark(sleeve.capNotchFront, 'sleeve-notch-front'),
      notchMark(sleeve.capNotchBack, 'sleeve-notch-back'),
    ];

    const out: BlockOutput = {
      paths,
      anchors: {
        // 袖山吃势审计锚点: x/y 复用为诊断值 (capCurveLength / capEase)
        'sp-left': { x: sleeve.capCurveLength, y: sleeve.capEase },
        'ap-left': { x: sleeve.bicepWidth, y: sleeve.capHeight },
        'cuff-top-left': { x: 0, y: sleeve.sleeveLength },
      },
    };
    return out;
  },
};




