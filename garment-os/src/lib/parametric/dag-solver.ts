/**
 * V2 参数化基因引擎 — DAG 几何解算器
 * 基于 V2 开发文档 §3.1.2
 *
 * 核心职责:
 * 1. 管理基因实例的注册与依赖图
 * 2. 参数变更时触发增量解算
 * 3. 路由到各部件生成器生成 SVG 路径
 * 4. 工艺约束校验
 *
 * 几何生成已拆分为 generators/ 子模块
 * 工具函数在 utils.ts, 约束校验在 constraints.ts
 */

import type { GeneInstance, GenePathData, RuleViolation } from '@/types/gene';
import { num, cubicBezierArcLength } from './utils';
import { validateBuiltInConstraints } from './constraints';
import { generateGeometry } from './generators';

// ─── DAG 解算器 ───

export class DAGSolver {
  private geneInstances: Map<string, GeneInstance> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();
  private listeners: Set<() => void> = new Set();

  /** 注册基因实例 (自动建立跨部件依赖) */
  registerGeneInstance(instance: GeneInstance): void {
    this.geneInstances.set(instance.id, instance);

    // 建立依赖边: sleeve/collar → body, cuff → sleeve + body
    const deps: string[] = [];
    switch (instance.category) {
      case 'sleeve':
      case 'collar':
      case 'pocket':
      case 'placket':
        deps.push('instance-body');
        break;
      case 'cuff':
        deps.push('instance-sleeve', 'instance-body');
        break;
    }
    this.dependencyGraph.set(instance.id, deps);
  }

  /** 移除基因实例 */
  removeGeneInstance(instanceId: string): void {
    this.geneInstances.delete(instanceId);
    this.dependencyGraph.delete(instanceId);
  }

  /** 获取依赖于指定实例的所有实例 ID (反向依赖) */
  getDependents(instanceId: string): string[] {
    const result: string[] = [];
    for (const [id, deps] of this.dependencyGraph.entries()) {
      if (deps.includes(instanceId)) {
        result.push(id);
      }
    }
    return result;
  }

  /** 清除所有实例 */
  clearAll(): void {
    this.geneInstances.clear();
    this.dependencyGraph.clear();
  }

  /**
   * 更新参数并触发解算 (修复 #4: 递归触发所有依赖节点重新求解)
   *  - 旧实现: 只解算当前 instance, 依赖的子节点 (sleeve→body) 不刷新
   *  - 新实现: 用 getDependents 递归解算所有下游
   *    例如: 改 body.shoulderWidth → sleeve 袖窿曲线应自动跟随
   */
  updateParameter(
    instanceId: string,
    paramId: string,
    value: number | string | boolean
  ): GeneInstance | null {
    const instance = this.geneInstances.get(instanceId);
    if (!instance) return null;

    instance.parameterValues[paramId] = value;

    // 触发当前 instance 解算
    this.solveGeneInstance(instanceId);

    // 修复 #4: 递归触发所有依赖节点 (下游) 重新求解
    //  - getDependents 返回所有反向依赖
    //  - BFS 遍历, 避免循环依赖死循环
    const visited = new Set<string>([instanceId]);
    const queue: string[] = this.getDependents(instanceId);
    while (queue.length > 0) {
      const depId = queue.shift()!;
      if (visited.has(depId)) continue;
      visited.add(depId);
      this.solveGeneInstance(depId);
      // 下游的下游也要解算 (transitive)
      for (const transitive of this.getDependents(depId)) {
        if (!visited.has(transitive)) queue.push(transitive);
      }
    }

    // 通知监听器
    this.listeners.forEach((fn) => fn());

    return instance;
  }

  /** 解算单个基因实例 */
  solveGeneInstance(instanceId: string): GeneInstance | null {
    const instance = this.geneInstances.get(instanceId);
    if (!instance) return null;

    // 先解算依赖
    this.solveDependencies(instanceId);

    // 执行几何生成
    try {
      instance.paths = this.executeGeometryGenerator(instance);
    } catch (e) {
      console.error(`Geometry generation error for ${instanceId}:`, e);
    }

    // 解算锚点
    this.resolveAnchors(instance);

    // 约束校验
    instance.violations = this.validateConstraints(instance);

    return instance;
  }

  /** 解算所有实例 */
  solveAll(): void {
    for (const id of this.geneInstances.keys()) {
      this.solveGeneInstance(id);
    }
    this.listeners.forEach((fn) => fn());
  }

  /** 获取所有实例 */
  getInstances(): GeneInstance[] {
    return Array.from(this.geneInstances.values());
  }

  /** 获取单个实例 */
  getInstance(id: string): GeneInstance | undefined {
    return this.geneInstances.get(id);
  }

  /** 监听变更 */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ─── 内部方法 ───

  private solveDependencies(instanceId: string): void {
    const deps = this.dependencyGraph.get(instanceId) || [];
    for (const depId of deps) {
      this.solveGeneInstance(depId);
    }
  }

  private executeGeometryGenerator(instance: GeneInstance): GenePathData[] {
    // 传入所有实例以支持跨部件依赖 (如袖子读取衣身锚点)
    return generateGeometry(instance, this.getInstances());
  }

  /** 解算后填充 resolvedAnchors */
  private resolveAnchors(instance: GeneInstance): void {
    const p = instance.parameterValues;
    const anchors: Record<string, { x: number; y: number; meta?: Record<string, number> }> = {};

    // 获取 body 实例的 anchors (供其他部件复用)
    const allInstances = this.getInstances();
    const bodyInst = allInstances.find((i) => i.category === 'body');
    const bodyAnchors = bodyInst?.resolvedAnchors ?? {};

    switch (instance.category) {
      case 'body': {
        const cx = 100;
        const sw = num(p, 'shoulderWidth', 32);
        const sy = num(p, 'shoulderY', 48);
        const nfy = num(p, 'neckFrontY', 34);
        const ad = num(p, 'armholeDepth', 96);
        const wy = num(p, 'waistY', 140);
        const hy = num(p, 'hipY', 172);
        const hyY = num(p, 'hemLength', 224);
        const hw = num(p, 'hemWidth', 42);

        // 肩/颈/袖窿锚点
        anchors['sp-left'] = { x: cx - sw, y: sy };
        anchors['sp-right'] = { x: cx + sw, y: sy };
        anchors['sn-left'] = { x: cx - sw + 44, y: sy - 6 };
        anchors['sn-right'] = { x: cx + sw - 44, y: sy - 6 };
        anchors['ap-left'] = { x: cx - sw + 4, y: ad };
        anchors['ap-right'] = { x: cx + sw - 4, y: ad };

        // 中心线锚点 (前中心线)
        anchors['cf-neck'] = { x: cx, y: nfy };
        anchors['cf-waist'] = { x: cx, y: wy };
        anchors['cf-hem'] = { x: cx, y: hyY + 4 };

        // 侧缝锚点 (左右)
        const waistSuppression = num(p, 'waistSuppression', 8);
        const sideWaistOffset = waistSuppression * 0.3;
        anchors['side-waist-left'] = { x: cx - sw + sideWaistOffset, y: wy };
        anchors['side-waist-right'] = { x: cx + sw - sideWaistOffset, y: wy };
        anchors['side-hem-left'] = { x: cx - hw, y: hyY };
        anchors['side-hem-right'] = { x: cx + hw, y: hyY };

        // 胸围/腰围/臀围水平参考线
        anchors['bust-line'] = { x: cx, y: ad + 4, meta: { width: sw * 2 } };
        anchors['waist-line'] = { x: cx, y: wy, meta: { width: (sw - sideWaistOffset) * 2 } };
        anchors['hip-line'] = { x: cx, y: hy, meta: { width: hw * 2 } };

        // 袖窿曲线长度 (用于 sleeve cap 高度)
        // 袖窿曲线: sp → 控制点1 → 控制点2 → ap
        const ahCtrlX = Math.max(2, sw * 0.12);
        const ahCtrlY1 = sy + (ad - sy) * 0.15;
        const ahCtrlY2 = sy + (ad - sy) * 0.35;
        // 累计两段 cubic Bezier 弧长
        const seg1 = cubicBezierArcLength(
          cx + sw, sy,
          cx + sw - ahCtrlX, sy + 1,
          cx + sw - ahCtrlX - 4, ahCtrlY1,
          cx + sw - ahCtrlX - 6, ahCtrlY2
        );
        const seg2 = cubicBezierArcLength(
          cx + sw - ahCtrlX - 6, ahCtrlY2,
          cx + sw - ahCtrlX - 2, sy + (ad - sy) * 0.55,
          cx + sw + 1, sy + (ad - sy) * 0.75,
          cx + sw - 4, ad
        );
        const armholeCurveLen = (seg1 + seg2) * 2; // 镜像左右
        anchors['armhole-curve-length'] = { x: 0, y: 0, meta: { length: armholeCurveLen } };

        break;
      }
      case 'collar': {
        const spread = num(p, 'collarSpread', 28);
        const collarHeight = num(p, 'collarHeight', 14);
        const collarType = String(p.collarType ?? 'round');
        anchors['sn-left'] = { x: 100 - spread, y: 42 };
        anchors['sn-right'] = { x: 100 + spread, y: 42 };
        // 领外底 Y (门襟起点参考)
        // V/lapel: 领口底 = neckFrontY + collarHeight * 2.5/3.5
        // mandarin/turtle: 领座顶 (snY - 16)
        // round/square/boat: 领口底 = neckFrontY
        const nfy = bodyAnchors['cf-neck']?.y ?? 34;
        let collarBottomY: number;
        switch (collarType) {
          case 'v': collarBottomY = nfy + collarHeight * 2.5; break;
          case 'lapel': collarBottomY = nfy + collarHeight * 3.5; break;
          case 'mandarin': case 'turtle': collarBottomY = 42 - 16; break;
          default: collarBottomY = nfy;
        }
        anchors['collar-bottom'] = { x: 100, y: collarBottomY };
        break;
      }
      case 'sleeve': {
        // 复用 body 的 sp/ap 锚点 (整合点: sleeve 缝在 body 上)
        if (bodyAnchors['sp-left']) {
          anchors['sp-left'] = bodyAnchors['sp-left'];
          anchors['sp-right'] = bodyAnchors['sp-right'];
          anchors['ap-left'] = bodyAnchors['ap-left'];
          anchors['ap-right'] = bodyAnchors['ap-right'];
        }
        // 袖口位置
        const sleeveLength = num(p, 'sleeveLength', 160);
        const cuffW = num(p, 'cuffWidth', 14);
        const spY = anchors['sp-right']?.y ?? 48;
        const spX = anchors['sp-right']?.x ?? 132;
        const cuffY = spY + sleeveLength;
        // 袖子自然下垂偏移
        const dropOffset = sleeveLength * 0.25;
        const rSleeveEndX = spX - dropOffset;
        anchors['cuff-top-left'] = { x: 100 - rSleeveEndX + cuffW, y: cuffY };
        anchors['cuff-top-right'] = { x: rSleeveEndX, y: cuffY };
        // 袖窿曲线长度 (从 body)
        const armholeCurveLen = bodyAnchors['armhole-curve-length']?.meta?.length ?? 0;
        anchors['sleeve-cap-arc-length'] = { x: 0, y: 0, meta: { length: armholeCurveLen } };
        break;
      }
      case 'cuff': {
        // 袖口依赖于 sleeve
        const sleeveInst = allInstances.find((i) => i.category === 'sleeve');
        if (sleeveInst?.resolvedAnchors) {
          const sa = sleeveInst.resolvedAnchors;
          if (sa['cuff-top-left'] && sa['cuff-top-right']) {
            anchors['cuff-top-left'] = sa['cuff-top-left'];
            anchors['cuff-top-right'] = sa['cuff-top-right'];
            // 袖口底部 (cuff 高度由 sleeve cuffWidth 决定)
            const cuffH = num(p, 'cuffHeight', 14);
            anchors['cuff-bottom-left'] = { x: sa['cuff-top-left'].x, y: sa['cuff-top-left'].y + cuffH };
            anchors['cuff-bottom-right'] = { x: sa['cuff-top-right'].x, y: sa['cuff-top-right'].y + cuffH };
          }
        }
        break;
      }
    }

    instance.resolvedAnchors = anchors;
  }

  private validateConstraints(instance: GeneInstance): RuleViolation[] {
    return validateBuiltInConstraints(instance);
  }
}

// ─── 单例导出 ───

// 修复 #8: HMR 安全 - 用 globalThis 缓存, 避免 Vite 热更新时 stale 引用
// Vite HMR 会重新执行模块, 但 module-scope let 会被重置为 null
// 用 globalThis 让实例跨 HMR 周期持续存在
const SOLVER_KEY = '__garment_os_dag_solver__';

export function getDAGSolver(): DAGSolver {
  const g = globalThis as any;
  if (!g[SOLVER_KEY]) {
    g[SOLVER_KEY] = new DAGSolver();
  }
  return g[SOLVER_KEY] as DAGSolver;
}

/** 重置 singleton (测试 / 调试用) */
export function resetDAGSolver(): void {
  const g = globalThis as any;
  if (g[SOLVER_KEY]) {
    g[SOLVER_KEY].clearAll();
  }
  g[SOLVER_KEY] = null;
}
