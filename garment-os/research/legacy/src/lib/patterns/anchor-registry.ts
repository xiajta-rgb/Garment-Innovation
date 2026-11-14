/**
 * AnchorRegistry (锚点注册中心) - 修复版
 *
 * 解决 Block 间连接问题:
 *  - Body Block 产出 sp-right (front), sp-right (back), sp-right (all)
 *  - Sleeve Block 需要消费 sp-right (view-aware)
 *  - 两者通过 AnchorRegistry 协调
 *
 * 设计原则: Block 不直接引用其他 Block, 只读写共享的锚点
 * 这样新 Block 可以即插即用, 不需要修改现有 Block
 *
 * 修复 Issue (锚点查找失败):
 *  - 旧实现: register 'sp-left' with viewScope='all' 写 key='sp-left'
 *           get 'sp-left' with view='front' 查 key='front:sp-left', miss
 *  - 新实现: 嵌套 Map [view][name] = entry, get 优先 view-specific, fallback 'all'
 *           无论 view 是什么都能读到 viewScope='all' 的共享锚点
 */

import type { AnchorName, AnchorPoint, AnchorEntry } from './types';

/** 视图作用域 */
export type ViewScope = 'front' | 'back' | 'all';

/** AnchorRegistry 实现 (可实例化, 修复并发安全) */
export class AnchorRegistryImpl {
  /** 嵌套存储: view → name → entry */
  private anchors: Map<ViewScope, Map<AnchorName, AnchorEntry>> = new Map([
    ['front', new Map()],
    ['back',  new Map()],
    ['all',   new Map()],
  ]);
  private listeners: Set<() => void> = new Set();
  private notifyScheduled = false;

  /** 注册 (Block 产出) */
  register(name: AnchorName, point: AnchorPoint, producedBy: string, viewScope: ViewScope = 'all'): void {
    const existing = this.anchors.get(viewScope)?.get(name);
    this.anchors.get(viewScope)!.set(name, {
      point,
      producedBy,
      consumedBy: existing?.consumedBy ?? [],
      viewScope,
    });
    this.scheduleNotify();
  }

  /** 标记消费 (Block 需要这个锚点) */
  markConsumed(name: AnchorName, consumedBy: string, view: ViewScope = 'all'): void {
    // 修复: 优先找 view-specific, 再找 'all' 共享
    const entry = this.findEntry(name, view);
    if (entry && !entry.consumedBy.includes(consumedBy)) {
      entry.consumedBy.push(consumedBy);
      this.scheduleNotify();
    }
  }

  /** 读取 (Block 求解时获取其他 Block 产出的锚点) */
  get(name: AnchorName, view: ViewScope = 'all'): AnchorPoint | undefined {
    return this.findEntry(name, view)?.point;
  }

  /** 批量读取 (view-aware + all fallback) */
  getMany(names: AnchorName[], view: ViewScope = 'all'): Partial<Record<AnchorName, AnchorPoint>> {
    const result: Partial<Record<AnchorName, AnchorPoint>> = {};
    for (const n of names) {
      const p = this.get(n, view);
      if (p) result[n] = p;
    }
    return result;
  }

  /**
   * 修复 B1: 查找入口, 优先级:
   *  1. 严格匹配 view + name (e.g. front + sp-left)
   *  2. fallback 到 'all' + name (共享锚点)
   */
  private findEntry(name: AnchorName, view: ViewScope): AnchorEntry | undefined {
    if (view !== 'all') {
      const specific = this.anchors.get(view)?.get(name);
      if (specific) return specific;
    }
    return this.anchors.get('all')?.get(name);
  }

  /**
   * 获取所有锚点 (调试用)
   * 修复 Issue 9: 顺序依赖 Map 迭代 - 改为显式优先级
   *  - 优先 'all' (共享锚点, 大多数 Block 关心这个)
   *  - 再 'front' (前视图专属)
   *  - 再 'back' (后视图专属)
   */
  getAll(): Partial<Record<AnchorName, AnchorPoint>> {
    const result: Partial<Record<AnchorName, AnchorPoint>> = {};
    // 显式优先级, 不依赖 Map 迭代顺序
    for (const view of ['all', 'front', 'back'] as ViewScope[]) {
      const map = this.anchors.get(view);
      if (!map) continue;
      for (const [name, entry] of map) {
        if (!(name in result)) result[name] = entry.point;
      }
    }
    return result;
  }

  /** 清空 (切换 Pattern 前调用) */
  clear(): void {
    for (const map of this.anchors.values()) map.clear();
    this.scheduleNotify();
  }

  /** 订阅变化 - 修复批量通知 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 调度批量通知 */
  private scheduleNotify(): void {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.notifyScheduled = false;
      for (const l of this.listeners) l();
    });
  }

  /** 调试: 列出所有未消费的锚点 (潜在死代码) */
  findUnconsumed(): AnchorName[] {
    const result: AnchorName[] = [];
    for (const [view, map] of this.anchors) {
      for (const [name, entry] of map) {
        if (entry.consumedBy.length === 0) {
          // 去重: 只返回 'all' 的, 避免同一 name 重复报告
          if (view === 'all') result.push(name);
        }
      }
    }
    return result;
  }
}

/** 全局单例 (向后兼容) */
export const AnchorRegistry = new AnchorRegistryImpl();
