/**
 * 工业级纸样符号 (Pattern Markings) 库
 *
 * 实现 Milestone B:
 * - 布纹线 (Grain Line) - 双向箭头标识 fabric 经向
 * - 折叠线 (Fold Line) - 虚线 + 折叠符号, 对称纸样用
 * - 剪口 (Notch) - 三角形标记, 拼合对位
 * - 省道 (Dart) - 虚线 + 三角/菱形收省
 * - 钻孔 (Drill Hole) - 小圆点定位
 *
 * 这些都是真实制版行业的标准符号, 区别于"几何图形"
 * 参考: AAMA/ASTM 工业制图标准
 */

import type { GenePathData } from '@/types/gene';

// ─── 通用样式常量 ───
const ARROW_SIZE = 3;        // 布纹箭头长度 (mm)
const FOLD_TICK = 4;         // 折叠符号短划长度 (mm)
const NOTCH_SIZE = 2.5;      // 剪口三角形边长 (mm)
const DRILL_R = 1.2;         // 钻孔半径 (mm)

/** 渲染顺序: cutting > seam > grain > fold > notch/dart/drill > stitch > detail */
export const MARKING_LAYER_ORDER = [
  'cutting-line', 'seam-line', 'grain-line', 'fold-line',
  'notch', 'dart', 'drill-hole', 'stitch', 'detail', 'outline', 'annotation',
] as const;

// ════════════════════════════════════════════════════════════
// 1. 布纹线 (Grain Line) - 双向箭头
// ════════════════════════════════════════════════════════════

export interface GrainLineSpec {
  /** 中心点 */
  cx: number;
  /** 中心点 y */
  cy: number;
  /** 总长度 (默认 30mm) */
  length?: number;
  /** 方向: 'vertical' | 'horizontal' (默认 vertical) */
  direction?: 'vertical' | 'horizontal';
  /** ID 前缀 */
  idPrefix?: string;
}

/**
 * 生成布纹线 - 工业标准双向箭头
 * 通常垂直放置, 标识 fabric 经向 (lengthwise grain)
 */
export function grainLine(spec: GrainLineSpec): GenePathData {
  const len = spec.length ?? 30;
  const dir = spec.direction ?? 'vertical';
  const idPrefix = spec.idPrefix ?? 'grain';
  const half = len / 2;

  let linePath: string;
  let arrow1: string;
  let arrow2: string;

  if (dir === 'vertical') {
    // 主线: 垂直
    linePath = `M${spec.cx},${spec.cy - half} L${spec.cx},${spec.cy + half}`;
    // 上箭头
    arrow1 = `M${spec.cx - ARROW_SIZE},${spec.cy - half + ARROW_SIZE} L${spec.cx},${spec.cy - half} L${spec.cx + ARROW_SIZE},${spec.cy - half + ARROW_SIZE}`;
    // 下箭头
    arrow2 = `M${spec.cx - ARROW_SIZE},${spec.cy + half - ARROW_SIZE} L${spec.cx},${spec.cy + half} L${spec.cx + ARROW_SIZE},${spec.cy + half - ARROW_SIZE}`;
  } else {
    linePath = `M${spec.cx - half},${spec.cy} L${spec.cx + half},${spec.cy}`;
    arrow1 = `M${spec.cx - half + ARROW_SIZE},${spec.cy - ARROW_SIZE} L${spec.cx - half},${spec.cy} L${spec.cx - half + ARROW_SIZE},${spec.cy + ARROW_SIZE}`;
    arrow2 = `M${spec.cx + half - ARROW_SIZE},${spec.cy - ARROW_SIZE} L${spec.cx + half},${spec.cy} L${spec.cx + half - ARROW_SIZE},${spec.cy + ARROW_SIZE}`;
  }

  return {
    id: `${idPrefix}-grain`,
    data: `${linePath} ${arrow1} ${arrow2}`,
    fill: 'none',
    stroke: '#000000',
    strokeWidth: 0.4,
    strokeLinecap: 'round',
    layer: 'grain-line',
  };
}

// ════════════════════════════════════════════════════════════
// 2. 折叠线 (Fold Line) - 虚线 + 折叠符号
// ════════════════════════════════════════════════════════════

export interface FoldLineSpec {
  /** 起点 */
  x1: number;
  y1: number;
  /** 终点 */
  x2: number;
  y2: number;
  /** ID 前缀 */
  idPrefix?: string;
}

/**
 * 生成折叠线 - 用于对称纸样 (前片/后片对折裁剪)
 * 形式: 长虚线 + 中部折叠符号
 */
export function foldLine(spec: FoldLineSpec): GenePathData[] {
  const idPrefix = spec.idPrefix ?? 'fold';
  const midX = (spec.x1 + spec.x2) / 2;
  const midY = (spec.y1 + spec.y2) / 2;

  // 折叠符号: 短划 + V 形 (标识 "此处折叠")
  const foldSymbol = `M${midX - FOLD_TICK * 2},${midY} L${midX + FOLD_TICK * 2},${midY} M${midX - FOLD_TICK * 0.6},${midY - FOLD_TICK * 0.6} L${midX},${midY + FOLD_TICK * 0.6} L${midX + FOLD_TICK * 0.6},${midY - FOLD_TICK * 0.6}`;

  return [
    {
      id: `${idPrefix}-fold-line`,
      data: `M${spec.x1},${spec.y1} L${spec.x2},${spec.y2}`,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 0.4,
      strokeDasharray: '3,2',
      strokeLinecap: 'round',
      layer: 'fold-line',
    },
    {
      id: `${idPrefix}-fold-symbol`,
      data: foldSymbol,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 0.4,
      strokeLinecap: 'round',
      layer: 'fold-line',
    },
  ];
}

// ════════════════════════════════════════════════════════════
// 3. 剪口 (Notch) - 三角形标记
// ════════════════════════════════════════════════════════════

export type NotchDirection = 'in' | 'out' | 'top' | 'bottom' | 'left' | 'right';

export interface NotchSpec {
  /** 剪口位置 */
  x: number;
  y: number;
  /** 朝向 (默认 'out', 从边缘向外凸出) */
  direction?: NotchDirection;
  /** 剪口大小 (mm) */
  size?: number;
  /** ID 前缀 */
  idPrefix?: string;
}

/**
 * 生成单个剪口 - 工业标准 (开口 V 形, 细线)
 * 不是实心三角! 而是 V 形开口, 标识缝合对位点
 */
export function notch(spec: NotchSpec): GenePathData {
  const size = spec.size ?? NOTCH_SIZE;
  const dir = spec.direction ?? 'out';
  const idPrefix = spec.idPrefix ?? 'notch';
  const s = spec.x;
  const y = spec.y;
  let path: string;

  // 工业制版标准: 剪口是细线 V 形, 不填充, 不画外框
  switch (dir) {
    case 'in': // 指向圆心
      path = `M${s - size},${y - size * 0.6} L${s + size},${y - size * 0.6} L${s},${y + size * 0.4}`;
      break;
    case 'top': // 指向上
      path = `M${s - size * 0.6},${y + size} L${s + size * 0.6},${y + size} L${s},${y}`;
      break;
    case 'bottom': // 指向下
      path = `M${s - size * 0.6},${y - size} L${s + size * 0.6},${y - size} L${s},${y}`;
      break;
    case 'left': // 指向左
      path = `M${s + size},${y - size * 0.6} L${s + size},${y + size * 0.6} L${s},${y}`;
      break;
    case 'right': // 指向右
      path = `M${s - size},${y - size * 0.6} L${s - size},${y + size * 0.6} L${s},${y}`;
      break;
    case 'out':
    default:
      path = `M${s - size},${y - size * 0.6} L${s + size},${y - size * 0.6} L${s},${y + size * 0.4}`;
  }

  return {
    id: `${idPrefix}-notch`,
    data: path,
    fill: 'none',
    stroke: '#333333',  // 浅灰而非纯黑, 减少视觉噪音
    strokeWidth: 0.3,
    strokeLinecap: 'round',
    layer: 'notch',
  };
}

/**
 * 批量生成剪口
 */
export function notches(specs: Omit<NotchSpec, 'idPrefix'>[], idPrefix = 'multi'): GenePathData[] {
  return specs.map((s, i) => notch({ ...s, idPrefix: `${idPrefix}-${i}` }));
}

// ════════════════════════════════════════════════════════════
// 4. 钻孔 (Drill Hole) - 小圆点
// ════════════════════════════════════════════════════════════

export interface DrillHoleSpec {
  x: number;
  y: number;
  /** 半径 (mm) */
  radius?: number;
  idPrefix?: string;
}

export function drillHole(spec: DrillHoleSpec): GenePathData {
  const r = spec.radius ?? DRILL_R;
  const idPrefix = spec.idPrefix ?? 'drill';
  return {
    id: `${idPrefix}-drill`,
    data: `M${spec.x - r},${spec.y} A${r},${r} 0 1,0 ${spec.x + r},${spec.y} A${r},${r} 0 1,0 ${spec.x - r},${spec.y} Z`,
    fill: '#000000',
    stroke: 'none',
    strokeWidth: 0,
    layer: 'drill-hole',
  };
}

// ════════════════════════════════════════════════════════════
// 5. 省道 (Dart) - 收省标识
// ════════════════════════════════════════════════════════════

export interface DartSpec {
  /** 起点 (省尖) */
  tipX: number;
  tipY: number;
  /** 省根左 */
  leg1X: number;
  leg1Y: number;
  /** 省根右 */
  leg2X: number;
  leg2Y: number;
  /** 省根中点 (用于基础线) */
  baseX: number;
  baseY: number;
  idPrefix?: string;
}

/**
 * 生成省道标识
 * 形式: 两条腿 (leg1→tip, leg2→tip) + 基础线 (leg1↔leg2) 虚线
 */
export function dart(spec: DartSpec): GenePathData[] {
  const idPrefix = spec.idPrefix ?? 'dart';
  return [
    // 省道两条腿 (实线, 表示缝合路径)
    {
      id: `${idPrefix}-dart-legs`,
      data: `M${spec.leg1X},${spec.leg1Y} L${spec.tipX},${spec.tipY} L${spec.leg2X},${spec.leg2Y}`,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 0.4,
      strokeLinecap: 'round',
      layer: 'dart',
    },
    // 省道基础线 (虚线, 表示折叠位置)
    {
      id: `${idPrefix}-dart-base`,
      data: `M${spec.leg1X},${spec.leg1Y} L${spec.baseX},${spec.baseY} L${spec.leg2X},${spec.leg2Y}`,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 0.3,
      strokeDasharray: '2,1.5',
      strokeLinecap: 'round',
      layer: 'dart',
    },
  ];
}

// ════════════════════════════════════════════════════════════
// 6. 净样线 (Cutting Line) - 加粗外轮廓
// ════════════════════════════════════════════════════════════

/**
 * 净样线 wrapper - 把现有 outline 升级为 cutting-line
 * 用于在工程中区分"用于裁剪的实线"和"辅助线"
 */
export function asCuttingLine(id: string, data: string, fill = 'none'): GenePathData {
  return {
    id,
    data,
    fill,
    stroke: '#000000',
    strokeWidth: 0.8,
    strokeLinecap: 'round',
    layer: 'cutting-line',
  };
}

/** 缝份线 wrapper - 内缩 1cm 的细线 */
export function asSeamLine(id: string, data: string): GenePathData {
  return {
    id,
    data,
    fill: 'none',
    stroke: '#000000',
    strokeWidth: 0.3,
    strokeLinecap: 'round',
    layer: 'seam-line',
  };
}
