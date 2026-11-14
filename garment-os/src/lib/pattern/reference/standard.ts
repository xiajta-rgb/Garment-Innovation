import { referenceChestEase } from '@/data/referenceFit';
import { Teagan } from '@freesewing/teagan';
import { Sven } from '@freesewing/sven';
import { Simon } from '@freesewing/simon';
import { Aaron } from '@freesewing/aaron';
import { Huey } from '@freesewing/huey';
import { Sandy } from '@freesewing/sandy';
import {Paco} from '@freesewing/paco';
import {PANTS_PATTERN_ID,PANTS_MEASUREMENT_FIELDS,PANTS_PARAMETERS} from '@/data/foundationMethods';
import {auditPantsConstruction} from '../assembly/pants-construction';
import { Path as SourcePath } from '@freesewing/core';
import type { BodyMeasurements } from '@/types/measurements';
import type { PatternPath } from '@/types/pattern';
import { requireReviewedPattern, type ReferenceEngine } from '@/data/patternReview';
import { referenceMeasurementSettings } from './measurements';
import { flattenSvgPathD } from '../geometry';
import { referenceMarker } from './symbols';
import { captureAssemblyPiece } from '../assembly/source';
import type { AssemblyPiece } from '@/types/assembly';
import type { AssemblyReport } from '@/types/assembly';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { AssemblyError, validateAssembly } from '../assembly/validate';
import type { ConstructionSelection } from '@/types/construction';
import { constructionOptions } from '../construction-selection';
import { auditConstruction } from '../assembly/construction';
import { requireSourcePieceRole } from '@/data/pieceRoleBindings';
import { PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';
import { auditKnitConstruction } from '../assembly/knit-construction';
import { SKIRT_DEFAULTS,SKIRT_MEASUREMENT_FIELDS } from '@/data/skirtMethods';
import { auditSkirtConstruction } from '../assembly/skirt-construction';

export const STANDARD_VERSION = '4.10.2';
type Point = { x: number; y: number };
interface Path { asPathstring(): string; length(): number; hidden?: boolean; attributes?: { list?: Record<string, string[]> }; ops: Array<{ type: string; to?: Point; cp1?: Point; cp2?: Point }> }
interface Part { hidden: boolean; points: Record<string, Point>; paths: Record<string, Path>; snippets: Record<string, { anchor: Point; def: string }> }
export interface StandardPiece {
  id: string; name: string; category: string; view: 'front' | 'back' | 'all';
  netPathD: string; cutPaths: Record<string, string>; grainPaths: Record<string, string>;
  points: Record<string, Point>; paths: PatternPath[]; cutInstructions: Record<string, unknown>;
  qty: number | null; onFold: boolean; checks: Array<{ id: string; pass: boolean; detail: string }>;
  sourcePaths: Record<string, { data: string; hidden: boolean; classes: string[] }>;
  markings: Record<string, { kind: string; x: number; y: number }>;
  edges: Array<{ index: number; kind: string; from: Point; to: Point; cp1?: Point; cp2?: Point; lengthMm: number }>;
}
export interface StandardDraft {
  engine: ReferenceEngine; version: string; settings: { measurements: Record<string, number>; options: Record<string, number | boolean | string>; sa: number };
  pieces: StandardPiece[]; assemblyPieces: AssemblyPiece[]; assembly: AssemblyReport; geometryPass: boolean; productionApproved: false;
  checks: Array<{ id: string; valueMm: number; toleranceMm: number; pass: boolean }>;
}
const roles: Record<string, [string, 'front' | 'back' | 'all', string]> = {
  'paco.front':['trouser','front','前裤片'],'paco.back':['trouser','back','后裤片'],'paco.waistband':['waistband','all','连裁松紧腰头'],
  'sandy.skirt':['skirt','all','对折圆弧裙幅'],'sandy.waistband':['waistband','all','连裁折腰'],
  front: ['body', 'front', '前衣身'], back: ['body', 'back', '后衣身'], sleeve: ['sleeve', 'all', '袖片'],
  frontLeft: ['body', 'front', '左前身'], frontRight: ['body', 'front', '右前身'], yoke: ['yoke', 'back', '过肩'],
  collar: ['collar', 'all', '领面'], collarStand: ['collar', 'all', '领座'], cuff: ['cuff', 'all', '袖口'],
  sleevePlacketOverlap: ['placket', 'all', '袖衩外搭片'], sleevePlacketUnderlap: ['placket', 'all', '袖衩内搭片'],
  armBinding:['binding','all','袖窿四折包条'],neckBinding:['binding','all','领口四折包条'],
  hood:['hood','all','双层帽侧片'],pocket:['pocket','front','前半贴袋'],waistband:['hem-band','all','罗纹下摆接条'],
};

export function standardSettings(patternId: string, m: BodyMeasurements, fit: 'slim' | 'regular' | 'loose' = 'regular', construction?: ConstructionSelection):StandardDraft['settings']&{expand?:boolean} {
  const review = requireReviewedPattern(patternId);
  if (review.engine === 'brian') throw new Error('Brian 使用其独立完整适配器');
  if (!['slim', 'regular', 'loose'].includes(fit)) throw new Error('不支持的松量方案');
  if(patternId===PANTS_PATTERN_ID){
    for(const f of PANTS_MEASUREMENT_FIELDS){const v=m[f.id];if(typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max)throw Error(`缺少或无效的裤装测量：${f.label}`);}
    if(m.waistBack!>=m.waist||m.seatBack!>=m.seat!||m.crossSeamFront!>=m.crossSeam!||m.hipDepth>=m.waistToSeat!||m.waistToSeat!>=m.waistToUpperLeg!||m.waistToUpperLeg!>=m.waistToKnee!||m.waistToKnee!>=m.waistToFloor!)throw Error('裤装弧长或纵向测量次序不成立；不能用半围或常数替代');
    return {measurements:Object.fromEntries(PANTS_MEASUREMENT_FIELDS.map(f=>[f.native,m[f.id]!])),options:{...review.options,...Object.fromEntries(PANTS_PARAMETERS.map(p=>[p.key,p.defaultValue])),...constructionOptions(patternId,construction)},sa:10,expand:true};
  }
  if(review.engine==='sandy'){
    for(const f of SKIRT_MEASUREMENT_FIELDS){const v=m[f.id];if(typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max)throw new Error(`缺少或无效的裙装输入：${f.label}，范围 ${f.min}–${f.max} mm`);}
    const options={...review.options,...SKIRT_DEFAULTS,...constructionOptions(patternId,construction)};
    if(m.hip<m.waist)throw new Error('当前自然腰位裙装要求臀围不小于腰围，其他体型需独立方法');
    if(m.skirtLength!>m.waistToFloor!||m.skirtLength!<m.waistToFloor!*.1)throw new Error('成品裙长须为腰到地长度的10%–100%，禁止静默截断');
    return {measurements:{waist:m.waist,hips:m.hip,waistToHips:m.hipDepth,waistToFloor:m.waistToFloor!},
      options:{...options,lengthBonus:m.skirtLength!/m.waistToFloor!},sa:10,expand:true};
  }
  const base = referenceMeasurementSettings(m);
  const measurements = { ...base.measurements, waist: m.waist, hips: m.hip, ...(review.engine==='huey'?{head:m.headCirc}: {}) };
  if(review.engine==='huey'&&(!Number.isFinite(m.headCirc)||Number(m.headCirc)<=0))throw new Error('连帽模板缺少或无效的头围实测值');
  if (![m.waist, m.hip].every(v => Number.isFinite(v) && v > 0)) throw new Error('缺少腰围或臀围，不能用胸围猜测');
  const chestEase = referenceChestEase(patternId,fit);
  const lengthBonus = base.lengthBonus;
  const minimum = review.engine === 'sven' ? 0 : ['teagan','aaron'].includes(review.engine) ? -.2 : -.04;
  const maximum = review.engine === 'sven' ? .3 : .6;
  if (lengthBonus < minimum - 1e-10 || lengthBonus > maximum + 1e-10) throw new Error(`衣长超出 ${review.engine} 已声明范围，禁止静默截断`);
  if (m.shoulderWidth / 2 >= m.bust * (1 + chestEase) / 4) throw new Error('肩宽越过当前松量方案的侧胸宽');
  return { measurements, options: { ...review.options, chestEase, lengthBonus, ...constructionOptions(patternId, construction) }, sa: 10, ...(['aaron','huey'].includes(review.engine)?{expand:true}:{}) };
}

const cache = new Map<string, StandardDraft>();
export function draftStandard(patternId: string, m: BodyMeasurements, fit: 'slim' | 'regular' | 'loose' = 'regular', construction?: ConstructionSelection): StandardDraft {
  const review = requireReviewedPattern(patternId);
  if (review.engine === 'brian') throw new Error('Brian 使用独立适配器');
  const settings = standardSettings(patternId, m, fit, construction);
  const cacheKey = JSON.stringify([patternId, settings]);
  if (cache.has(cacheKey)) return structuredClone(cache.get(cacheKey)!);
  const Design = { teagan: Teagan, sven: Sven, simon: Simon,aaron:Aaron,huey:Huey,sandy:Sandy,paco:Paco }[review.engine];
  const pattern = new Design(settings);
  pattern.draft();
  const resolvedOptions = pattern.settings[0].options;
  const rawParts = pattern.parts[0] as Record<string, Part>;
  // Match the actual upstream sleeve-fitting target. The 2 mm limit is the library's iteration stop,
  // not a factory acceptance tolerance (library/src/sleeve/index.mjs).
  const cap = Number(pattern.setStores[0].get('library.sleeve.sleevecapLength'));
  const target = Number(pattern.setStores[0].get('library.sleeve.sleevecapTarget'));
  const checks = ['aaron','sandy','paco'].includes(review.engine)?[]:[{ id: 'upstream-sleevecap-fit', valueMm: Math.abs(cap-target), toleranceMm: 2 }];
  if (review.engine === 'simon') {
    const c = rawParts['simon.collar'].points, s = rawParts['simon.collarStand'].points;
    const collarLength = new SourcePath().move(c.leftBottomEdge).curve(c.leftBottomEdge, c.bottomMidCp2, c.bottomMid).length() * 2;
    const standLength = new SourcePath().move(s.leftBottomCf).curve(s.leftBottomCfCp2, s.leftBottomHingeCp1, s.leftBottomHinge).curve(s.leftBottomHingeCp2, s.bottomMidCp1, s.bottomMid).length() * 2;
    checks.push({ id: 'collar-length-target', valueMm: Math.abs(collarLength - m.neckCirc*(1+Number(resolvedOptions.collarEase)-Number(resolvedOptions.collarGap))), toleranceMm: 1 },
      { id: 'collarstand-length-target', valueMm: Math.abs(standLength - m.neckCirc*(1+Number(resolvedOptions.collarEase))), toleranceMm: 1 });
  }
  const fitChecks = checks.map(c => ({ ...c, pass: Number.isFinite(c.valueMm) && c.valueMm <= c.toleranceMm }));
  if (fitChecks.some(c => !c.pass)) throw new Error(`走缝约束未收敛：${fitChecks.filter(c => !c.pass).map(c => `${c.id}=${c.valueMm.toFixed(3)}mm`).join('、')}`);
  const cutlist = pattern.setStores[0].get('cutlist', {}) as Record<string, Record<string, unknown>>;
  const pieces: StandardPiece[] = [];
  const assemblyPieces: AssemblyPiece[] = [];
  let layoutX = 0;
  for (const [id, part] of Object.entries(pattern.parts[0]) as Array<[string, Part]>) {
    if (part.hidden || !part.paths.seam) continue;
    // Huey 4.10.2 pocket=false returns inherited front geometry without hiding it.
    // The explicit source option removes this inactive component; never emit that inherited body as a pocket.
    if(review.engine==='huey'&&id==='huey.pocket'&&resolvedOptions.pocket===false)continue;
    if (!id.startsWith(`${review.engine}.`)) throw new Error(`出现未声明裁片：${id}`);
    const role = roles[id]??roles[id.split('.')[1]];
    if (!role) throw new Error(`裁片缺少角色定义：${id}`);
    const [category, view, roleName] = role;
    const name=review.engine==='huey'&&id.endsWith('.cuff')?'罗纹袖口':roleName;
    const binding = requireSourcePieceRole(id);
    if(binding.definition.family!==category)throw new Error(`源裁片大类与角色不一致：${id}`);
    const netPathD = part.paths.seam.asPathstring();
    const edges: StandardPiece['edges'] = [];
    let from: Point | undefined, origin: Point | undefined;
    const point = (p: Point) => ({ x: p.x, y: p.y });
    for (const op of part.paths.seam.ops as Array<{ type: string; to?: Point; cp1?: Point; cp2?: Point }>) {
      if (op.type === 'move') { origin = from = op.to; continue; }
      const to = op.type === 'close' ? origin : op.to;
      if (!from || !to) throw new Error('轮廓段缺少端点');
      const edge = new SourcePath().move(from);
      if (op.type === 'curve' && op.cp1 && op.cp2) edge.curve(op.cp1, op.cp2, to);
      else if (op.type === 'line' || op.type === 'close') edge.line(to);
      else throw new Error(`未声明的上游轮廓操作 ${op.type}`);
      edges.push({ index: edges.length + 1, kind: op.type, from: point(from), to: point(to), cp1: op.cp1 ? point(op.cp1) : undefined, cp2: op.cp2 ? point(op.cp2) : undefined, lengthMm: edge.length() });
      from = to;
    }
    const cutPaths: Record<string, string> = {}, grainPaths: Record<string, string> = {};
    const sourcePaths: StandardPiece['sourcePaths'] = {};
    for (const [key, path] of Object.entries(part.paths)) {
      sourcePaths[key] = { data: path.asPathstring(), hidden: !!path.hidden, classes: path.attributes?.list?.class ?? [] };
      if (path.hidden) continue;
      const classes = (path.attributes?.list?.class ?? []).join(' ');
      if (classes.split(/\s+/).includes('sa') && (classes.includes('fabric')||(binding.material==='ribbing'&&classes.includes('various')))) cutPaths[key] = path.asPathstring();
      if ((key.includes('grainline') || key.includes('cutonfold')) && key.endsWith('_line')) grainPaths[key] = path.asPathstring();
    }
    // Aaron's four-fold strips are authored as final cutting rectangles. No invented offset or extra SA.
    if(binding.cutMode==='source-net-as-cut')cutPaths.seam=netPathD;
    const points = Object.fromEntries(Object.entries(part.points).filter(([key]) => !key.startsWith('_')).map(([key, p]) => [key, { x: p.x, y: p.y }]));
    const cutInstructions = cutlist[id] ?? {};
    const fabric = (cutInstructions.materials as Record<string, Array<{ cut: number; onFold: boolean }>> | undefined)?.[binding.material];
    const qty = fabric?.reduce((sum, instruction) => sum + instruction.cut, 0) ?? null;
    // Inherited annotation metadata is not a cutting instruction (Simon full yoke).
    const onFold = !!fabric?.some(item => item.onFold);
    assemblyPieces.push(captureAssemblyPiece(part, { id, name, engine: review.engine, version: STANDARD_VERSION,...(binding.material!=='fabric'?{primaryMaterial:binding.material}:{}) }, cutInstructions,
      review.engine==='huey'&&id==='huey.front'&&resolvedOptions.pocket?['pocket']:[]));
    const samples = flattenSvgPathD(netPathD, 64);
    const netClosed = samples.length > 2 && Math.hypot(samples[0].x - samples.at(-1)!.x, samples[0].y - samples.at(-1)!.y) < .001;
    const valid = Object.values(points).every(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      && [netPathD, ...Object.values(cutPaths)].every(d => !/NaN|Infinity|undefined/.test(d));
    const checks = [{ id: 'net-closed', pass: netClosed, detail: '净样连续闭合' },
      { id: 'finite-geometry', pass: valid, detail: '坐标有效' },
      { id: 'upstream-cut-paths', pass: Object.keys(cutPaths).length > 0, detail: '保留全部上游缝份分路径，未重画' }];
    const xs = samples.map(p => p.x), ys = samples.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX;
    const transform = `translate(${layoutX-minX},${-minY})`;
    layoutX += width + 100;
    const base: Omit<PatternPath, 'id' | 'data'> = { category, view, pieceId: id, pieceName: name,
      pieceRole:binding.role,materialRole:binding.material,taxonomyVersion:PIECE_TAXONOMY_VERSION,
      cutQty: qty, cutOnFold: onFold, referenceVersion: STANDARD_VERSION, referenceEngine: review.engine,
      referenceCutMode:binding.cutMode??'source-sa',
      referenceExpectedCutCount: Object.keys(cutPaths).length, transform, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 1 };
    const paths: PatternPath[] = [{ ...base, id: `${id}:seam`, data: netPathD, layer: 'seam-line' },
      ...Object.entries(cutPaths).map(([key, data]) => ({ ...base, id: key==='seam'?`${id}:${key}:cut`:`${id}:${key}`, data, layer: 'cutting-line' as const })),
      ...Object.entries(grainPaths).map(([key, data]) => ({ ...base, id: `${id}:${key}`, data, layer: 'grain-line' as const,
        markerStart: referenceMarker(part.paths[key].attributes?.list?.['marker-start']), markerEnd: referenceMarker(part.paths[key].attributes?.list?.['marker-end']) }))];
    for (const [key, path] of Object.entries(part.paths)) {
      if (path.hidden) continue;
      if (/fold|pleat/i.test(key) && !/cutonfold|banner/i.test(key)) paths.push({ ...base, id: `${id}:${key}`, data: path.asPathstring(), layer: 'fold-line' });
      else if (key === 'dart') paths.push({ ...base, id: `${id}:${key}`, data: path.asPathstring(), layer: 'dart' });
      else if (key === 'placketCut'||(review.engine==='huey'&&key==='pocket')) paths.push({ ...base, id: `${id}:${key}`, data: path.asPathstring(), layer: 'detail' });
      else if (key === 'underCollar' || key === 'saUndercollar') paths.push({ ...base, id: `${id}:${key}`, data: path.asPathstring(), layer: 'detail', strokeDasharray: '3 3' });
    }
    // Snippet anchors are upstream positions; symbol strokes are display marks, not new cut geometry.
    const markings: StandardPiece['markings'] = {};
    for (const [key, snippet] of Object.entries(part.snippets)) {
      if (!snippet.anchor || !/notch|button/.test(snippet.def)) continue;
      const p = snippet.anchor;
      markings[key] = { kind: snippet.def, x: p.x, y: p.y };
      paths.push({ ...base, id: `${id}:mark:${key}`, data: `M${p.x-2} ${p.y}L${p.x+2} ${p.y}`, layer: /notch/.test(snippet.def) ? 'notch' : 'detail' });
    }
    pieces.push({ id, name, category, view, netPathD, cutPaths, grainPaths, points, paths, cutInstructions, qty, onFold, checks, sourcePaths, markings, edges });
  }
  const failures = pieces.flatMap(p => p.checks.filter(c => !c.pass).map(c => `${p.id}/${c.id}`));
  if (!pieces.length || failures.length) throw new Error(`上游裁片检查失败，已停止生成：${failures.join('、')}`);
  const assembly = validateAssembly(getAssemblyDefinition(patternId, construction), assemblyPieces);
  if (!assembly.integrityPass) throw new AssemblyError(assembly);
  assembly.construction = review.engine==='paco'?auditPantsConstruction(m,resolvedOptions,pieces,construction,pattern.settings[0].absoluteOptions):review.engine==='sandy'?auditSkirtConstruction(m,resolvedOptions,pieces,assembly,construction,pattern.settings[0].absoluteOptions):['aaron','huey'].includes(review.engine)?auditKnitConstruction(patternId,m,resolvedOptions,pieces,assembly,construction):auditConstruction(patternId, m, resolvedOptions, pieces, assembly, construction);
  const result: StandardDraft = { engine: review.engine, version: STANDARD_VERSION, settings, pieces, assemblyPieces, assembly, geometryPass: true, productionApproved: false, checks: fitChecks };
  if (cache.size >= 16) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, result);
  return structuredClone(result);
}
