/**
 * ─────────────────────────────────────────────────────────────
 *  Aldrich 工业制版公式引擎 (公式驱动, 全程 mm)
 * ─────────────────────────────────────────────────────────────
 *
 *  公式来源:
 *   - Winifred Aldrich《Metric Pattern Cutting for Menswear / Womenswear》
 *   - Valentina / Seamly2D 开源制版软件的公式驱动点系统
 *   - 服装工程经验值 (袖山吃势 5-12mm, 肩斜 15° 等)
 *
 *  每个点坐标 = f(人体测量值), 无渲染坐标系魔法数字。
 *  本模块输出的所有坐标均为真实毫米, 可直接用于裁剪纸样。
 */

import type { BodyMeasurements } from '@/types/measurements';
import type { GenderType } from '@/types/gene';
import { FIT_PRESETS } from '../../parametric/measurement-formulas';
import type { Contour, Pt, Seg } from './geometry';
import {
  contourLength, cubicLength, dist, flattenChain, pointAtChainLength, pt, smoothJoin, unit,
} from './geometry';

// ════════════════════════════════════════════════════════════
// 版型规格 (Block 参数) — 与 GenePathData 解耦的中间层
// ════════════════════════════════════════════════════════════

/** 边角色 — 决定缝份宽度 (生产对接的核心语义) */
export type EdgeRole = 'fold' | 'neckline' | 'seam' | 'hem';

/** 角色缝份宽度表 (mm): 对折 0 / 领口 6 / 缝合 seam / 下摆折边 hem */
export interface SeamWidths {
  fold: number;
  neckline: number;
  seam: number;
  hem: number;
}

export const INDUSTRIAL_WIDTHS: SeamWidths = { fold: 0, neckline: 6, seam: 10, hem: 25 };

export interface DraftEdge {
  role: EdgeRole;
  start: Pt;
  segs: Seg[];
}

export interface BodiceDraft {
  /** 净样轮廓 (已闭合, mm 坐标) */
  contour: Contour;
  /** 带角色的边 (缝份引擎输入) */
  edges: DraftEdge[];
  /** 关键制版点 (mm) */
  points: {
    cbNeck: Pt;        // 后颈点 / 前颈点 (原点)
    snSide: Pt;        // 侧颈点
    shoulder: Pt;      // 肩点
    armhole: Pt;       // 袖窿底 (侧缝与胸围线交点)
    bustMid: Pt;       // 胸围线与中线的交点
    waistSide: Pt;     // 侧腰点
    hemSide: Pt;       // 侧下摆点
    hemCenter: Pt;     // 中线下摆点
    acrossX: Pt;       // 背宽/胸宽线上的点 (at bust line)
  };
  /** 本片袖窿弧长 (mm) — 袖子制版的输入 */
  armholeLength: number;
  /** 袖窿深 (颈点→袖窿底, mm) */
  scyeDepth: number;
  /** 领口弧长 (mm) — 领子制版输入 */
  necklineLength: number;
  /** 肩线长度 (mm) */
  shoulderLength: number;
  /** 侧缝长度 (袖窿底→下摆, mm) — 前后片缝合可行性校验用 */
  sideSeamLength: number;
  /** 袖窿对位剪口 (弧长精确定位; 前片 1 个 / 后片 2 个, 从袖窿底向上量取) */
  armholeNotches: Array<{ point: Pt; fromBottomMm: number }>;
  /** 领口曲线真实采样点 (净样, 裁片坐标; 立领内口展平输入) */
  necklinePoints: Pt[];
  /** 半胸围宽 (mm, 胸围线处) */
  halfBustWidth: number;
  /** 背长 (mm) */
  waistY: number;
  /** 衣长 (mm, 颈点→下摆) */
  hemY: number;
}

export interface SleeveDraft {
  /** 净样轮廓 (已闭合) */
  contour: Contour;
  /** 袖山高 (mm) */
  capHeight: number;
  /** 袖肥 (mm) */
  bicepWidth: number;
  /** 袖山弧线总长 (mm, 迭代求解后) */
  capCurveLength: number;
  /** 袖窿弧长总长 (前后片之和, mm) */
  armholeLength: number;
  /** 吃势 (袖山弧长 - 袖窿弧长, mm, 目标 6~10) */
  capEase: number;
  /** 袖长 (mm) */
  sleeveLength: number;
  /** 袖口宽 (mm) */
  cuffWidth: number;
  /** 袖山对位剪口 (弧长精确落位, 与衣身袖窿剪口配对) */
  capNotchFront: Pt;
  capNotchBack: Pt;
  /** 带角色的边 */
  edges: DraftEdge[];
  /** 关键点 (完整尺寸定位) */
  points: { top: Pt; frontBicep: Pt; backBicep: Pt; frontCuff: Pt; backCuff: Pt };
}

export interface DraftOptions {
  fit: 'slim' | 'regular' | 'loose';
  /** 缝份宽度 mm (默认 10) */
  seamAllowanceMm?: number;
  /** 领口造型: 圆领 (crew) / V 领 (v) / 方领 (square), 默认 crew */
  neckType?: 'crew' | 'v' | 'square';
  /** V 领额外深度 mm (在公式领深基础上加放) */
  neckVExtraMm?: number;
  /** 袖长覆盖 mm (默认 = 测量值袖长; 短袖传 200~240) */
  sleeveLengthMm?: number;
  /** 袖山总吃势 mm (默认 30, 合体梭织标准 30~45; 针织 T 恤可传 8~15) */
  sleeveEaseMm?: number;
}

// ════════════════════════════════════════════════════════════
// 放松量 (Ease) — 从现有 FIT_PRESETS 取, cm → mm
// ════════════════════════════════════════════════════════════

export function easeFor(fit: DraftOptions['fit']) {
  const e = FIT_PRESETS[fit] ?? FIT_PRESETS.regular;
  return {
    bust: e.bust * 10,      // mm
    waist: e.waist * 10,
    hip: e.hip * 10,
    bicep: e.bicep * 10,
    wrist: e.wrist * 10,
  };
}

// ════════════════════════════════════════════════════════════
// 衣身原型 (合体 T 恤基型, Aldrich)
// ════════════════════════════════════════════════════════════

const TAN_SLOPE = 0.23086819; // tan(13 度) 肩斜 — Brian 标准基型斜率

/**
 * 衣身片原型制版 (front / back)
 *
 * 坐标系: 原点 = 颈点 (前片 cf-neck / 后片 cb-neck), y 向下, mm
 * 公式 (每一条都有出处):
 *   袖窿深  = B/8 + 105mm + ease/4            [Aldrich scye depth]
 *   领宽    = N/5 - 5mm                        [Aldrich neck width]
 *   前领深  = N/5 + 10mm                       [Aldrich front neck drop]
 *   后领深  = 25mm                             [Aldrich back neck]
 *   肩斜    = 15° → drop = 半肩宽 × tan15°
 *   胸围线宽 = B/4 + ease/4                    [四分法]
 */
export function draftBodice(
  m: BodyMeasurements,
  gender: GenderType,
  view: 'front' | 'back',
  opts: DraftOptions = { fit: 'regular' },
): BodiceDraft {
  const ease = easeFor(opts.fit);

  // ── 1. 纵向基准线 ──
  const scye = m.hpsToBust ?? (m.bust / 8 + 105 + ease.bust / 4 + 41); // 袖窿深 (HPS→胸围线, 实测优先)
  const waistY = view === 'front' ? m.frontLength : m.backLength; // 腰线
  const hemY = view === 'front'
    ? m.totalLength + (m.frontLength - m.backLength)
    : m.totalLength;                                       // 下摆线

  // ── 2. 横向基准 (半片) ──
  const halfShoulder = m.shoulderWidth / 2;
  const neckHalf = m.neckCirc * 0.22;                      // 领宽(半) — Brian 标准 0.22N
  const neckDrop = view === 'front' ? m.neckCirc * 0.16 : m.neckCirc * 0.05; // 领深 — Brian 标准
  const shoulderDrop = (halfShoulder - neckHalf) * TAN_SLOPE; // 肩斜: 沿肩线水平距离量取 13 度 (Brian)
  const halfBust = m.bust / 4 + ease.bust / 4;             // 半片胸宽
  const acrossHalf = view === 'front' ? m.acrossFront / 2 : m.acrossBack / 2;
  const halfWaist = m.waist / 4 + ease.waist / 4;
  const halfHem = Math.max(halfBust - 8, m.hip / 4 + ease.hip / 4 - (gender === 'male' ? 40 : 20));

  // ── 3. 领型与领点 ──
  const neckType = opts.neckType ?? 'crew';
  const neckVExtra = opts.neckVExtraMm ?? 25;
  // 颈点 = 领口最深点 (中心折线上): 圆/方领 前片垂直下挖 N/5+10, V 领再加深; 后领深 25
  const origin = view === 'front'
    ? pt(0, neckDrop + (neckType === 'v' || neckType === 'square' ? neckVExtra : 0))
    : pt(0, neckDrop);
  const snSide = pt(-neckHalf, 0);                          // 侧颈点 = HPS (垂直基准 0)
  const shoulder = pt(-halfShoulder, snSide.y + shoulderDrop); // 肩点
  const bustMid = pt(0, scye);                              // 胸围线 × 中线
  const armhole = pt(-halfBust, scye);                      // 袖窿底 = 侧缝×胸围线
  const acrossX = pt(-acrossHalf, scye - 30);               // 背宽/胸宽标记
  const waistSide = pt(-Math.min(halfWaist, halfBust), waistY);
  const hemSide = pt(-halfHem, hemY);
  const hemCenter = pt(0, hemY);

  // ── 4. 轮廓段 ──
  // 侧颈点切线顺接肩线 (G1)
  const snOutDir = unit({ x: shoulder.x - snSide.x, y: shoulder.y - snSide.y });

  let neckline: Seg;
  let neckToSn: Seg | null = null;
  if (view === 'front' && neckType === 'v') {
    // V 领: 从 V 底 (origin, 折线上) 直线上升到侧颈点
    neckline = { kind: 'L', to: snSide };
    neckToSn = null;
  } else if (view === 'front' && neckType === 'square') {
    // 方领: 深点 → 水平横移至领宽 → 垂直上升到侧颈点 (三段直角)
    neckline = { kind: 'L', to: pt(-neckHalf, origin.y) };
    neckToSn = { kind: 'L', to: snSide };
  } else {
    // 圆领: 从折线深点 (切线水平) 光滑上升到侧颈点 (切线顺接肩线)
    neckline = smoothJoin(origin, { x: -1, y: 0 }, snSide, snOutDir);
  }

  // 肩线: 侧颈点 → 肩点 (直线, 15 度肩斜)
  const shoulderSeg: Seg = { kind: 'L', to: shoulder };

  // 袖窿: 肩点 → 胸宽标记 → 袖窿底
  // 肩点起始切线近乎垂直 (微内倾); acrossX 处切线垂直, 袖窿底切线向下流入侧缝
  const ahTop: Seg = smoothJoin(shoulder, unit({ x: 0, y: 1 }), acrossX, { x: 0, y: 1 });
  const ahBottom: Seg = smoothJoin(acrossX, { x: 0, y: 1 }, armhole, { x: 0.08, y: 1 });

  // 侧缝: 袖窿底 → 侧腰 → 侧下摆 (微弧收腰)
  const sideTop: Seg = smoothJoin(armhole, { x: 0, y: 1 }, waistSide, { x: 0, y: 1 });
  const sideBottom: Seg = smoothJoin(waistSide, { x: 0, y: 1 }, hemSide, { x: 0, y: 1 });

  // 下摆: 侧 → 中 (直线)
  const hemSeg: Seg = { kind: 'L', to: hemCenter };

  // 中线: 下摆中点 → 领口深点 (对折线)
  const centerSeg: Seg = { kind: 'L', to: origin };

  const contour: Contour = {
    start: origin,
    segs: [
      neckline,
      ...(neckToSn ? [neckToSn] : []),
      shoulderSeg, ahTop, ahBottom, sideTop, sideBottom, hemSeg, centerSeg,
    ],
    closed: true,
  };

  const edges: DraftEdge[] = [
    { role: 'neckline', start: origin, segs: [neckline, ...(neckToSn ? [neckToSn] : [])] },
    { role: 'seam', start: snSide, segs: [shoulderSeg] },
    { role: 'seam', start: shoulder, segs: [ahTop, ahBottom] },
    { role: 'seam', start: armhole, segs: [sideTop, sideBottom] },
    { role: 'hem', start: hemSide, segs: [hemSeg] },
    { role: 'fold', start: hemCenter, segs: [centerSeg] },
  ];

  // 袖窿对位剪口: 前片单剪 (距袖窿底 60mm), 后片双剪 (70/80mm) — 服装厂配袖标准
  const ahLen = segChainLength(shoulder, [ahTop, ahBottom]);
  const notchDists = view === 'front' ? [60] : [70, 80];
  const armholeNotches = notchDists.map((d) => ({
    point: pointAtChainLength(shoulder, [ahTop, ahBottom], Math.max(0, ahLen - d)),
    fromBottomMm: d,
  }));

  return {
    contour,
    edges,
    points: { cbNeck: origin, snSide, shoulder, armhole, bustMid, waistSide, hemSide, hemCenter, acrossX },
    armholeNotches,
    necklinePoints: flattenChain(origin, neckToSn ? [neckline, neckToSn] : [neckline], 1.5),
    armholeLength: ahLen,
    scyeDepth: scye,
    necklineLength: segChainLength(origin, neckToSn ? [neckline, neckToSn] : [neckline]),
    shoulderLength: segChainLength(snSide, [shoulderSeg]),
    sideSeamLength: segChainLength(armhole, [sideTop, sideBottom]),
    halfBustWidth: halfBust,
    waistY,
    hemY,
  };
}
/** 段链长度: 从已知起点沿段序列积分 */
function segChainLength(start: Pt, segs: Seg[]): number {
  let total = 0;
  let from = start;
  for (const s of segs) {
    if (s.kind === 'L') total += dist(from, s.to);
    else total += cubicLength(from, s.c1, s.c2, s.to);
    from = s.to;
  }
  return total;
}



// ════════════════════════════════════════════════════════════
// 袖子原型 (一片合体装袖, Aldrich)
// ════════════════════════════════════════════════════════════

/**
 * 袖原型制版 (前后通用片, mm)
 *
 * 坐标系: 原点 = 袖山顶点, y 向下
 * 公式:
 *   袖山高 = 袖窿深 × 0.75                        [Aldrich cap height]
 *   袖山弧长 = 袖窿弧长 + 吃势 (6~10mm)           [服装工程: 袖山吃缝]
 *   袖肥: 数值迭代求解, 使袖山弧长匹配目标        [本文引擎核心创新]
 *   袖口   = 腕围 + 40mm 松量                     [T 恤袖口经验]
 */
export function draftSleeve(
  m: BodyMeasurements,
  gender: GenderType,
  frontAH: number,
  backAH: number,
  opts: DraftOptions = { fit: 'regular' },
): SleeveDraft {
  const ease = easeFor(opts.fit);
  const AH = frontAH + backAH;
  const scye = m.hpsToBust ?? (m.bust / 8 + 105 + ease.bust / 4); // 袖窿深 = 实测 HPS→胸围线

  // ── 专业标准 (dresspatternmaking / Aldrich):
  //  - 袖山吃势 (合体袖 block): 总吃势 30mm (标准 30~45mm, 针织 T 恤可用 sleeveEaseMm 覆盖减小)
  //  - 三角形关系: capHeight 与 AH 定 bicep (三选二)
  //  - 袖山前后不对称: 前后半宽按前后袖窿弧长比例分配
  //  - crown 顶点切线水平 (光滑圆顶, 无尖角)
  //  - bicep 处切线竖直 (曲线竖直落入袖肥线)
  const easeMm = opts.sleeveEaseMm ?? 30;
  const targetCapLen = AH + easeMm;
  const capHeight = scye * 0.75;
  const sleeveLength = opts.sleeveLengthMm ?? m.sleeveLength;
  const cuffWidth = m.wristCirc + 40 + (gender === 'male' ? 10 : 0);

  const fRatio = frontAH / AH;   // 前半宽比例
  const bRatio = backAH / AH;    // 后半宽比例

  // ── 数值迭代求袖肥: 袖山弧长 = AH + easeMm ──
  let bicepWidth = AH * 0.68;
  let capLen = 0;
  for (let iter = 0; iter < 32; iter++) {
    capLen = capTotalLength(capHeight, bicepWidth, fRatio, bRatio);
    const err = targetCapLen - capLen;
    if (Math.abs(err) < 1.2) break;
    bicepWidth += err * 0.5;
    if (bicepWidth < capHeight * 0.75) bicepWidth = capHeight * 0.75;
    if (bicepWidth > capHeight * 2.2) bicepWidth = capHeight * 2.2;
  }

  const frontBicep = pt(-bicepWidth * fRatio, capHeight);
  const backBicep = pt(bicepWidth * bRatio, capHeight);
  const top = pt(0, 0);

  // 袖山曲线 (光滑圆顶): crown 切线水平, bicep 切线竖直 — 每半一段 cubic, G1 连续
  const capFrontSegs: Seg[] = [smoothJoin(top, { x: -1, y: 0 }, frontBicep, { x: 0, y: 1 })];
  const capBackSegs: Seg[] = [smoothJoin(top, { x: 1, y: 0 }, backBicep, { x: 0, y: 1 })];
  const frontLen = contourLength({ start: top, segs: capFrontSegs, closed: false });
  const backLen = contourLength({ start: top, segs: capBackSegs, closed: false });

  // 对位剪口: 距 bicep 弧长 = 60/75 + easeShare (吃势 30% 分配在剪口以下)
  const easeShare = (capLen - AH) * 0.3;
  const capNotchFront = pointAtChainLength(top, capFrontSegs, Math.max(0, frontLen - 60 - easeShare));
  const capNotchBack = pointAtChainLength(top, capBackSegs, Math.max(0, backLen - 75 - easeShare));

  const { contour, edges, points } = sleeveContour(capHeight, bicepWidth, fRatio, bRatio, sleeveLength, cuffWidth);

  return {
    contour,
    capHeight,
    bicepWidth,
    capCurveLength: capLen,
    armholeLength: AH,
    capEase: capLen - AH,
    sleeveLength,
    cuffWidth,
    capNotchFront,
    capNotchBack,
    edges,
    points,
  };
}

/** 袖山总弧长 (前后两半, 光滑圆顶构造) — 袖肥迭代求解用 */
function capTotalLength(capHeight: number, bicepWidth: number, fRatio: number, bRatio: number): number {
  const top = pt(0, 0);
  const frontBicep = pt(-bicepWidth * fRatio, capHeight);
  const backBicep = pt(bicepWidth * bRatio, capHeight);
  const front = { start: top, segs: [smoothJoin(top, { x: -1, y: 0 }, frontBicep, { x: 0, y: 1 })], closed: false };
  const back = { start: top, segs: [smoothJoin(top, { x: 1, y: 0 }, backBicep, { x: 0, y: 1 })], closed: false };
  return contourLength(front) + contourLength(back);
}

/** 完整袖片轮廓 + 带角色的边 (袖山/侧缝缝合, 袖口折边) */
function sleeveContour(
  capHeight: number, bicepWidth: number, fRatio: number, bRatio: number,
  sleeveLength: number, cuffWidth: number,
): { contour: Contour; edges: DraftEdge[]; points: { top: Pt; frontBicep: Pt; backBicep: Pt; frontCuff: Pt; backCuff: Pt } } {
  const top = pt(0, 0);
  const frontBicep = pt(-bicepWidth * fRatio, capHeight);
  const backBicep = pt(bicepWidth * bRatio, capHeight);
  const halfW = cuffWidth / 2;
  const frontCuff = pt(-halfW, sleeveLength);
  const backCuff = pt(halfW, sleeveLength);

  // 袖山 (crown 水平切线, bicep 竖直切线)
  const sF = smoothJoin(top, { x: -1, y: 0 }, frontBicep, { x: 0, y: 1 });
  const sB = smoothJoin(top, { x: 1, y: 0 }, backBicep, { x: 0, y: 1 });

  // 侧缝: 近直线微内收 (bicep 出发切线竖直向下, cuff 端竖直进入 — 无勾无自交)
  const frontSeam = smoothJoin(frontBicep, { x: 0, y: 1 }, frontCuff, { x: 0, y: 1 });
  const backSeam = smoothJoin(backBicep, { x: 0, y: 1 }, backCuff, { x: 0, y: 1 });

  // 袖口线 (水平, 合体标准: bicep 线平行地面)
  const cuffSeg: Seg = { kind: 'L', to: backCuff };

  // 逆行段 (轮廓闭合方向: top → 前半 → 前袖缝 → 袖口 → 后袖缝逆行 → 后半逆行 → top)
  const backSeamRev: Seg = { kind: 'C', c1: (backSeam as any).c2, c2: (backSeam as any).c1, to: backBicep };
  const sBrev: Seg = { kind: 'C', c1: (sB as any).c2, c2: (sB as any).c1, to: top };

  const contour: Contour = {
    start: top,
    segs: [sF, frontSeam, cuffSeg, backSeamRev, sBrev],
    closed: true,
  };

  // 细分 5 链 (完整尺寸定位: 每条边独立可测)
  const edges: DraftEdge[] = [
    { role: 'seam', start: top, segs: [sF] },                       // 袖山前弧
    { role: 'seam', start: frontBicep, segs: [frontSeam] },         // 前侧缝
    { role: 'hem', start: frontCuff, segs: [cuffSeg] },             // 袖口折边
    { role: 'seam', start: backCuff, segs: [backSeamRev] },         // 后侧缝 (逆行)
    { role: 'seam', start: backBicep, segs: [sBrev] },              // 袖山后弧 (逆行)
  ];

  const points = { top, frontBicep, backBicep, frontCuff, backCuff };

  return { contour, edges, points };
}













