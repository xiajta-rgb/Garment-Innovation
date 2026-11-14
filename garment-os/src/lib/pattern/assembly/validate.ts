import { Path, Point } from '@freesewing/core';
import type { AssemblyDefinition, AssemblyEdge, AssemblyFinding, AssemblyPiece, AssemblyPoint, AssemblyReport, BoundaryDefinition, BoundaryResult, BoundaryUse, JoinResult, PointReference } from '@/types/assembly';
import { contourTopologyError } from './topology';
import { auditSleeveTopology } from './sleeve-topology';

const distance = (a: AssemblyPoint, b: AssemblyPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const same = (a: AssemblyPoint, b: AssemblyPoint) => distance(a, b) <= 1e-6;
const finite = (p?: AssemblyPoint): p is AssemblyPoint => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const sourcePoint = (p: AssemblyPoint) => new Point(p.x, p.y);
const key = (p: string, b: string) => `${p}/${b}`;

function resolvePoint(piece: AssemblyPiece, ref: PointReference): AssemblyPoint {
  const name = typeof ref === 'string' ? ref : ref.point;
  const p = piece.points[name];
  if (!finite(p)) throw new Error(`源点不存在或坐标无效：${name}`);
  return typeof ref === 'string' ? p : { x: -p.x, y: p.y };
}

function route(piece: AssemblyPiece, def: BoundaryDefinition): AssemblyEdge[] {
  const edges = def.sourcePath ? piece.internalPaths[def.sourcePath] : piece.edges;
  if (!edges?.length) throw new Error(`源路径不存在：${def.sourcePath ?? 'seam'}`);
  const start = resolvePoint(piece, def.from), end = resolvePoint(piece, def.to);
  const starts = edges.map((e, i) => same(e.from, start) ? i : -1).filter(i => i >= 0);
  if (starts.length !== 1 || same(start, end)) throw new Error('边界起点不唯一或起止点重合');
  const selected: AssemblyEdge[] = [];
  for (let step = 0; step < edges.length; step++) {
    const i = starts[0] + step;
    if (def.sourcePath && i >= edges.length) break;
    const edge = edges[i % edges.length];
    selected.push(edge);
    if (same(edge.to, end)) return selected;
  }
  throw new Error('终点不在连续源边链上');
}

function verifyEdges(edges: AssemblyEdge[], closed: boolean): string | null {
  if (!edges.length || new Set(edges.map(e => e.id)).size !== edges.length) return '空轮廓或重复边身份';
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (!finite(e.from) || !finite(e.to) || !Number.isFinite(e.lengthMm) || e.lengthMm <= 0) return '源边含无效坐标或长度';
    const path = new Path().move(sourcePoint(e.from));
    if (e.kind === 'curve' && finite(e.cp1) && finite(e.cp2)) path.curve(sourcePoint(e.cp1), sourcePoint(e.cp2), sourcePoint(e.to));
    else if (e.kind === 'line') path.line(sourcePoint(e.to));
    else return '曲线控制点缺失或边类型未知';
    if (Math.abs(path.length() - e.lengthMm) > 1e-6) return '源边长度与实际曲线不一致';
    if (i > 0 && !same(edges[i - 1].to, e.from)) return '边链不连续';
  }
  return closed && !same(edges.at(-1)!.to, edges[0].from) ? '净样边链未闭合' : null;
}

function edgePath(edges: AssemblyEdge[]): string {
  return `M${edges[0].from.x} ${edges[0].from.y}` + edges.map(e => e.kind === 'curve'
    ? `C${e.cp1!.x} ${e.cp1!.y} ${e.cp2!.x} ${e.cp2!.y} ${e.to.x} ${e.to.y}` : `L${e.to.x} ${e.to.y}`).join('');
}

/** Pure audit of a complete draft against a versioned structural method. Unknown stays pending. */
export function validateAssembly(def: AssemblyDefinition, pieces: AssemblyPiece[]): AssemblyReport {
  const errors: AssemblyFinding[] = [], pending: AssemblyFinding[] = [], boundaries: BoundaryResult[] = [], joins: JoinResult[] = [];
  const error = (code: string, subject: string, message: string) => errors.push({ code, subject, message });
  errors.push(...auditSleeveTopology(def));
  const wait = (code: string, subject: string, message: string) => pending.push({ code, subject, message });
  const pieceMap = new Map<string, AssemblyPiece>(), boundaryMap = new Map<string, BoundaryResult>();
  const graph = new Map(def.pieces.map(p => [p.id, new Set<string>()]));
  if (new Set(def.pieces.map(p => p.id)).size !== def.pieces.length) error('definition-duplicate', def.id, '装配定义包含重复裁片');
  if (new Set(def.joins.map(j => j.id)).size !== def.joins.length) error('join-duplicate', def.id, '装配定义包含重复关系');
  for (const p of pieces) {
    if (pieceMap.has(p.id)) error('piece-duplicate', p.id, '同一裁片身份重复');
    pieceMap.set(p.id, p);
    if (!def.pieces.some(d => d.id === p.id)) error('piece-unexpected', p.id, '未声明裁片不得参与装配');
  }
  let totalEdges = 0, classifiedEdges = 0;
  for (const expected of def.pieces) {
    const p = pieceMap.get(expected.id);
    if (!p) { error('piece-missing', expected.id, '装配必需裁片缺失'); continue; }
    if (p.engine !== def.engine || p.version !== def.version) error('source-mismatch', p.id, `需 ${def.engine} ${def.version}，实际 ${p.engine} ${p.version}`);
    if (p.quantity !== expected.quantity || p.onFold !== expected.onFold) error('cut-plan-mismatch', p.id, `需裁 ${expected.quantity} 片、对折=${expected.onFold}，实际 ${p.quantity}、${p.onFold}`);
    const material=expected.primaryMaterial??'fabric';
    if((p.primaryMaterial??'fabric')!==material)error('primary-material-mismatch',p.id,'主材料身份与构型不一致');
    const fabric = p.materials[material] ?? [];
    if (!fabric.length || fabric.some(c => !Number.isInteger(c.cut) || c.cut <= 0 || c.onFold !== p.onFold) || fabric.reduce((sum, c) => sum + c.cut, 0) !== p.quantity) error('cutlist-mismatch', p.id, '材料裁剪指令与结构数量或对折方式不一致');
    for (const cuts of Object.values(p.materials)) if (!Array.isArray(cuts) || cuts.some(c => !Number.isInteger(c.cut) || c.cut <= 0 || typeof c.onFold !== 'boolean')) error('material-cut-invalid', p.id, '材料层裁剪数量或对折方式无效');
    const invalid = verifyEdges(p.edges, true);
    totalEdges += p.edges.length;
    if (invalid) { error('geometry-invalid', p.id, invalid); continue; }
    const topology = contourTopologyError(p.edges);
    if (topology) { error('geometry-topology', p.id, topology); continue; }
    for (const [name, edges] of Object.entries(p.internalPaths)) {
      const invalidPath = verifyEdges(edges, false);
      if (invalidPath) error('internal-path-invalid', `${p.id}/${name}`, invalidPath);
    }
    const covered = new Set<string>(), internalFaces = new Set<string>();
    for (const b of expected.boundaries) {
      const subject = key(p.id, b.id);
      if (boundaryMap.has(subject)) { error('boundary-duplicate', subject, '重复边界身份'); continue; }
      try {
        const edges = route(p, b);
        if (b.sourcePath) {
          if((b.sourcePathKind??'cut')!==(p.internalPathKinds?.[b.sourcePath]??'cut'))error('internal-path-kind-mismatch',subject,'源切口与定位线身份不一致');
          if(b.sourcePathKind!=='placement'){
            const face = `${b.sourcePath}/${b.sourceFace}`;
            if (!b.sourceFace || internalFaces.has(face)) error('internal-face-duplicate', subject, '内部切口必须分别声明两侧，禁止重复使用同侧');
            internalFaces.add(face);
          }
        } else {
          for (const edge of edges) {
            if (covered.has(edge.id)) error('boundary-overlap', subject, `源边 ${edge.id} 被重复分类`);
            covered.add(edge.id);
          }
        }
        if (b.disposition === 'fold' && !p.onFold) error('fold-mismatch', subject, '非对折裁剪不能声明中心对折边');
        const result: BoundaryResult = { piece: p.id, id: b.id, label: b.label, role: b.role, disposition: b.disposition, sourcePath: b.sourcePath, sourcePathKind:b.sourcePathKind, sourceFace: b.sourceFace, stations: b.stations ? [...b.stations] : undefined,
          edgeIds: edges.map(e => e.id), pathD: edgePath(edges), lengthMm: edges.reduce((sum, e) => sum + e.lengthMm, 0), availableUses: p.quantity * (p.onFold ? 2 : 1), used: 0 };
        boundaries.push(result); boundaryMap.set(subject, result);
      } catch (cause) { error('boundary-unresolved', subject, cause instanceof Error ? cause.message : String(cause)); }
    }
    classifiedEdges += covered.size;
    if (covered.size !== p.edges.length) error('boundary-unclassified', p.id, `${p.edges.length - covered.size} 条源边没有明确用途`);
  }
  for (const join of def.joins) {
    const initialErrors = errors.length;
    const measure = (uses: BoundaryUse[], role: string): number | null => {
      if (!uses.length) { error('join-empty', join.id, '缝合关系两侧都必须有接口'); return null; }
      let length = 0;
      for (const u of uses) {
        const subject = key(u.piece, u.boundary), b = boundaryMap.get(subject);
        if (!b) { error('join-boundary-missing', join.id, `接口不存在：${subject}`); continue; }
        if (b.role !== role) error('join-role-mismatch', join.id, `${b.label} 的用途 ${b.role} 不能用于 ${role}`);
        if (!Number.isInteger(u.runs) || u.runs <= 0 || !Number.isInteger(u.layers) || u.layers <= 0) { error('join-count-invalid', join.id, '缝合次数和层数必须是正整数'); continue; }
        if (!['join', 'pending'].includes(b.disposition)) error('join-disposition-invalid', join.id, `不能将 ${b.disposition} 边作为装配接口`);
        if (join.rule.kind === 'equal' && (b.sourcePath || b.disposition === 'pending')) error('join-unresolved-interface', join.id, '未定义完成态的接口不能通过长度相等规则放行');
        b.used += u.runs * u.layers;
        length += b.lengthMm * u.runs;
      }
      return errors.length === initialErrors ? length : null;
    };
    const a = measure(join.a, join.roles[0]), b = measure(join.b, join.roles[1]);
    const delta = a === null || b === null ? null : a - b;
    const toleranceMm = join.rule.kind === 'equal' ? join.rule.toleranceMm : null;
    let directionChecked = false;
    if (join.rule.kind === 'equal') {
      const sequence = (uses: BoundaryUse[]): [string, string] | null => {
        let start: string | undefined, end: string | undefined;
        for (const u of uses) {
          const stations = boundaryMap.get(key(u.piece, u.boundary))?.stations;
          if (!stations) { error('join-endpoint-unknown', join.id, '走缝端点语义未声明'); return null; }
          const [from, to] = u.reverse ? [stations[1], stations[0]] : stations;
          if (end && end !== from) { error('join-direction-mismatch', join.id, `接口顺序不连续：${end} 不能接 ${from}`); return null; }
          start ??= from; end = to;
        }
        return start && end ? [start, end] : null;
      };
      const aStations = sequence(join.a), bStations = sequence(join.b);
      directionChecked = !!aStations && !!bStations && aStations[0] === bStations[0] && aStations[1] === bStations[1];
      if (aStations && bStations && !directionChecked) error('join-direction-mismatch', join.id, `两侧起止语义不匹配：${aStations.join('→')} / ${bStations.join('→')}`);
      if (!Number.isFinite(toleranceMm) || toleranceMm! < 0) error('join-tolerance-invalid', join.id, '走缝阈值必须明确且有效');
      else if (delta !== null && Math.abs(delta) > toleranceMm!) error('join-length-mismatch', join.id, `净边走缝差 ${delta.toFixed(4)} mm，限值 ${toleranceMm} mm`);
    } else wait('join-pending', join.id, join.rule.reason);
    for (const from of join.a) for (const to of join.b) if (from.piece !== to.piece && graph.has(from.piece) && graph.has(to.piece)) {
      graph.get(from.piece)!.add(to.piece); graph.get(to.piece)!.add(from.piece);
    }
    joins.push({ id: join.id, label: join.label, a: structuredClone(join.a), b: structuredClone(join.b), aLengthMm: a, bLengthMm: b, deltaMm: delta,
      status: errors.length > initialErrors ? 'failed' : join.rule.kind === 'pending' ? 'pending' : 'passed', toleranceMm,
      directionChecked,
      basis: join.rule.kind === 'equal' ? join.rule.basis : join.rule.reason });
  }
  for (const b of boundaries) {
    if (b.used > b.availableUses) error('boundary-overconsumed', key(b.piece, b.id), `接口最多 ${b.availableUses} 次，已占用 ${b.used} 次`);
    if (b.disposition === 'join' && b.used !== b.availableUses) error('boundary-unpaired', key(b.piece, b.id), `必配接口有 ${b.availableUses - b.used} 次未配对`);
    if (b.disposition === 'pending' && b.used === 0) wait('boundary-pending', key(b.piece, b.id), `${b.label} 尚无完整装配规则`);
  }
  const visited = new Set<string>();
  function visit(id: string) { if (visited.has(id)) return; visited.add(id); for (const next of graph.get(id) ?? []) visit(next); }
  if (def.pieces[0]) visit(def.pieces[0].id);
  const allPiecesConnected = visited.size === def.pieces.length;
  if (!allPiecesConnected) error('piece-disconnected', def.id, '裁片关系图存在孤立裁片');
  def.unresolved.forEach((message, i) => wait('method-pending', `${def.id}/${i + 1}`, message));
  return { templateId: def.id, engine: def.engine, version: def.version, revision: def.revision,
    status: errors.length ? 'blocked' : pending.length ? 'incomplete' : 'verified', integrityPass: errors.length === 0,
    pieces: def.pieces.flatMap(d => { const p = pieceMap.get(d.id); return p ? [{ id: p.id, name: p.name, quantity: p.quantity, onFold: p.onFold, materials: structuredClone(p.materials), source: d.source, ...(d.primaryMaterial?{primaryMaterial:d.primaryMaterial}:{}) }] : []; }),
    boundaries, joins, coverage: { totalEdges, classifiedEdges, allPiecesConnected }, errors, pending, productionApproved: false };
}

export class AssemblyError extends Error {
  constructor(public readonly report: AssemblyReport) {
    super(`裁片装配约束未通过：${report.errors.map(e => `${e.subject} ${e.message}`).join('；')}`);
    this.name = 'AssemblyError';
  }
}
