/**
 * Pattern 组合引擎 (Composition Engine)
 *
 * 核心职责: 把 PatternDefinition 中声明的 Blocks 按依赖顺序求解,
 *          通过 AnchorRegistry 协调 Block 间的连接
 *
 * 求解流程:
 *  1. 清空 AnchorRegistry
 *  2. 对 Pattern.blocks 列表中的每个 BlockRef:
 *     a. 取出对应 BlockDefinition
 *     b. 合并参数 (block defaults < pattern defaults < ref override < runtime extra)
 *     c. 从 AnchorRegistry 取出 Block 声明的输入锚点 (view-aware)
 *     d. 调用 Block.solve() 得到 paths + 输出锚点
 *     e. 把输出锚点注册到 AnchorRegistry (标记此 Block 为 producer, 带 viewScope)
 *     f. 应用变换 (position / mirror / rotation) 到输出路径
 *     g. 收集所有 paths
 *  3. 返回 PatternSolution
 *
 * 修复 Issue 6: 缺锚点严格验证 (默认 strict, 缺关键锚点抛错)
 * 修复 Issue 7: 实现 position/mirror/rotation 变换
 * 修复 Issue 10: 修正 mergedParams 注释, 加上"block default"层
 */

import type {
  PatternDefinition,
  PatternBlockRef,
  BlockDefinition,
  BlockSolveContext,
  BlockOutput,
  PatternSolution,
  AnchorName,
} from './types';
import { BLOCK_LIBRARY } from './block-library';
import { AnchorRegistry, AnchorRegistryImpl, type ViewScope } from './anchor-registry';

/** 组合错误 (缺锚点 / 缺 Block) */
export class CompositionError extends Error {
  constructor(message: string, public readonly blockId?: string) {
    super(message);
    this.name = 'CompositionError';
  }
}

/** 严格性级别 */
export type CompositionStrictness = 'strict' | 'lenient' | 'silent';

/** composePattern 完整选项 */
export interface ComposeOptions {
  /** 视图 (front/back) - 修复 Issue 3, 决定 anchor 的 viewScope */
  view?: 'front' | 'back';
  /** 严格性, 默认 'strict' (修复 Issue 6) */
  strictness?: CompositionStrictness;
  /** 自定义 registry (修复 Issue 8, 默认全局单例) */
  registry?: AnchorRegistryImpl;
  /** 用户手动覆盖参数 (来自滑块), 优先级高于 defaultParams 但低于 ref.params */
  userOverrides?: Record<string, number | string | boolean>;
}

const CRITICAL_ANCHORS: AnchorName[] = ['sp-left', 'sp-right', 'ap-left', 'ap-right'];

/**
 * 组合 Pattern - 主入口
 */
export function composePattern(
  pattern: PatternDefinition,
  extraParams?: Record<string, number | string | boolean>,
  measurements?: BlockSolveContext['measurements'],
  gender?: BlockSolveContext['gender'],
  options: ComposeOptions = {}
): PatternSolution {
  const view = options.view ?? 'front';
  const strictness = options.strictness ?? 'strict';
  const registry = options.registry ?? AnchorRegistry;
  const t0 = performance.now();

  // 1. 清空 registry
  registry.clear();

  // 2. 累计所有路径
  const allPaths: PatternSolution['paths'] = [];

  // 3. 依次求解每个 Block
  for (const ref of pattern.blocks) {
    const block = BLOCK_LIBRARY[ref.blockId];
    if (!block) {
      throw new CompositionError(`Block not found: ${ref.blockId}`, ref.blockId);
    }

    // 合并参数: block default < runtime derived < pattern default < user overrides < ref override
    // 优先级说明:
    //  - extraParams (运行时推导值) 最低, 仅补充默认值
    //  - pattern.defaultParams 模板定义的合理坐标值, 覆盖推导值
    //  - userOverrides 用户通过滑块手动调整的参数, 覆盖模板默认值
    //  - ref.params 模板结构覆盖 (如 collarType/sleeveType), 优先级最高
    const mergedParams: Record<string, number | string | boolean> = {
      ...(block.inputs.params ? {} : {}), // block default 占位 (目前为空)
      ...(extraParams ?? {}),
      ...(pattern.defaultParams ?? {}),
      ...(options.userOverrides ?? {}),
      ...(ref.params ?? {}),
    };

    // 取出声明的输入锚点 (view-aware)
    const inputAnchors: AnchorName[] = block.inputs.anchors ?? [];
    const availableAnchors = registry.getMany(inputAnchors, view);

    // 修复 Issue 6: 缺锚点严格验证
    for (const required of inputAnchors) {
      if (!(required in availableAnchors)) {
        const isCritical = CRITICAL_ANCHORS.includes(required);
        if (strictness === 'strict' && isCritical) {
          throw new CompositionError(
            `Block "${block.id}" missing critical anchor "${required}" in view "${view}". ` +
            `Check Pattern block order and ensure producer runs first.`,
            block.id
          );
        }
        if (strictness === 'lenient') {
          console.warn(`[compose] Block "${block.id}" missing anchor "${required}" in view "${view}" — using default`);
        }
        // silent: 不输出
      }
    }

    // 构造求解上下文
    const ctx: BlockSolveContext = {
      params: mergedParams,
      anchors: availableAnchors,
      measurements,
      gender,
      view, // 修复 Issue 3
    };

    // 求解
    let output: BlockOutput;
    try {
      output = block.solve(ctx);
    } catch (err) {
      throw new CompositionError(
        `Block "${block.id}" solve failed: ${err instanceof Error ? err.message : String(err)}`,
        block.id
      );
    }

    // 注册输出锚点 (带 viewScope)
    // 修复 #7: 只用 Block 显式声明的 anchorScopes, 无 fallback (避免 string-prefix 死代码)
    // 所有 Block 必须显式返回 anchorScopes (即使全 'all')
    for (const [name, point] of Object.entries(output.anchors)) {
      if (point) {
        const viewScope: ViewScope = (output.anchorScopes?.[name as AnchorName] as ViewScope) ?? 'all';
        registry.register(name as AnchorName, point, block.id, viewScope);
      }
    }

    // 标记消费
    for (const name of inputAnchors) {
      registry.markConsumed(name, block.id, view);
    }

    // 修复 Issue 7: 应用变换 (position / mirror / rotation)
    const transformedPaths = applyTransform(output.paths, ref);

    // 收集路径
    allPaths.push(...transformedPaths);
  }

  const solveTimeMs = performance.now() - t0;

  return {
    paths: allPaths,
    anchors: registry.getAll(),
    solveTimeMs,
  };
}

/**
 * 修复 Issue 1+2+3: 应用 Block 引用声明的变换 (position/mirror/rotation)
 *
 * 之前实现 (废弃): 用正则修改 SVG path d 字符串
 *   - 错误: C 命令 6 个数字, 正则只匹配 2 个 → 路径损坏
 *   - 错误: 漏 A/S/T 命令 → 弧线/平滑曲线变换失败
 *   - 错误: 小写相对坐标不处理
 *
 * 新实现: 构造 SVG transform 属性, 由渲染器 <path transform="..."> 应用
 *   - 支持所有 SVG 变换 (translate/rotate/scale/matrix)
 *   - 支持相对/绝对坐标 (浏览器自动处理)
 *   - 支持所有路径命令 (A/S/T/V/H/C/L/Q/M/Z)
 */
function applyTransform(paths: BlockOutput['paths'], ref: PatternBlockRef): BlockOutput['paths'] {
  const { position, mirror, rotation } = ref;
  if (!position && !mirror && !rotation) return paths;

  // 构造 transform 字符串 (SVG 变换从右到左应用)
  // 顺序: mirror 在最右 (最先应用), 然后 rotate, 最后 translate
  const transformParts: string[] = [];
  if (mirror) {
    // 水平镜像: scale(-1, 1) 后 translate(-2*cx, 0) 让画布回到可见区域
    // 画布中心在 (100, 100), 宽度 200, 所以 translate(-200, 0)
    transformParts.push('scale(-1,1)', 'translate(-200,0)');
  }
  if (rotation) {
    transformParts.push(`rotate(${rotation},100,100)`);
  }
  if (position) {
    transformParts.push(`translate(${position.x},${position.y})`);
  }
  const transformStr = transformParts.join(' ');

  return paths.map((p) => ({ ...p, transform: transformStr }));
}

/**
 * 列出 Pattern 涉及的所有 Block (调试)
 */
export function listPatternBlocks(pattern: PatternDefinition): Array<{ ref: PatternBlockRef; def: BlockDefinition }> {
  return pattern.blocks
    .map((ref) => {
      const def = BLOCK_LIBRARY[ref.blockId];
      return def ? { ref, def } : null;
    })
    .filter((x): x is { ref: PatternBlockRef; def: BlockDefinition } => x !== null);
}
