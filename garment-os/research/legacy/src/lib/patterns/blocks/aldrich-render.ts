/**
 * Aldrich Block 共享 CAD 渲染工具
 * 标准 5 层输出: 毛样裁剪线 / 净样线 / 对折线 / 布纹线 / 剪口
 */

import type { GenePathData } from '@/types/gene';
import type { Contour, Pt } from '../../pattern/drafting';
import { seamAllowancePath, contourToPath } from '../../pattern/drafting';

export interface PieceRenderOptions {
  /** 部件类目 (body/sleeve/collar/cuff/placket/pocket) */
  category: string;
  /** 视图归属 */
  view: 'front' | 'back' | 'all';
  /** 对折线 (可选项): 线段两端点 */
  foldLine?: [Pt, Pt];
  /** 布纹线 (可选项): 线段两端点 */
  grainLine?: [Pt, Pt];
  /** 剪口点 (可选项) */
  notch?: Pt;
  /** id 前缀 */
  idPrefix: string;
  /** 分段缝份毛样 path (可选项; 提供时优先于 uniform seamWidthMm) */
  cuttingPath?: string;
}

/** 标准裁片 5 层 path 输出 */
export function renderStandardPiece(
  contour: Contour,
  seamWidthMm: number,
  opts: PieceRenderOptions,
): GenePathData[] {
  const paths: GenePathData[] = [
    // 毛样裁剪线 (分段缝份优先, 退回统一缝份)
    {
      id: `${opts.idPrefix}-cutting`,
      data: opts.cuttingPath ?? seamAllowancePath(contour, seamWidthMm),
      fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2,
      layer: 'cutting-line', category: opts.category, view: opts.view,
    },
    // 净样线
    {
      id: `${opts.idPrefix}-net`,
      data: contourToPath(contour),
      fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
      layer: 'seam-line', category: opts.category, view: opts.view,
    },
  ];
  if (opts.foldLine) {
    paths.push({
      id: `${opts.idPrefix}-fold`,
      data: `M${opts.foldLine[0].x.toFixed(2)} ${opts.foldLine[0].y.toFixed(2)} L${opts.foldLine[1].x.toFixed(2)} ${opts.foldLine[1].y.toFixed(2)}`,
      fill: 'none', stroke: '#555', strokeWidth: 1,
      strokeDasharray: '12,6,2,6',
      layer: 'fold-line', category: opts.category, view: opts.view,
    });
  }
  if (opts.grainLine) {
    const [a, b] = opts.grainLine;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len; // 单位方向
    const w = 5;
    const ax = -uy, ay = ux; // 箭头横向
    paths.push({
      id: `${opts.idPrefix}-grain`,
      data: [
        `M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        `M${(a.x + ux * w * 0.8 + ax * w / 2).toFixed(2)} ${(a.y + uy * w * 0.8 + ay * w / 2).toFixed(2)} L${a.x.toFixed(2)} ${a.y.toFixed(2)} L${(a.x + ux * w * 0.8 - ax * w / 2).toFixed(2)} ${(a.y + uy * w * 0.8 - ay * w / 2).toFixed(2)}`,
      ].join(' '),
      fill: 'none', stroke: '#1a1a1a', strokeWidth: 1.5,
      layer: 'grain-line', category: opts.category, view: opts.view,
    });
  }
  if (opts.notch) {
    const s = 5;
    paths.push({
      id: `${opts.idPrefix}-notch`,
      data: `M${(opts.notch.x - s).toFixed(2)} ${(opts.notch.y - s).toFixed(2)} L${(opts.notch.x + s).toFixed(2)} ${(opts.notch.y - s).toFixed(2)} L${opts.notch.x.toFixed(2)} ${(opts.notch.y + s * 1.4).toFixed(2)} Z`,
      fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1.2,
      layer: 'notch', category: opts.category, view: opts.view,
    });
  }
  return paths;
}

