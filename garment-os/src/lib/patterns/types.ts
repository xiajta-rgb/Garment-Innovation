/**
 * Block + Pattern 架构核心类型定义
 *
 * 这是商业化系统的基础抽象。
 *
 * ── 三层结构 ──
 *  1. Anchor (锚点)        - 跨 Block 的几何连接点, e.g. 肩点 sp-right
 *  2. Block  (版片)         - 原子化的纸样片, 声明 inputs/outputs, 产出路径
 *  3. Pattern (服装模板)    - 由多个 Block 组成, 描述完整服装
 *
 * ── 关键约束 ──
 *  - Block 是无状态的: 输入 + 参数 → 输出路径 + 输出锚点
 *  - Block 通过 AnchorRegistry 共享锚点, 不直接依赖其他 Block
 *  - Pattern 决定哪些 Block 参与, 它们的连接顺序, 默认参数
 *  - 换 Pattern = 换 Block 集合 + 换连接关系, 几何真正改变
 */

import type { GenePathData } from '@/types/gene';
import type { BodyMeasurements } from '@/types/measurements';

// ════════════════════════════════════════════════════════
// 1. Anchor (锚点) - 跨 Block 的几何连接点
// ════════════════════════════════════════════════════════

/** 锚点坐标 (mm, SVG 坐标系) */
export interface AnchorPoint {
  x: number;
  y: number;
}

/** 预定义锚点名称 (Block 间约定的连接点 ID) */
export type AnchorName =
  // 衣身相关 (Bodice)
  | 'sp-left' | 'sp-right'         // 肩点 Shoulder Point
  | 'ap-left' | 'ap-right'         // 袖窿底 Armhole Point
  | 'sn-left' | 'sn-right'         // 颈侧点 Side Neck
  | 'cf-neck' | 'cf-waist' | 'cf-hem'  // 前中心 Center Front
  | 'cb-neck' | 'cb-waist' | 'cb-hem'  // 后中心 Center Back
  | 'side-waist-left' | 'side-waist-right'
  | 'side-hem-left' | 'side-hem-right'
  // 袖子相关 (Sleeve)
  | 'sleeve-cap-left' | 'sleeve-cap-right'
  | 'sleeve-cuff-top-left' | 'sleeve-cuff-top-right'
  | 'sleeve-cuff-bottom-left' | 'sleeve-cuff-bottom-right'
  // 通用
  | string;  // 允许扩展 (e.g. 'placket-top')

/** 锚点注册项 (在 AnchorRegistry 中存储) */
export interface AnchorEntry {
  /** 坐标 */
  point: AnchorPoint;
  /** 由哪个 Block 产生 (blockId) */
  producedBy: string;
  /** 哪些 Block 消费 */
  consumedBy: string[];
  /**
   * 锚点所属视图 (front/back/all) - 修复 Issue 4
   * 用于区分同一 Block 在 front/back 两个视图产出的同名锚点
   * 'all' = 共享 (e.g. sleeve-cap 不区分前后)
   */
  viewScope: 'front' | 'back' | 'all';
}

// ════════════════════════════════════════════════════════
// 2. Block (版片) - 原子化的纸样片
// ════════════════════════════════════════════════════════

/** Block 类别 (决定在画布上的语义层) */
export type BlockCategory = 'body' | 'sleeve' | 'collar' | 'cuff' | 'pocket' | 'placket';

/**
 * Block 输入声明 - 表达"我需要什么"
 *  - anchor: 需要从其他 Block 获取的几何连接点
 *  - param:  用户/测量值提供的参数
 */
export interface BlockInput {
  /** 必需锚点 (必须在 AnchorRegistry 中找到) */
  anchors?: AnchorName[];
  /** 必需参数 (从 measurement-formulas 推导) */
  params?: string[];
}

/**
 * Block 输出声明 - 表达"我产出什么"
 *  - paths: SVG 路径集合
 *  - anchors: 暴露给其他 Block 的几何连接点
 */

/** 锚点作用域 (front/back/all) - 修复 Issue 6/8: 显式声明替代字符串约定 */
export type AnchorScope = 'front' | 'back' | 'all';

export interface BlockOutput {
  /** 此 Block 产出的路径 (供画布渲染) */
  paths: GenePathData[];
  /**
   * 此 Block 产出的锚点 (供其他 Block 消费)
   * 默认 viewScope='all' (共享) - 简化大多数场景
   */
  anchors: Partial<Record<AnchorName, AnchorPoint>>;
  /**
   * 修复 Issue 6/8: 显式 viewScope 声明
   * Block 内部可指定每个 anchor 的视图作用域, 替代 compose.ts 中的字符串前缀约定
   * - 缺省: 该 anchor 用默认 'all' (共享)
   * - 提供时: 覆盖默认
   */
  anchorScopes?: Partial<Record<AnchorName, AnchorScope>>;
}

/**
 * Block 抽象接口 - 任何纸样片都需实现
 */
export interface BlockDefinition {
  /** Block ID (库内唯一) */
  id: string;
  /** 显示名 */
  name: string;
  /** 类别 */
  category: BlockCategory;
  /** 输入声明 (运行时会被填充实际值) */
  inputs: BlockInput;
  /**
   * 求解函数: 接收参数+锚点, 输出路径+锚点
   * 这是纯函数: 同样输入永远产生同样输出
   */
  solve: (ctx: BlockSolveContext) => BlockOutput;
}

/** Block 求解时的运行时上下文 */
export interface BlockSolveContext {
  /** 用户提供的参数 (数字/字符串/布尔) */
  params: Record<string, number | string | boolean>;
  /** 来自 AnchorRegistry 的输入锚点 (按 AnchorName 索引) */
  anchors: Partial<Record<AnchorName, AnchorPoint>>;
  /** 当前身体测量值 (用于派生) */
  measurements?: BodyMeasurements;
  /** 性别 (派生参数可能因性别不同) */
  gender?: 'male' | 'female' | 'unisex';
  /**
   * 视图 (front/back) - 修复 Issue 3
   * Block 内部可读此字段决定是产出前片还是后片路径/锚点
   * 单一大身模块也可以生成前/后两份不同的输出
   */
  view?: 'front' | 'back';
}

// ════════════════════════════════════════════════════════
// 3. Pattern (服装模板) - 由多个 Block 组成
// ════════════════════════════════════════════════════════

/** Pattern 类别 (用于 UI 分类) */
export type PatternCategory = 't-shirt' | 'shirt' | 'polo' | 'jacket' | 'dress' | 'skirt' | 'pants';

/** Pattern 中的一个 Block 引用 */
export interface PatternBlockRef {
  /** 引用的 Block ID */
  blockId: string;
  /** 此实例的覆盖参数 (覆盖 Block 默认) */
  params?: Record<string, number | string | boolean>;
  /** 在画布上的位置 (mm) */
  position?: AnchorPoint;
  /** 是否镜像 */
  mirror?: boolean;
  /** 旋转角度 (度) */
  rotation?: number;
}

/** 完整 Pattern 定义 */
export interface PatternDefinition {
  /** Pattern ID (库内唯一) */
  id: string;
  /** 显示名 */
  name: string;
  /** 描述 */
  description: string;
  /** 类别 */
  category: PatternCategory;
  /** 缩略图 (SVG path) */
  thumbnail?: string;
  /** 默认 Block 列表 (按求解顺序) */
  blocks: PatternBlockRef[];
  /** 默认参数 (从 size chart 推导后的覆盖) */
  defaultParams?: Record<string, number | string | boolean>;
}

// ════════════════════════════════════════════════════════
// 4. Block 求解结果 (供渲染器使用)
// ════════════════════════════════════════════════════════

/** Pattern 求解后的产物 (给画布用) */
export interface PatternSolution {
  /** 所有 Block 输出的路径 (按 Block 求解顺序) */
  paths: GenePathData[];
  /** 求解过程产生的所有锚点 (调试用) */
  anchors: Partial<Record<AnchorName, AnchorPoint>>;
  /** 求解时间 (ms, 性能监控) */
  solveTimeMs: number;
}
