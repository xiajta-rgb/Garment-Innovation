/**
 * ─────────────────────────────────────────────────────────────
 *  mm 标准部件 Blocks (领 / 门襟 / 袖口 / 贴袋)
 * ─────────────────────────────────────────────────────────────
 *
 *  与衣身/袖子同标准: 输入测量值 (mm), 输出 CAD 裁片 5 层。
 *  通过 PatternBlockRef.position 在版面内独立排布 (CAD 排料式)。
 */

import type { BlockDefinition, BlockOutput } from '../types';
import type { GenePathData } from '@/types/gene';
import {
  draftBodice, draftMandarinCollar, draftPlacket, draftCuff, draftPatchPocket,
  pt, INDUSTRIAL_SEAM, INDUSTRIAL_WIDTHS, segmentedSeamAllowancePath,
  type SeamWidths, type DraftOptions, type Pt,
} from '../../pattern/drafting';
import { renderStandardPiece } from './aldrich-render';

// ════════════════════════════════════════════════════════════
// 立领 Block
// ════════════════════════════════════════════════════════════

export const CollarAldrichBlock: BlockDefinition = {
  id: 'collar-aldrich',
  name: '立领 (mm 制版)',
  category: 'collar',
  inputs: { params: ['fit', 'seamAllowance', 'collarHeightMm'] },
  solve: (ctx) => {
    const m = ctx.measurements;
    if (!m) throw new Error('collar-aldrich 需要人体测量值');
    const fit = String(ctx.params.fit ?? 'regular') as DraftOptions['fit'];
    const seamW = Number(ctx.params.seamAllowance ?? INDUSTRIAL_SEAM.default);
    const hMm = Number(ctx.params.collarHeightMm ?? 30);
    const gender = ctx.gender ?? 'unisex';

    // 领下口 = 真实领口净样曲线 (后领逆行 + 前领, 与衣身完全贴合)
    const front = draftBodice(m, gender, 'front', { fit });
    const back = draftBodice(m, gender, 'back', { fit });
    const neckPts: Pt[] = [
      ...back.necklinePoints,
      ...front.necklinePoints.slice(1).reverse(),
    ];

    const collar = draftMandarinCollar(neckPts, hMm);
    const paths = renderStandardPiece(collar.contour, Math.min(6, seamW), {
      category: 'collar', view: 'all', idPrefix: 'collar-aldrich',
      cuttingPath: segmentedSeamAllowancePath(collar.edges, { ...INDUSTRIAL_WIDTHS, seam: Math.min(10, seamW), neckline: Math.min(6, seamW) } as SeamWidths),
      foldLine: [pt(0, 0), pt(0, hMm)],
      grainLine: [pt(-collar.innerEdgeLength * 0.35, hMm * 0.5), pt(-collar.innerEdgeLength * 0.65, hMm * 0.5)],
      notch: pt(0, 0),
    });
    const out: BlockOutput = {
      paths,
      anchors: {
        'collar-neckline-length': { x: collar.innerEdgeLength, y: 0 },
        'sn-left': { x: 0, y: 0 },
      },
    };
    return out;
  },
};

// ════════════════════════════════════════════════════════════
// 门襟 Block
// ════════════════════════════════════════════════════════════

export const PlacketAldrichBlock: BlockDefinition = {
  id: 'placket-aldrich',
  name: '中开门襟 (mm 制版)',
  category: 'placket',
  inputs: { params: ['placketWidthMm', 'placketLengthMm', 'buttonCount'] },
  solve: (ctx) => {
    const w = Number(ctx.params.placketWidthMm ?? 18);
    const len = Number(ctx.params.placketLengthMm ?? 380);
    const buttonCount = Number(ctx.params.buttonCount ?? 4);
    const placket = draftPlacket(w, len);
    const paths = renderStandardPiece(placket.contour, INDUSTRIAL_SEAM.default, {
      category: 'placket', view: 'all', idPrefix: 'placket-aldrich',
      foldLine: [pt(w + 5, 0), pt(w + 5, len)],
      grainLine: [pt(w / 2, len * 0.3), pt(w / 2, len * 0.7)],
    });

    // 扣位标记 (drill-hole): 沿折叠中线均布, 首粒距领口缝合线 30mm, 间距 75mm
    const foldX = w + 5;
    const r = 7;
    for (let i = 0; i < buttonCount; i++) {
      const y = 30 + i * 75;
      if (y > len - 15) break;
      paths.push({
        id: `placket-btn-${i}`,
        data: `M${(foldX - r).toFixed(2)} ${y.toFixed(2)} a${r} ${r} 0 1 0 ${(r * 2).toFixed(2)} 0 a${r} ${r} 0 1 0 ${(-r * 2).toFixed(2)} 0`,
        fill: 'none', stroke: '#888', strokeWidth: 1,
        layer: 'drill-hole', category: 'placket', view: 'all',
      } as GenePathData);
    }

    const out: BlockOutput = { paths, anchors: {} };
    return out;
  },
};

// ════════════════════════════════════════════════════════════
// 袖口 Block
// ════════════════════════════════════════════════════════════

export const CuffAldrichBlock: BlockDefinition = {
  id: 'cuff-aldrich',
  name: '平袖口 (mm 制版)',
  category: 'cuff',
  inputs: { params: ['cuffHeightMm'] },
  solve: (ctx) => {
    const m = ctx.measurements;
    if (!m) throw new Error('cuff-aldrich 需要人体测量值');
    const gender = ctx.gender ?? 'unisex';
    const hMm = Number(ctx.params.cuffHeightMm ?? 40);
    const seamW = Number(ctx.params.seamAllowance ?? INDUSTRIAL_SEAM.default);
    const circ = m.wristCirc + 40 + (gender === 'male' ? 10 : 0);
    const cuff = draftCuff(circ, hMm);
    const paths = renderStandardPiece(cuff.contour, INDUSTRIAL_SEAM.default, {
      category: 'cuff', view: 'all', idPrefix: 'cuff-aldrich',
      cuttingPath: segmentedSeamAllowancePath(cuff.edges, { ...INDUSTRIAL_WIDTHS, seam: seamW } as SeamWidths),
      foldLine: [pt(circ / 2, 0), pt(circ / 2, hMm * 2)],
      grainLine: [pt(circ * 0.3, hMm), pt(circ * 0.7, hMm)],
      notch: pt(circ / 2, 0),
    });
    const out: BlockOutput = {
      paths,
      anchors: { 'cuff-top-left': { x: 0, y: 0 } },
    };
    return out;
  },
};

// ════════════════════════════════════════════════════════════
// 贴袋 Block
// ════════════════════════════════════════════════════════════

export const PocketAldrichBlock: BlockDefinition = {
  id: 'pocket-aldrich',
  name: '贴袋 (mm 制版)',
  category: 'pocket',
  inputs: { params: ['pocketWidthMm', 'pocketHeightMm'] },
  solve: (ctx) => {
    const w = Number(ctx.params.pocketWidthMm ?? 120);
    const h = Number(ctx.params.pocketHeightMm ?? 140);
    const pocket = draftPatchPocket(w, h);
    const paths = renderStandardPiece(pocket.contour, INDUSTRIAL_SEAM.default, {
      category: 'pocket', view: 'all', idPrefix: 'pocket-aldrich',
      grainLine: [pt(w * 0.5, h * 0.25), pt(w * 0.5, h * 0.75)],
    });
    // 定位孔 (drill-hole): 四角内缩 15mm, 车缝定位
    const inset = 15;
    const corners: Array<[number, number]> = [
      [inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset],
    ];
    corners.forEach(([cx, cy], i) => {
      paths.push({
        id: `pocket-drill-${i}`,
        data: `M${(cx - 2.5).toFixed(2)} ${cy.toFixed(2)} a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0`,
        fill: 'none', stroke: '#888', strokeWidth: 1,
        layer: 'drill-hole', category: 'pocket', view: 'all',
      } as GenePathData);
    });

    // 袋口明线 (annotation: 双折边参考)
    paths.push({
      id: 'pocket-aldrich-hemfold',
      data: `M${(w + 8).toFixed(2)} 15 L${(-8).toFixed(2)} 15 L${(-8).toFixed(2)} 25 L${(w + 8).toFixed(2)} 25 Z`,
      fill: 'none', stroke: '#555', strokeWidth: 1,
      strokeDasharray: '6,4',
      layer: 'detail', category: 'pocket', view: 'all',
    } as GenePathData);
    const out: BlockOutput = { paths, anchors: {} };
    return out;
  },
};








