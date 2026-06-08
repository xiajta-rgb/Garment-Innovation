/**
 * DAG 参数化解算器
 * 连接基因实例 → 依赖图 → 几何生成 → 锚点解析 → 约束校验
 *
 * 锚点解析已拆分至:
 * - anchor-resolver.ts (resolveAnchors)
 */

import type { GeneInstance, GenePathData, RuleViolation } from '@/types/gene';
import { validateBuiltInConstraints } from './constraints';
import { generateGeometry } from './generators';
import { resolveAnchors } from './anchor-resolver';

// ─── DAG 解算器 ───

export class DAGSolver {
  private geneInstances: Map<string, GeneInstance> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();
  private listeners: Set<() => void> = new Set();

  /** 注册基因实例 (自动建立跨部件依赖) */
  registerGeneInstance(instance: GeneInstance): void {
    this.geneInstances.set(instance.id, instance);

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
   * 更新参数并触发解算
   * 递归触发所有依赖节点 (下游) 重新求解
   */
  updateParameter(
    instanceId: string,
    paramId: string,
    value: number | string | boolean
  ): GeneInstance | null {
    const instance = this.geneInstances.get(instanceId);
    if (!instance) return null;

    instance.parameterValues[paramId] = value;
    this.solveGeneInstance(instanceId);

    // BFS 遍历下游依赖
    const visited = new Set<string>([instanceId]);
    const queue: string[] = this.getDependents(instanceId);
    while (queue.length > 0) {
      const depId = queue.shift()!;
      if (visited.has(depId)) continue;
      visited.add(depId);
      this.solveGeneInstance(depId);
      for (const transitive of this.getDependents(depId)) {
        if (!visited.has(transitive)) queue.push(transitive);
      }
    }

    this.listeners.forEach((fn) => fn());
    return instance;
  }

  /** 解算单个基因实例 */
  solveGeneInstance(instanceId: string): GeneInstance | null {
    const instance = this.geneInstances.get(instanceId);
    if (!instance) return null;

    this.solveDependencies(instanceId);

    try {
      instance.paths = this.executeGeometryGenerator(instance);
    } catch (e) {
      console.error(`Geometry generation error for ${instanceId}:`, e);
    }

    // 锚点解析 (委托给 anchor-resolver)
    instance.resolvedAnchors = resolveAnchors(instance, this.getInstances());

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
    return generateGeometry(instance, this.getInstances());
  }

  private validateConstraints(instance: GeneInstance): RuleViolation[] {
    return validateBuiltInConstraints(instance);
  }
}

// ─── 单例导出 ───

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
