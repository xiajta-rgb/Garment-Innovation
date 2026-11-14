import type { BlockDefinition } from '../types';
import type { GenePathData } from '@/types/gene';
import { draftBrian, BRIAN_VERSION, type ReferencePiece } from '@/lib/pattern/reference/brian';

function pathsFor(piece: ReferencePiece): GenePathData[] {
  const category = piece.kind === 'sleeve' ? 'sleeve' : 'body';
  const view = piece.kind === 'sleeve' ? 'all' : piece.kind;
  const base = { category, view, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1, referenceVersion: BRIAN_VERSION, referenceEngine: 'brian', referenceExpectedCutCount: 1, pieceId: piece.upstreamPart, pieceName: piece.name, cutQty: piece.qty, cutOnFold: piece.onFold } as const;
  const paths: GenePathData[] = [
    { ...base, id: `${piece.id}-reference-cut`, data: piece.cuttingPathD, layer: 'cutting-line' },
    { ...base, id: `${piece.id}-reference-net`, data: piece.netPathD, layer: 'seam-line', strokeDasharray: '4 3' },
  ];
  // Use the upstream grainline path when available. A cut-on-fold body's warp follows its center axis.
  if (!piece.grainPathD) throw new Error('上游未定义布纹或对折方向，不能补画');
  paths.push({ ...base, id: `${piece.id}-reference-grain`, data: piece.grainPathD, layer: 'grain-line', markerStart: piece.grainMarkerStart, markerEnd: piece.grainMarkerEnd });
  for (const [index, p] of piece.notchPoints.entries()) paths.push({ ...base, id: `${piece.id}-reference-notch-${index}`, data: `M${p.x - 3} ${p.y}L${p.x + 3} ${p.y}`, layer: 'notch' });
  return paths;
}

export const BrianBodiceBlock: BlockDefinition = {
  id: 'bodice-brian', name: 'Brian 衣身参考', category: 'body', inputs: { anchors: [], params: ['fit'] },
  solve: ctx => {
    if (!ctx.measurements) throw new Error('Brian 需要完整人体测量值');
    const draft = draftBrian(ctx.measurements, { fit: String(ctx.params.fit ?? 'regular') as 'regular', seamAllowanceMm: Number(ctx.params.seamAllowance ?? 10) });
    if (!draft.geometryPass) throw new Error('Brian 走缝约束未通过，已阻断映射');
    const piece = draft.pieces.find(p => p.kind === (ctx.view ?? 'front'))!;
    const p = piece.points;
    return {
      paths: pathsFor(piece),
      anchors: { 'sp-left': { x: -p.shoulder.x, y: p.shoulder.y }, 'sp-right': p.shoulder, 'ap-left': { x: -p.armhole.x, y: p.armhole.y }, 'ap-right': p.armhole, 'sn-right': p.hps },
    };
  },
};
export const BrianSleeveBlock: BlockDefinition = {
  id: 'sleeve-brian', name: 'Brian 配套装袖参考', category: 'sleeve', inputs: { anchors: [], params: ['fit'] },
  solve: ctx => {
    if (!ctx.measurements) throw new Error('Brian 需要完整人体测量值');
    const draft = draftBrian(ctx.measurements, { fit: String(ctx.params.fit ?? 'regular') as 'regular', seamAllowanceMm: Number(ctx.params.seamAllowance ?? 10) });
    if (!draft.geometryPass) throw new Error('Brian 走缝约束未通过，已阻断映射');
    return { paths: pathsFor(draft.pieces[2]), anchors: {} };
  },
};
