import type { PatternPath } from '@/types/pattern';
import { BRIAN_VERSION, type ReferencePiece } from './brian';
import { requireSourcePieceRole } from '@/data/pieceRoleBindings';
import { PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';

/** Convert one sourced piece; this function never solves or invents geometry. */
export function brianPiecePaths(piece: ReferencePiece): PatternPath[] {
  const binding=requireSourcePieceRole(piece.upstreamPart);
  const category = piece.kind === 'sleeve' ? 'sleeve' : 'body';
  const view = piece.kind === 'sleeve' ? 'all' : piece.kind;
  const transform = piece.kind === 'sleeve' ? 'translate(650,180)' : undefined;
  const base = { category, view, transform, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1,
    pieceRole:binding.role,materialRole:binding.material,taxonomyVersion:PIECE_TAXONOMY_VERSION,
    referenceVersion: BRIAN_VERSION, referenceEngine: 'brian', referenceExpectedCutCount: 1,
    pieceId: piece.upstreamPart, pieceName: piece.name, cutQty: piece.qty, cutOnFold: piece.onFold } as const;
  if (!piece.grainPathD) throw new Error('上游未定义布纹或对折方向，不能补画');
  return [
    { ...base, id: `${piece.id}-reference-cut`, data: piece.cuttingPathD, layer: 'cutting-line' },
    { ...base, id: `${piece.id}-reference-net`, data: piece.netPathD, layer: 'seam-line', strokeDasharray: '4 3' },
    { ...base, id: `${piece.id}-reference-grain`, data: piece.grainPathD, layer: 'grain-line', markerStart: piece.grainMarkerStart, markerEnd: piece.grainMarkerEnd },
    ...piece.notchPoints.map((p, index): PatternPath => ({ ...base, id: `${piece.id}-reference-notch-${index}`, data: `M${p.x - 3} ${p.y}L${p.x + 3} ${p.y}`, layer: 'notch' })),
  ];
}
