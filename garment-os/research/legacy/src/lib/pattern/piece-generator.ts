/**
 * ─────────────────────────────────────────────────────────────
 *  裁片生成器 (Piece Generator)
 * ─────────────────────────────────────────────────────────────
 *
 *  标准化的核心承诺: 关键数据 (人体测量值) → 确定性生成全套裁片。
 *  同一份关键数据永远产出同一套裁片; 关键数据变化 → 裁片尺寸
 *  以可追溯的方式变化 (每片暴露 keyDims 特征尺寸表)。
 *
 *  推档 (Grading): 按标准尺码表批量生成 XS~XXXL 全尺码裁片,
 *  输出分尺码尺寸表 + 总用料 — 工业放码的数字化形态。
 */

import type { BodyMeasurements, StandardSize } from '@/types/measurements';
import type { GenderType } from '@/types/gene';
import { getMeasurementsBySize } from '@/data/sizeCharts';
import {
  draftBodice, draftSleeve, draftMandarinCollar, draftPlacket, draftCuff, draftPatchPocket,
  segmentedGrossArea, contourLength, INDUSTRIAL_WIDTHS, type DraftOptions, type Pt,
} from './drafting';
import type { DraftEdge } from './drafting';

/** 边链实测长度 */
function chainLength(e: DraftEdge): number {
  return contourLength({ start: e.start, segs: e.segs, closed: false });
}

/** 由边链与标签生成完整尺寸规格表 */
function buildDimensions(edges: DraftEdge[], labels: string[]): Array<DimensionRow> {
  return edges.map((e, i) => {
    const pts = [e.start, ...e.segs.map((s) => s.to)];
    const from = pts[0];
    const to = pts[pts.length - 1];
    return {
      label: labels[i] ?? `边 ${i + 1}`,
      role: e.role,
      lengthMm: Math.round(chainLength(e) * 10) / 10,
      from: { x: Math.round(from.x * 10) / 10, y: Math.round(from.y * 10) / 10 },
      to: { x: Math.round(to.x * 10) / 10, y: Math.round(to.y * 10) / 10 },
    };
  });
}

/** 关键点坐标表 */
function buildPoints(points: Record<string, Pt>, labels: Record<string, string>): PointRow[] {
  return Object.entries(labels).map(([k, label]) => {
    const p = points[k];
    return { label, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
  });
}
import { estimateFabricUsage } from '@/lib/bom-engine/fabric-usage';
import { deriveTagsFor } from './piece-tags';

// ════════════════════════════════════════════════════════════
// 关键数据定义 (单一可信源)
// ════════════════════════════════════════════════════════════

export interface KeyField {
  id: keyof BodyMeasurements;
  label: string;
  min: number;
  max: number;
  /** 该数据驱动的裁片 */
  affects: string[];
}

/** 制版关键数据 (控制全部裁片尺寸的输入变量) */
export const KEY_FIELDS: KeyField[] = [
  { id: 'bust',          label: '胸围',   min: 600, max: 1400, affects: ['前衣身', '后衣身', '袖片'] },
  { id: 'waist',         label: '腰围',   min: 500, max: 1300, affects: ['前衣身', '后衣身'] },
  { id: 'hip',           label: '臀围',   min: 600, max: 1400, affects: ['前衣身', '后衣身'] },
  { id: 'shoulderWidth', label: '总肩宽', min: 300, max: 550,  affects: ['前衣身', '后衣身'] },
  { id: 'neckCirc',      label: '颈围',   min: 250, max: 500,  affects: ['前衣身', '后衣身', '立领'] },
  { id: 'acrossBack',    label: '后背宽', min: 250, max: 480,  affects: ['后衣身'] },
  { id: 'acrossFront',   label: '前胸宽', min: 250, max: 460,  affects: ['前衣身'] },
  { id: 'backLength',    label: '背长',   min: 280, max: 520,  affects: ['后衣身'] },
  { id: 'frontLength',   label: '前腰节', min: 280, max: 540,  affects: ['前衣身'] },
  { id: 'totalLength',   label: '衣长',   min: 400, max: 850,  affects: ['前衣身', '后衣身'] },
  { id: 'sleeveLength',  label: '袖长',   min: 150, max: 700,  affects: ['袖片'] },
  { id: 'bicep',         label: '上臂围', min: 180, max: 450,  affects: ['袖片'] },
  { id: 'wristCirc',     label: '腕围',   min: 120, max: 240,  affects: ['袖片', '袖口'] },
];

export interface GeneratorOptions extends Partial<Pick<DraftOptions, 'fit' | 'sleeveLengthMm' | 'sleeveEaseMm'>> {
  gender?: GenderType;
  seamAllowanceMm?: number;
}

export interface DimensionRow {
  /** 边名称 (完整定位: 每条边独立命名) */
  label: string;
  role: string;
  /** 净样边长 (mm) */
  lengthMm: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface PointRow {
  label: string;
  x: number;
  y: number;
}

export interface GeneratedPiece {
  id: string;
  name: string;
  /** 裁片数量 (对称片 ×2 等) */
  qty: number;
  kind: 'front' | 'back' | 'sleeve' | 'collar' | 'placket' | 'cuff' | 'pocket';
  /** 标签 (大类/层级/裁剪方式, 自动派生) */
  tags: string[];
  /** 特征尺寸表 (关键数据 → 该片尺寸的追溯) */
  keyDims: Array<{ label: string; value: number }>;
  /** 完整边长规格表 (每条边独立命名+实测长度 — 裁片尺寸完全定位) */
  dimensions: DimensionRow[];
  /** 关键点坐标表 (裁片坐标系, mm) */
  points: PointRow[];
  /** 毛样面积 mm² (分段缝份) */
  grossAreaMm2: number;
  /** 渲染输入 (供 UI 绘制) */
  edges: DraftEdge[];
  netPathD?: string;
}

export interface GenerationResult {
  /** 输入关键数据快照 */
  keyData: BodyMeasurements;
  gender: GenderType;
  fit: string;
  pieces: GeneratedPiece[];
  /** 主料用量估算 (门幅 1500 · 利用率 0.85 · 损耗 3%) */
  fabricUsage: { lengthM: number; totalPieceAreaMm2: number };
}

// ════════════════════════════════════════════════════════════
// 核心: 关键数据 → 全套裁片
// ════════════════════════════════════════════════════════════

/** 生成全套裁片 (纯函数, 确定性) */
export function generatePieces(
  keyData: BodyMeasurements,
  opts: GeneratorOptions = {},
): GenerationResult {
  const gender = opts.gender ?? 'male';
  const fit = opts.fit ?? 'regular';
  const draftOpts: DraftOptions = {
    fit: fit as DraftOptions['fit'],
    seamAllowanceMm: opts.seamAllowanceMm ?? 10,
    sleeveLengthMm: opts.sleeveLengthMm,
    sleeveEaseMm: opts.sleeveEaseMm,
  };
  const widths = { ...INDUSTRIAL_WIDTHS, seam: draftOpts.seamAllowanceMm ?? 10 };

  const front = draftBodice(keyData, gender, 'front', draftOpts);
  const back = draftBodice(keyData, gender, 'back', draftOpts);
  const sleeve = draftSleeve(keyData, gender, front.armholeLength, back.armholeLength, draftOpts);
  const collar = draftMandarinCollar(
    [...back.necklinePoints, ...front.necklinePoints.slice(1).reverse()],
    30,
  );
  const placket = draftPlacket(20, Math.max(300, front.hemY - front.points.snSide.y - 60));
  const cuff = draftCuff(keyData.wristCirc + 40 + (gender === 'male' ? 10 : 0), 45);
  const pocket = draftPatchPocket(120, 140);

  const r1 = (v: number) => Math.round(v * 10) / 10;

  const pieces: GeneratedPiece[] = [
    {
      id: 'front-body', name: '前衣身', qty: 1, kind: 'front', tags: deriveTagsFor('front', 1),
      keyDims: [
        { label: '衣长 (颈点→下摆)', value: r1(front.hemY) },
        { label: '袖窿深', value: r1(front.scyeDepth) },
        { label: '半胸围线宽', value: r1(front.halfBustWidth) },
        { label: '领口弧长', value: r1(front.necklineLength) },
        { label: '腰线高', value: r1(front.waistY) },
        { label: '侧缝长', value: r1(front.sideSeamLength) },
      ],
      grossAreaMm2: segmentedGrossArea(front.edges, widths),
      edges: front.edges,
      dimensions: buildDimensions(front.edges, ['前领口弧线', '肩线', '袖窿弧线', '侧缝线', '下摆边', '中线 (对折)']),
      points: buildPoints(front.points as any, {
        cbNeck: '前领口深点 (折线)', snSide: '侧颈点', shoulder: '肩点', acrossX: '前胸宽点',
        armhole: '袖窿底', waistSide: '侧腰点', hemSide: '侧下摆点', hemCenter: '下摆中点',
      }),
    },
    {
      id: 'back-body', name: '后衣身', qty: 1, kind: 'back', tags: deriveTagsFor('back', 1),
      keyDims: [
        { label: '衣长 (颈点→下摆)', value: r1(back.hemY) },
        { label: '袖窿深', value: r1(back.scyeDepth) },
        { label: '半胸围线宽', value: r1(back.halfBustWidth) },
        { label: '领口弧长', value: r1(back.necklineLength) },
        { label: '背宽标记', value: r1(back.points.acrossX.x) },
      ],
      grossAreaMm2: segmentedGrossArea(back.edges, widths),
      edges: back.edges,
      dimensions: buildDimensions(back.edges, ['后领口弧线', '肩线', '后袖窿弧线', '侧缝线', '下摆边', '中线 (对折)']),
      points: buildPoints(back.points as any, {
        cbNeck: '后领口深点 (折线)', snSide: '侧颈点', shoulder: '肩点', acrossX: '后背宽点',
        armhole: '袖窿底', waistSide: '侧腰点', hemSide: '侧下摆点', hemCenter: '下摆中点',
      }),
    },
    {
      id: 'sleeve', name: '袖片 (对裁)', qty: 2, kind: 'sleeve', tags: deriveTagsFor('sleeve', 2),
      keyDims: [
        { label: '袖长', value: r1(sleeve.sleeveLength) },
        { label: '袖山高', value: r1(sleeve.capHeight) },
        { label: '袖肥', value: r1(sleeve.bicepWidth) },
        { label: '袖山弧长', value: r1(sleeve.capCurveLength) },
        { label: '吃势', value: r1(sleeve.capEase) },
        { label: '袖口宽', value: r1(sleeve.cuffWidth) },
      ],
      grossAreaMm2: segmentedGrossArea(sleeve.edges, widths),
      edges: sleeve.edges,
      dimensions: buildDimensions(sleeve.edges, ['袖山前弧', '前侧缝', '袖口折边', '后侧缝', '袖山后弧']),
      points: buildPoints(
        { ...sleeve.points, capNotchFront: sleeve.capNotchFront, capNotchBack: sleeve.capNotchBack } as any,
        {
          top: '袖山顶点', frontBicep: '前袖肥点', backBicep: '后袖肥点',
          frontCuff: '前袖口点', backCuff: '后袖口点',
          capNotchFront: '前对位剪口', capNotchBack: '后对位剪口',
        },
      ),
    },
    {
      id: 'collar', name: '立领 (对折)', qty: 1, kind: 'collar', tags: deriveTagsFor('collar', 1),
      keyDims: [
        { label: '内口长 (领窝)', value: r1(collar.innerEdgeLength) },
        { label: '领高', value: r1(collar.collarHeight) },
      ],
      grossAreaMm2: segmentedGrossArea(collar.edges, widths),
      edges: collar.edges,
      dimensions: buildDimensions(collar.edges, ['内口弧线 (缝领)', '前端头', '上口弧线 (对折)', '中心后端头 (对折)']),
      points: buildPoints(collar.points as any, {
        cbFold: '中心后折点', innerFront: '内口前端点', outerFront: '上口前端点', outerBack: '上口后折点',
      }),
    },
    {
      id: 'placket', name: '门襟', qty: 1, kind: 'placket', tags: deriveTagsFor('placket', 1),
      keyDims: [
        { label: '门襟长', value: r1(placket.length) },
        { label: '成品宽', value: r1(placket.finishedWidth) },
      ],
      grossAreaMm2: segmentedGrossArea(placket.edges, widths),
      edges: placket.edges,
      dimensions: buildDimensions(placket.edges, ['上端头', '长边 A', '下端头', '长边 B']),
      points: buildPoints(placket.points as any, { tl: '左上角', tr: '右上角', br: '右下角', bl: '左下角' }),
    },
    {
      id: 'cuff', name: '袖口 (对折)', qty: 2, kind: 'cuff', tags: deriveTagsFor('cuff', 2),
      keyDims: [
        { label: '袖口围', value: r1(cuff.cuffCirc) },
        { label: '成品高', value: r1(cuff.cuffHeight) },
      ],
      grossAreaMm2: segmentedGrossArea(cuff.edges, widths),
      edges: cuff.edges,
      dimensions: buildDimensions(cuff.edges, ['对折边 (下长边)', '前端头', '上边 (缝袖口)', '后端头']),
      points: buildPoints(cuff.points as any, { bl: '左折角', br: '右折角', tr: '右上角', tl: '左上角' }),
    },
    {
      id: 'pocket', name: '贴袋', qty: 1, kind: 'pocket', tags: deriveTagsFor('pocket', 1),
      keyDims: [
        { label: '袋宽', value: r1(pocket.width) },
        { label: '袋高', value: r1(pocket.height) },
      ],
      grossAreaMm2: segmentedGrossArea(pocket.edges, widths),
      edges: pocket.edges,
      dimensions: buildDimensions(pocket.edges, ['底部弧边', '右侧边', '袋口折边', '左侧边']),
      points: buildPoints(pocket.points as any, { bl: '左名义角', br: '右名义角', tr: '右上角', tl: '左上角' }),
    },
  ];

  const totalArea = pieces.reduce((s, p) => s + p.grossAreaMm2 * p.qty, 0);
  const usage = estimateFabricUsage({
    pieceAreasMm2: pieces.map((p) => p.grossAreaMm2),
    pieceQty: pieces.map((p) => p.qty),
    fabricWidthMm: 1500,
    efficiency: 0.85,
    lossRate: 0.03,
  });

  return {
    keyData,
    gender,
    fit,
    pieces,
    fabricUsage: { lengthM: usage.lengthM, totalPieceAreaMm2: totalArea },
  };
}

// ════════════════════════════════════════════════════════════
// 推档 (Grading): 标准尺码表批量放码
// ════════════════════════════════════════════════════════════

export interface GradedSize {
  size: StandardSize;
  result: GenerationResult;
}

/** 按标准尺码表生成多尺码裁片 (推档) */
export function generateGraded(
  gender: GenderType,
  sizes: StandardSize[],
  opts: GeneratorOptions = {},
): GradedSize[] {
  return sizes.map((size) => ({
    size,
    result: generatePieces(getMeasurementsBySize(gender, size), { ...opts, gender }),
  }));
}




