/**
 * ─────────────────────────────────────────────────────────────
 *  mm 标准部件制版 (Collar / Placket / Cuff / Pocket)
 * ─────────────────────────────────────────────────────────────
 *
 *  与衣身/袖子同一标准: 输入 = 测量值派生量 (mm), 输出 = CAD 裁片
 *  (净样轮廓 + 缝份由 seamAllowancePath 生成), 无渲染坐标魔法数字。
 */

import type { Contour, Pt, Seg } from './geometry';
import { arcThrough, dist, pt, smoothJoin, unit } from './geometry';
import type { DraftEdge } from './aldrich';

// ════════════════════════════════════════════════════════════
// 立领 (Mandarin / Stand Collar)
// ════════════════════════════════════════════════════════════

export interface CollarDraft {
  contour: Contour;
  /** 带角色的边: 内口缝合(6) / 两端缝合(10) / 上口对折(0) */
  edges: DraftEdge[];
  /** 关键点 (中心后折点 / 内口前端 / 上口前端 / 上口后折点) */
  points: { cbFold: Pt; innerFront: Pt; outerFront: Pt; outerBack: Pt };
  /** 领下口弧长 (≈ 领口弧长, mm) */
  innerEdgeLength: number;
  /** 领高 (mm) */
  collarHeight: number;
}

/**
 * 立领: 对折裁剪的弯条 (半片)
 *  - 内口长 = 前后领口弧长之和的一半 (对折对称)
 *  - 领高 h, 外口比内口长 8~15mm (立领起翘量, Aldrich 经验)
 *  - 坐标: 原点 = 后领中心 (对折点), x 沿领口方向, y 领宽方向
 */
/**
 * 立领 (Stand Collar): 内口 = 真实领口净样曲线展平
 *  - neckPoints: 完整领口净样折线 (后领深点 → 侧颈 → 前领深点, mm)
 *  - 内口按领口原样成型 (与衣身领窝完全贴合, 弯曲自然)
 *  - 外口沿法向抬升领高 — 曲率自动产生立领外口余量 (无需硬编码起翘量)
 *  - 后端头 = 中心后对折 (fold), 前端头缝合 (seam)
 */
/**
 * 立领 (Stand Collar): 条带构造 + 真实领口弧长
 *  - 内口长 = 真实领口净样折线长 (与衣身领窝缝合长度精确一致)
 *  - 专业立领原型画法: 近矩形条带, 内口微弯 (半长处下沉 2mm), 外口上口弧比内口长 12mm (立领起翘)
 *  - 对折裁剪: 中心后端 fold, 上口 fold; 内口缝合 6mm, 前端头缝合 10mm
 */
/**
 * 立领 (Stand Collar): 单弧条带 — 专业原型画法
 *  - 内口 = 单一圆弧 (中点下沉 3mm, 对应颈部曲率, 无 S 波)
 *  - 外口 = 平行圆弧 (+5mm), 前端略低 2mm (立领前倾)
 *  - 内口长 = 真实领口净样折线长 (与衣身领窝精确缝合)
 *  - 中心后端与上口均为对折边 (fold), 内口缝合 6, 前端头 10
 */
export function draftMandarinCollar(neckPoints: Pt[], collarHeightMm: number): CollarDraft {
  let neckLength = 0;
  for (let i = 1; i < neckPoints.length; i++) {
    neckLength += dist(neckPoints[i - 1], neckPoints[i]);
  }
  const h = collarHeightMm;
  const innerLen = neckLength / 2;      // 对折半片
  const outerLen = innerLen + 8;        // 外口余量 (起翘)

  const origin = pt(0, 0);              // 中心后折点 (内口侧)
  const innerEnd = pt(-innerLen, 0);    // 内口前端
  // 内口: 单弧 (中点下沉 3mm)
  const innerMid = pt(-innerLen * 0.5, 3);
  const innerCurve = arcThrough(origin, innerMid, innerEnd);

  const outerStart = pt(0, h);          // 上口后折点
  const outerEnd = pt(-outerLen, h - 2); // 上口前端 (前倾 2mm)
  // 外口: 单弧 (中点 +5mm, 与内口平行)
  const outerMid = pt(-innerLen * 0.5, h + 5);
  const outerCurve = arcThrough(outerStart, outerMid, outerEnd);

  const endFront: Seg = { kind: 'L', to: outerEnd };  // 前端头 (缝合 10)
  const endBack: Seg = { kind: 'L', to: origin };      // 中心后端 (对折 0)

  const contour: Contour = {
    start: origin,
    segs: [innerCurve, endFront, outerCurve, endBack],
    closed: true,
  };

  const edges: DraftEdge[] = [
    { role: 'neckline', start: origin, segs: [innerCurve] },   // 内口缝领 (6)
    { role: 'seam', start: innerEnd, segs: [endFront] },        // 前端头 (10)
    { role: 'fold', start: outerEnd, segs: [outerCurve] },      // 上口对折 (0)
    { role: 'fold', start: outerStart, segs: [endBack] },       // 中心后对折 (0)
  ];

  let innerEdgeLength = neckLength;

  return {
    contour,
    edges,
    points: { cbFold: origin, innerFront: innerEnd, outerFront: outerEnd, outerBack: outerStart },
    innerEdgeLength,
    collarHeight: h,
  };
}
export interface PlacketDraft {
  contour: Contour;
  /** 带角色的边 (四边均缝合 10) */
  edges: DraftEdge[];
  /** 角点 */
  points: { tl: Pt; tr: Pt; br: Pt; bl: Pt };
  /** 成品门襟宽度 (mm, 对折后) */
  finishedWidth: number;
  /** 门襟长度 (mm) */
  length: number;
}

/**
 * 中开门襟: 对折长条
 *  - 裁片宽 = 成品宽 × 2 + 10mm (内折余量)
 *  - 长度 = 门襟区长度 (领口到门襟底)
 */
export function draftPlacket(finishedWidthMm: number, lengthMm: number): PlacketDraft {
  const cutWidth = finishedWidthMm * 2 + 10;
  const contour: Contour = {
    start: pt(0, 0),
    segs: [
      { kind: 'L', to: pt(cutWidth, 0) },
      { kind: 'L', to: pt(cutWidth, lengthMm) },
      { kind: 'L', to: pt(0, lengthMm) },
      { kind: 'L', to: pt(0, 0) },
    ],
    closed: true,
  };
  const edges: DraftEdge[] = [
    { role: 'seam', start: pt(0, 0), segs: [{ kind: 'L', to: pt(cutWidth, 0) }] },
    { role: 'seam', start: pt(cutWidth, 0), segs: [{ kind: 'L', to: pt(cutWidth, lengthMm) }] },
    { role: 'seam', start: pt(cutWidth, lengthMm), segs: [{ kind: 'L', to: pt(0, lengthMm) }] },
    { role: 'seam', start: pt(0, lengthMm), segs: [{ kind: 'L', to: pt(0, 0) }] },
  ];
  return {
    contour,
    edges,
    points: { tl: pt(0, 0), tr: pt(cutWidth, 0), br: pt(cutWidth, lengthMm), bl: pt(0, lengthMm) },
    finishedWidth: finishedWidthMm,
    length: lengthMm,
  };
}

// ════════════════════════════════════════════════════════════
// 袖口 (Cuff)
// ════════════════════════════════════════════════════════════

export interface CuffDraft {
  contour: Contour;
  /** 带角色的边: 长向对折(0) / 上边缝袖口(10) / 两端缝合(10) */
  edges: DraftEdge[];
  /** 角点 */
  points: { bl: Pt; br: Pt; tr: Pt; tl: Pt };
  /** 袖口围 (mm) */
  cuffCirc: number;
  /** 袖口高 (对折后, mm) */
  cuffHeight: number;
}

/**
 * 平袖口: 对折矩形条
 *  - 长度 = 腕围 + 40mm 松量 (袖口围)
 *  - 裁片高 = 成品高 × 2 (对折)
 */
/**
 * 袖口 (Shirt Barrel Cuff): 圆角袖头 — 衬衫标准
 *  - 长 = 腕围 + 松量 (含搭门), 高 = 成品高 ×2 (对折)
 *  - 外缘两角圆角 R12 (衬衫袖头标准造型), 其余直角
 *  - 下长边对折 (0), 上长边缝袖口 (10), 两端缝合 (10)
 */
export function draftCuff(cuffCircMm: number, cuffHeightMm: number): CuffDraft {
  const h = cuffHeightMm * 2;
  const r = 12; // 袖口外缘圆角

  const bottomArcR = smoothJoin(pt(cuffCircMm - r, 0), { x: 1, y: 0 }, pt(cuffCircMm, r), { x: 0, y: 1 }, 2.2);
  const bottomArcL = smoothJoin(pt(0, r), { x: 0, y: -1 }, pt(r, 0), { x: 1, y: 0 }, 2.2);

  const contour: Contour = {
    start: pt(r, 0),
    segs: [
      { kind: 'L', to: pt(cuffCircMm - r, 0) },
      bottomArcR,
      { kind: 'L', to: pt(cuffCircMm, h) },
      { kind: 'L', to: pt(0, h) },
      { kind: 'L', to: pt(0, r) },
      bottomArcL,
    ],
    closed: true,
  };

  const edges: DraftEdge[] = [
    { role: 'fold', start: pt(r, 0), segs: [{ kind: 'L', to: pt(cuffCircMm - r, 0) }, bottomArcR, { kind: 'L', to: pt(cuffCircMm, h) }] }, // 折边+外缘圆角
    { role: 'seam', start: pt(cuffCircMm, h), segs: [{ kind: 'L', to: pt(0, h) }] },                                                        // 上长边 (缝袖口)
    { role: 'seam', start: pt(0, h), segs: [{ kind: 'L', to: pt(0, r) }, bottomArcL] },                                                     // 后端头+圆角
  ];

  return {
    contour,
    edges,
    points: { bl: pt(0, 0), br: pt(cuffCircMm, 0), tr: pt(cuffCircMm, h), tl: pt(0, h) },
    cuffCirc: cuffCircMm,
    cuffHeight: cuffHeightMm,
  };
}
export interface PocketDraft {
  contour: Contour;
  /** 带角色的边: 底/侧缝合, 袋口折边 (hem) */
  edges: DraftEdge[];
  /** 角点 (圆角前的直角名义点) */
  points: { bl: Pt; br: Pt; tr: Pt; tl: Pt };
  width: number;
  height: number;
}

/**
 * 贴袋: 圆角矩形 (底角圆弧 R=15mm)
 */
export function draftPatchPocket(widthMm: number, heightMm: number): PocketDraft {
  const r = 15;
  const bottomArcL = smoothJoin(pt(0, r), { x: 0, y: -1 }, pt(r, 0), { x: 1, y: 0 });
  const bottomArcR = smoothJoin(pt(widthMm - r, 0), { x: 1, y: 0 }, pt(widthMm, r), { x: 0, y: 1 });
  const topArcR = smoothJoin(pt(widthMm, heightMm - r), { x: 0, y: 1 }, pt(widthMm - r, heightMm), { x: -1, y: 0 });
  const topArcL = smoothJoin(pt(r, heightMm), { x: -1, y: 0 }, pt(0, heightMm - r), { x: 0, y: -1 });

  const contour: Contour = {
    start: pt(0, r),
    segs: [
      bottomArcL,
      { kind: 'L', to: pt(widthMm - r, 0) },
      bottomArcR,
      { kind: 'L', to: pt(widthMm, heightMm - r) },
      topArcR,
      { kind: 'L', to: pt(r, heightMm) },
      topArcL,
      { kind: 'L', to: pt(0, r) },
    ],
    closed: true,
  };

  const edges: DraftEdge[] = [
    { role: 'seam', start: pt(0, r), segs: [bottomArcL, { kind: 'L', to: pt(widthMm - r, 0) }, bottomArcR] },  // 底
    { role: 'seam', start: pt(widthMm, r), segs: [{ kind: 'L', to: pt(widthMm, heightMm - r) }] },             // 右侧
    { role: 'hem', start: pt(widthMm, heightMm - r), segs: [topArcR, { kind: 'L', to: pt(r, heightMm) }, topArcL] }, // 袋口折边
    { role: 'seam', start: pt(0, heightMm - r), segs: [{ kind: 'L', to: pt(0, r) }] },                          // 左侧
  ];

  return {
    contour,
    edges,
    points: { bl: pt(0, 0), br: pt(widthMm, 0), tr: pt(widthMm, heightMm), tl: pt(0, heightMm) },
    width: widthMm,
    height: heightMm,
  };
}

// 供 blocks 使用的工具 re-export
export { unit };









