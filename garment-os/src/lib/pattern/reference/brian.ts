/**
 * FreeSewing Brian 4.10.2 adapter. Geometry is copied from one complete upstream
 * draft, including its fitted sleeve, never reconstructed from approximate formulas.
 * Brian is a menswear body block reference, not a manufacturing certification.
 */
import { Brian } from '@freesewing/brian';
import type { BodyMeasurements } from '@/types/measurements';
import type { DraftEdge } from '@/types/geometry';
import { contourLength, flattenChain, dist, type Pt, type Seg } from '../geometry';
import { referenceMarker } from './symbols';
import { referenceMeasurementSettings } from './measurements';
import { captureAssemblyPiece } from '../assembly/source';
import type { AssemblyPiece, AssemblyReport } from '@/types/assembly';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { AssemblyError, validateAssembly } from '../assembly/validate';
import { auditConstruction } from '../assembly/construction';

export const BRIAN_VERSION = '4.10.2';
export const BRIAN_SOURCE = 'https://freesewing.eu/designs/brian/';
export const REFERENCE_FIT = {
  slim: { chestEase: 0.08, bicepsEase: 0.10 },
  regular: { chestEase: 0.15, bicepsEase: 0.15 },
  loose: { chestEase: 0.25, bicepsEase: 0.25 },
} as const;
export interface ReferenceOptions {
  fit?: keyof typeof REFERENCE_FIT;
  seamAllowanceMm?: number;
}
export interface FsOp { type: string; to?: Pt; cp1?: Pt; cp2?: Pt }
interface FsPath { ops: FsOp[]; asPathstring(): string; length(): number; attributes?: { list?: Record<string,string[]> } }
interface FsPart {
  points: Record<string, Pt>;
  paths: Record<string, FsPath>;
}
export interface ReferencePiece {
  id: 'front-body' | 'back-body' | 'sleeve';
  upstreamPart: string;
  name: string;
  kind: 'front' | 'back' | 'sleeve';
  qty: number;
  onFold: boolean;
  points: Record<string, Pt>;
  edges: Array<DraftEdge & { label: string }>;
  netPathD: string;
  cuttingPathD: string;
  grainPathD: string;
  grainMarkerStart?: string;
  grainMarkerEnd?: string;
  notchPoints: Pt[];
  netAreaMm2: number;
}
export interface ReferenceDraft {
  engine: typeof BRIAN_VERSION;
  settings: { measurements: Record<string, number>; options: Record<string, number | boolean>; sa: number };
  pieces: ReferencePiece[];
  assemblyPieces: AssemblyPiece[];
  assembly: AssemblyReport;
  checks: Array<{ id: string; label: string; pass: boolean; valueMm: number; toleranceMm: number }>;
  geometryPass: boolean;
  productionStatus: 'unapproved';
}
const point = (p: Pt): Pt => ({ x: p.x, y: p.y });

export function brianSettings(m: BodyMeasurements, opts: ReferenceOptions = {}): ReferenceDraft['settings'] {
  // These are direct semantic mappings, not proportions or nearest-size guesses.
  const { measurements: mappings, lengthBonus } = referenceMeasurementSettings(m);
  // Upstream clamps this option; reject out-of-range inputs instead of silently changing dimensions.
  if (lengthBonus < -0.04 - 1e-10 || lengthBonus > 0.6 + 1e-10) {
    throw new Error('衣长超出 Brian lengthBonus 支持范围（腰臀基长的 96%～160%）');
  }
  const sa = opts.seamAllowanceMm ?? 10;
  if (!Number.isFinite(sa) || sa < 0 || sa > 30) throw new Error('缝份须在 0～30 mm 内');
  if (opts.fit && !(opts.fit in REFERENCE_FIT)) throw new Error('不支持的松量方案');
  const fit = REFERENCE_FIT[opts.fit ?? 'regular'];
  if (m.shoulderWidth / 2 >= m.bust * (1 + fit.chestEase) / 4) {
    throw new Error('肩点不得越过侧胸宽；请复核肩宽、胸围和松量');
  }
  return {
    measurements: mappings as Record<string, number>,
    options: { ...fit, lengthBonus },
    sa,
  };
}

/** Lossless M/L/C conversion. Reject unexpected operations rather than approximate them. */
export function pathEdges(path: FsPath, kind: ReferencePiece['kind']): ReferencePiece['edges'] {
  const edges: ReferencePiece['edges'] = [];
  let start: Pt | undefined;
  let from: Pt | undefined;
  let cubic = 0;
  for (const op of path.ops) {
    if (op.type === 'move') {
      if (start) throw new Error('净样包含多个子轮廓，需显式拆片');
      start = from = point(op.to!);
    } else if (op.type === 'close') {
      if (from && start && dist(from, start) > 1e-8) {
        edges.push({ role: 'seam', label: '闭合边', start: from, segs: [{ kind: 'L', to: start }] });
      }
      from = start;
    } else if ((op.type === 'line' || op.type === 'curve') && from && op.to) {
      const to = point(op.to);
      const seg: Seg = op.type === 'line' ? { kind: 'L', to }
        : { kind: 'C', c1: point(op.cp1!), c2: point(op.cp2!), to };
      let role: DraftEdge['role'] = 'seam';
      let label: string;
      if (kind === 'sleeve') {
        label = op.type === 'curve' ? `袖山曲线 ${++cubic}`
          : edges.length === 0 ? '后袖缝' : edges.length === 1 ? '袖口' : '前袖缝';
        if (edges.length === 1) role = 'hem';
      } else if (Math.abs(from.x) < 1e-8 && Math.abs(to.x) < 1e-8) {
        role = 'fold'; label = '中心对折边';
      } else if (op.type === 'curve') {
        const isNeck = Math.abs(to.x) < 1e-8;
        role = isNeck ? 'neckline' : 'seam';
        label = isNeck ? '领口弧线' : `袖窿曲线 ${++cubic}`;
      } else if (Math.abs(from.y - to.y) < 1e-8) {
        role = 'hem'; label = '下摆';
      } else label = from.y > to.y && Math.abs(from.x - to.x) > 1e-8 ? '肩缝' : '侧缝';
      if (dist(from, to) > 1e-8 || seg.kind === 'C') edges.push({ role, label, start: from, segs: [seg] });
      from = to;
    } else throw new Error(`不支持的上游路径操作：${op.type}`);
  }
  if (!start || !from || dist(start, from) > 1e-6) throw new Error('上游净样未闭合');
  return edges;
}

function area(edges: DraftEdge[]): number {
  const samples = edges.flatMap(e => flattenChain(e.start, e.segs, 0.25).slice(0, -1));
  return Math.abs(samples.reduce((sum, p, i) => {
    const q = samples[(i + 1) % samples.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0)) / 2;
}
const edgeLength = (p: ReferencePiece, label: RegExp) => p.edges.filter(e => label.test(e.label))
  .reduce((sum, e) => sum + contourLength({ start: e.start, segs: e.segs, closed: false }), 0);

// Small bounded cache: body and sleeve blocks and generator share the same complete draft.
const cache = new Map<string, ReferenceDraft>();
export function draftBrian(m: BodyMeasurements, opts: ReferenceOptions = {}): ReferenceDraft {
  const settings = brianSettings(m, opts);
  const cacheKey = JSON.stringify(settings);
  const cached = cache.get(cacheKey);
  if (cached) return structuredClone(cached);
  const pattern = new Brian(settings);
  pattern.draft();
  const upstream = pattern.parts[0] as Record<string, FsPart>;
  const assemblyPieces: AssemblyPiece[] = [];
  const specs = [
    ['front-body', 'brian.front', '前衣身 · Brian', 'front', 1, true],
    ['back-body', 'brian.back', '后衣身 · Brian', 'back', 1, true],
    ['sleeve', 'library.sleeve', '装袖 · Brian', 'sleeve', 2, false],
  ] as const;
  const pieces: ReferencePiece[] = specs.map(([id, upstreamPart, name, kind, qty, onFold]) => {
    const part = upstream[upstreamPart];
    assemblyPieces.push(captureAssemblyPiece(part, { id: upstreamPart, name, engine: 'brian', version: BRIAN_VERSION },
      (pattern.setStores[0].get('cutlist') as Record<string, Record<string, unknown>>)[upstreamPart]));
    if (!part?.paths.seam || (settings.sa > 0 && !part.paths.sa)) throw new Error(`上游缺少 ${upstreamPart} 净样/缝份`);
    const edges = pathEdges(part.paths.seam, kind);
    const points = Object.fromEntries(Object.entries(part.points).filter(([k]) => !k.startsWith('_')).map(([k, p]) => [k, point(p)]));
    if (Object.values(points).some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('上游生成了无效坐标');
    const grain = Object.entries(part.paths).find(([k]) => /grainline|cutonfold/.test(k) && k.endsWith('line'))?.[1];
    return {
      id, upstreamPart, name, kind, qty, onFold, points, edges,
      netPathD: part.paths.seam.asPathstring(),
      cuttingPathD: (part.paths.sa ?? part.paths.seam).asPathstring(),
      grainPathD: grain?.asPathstring() ?? '',
      grainMarkerStart: referenceMarker(grain?.attributes?.list?.['marker-start']),
      grainMarkerEnd: referenceMarker(grain?.attributes?.list?.['marker-end']),
      notchPoints: (kind === 'sleeve' ? ['frontNotch', 'backNotch'] : ['armholePitch']).map(k => points[k]).filter(Boolean),
      netAreaMm2: area(edges),
    };
  });
  const [front, back, sleeve] = pieces;
  for (const body of [front, back]) {
    const p = body.points;
    const hem = p.cfHem ?? p.cbHem;
    if (!(p.hps.x < p.shoulder.x && p.shoulder.y < p.armhole.y && p.armhole.y < hem.y)) {
      throw new Error(`${body.name} 的颈点、肩点、腋下与下摆次序无效；停止生成`);
    }
  }
  const armhole = edgeLength(front, /袖窿/) + edgeLength(back, /袖窿/);
  const cap = edgeLength(sleeve, /袖山/);
  const checks = [
    { id: 'sleeve-fit', label: '袖山与前后袖窿走缝差（参考设定吃势 0）', valueMm: Math.abs(cap - armhole), toleranceMm: 2 },
    { id: 'shoulder-match', label: '前后肩缝差', valueMm: Math.abs(edgeLength(front, /肩缝/) - edgeLength(back, /肩缝/)), toleranceMm: 0.01 },
    { id: 'side-match', label: '前后侧缝差', valueMm: Math.abs(edgeLength(front, /侧缝/) - edgeLength(back, /侧缝/)), toleranceMm: 0.01 },
  ].map(c => ({ ...c, pass: c.valueMm <= c.toleranceMm }));
  const assembly = validateAssembly(getAssemblyDefinition('brian-reference'), assemblyPieces);
  if (!assembly.integrityPass) throw new AssemblyError(assembly);
  assembly.construction = auditConstruction('brian-reference', m, settings.options, assemblyPieces.map(p=>({id:p.id,points:p.points,sourcePaths:{}})), assembly);
  const result: ReferenceDraft = { engine: BRIAN_VERSION, settings, pieces, assemblyPieces, assembly, checks, geometryPass: checks.every(c => c.pass), productionStatus: 'unapproved' };
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, result);
  return structuredClone(result);
}
