/**
 * ─────────────────────────────────────────────────────────────
 *  裁片标准化注册与检验 (Piece Registry & QC)
 * ─────────────────────────────────────────────────────────────
 *
 *  把版型解算输出的 paths 按裁片分组, 每片独立执行 CAD 检验:
 *  只有全部检验通过的裁片才允许映射到画布 (QC 门禁)。
 *
 *  裁片键 = `${category}:${view}` — 与渲染过滤一致。
 */

import type { PatternPath } from '@/types/pattern';
import { classificationError, tagsForPath } from './piece-tags';
import { flattenSvgPathD } from './geometry';
import type { PieceFamilyId } from '@/types/piece-taxonomy';
import { PIECE_FAMILIES } from '@/data/pieceTaxonomy';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';

// ════════════════════════════════════════════════════════════
// SVG path 精确展平 (M/L/C/Z) — bbox 测量用真实曲线采样,
// 不受贝塞尔控制点越界影响 (控制点不代表曲线实际位置)
// ════════════════════════════════════════════════════════════

/** 委托 geometry 的精确展平 (真实曲线采样) */
function flattenSvgPath(d: string, samplesPerCubic = 24): Array<{ x: number; y: number }> {
  return flattenSvgPathD(d, samplesPerCubic);
}

// ════════════════════════════════════════════════════════════
// 类型
// ════════════════════════════════════════════════════════════

export type PieceCategory = PieceFamilyId | 'unknown';

export interface PieceCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
  level?: 'error' | 'warning';
}

export interface PieceRecord {
  key: string;
  category: PieceCategory;
  view: 'front' | 'back' | 'all';
  /** 裁片中文名 */
  name: string;
  /** 标签 (大类/层级/裁剪方式, 自动派生) */
  tags: string[];
  /** 该片全部路径 (按 layer) */
  paths: PatternPath[];
  /** CAD 检验结果 */
  checks: PieceCheck[];
  /** 是否全部通过 */
  pass: boolean;
  /** 尺寸 (mm) */
  bbox: { width: number; height: number };
}

/** 裁片键 */
export function pieceKeyFor(category: string | undefined, view: string | undefined, pieceId?: string): string {
  if (pieceId) return pieceId;
  return `${category ?? 'unknown'}:${view ?? 'all'}`;
}

const PIECE_NAMES: Record<string, string> = {
  'body:front': '前衣身', 'body:back': '后衣身',
  'sleeve:all': '袖片', 'sleeve:front': '袖片 (前视图)', 'sleeve:back': '袖片 (后视图)',
  'collar:all': '立领', 'placket:all': '门襟', 'cuff:all': '袖口', 'pocket:all': '贴袋',
};

// ════════════════════════════════════════════════════════════
// 分组
// ════════════════════════════════════════════════════════════

const PIECE_ORDER: PieceCategory[] = [...PIECE_FAMILIES.map(f=>f.id),'unknown'];
const VIEW_ORDER = ['front', 'back', 'all'];

/** 解算结果 → 裁片记录列表 (稳定排序) */
export function groupSolutionPieces(paths: PatternPath[]): PieceRecord[] {
  const byKey = new Map<string, PatternPath[]>();
  for (const p of paths) {
    if (!p?.data) continue;
    const key = pieceKeyFor(p.category, p.view, p.pieceId);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }

  const records: PieceRecord[] = [];
  for (const [key, piecePaths] of byKey) {
    const category:PieceCategory = PIECE_FAMILIES.some(f=>f.id===piecePaths[0].category)?piecePaths[0].category as PieceFamilyId:'unknown';
    const view = piecePaths[0].view ?? 'all';
    records.push({
      key,
      category,
      view,
      name: piecePaths[0].pieceName ?? PIECE_NAMES[key] ?? key,
      tags: tagsForPath(piecePaths[0]),
      paths: piecePaths,
      checks: [],
      pass: false,
      bbox: measurePieceBbox(piecePaths),
    });
  }
  records.sort((a, b) => {
    const dCat = PIECE_ORDER.indexOf(a.category) - PIECE_ORDER.indexOf(b.category);
    if (dCat !== 0) return dCat;
    return VIEW_ORDER.indexOf(a.view) - VIEW_ORDER.indexOf(b.view);
  });
  return records;
}

/** 裁片 bbox (真实曲线采样 + transform 平移, mm) */
export function measurePieceBbox(paths: PatternPath[]): { width: number; height: number } {
  const b = measurePieceBboxFull(paths);
  if (b.minX === Infinity) return { width: 0, height: 0 };
  return { width: b.maxX - b.minX, height: b.maxY - b.minY };
}

/** 裁片 bbox 完整值 (真实曲线采样, 预览定位用) */
export function measurePieceBboxFull(paths: PatternPath[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    let tx = 0, ty = 0;
    const tr = /translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/.exec(p.transform ?? '');
    if (tr) { tx = Number(tr[1]); ty = Number(tr[2]); }
    for (const pt of flattenSvgPath(p.data)) {
      const x = pt.x + tx, y = pt.y + ty;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

// ════════════════════════════════════════════════════════════
// 逐件 CAD 检验
// ════════════════════════════════════════════════════════════

/**
 * Reference preview checks: layers, net closure, finite extents/coordinates,
 * source direction marks, declared SA segment count and sourced cut quantity.
 * These checks do not validate SA offset distance, topology or manufacturing readiness.
 */
export function validatePiece(piece: PieceRecord, seamAllowanceMm = 10): PieceRecord {
  const { paths } = piece;
  const net = paths.find(p => p.layer === 'seam-line');
  const cuts = paths.filter(p => p.layer === 'cutting-line');
  const reference = !!net?.referenceEngine;
  const netPoints = net ? flattenSvgPath(net.data) : [];
  const closed = netPoints.length > 2 && Math.hypot(netPoints[0].x - netPoints.at(-1)!.x, netPoints[0].y - netPoints.at(-1)!.y) < .02;
  const hasGrain = paths.some(p => p.layer === 'grain-line');
  const binding = Object.hasOwn(SOURCE_PIECE_ROLES,piece.key)?SOURCE_PIECE_ROLES[piece.key]:undefined;
  const checks: PieceCheck[] = [
    { id: 'C1-layers', label: '净样与源裁边', pass: !!net && cuts.length > 0 },
    { id: 'C2-closed', label: '净样连续闭合', pass: closed },
    { id: 'C3-mm-scale', label: '毫米几何范围有效', pass: Math.min(piece.bbox.width, piece.bbox.height) > 0, detail: `${piece.bbox.width.toFixed(2)} × ${piece.bbox.height.toFixed(2)} mm` },
    { id: 'C4-no-nan', label: '坐标有效', pass: paths.every(p => /^M/i.test(p.data) && !/NaN|Infinity|undefined/.test(p.data)) },
    { id: 'C5-grain', label: '布纹 / 对折方向', pass: hasGrain, level: reference ? 'warning' : 'error', detail: hasGrain ? '上游方向标记' : '上游未定义：预览保留，生产交付待补；未自行补画' },
    { id: 'C6-seam', label: net?.referenceCutMode==='source-net-as-cut'?'源包条裁边（不另加缝份）':`上游缝份分段保留（基准 ${seamAllowanceMm} mm）`, pass: reference && cuts.length === net?.referenceExpectedCutCount&&(net?.referenceCutMode!=='source-net-as-cut'||(cuts.length===1&&cuts[0].data===net.data)), detail: net?.referenceCutMode==='source-net-as-cut'?'包条直接保留源展开裁边，四折线不是对折下料；端头闭合工艺待核验':'按上游构型保存全部分段；外包框不能证明缝份距离或排料合格' },
    { id: 'C7-size', label: '裁剪数量有来源', pass: reference && Number.isInteger(net?.cutQty) && Number(net?.cutQty) > 0, detail: net?.cutQty == null ? '缺数量定义' : `裁 ${net.cutQty} 片${net.cutOnFold ? '，对折' : ''}` },
    { id: 'C10-cut-method', label: '对折裁法明确声明', pass: reference && typeof net?.cutOnFold==='boolean', detail: typeof net?.cutOnFold==='boolean'?'保留源裁法；不由数量推断镜像或对折':'裁法未声明，不能按部位猜测' },
    { id: 'C11-source-role', label: '精确源身份与分类绑定', pass: !!binding&&binding.role===net?.pieceRole&&binding.material===net?.materialRole&&(binding.cutMode??'source-sa')===(net?.referenceCutMode??'source-sa')&&paths.every(p=>p.pieceId===piece.key), detail: '只接受登记的源身份与角色材料组合，禁止按名称或相似轮廓猜测' },
    { id:'C9-taxonomy',label:'裁片分类与材料层一致',pass:!!net&&paths.every(p=>!classificationError(p)&&p.category===net.category&&p.pieceRole===net.pieceRole&&p.materialRole===net.materialRole&&p.taxonomyVersion===net.taxonomyVersion&&p.cutQty===net.cutQty&&p.cutOnFold===net.cutOnFold&&p.referenceCutMode===net.referenceCutMode),detail:net?classificationError(net)??'全部路径共用明确的角色、材料层、数量和裁法':'缺少净样' },
  ];
  return { ...piece, checks, pass: checks.every(c => c.pass || c.level === 'warning') };
}

/** 全量检验 */
export function validateAllPieces(pieces: PieceRecord[], seamAllowanceMm = 10): PieceRecord[] {
  return pieces.map((p) => validatePiece(p, seamAllowanceMm));
}





