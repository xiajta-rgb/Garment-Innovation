/**
 * ─────────────────────────────────────────────────────────────
 *  Aldrich 衣身 Block (毫米制版, 公式驱动)
 * ─────────────────────────────────────────────────────────────
 *
 *  与 bodice-basic (渲染坐标近似版) 的本质区别:
 *   - 输入直接读 ctx.measurements (真实 mm)
 *   - 所有坐标 = 制版公式计算值 (可查证出处)
 *   - 输出毛样裁剪线 + 净样线 + 缝份体系, 可直接排料
 */

import type { BlockDefinition, BlockOutput } from '../types';
import type { GenePathData } from '@/types/gene';
import {
  draftBodice, segmentedSeamAllowancePath, hemFoldPath, INDUSTRIAL_SEAM, INDUSTRIAL_WIDTHS,
  contourToPath, pt, type SeamWidths, type DraftOptions,
} from '../../pattern/drafting';

export const BodiceAldrichBlock: BlockDefinition = {
  id: 'bodice-aldrich',
  name: '衣身原型 (Aldrich mm 制版)',
  category: 'body',
  inputs: {
    params: ['fit', 'seamAllowance', 'neckType', 'neckVExtraMm'],
  },
  solve: (ctx) => {
    const m = ctx.measurements;
    if (!m) throw new Error('bodice-aldrich 需要人体测量值 (measurements)');
    const view = ctx.view ?? 'front';
    const fit = (String(ctx.params.fit ?? 'regular') as DraftOptions['fit']);
    const seamW = Number(ctx.params.seamAllowance ?? INDUSTRIAL_SEAM.default);
    const neckType = String(ctx.params.neckType ?? 'crew') as 'crew' | 'v' | 'square';
    const neckVExtraMm = ctx.params.neckVExtraMm != null ? Number(ctx.params.neckVExtraMm) : undefined;

    const draft = draftBodice(m, ctx.gender ?? 'unisex', view, { fit, seamAllowanceMm: seamW, neckType, neckVExtraMm });
    const p = draft.points;

    const paths: GenePathData[] = [
      // 毛样裁剪线 (含缝份, 粗实线) — 排料裁剪用
      {
        id: `bodice-cutting-${view}`,
        data: segmentedSeamAllowancePath(draft.edges, { ...INDUSTRIAL_WIDTHS, seam: seamW, hem: INDUSTRIAL_SEAM.hem } as SeamWidths),
        fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2,
        layer: 'cutting-line', category: 'body', view,
      },
      // 净样轮廓 (细线) — 缝合参考线
      {
        id: `bodice-net-${view}`,
        data: contourToPath(draft.contour),
        fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
        layer: 'seam-line', category: 'body', view,
      },
      // 中线折叠线 (对折裁剪标记, 虚线)
      {
        id: `bodice-fold-${view}`,
        data: `M0 ${(-20).toFixed(2)} L0 ${(draft.hemY + 25).toFixed(2)}`,
        fill: 'none', stroke: '#555', strokeWidth: 1,
        strokeDasharray: '12,6,2,6',
        layer: 'fold-line', category: 'body', view,
      },
      // 下摆折边线 (净样内 hem mm, 只画裁片一侧, 避开折叠线)
      ...(hemFoldPath(draft.contour, { hemSide: p.hemSide, hemCenter: p.hemCenter }, INDUSTRIAL_SEAM.hem) ? [{
        id: `bodice-hemfold-${view}`,
        data: hemFoldPath(draft.contour, { hemSide: p.hemSide, hemCenter: p.hemCenter }, INDUSTRIAL_SEAM.hem)!,
        fill: 'none', stroke: '#555', strokeWidth: 1,
        strokeDasharray: '6,4',
        layer: 'detail' as const, category: 'body', view,
      } satisfies GenePathData] : []),
      // 布纹线 (经向箭头, 在裁片内、与中线平行)
      {
        id: `bodice-grain-${view}`,
        data: grainArrow(p.bustMid.x - draft.halfBustWidth * 0.55, draft.waistY * 0.2, draft.hemY - 30),
        fill: 'none', stroke: '#1a1a1a', strokeWidth: 1.5,
        layer: 'grain-line', category: 'body', view,
      },
      // 剪口: 肩点 / 袖窿底 (拼合对位)
      ...notchTri(p.shoulder.x, p.shoulder.y, 'left', `bodice-sp-${view}`, view),
      ...notchTri(p.armhole.x, p.armhole.y, 'left', `bodice-ap-${view}`, view),
      // 袖窿对位剪口 (弧长精确定位): 前片单剪 / 后片双剪, 与袖山剪口配对
      ...draft.armholeNotches.map((n, i) => ({
        id: `bodice-ah-notch-${view}-${i}`,
        data: `M${(n.point.x - 5).toFixed(2)} ${(n.point.y - 5).toFixed(2)} L${(n.point.x + 5).toFixed(2)} ${(n.point.y - 5).toFixed(2)} L${n.point.x.toFixed(2)} ${(n.point.y + 7).toFixed(2)} Z`,
        fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
        layer: 'notch' as const, category: 'body', view,
      } satisfies GenePathData)),
      // 胸围线尺寸标注 (双箭头, industrial 视图)
      {
        id: `bodice-dim-bust-${view}`,
        data: dimensionLine(pt(p.bustMid.x - 8, p.bustMid.y), pt(p.armhole.x + 8, p.armhole.y)),
        fill: 'none', stroke: '#888', strokeWidth: 0.8,
        layer: 'annotation', category: 'body', view,
      },
    ];

    // 锚点 (mm): 镜像补全左右锚点满足 compose 严格校验
    const out: BlockOutput = {
      paths,
      anchors: {
        'sp-left': { x: p.shoulder.x, y: p.shoulder.y },
        'sp-right': { x: -p.shoulder.x, y: p.shoulder.y },
        'ap-left': { x: p.armhole.x, y: p.armhole.y },
        'ap-right': { x: -p.armhole.x, y: p.armhole.y },
        'sn-left': { x: p.snSide.x, y: p.snSide.y },
        'sn-right': { x: -p.snSide.x, y: p.snSide.y },
        'cf-neck': { x: 0, y: 0 },
        'cf-waist': { x: 0, y: draft.waistY },
        'cf-hem': { x: 0, y: draft.hemY },
        'cb-neck': { x: 0, y: 0 },
        'cb-waist': { x: 0, y: draft.waistY },
        'cb-hem': { x: 0, y: draft.hemY },
        'side-waist-left': { x: p.waistSide.x, y: p.waistSide.y },
        'side-waist-right': { x: -p.waistSide.x, y: p.waistSide.y },
        'side-hem-left': { x: p.hemSide.x, y: p.hemSide.y },
        'side-hem-right': { x: -p.hemSide.x, y: p.hemSide.y },
      },
      anchorScopes: {
        'cf-neck': view === 'front' ? 'front' : 'back',
        'cf-waist': view === 'front' ? 'front' : 'back',
        'cf-hem': view === 'front' ? 'front' : 'back',
        'cb-neck': view === 'front' ? 'back' : 'front',
        'cb-waist': view === 'front' ? 'back' : 'front',
        'cb-hem': view === 'front' ? 'back' : 'front',
      },
    };
    return out;
  },
};

/** 布纹线 (双向箭头) */
function grainArrow(x: number, yTop: number, yBottom: number): string {
  const w = 6;
  return [
    `M${x.toFixed(2)} ${yTop.toFixed(2)} L${x.toFixed(2)} ${yBottom.toFixed(2)}`,
    `M${(x - w / 2).toFixed(2)} ${(yTop + w).toFixed(2)} L${x.toFixed(2)} ${yTop.toFixed(2)} L${(x + w / 2).toFixed(2)} ${(yTop + w).toFixed(2)}`,
    `M${(x - w / 2).toFixed(2)} ${(yBottom - w).toFixed(2)} L${x.toFixed(2)} ${yBottom.toFixed(2)} L${(x + w / 2).toFixed(2)} ${(yBottom - w).toFixed(2)}`,
  ].join(' ');
}

/** 剪口三角 (拼合对位标记) */
function notchTri(x: number, y: number, dir: 'left' | 'right' | 'up' | 'down', idPrefix: string, view: 'front' | 'back' | 'all'): GenePathData[] {
  const s = 5;
  let d: string;
  if (dir === 'left') d = `M${x} ${(y - s).toFixed(2)} L${(x - s * 1.4).toFixed(2)} ${y.toFixed(2)} L${x} ${(y + s).toFixed(2)} Z`;
  else if (dir === 'right') d = `M${x} ${(y - s).toFixed(2)} L${(x + s * 1.4).toFixed(2)} ${y.toFixed(2)} L${x} ${(y + s).toFixed(2)} Z`;
  else if (dir === 'up') d = `M${(x - s).toFixed(2)} ${y.toFixed(2)} L${x.toFixed(2)} ${(y - s * 1.4).toFixed(2)} L${(x + s).toFixed(2)} ${y.toFixed(2)} Z`;
  else d = `M${(x - s).toFixed(2)} ${y.toFixed(2)} L${x.toFixed(2)} ${(y + s * 1.4).toFixed(2)} L${(x + s).toFixed(2)} ${y.toFixed(2)} Z`;
  return [{
    id: `${idPrefix}-notch`,
    data: d,
    fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
    layer: 'notch', category: 'body', view,
  } as GenePathData];
}

/** 尺寸标注线 (双箭头) */
function dimensionLine(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const ax = 4;
  return [
    `M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
    `M${(a.x + ax).toFixed(2)} ${(a.y - ax / 2).toFixed(2)} L${a.x.toFixed(2)} ${a.y.toFixed(2)} L${(a.x + ax).toFixed(2)} ${(a.y + ax / 2).toFixed(2)}`,
    `M${(b.x - ax).toFixed(2)} ${(b.y - ax / 2).toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)} L${(b.x - ax).toFixed(2)} ${(b.y + ax / 2).toFixed(2)}`,
  ].join(' ');
}

