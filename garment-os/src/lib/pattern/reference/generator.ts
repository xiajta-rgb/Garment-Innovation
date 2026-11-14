import type { BodyMeasurements, StandardSize, GenderType } from '@/types/measurements';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import type { GeneratedPiece, DimensionRow } from '@/types/geometry';
import { tagsForPath } from '../piece-tags';
import { brianPiecePaths } from './brian-paths';
import { contourLength } from '../geometry';
import { draftBrian, type ReferenceOptions, type ReferenceDraft } from './brian';

/** Only data that actually controls this reference is editable. Degrees have their own unit. */
export const REFERENCE_FIELDS: Array<{ id: keyof BodyMeasurements; label: string; min: number; max: number; unit: 'mm' | '°'; step: number }> = [
  { id: 'bust', label: '胸围', min: 600, max: 1600, unit: 'mm', step: 1 },
  { id: 'neckCirc', label: '颈围', min: 250, max: 550, unit: 'mm', step: 1 },
  { id: 'shoulderWidth', label: '总肩宽', min: 280, max: 620, unit: 'mm', step: 1 },
  { id: 'shoulderSlope', label: '肩斜角', min: 0, max: 45, unit: '°', step: 0.1 },
  { id: 'hpsToBust', label: 'HPS→胸围线', min: 150, max: 400, unit: 'mm', step: 1 },
  { id: 'hpsToWaistBack', label: 'HPS→后腰', min: 280, max: 650, unit: 'mm', step: 1 },
  { id: 'waistToArmpit', label: '腰→腋下', min: 100, max: 350, unit: 'mm', step: 1 },
  { id: 'hipDepth', label: '腰→臀线', min: 60, max: 300, unit: 'mm', step: 1 },
  { id: 'totalLength', label: 'HPS→下摆', min: 400, max: 1000, unit: 'mm', step: 1 },
  { id: 'bicep', label: '上臂围', min: 180, max: 550, unit: 'mm', step: 1 },
  { id: 'sleeveLength', label: '肩端→腕', min: 400, max: 850, unit: 'mm', step: 1 },
  { id: 'wristCirc', label: '腕围', min: 120, max: 300, unit: 'mm', step: 1 },
];
export type ReferenceGeneratedPiece = Omit<GeneratedPiece, 'grossAreaMm2'> & { netAreaMm2: number; onFold: boolean; cuttingPathD: string; referencePathD: string; referencePoints: Record<string, { x: number; y: number }>; upstreamPart: string; grainPathD: string; grainMarkerStart?: string; grainMarkerEnd?: string };
export interface ReferenceGeneration {
  draft: ReferenceDraft;
  pieces: ReferenceGeneratedPiece[];
  netAreaPerGarmentMm2: number;
}
export function generateReferencePieces(m: BodyMeasurements, opts: ReferenceOptions = {}): ReferenceGeneration {
  const draft = draftBrian(m, opts);
  const pieces = draft.pieces.map(p => {
    const dimensions: DimensionRow[] = p.edges.map(e => ({
      label: e.label, role: e.role,
      lengthMm: contourLength({ start: e.start, segs: e.segs, closed: false }),
      from: e.start, to: e.segs.at(-1)!.to,
    }));
    const keyDims = p.kind === 'sleeve' ? [
      { label: '肩端→腕长度', value: m.sleeveLength },
      { label: '袖肥全宽', value: p.points.bicepsRight.x - p.points.bicepsLeft.x },
      { label: '袖山弧长', value: dimensions.filter(d => d.label.includes('袖山')).reduce((s, d) => s + d.lengthMm, 0) },
      { label: '袖口全宽', value: p.points.wristRight.x - p.points.wristLeft.x },
    ] : [
      { label: 'HPS→下摆', value: m.totalLength },
      { label: '半片胸宽', value: p.points.armhole.x },
      { label: 'HPS→胸围线', value: m.hpsToBust },
      { label: 'HPS→袖窿底', value: p.points.armhole.y },
    ];
    return {
      id: p.id, name: p.name, qty: p.qty, kind: p.kind, onFold: p.onFold,
      tags: tagsForPath(brianPiecePaths(p)[0]), keyDims, dimensions,
      points: Object.entries(p.points).map(([label, point]) => ({ label, ...point })),
      netAreaMm2: p.netAreaMm2, edges: p.edges,
      netPathD: p.netPathD, cuttingPathD: p.cuttingPathD,
      referencePathD: p.netPathD, referencePoints: p.points, upstreamPart: p.upstreamPart,
      grainPathD: p.grainPathD, grainMarkerStart: p.grainMarkerStart, grainMarkerEnd: p.grainMarkerEnd,
    };
  });
  return { draft, pieces, netAreaPerGarmentMm2: draft.pieces.reduce((s, p) => s + p.netAreaMm2 * p.qty * (p.onFold ? 2 : 1), 0) };
}

export function generateReferenceSizes(gender: GenderType, sizes: StandardSize[], opts: ReferenceOptions = {}) {
  return sizes.map(size => ({ size, result: generateReferencePieces(getReferenceMeasurements(gender, size), opts) }));
}
