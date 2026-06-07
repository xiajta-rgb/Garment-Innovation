/**
 * V2 参数化设计 Store
 * 连接 DAGSolver + CostEngine + UI
 * 支持男女款切换 + 设计持久化
 *
 * 商业化基础 (Milestone A):
 * - measurements: 身体测量值 (单一可信源)
 * - standardSize: 当前选择的尺码
 * - fit: 版型 (slim/regular/loose)
 * - setSize / updateMeasurements: 切换尺码或微调测量时, 自动推导所有参数
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GeneInstance, CostBreakdown, CostParameters, RuleViolation, GenderType, DesignDocument } from '@/types/gene';
import type { BodyMeasurements, StandardSize } from '@/types/measurements';
import { getDAGSolver } from '@/lib/parametric/dag-solver';
import { CostEngine, DEFAULT_COST_PARAMS } from '@/lib/bom-engine/cost-engine';
import { GENE_DEFINITIONS, getPresetsByGender, getPresetValues } from '@/data/geneLibrary';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { composePattern } from '@/lib/patterns/compose';
import { getMeasurementsBySize } from '@/data/sizeCharts';
import { measurementsToAllParams } from '@/lib/parametric/measurement-formulas';
import { db } from '@/lib/db/design-db';

type PartType = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';

export interface ParametricState {
  // 性别
  gender: GenderType;

  // 当前标准尺码 (Milestone A)
  standardSize: StandardSize;
  // 当前身体测量值 (Milestone A 单一可信源)
  measurements: BodyMeasurements;
  // 版型: slim/regular/loose
  fit: 'slim' | 'regular' | 'loose';
  // 当前激活的 Pattern ID (Block+Pattern 架构核心)
  activePatternId: string;
  // Pattern 求解后的所有路径 (供画布直接渲染, 优先级高于 instances)
  patternPaths: import('@/types/gene').GenePathData[];
  // Pattern 求解的锚点 (调试/可视化用)
  patternAnchors: Record<string, { x: number; y: number }>;

  // 当前选中的部件
  activePart: PartType;

  // 基因实例 (每个部件类型一个)
  instances: Record<PartType, GeneInstance>;

  /**
   * 纸样的前/后片视图 (paperSide) - 决定 patternPaths 的内容
   *   - 'front': 显示前片 (含 placket, button line 等)
   *   - 'back':  显示后片 (隐藏 placket 等前片专属元素)
   * 注意: 与 viewMode (渲染层) 是不同概念, 不要混淆
   */
  view: 'front' | 'back';
  /**
   * 渲染层视图模式 (renderMode) - 决定 path 的 layer 过滤
   *   - 'clean':      纯线稿 (净样线 + 明线 + 细节线)
   *   - 'industrial': 工业级纸样符号 (布纹线 + 折叠线 + 剪口 + 省道 + 钻孔)
   * 注意: 与 view (纸片前/后) 是不同概念
   */
  viewMode: 'clean' | 'industrial';

  // 颜色
  garmentColor: string;
  fabricId: string;

  // 成本
  costBreakdown: CostBreakdown | null;
  costParams: CostParameters;

  // 约束违规
  violations: RuleViolation[];

  // 当前设计 ID (null = 新建设计)
  currentDesignId: string | null;
  designName: string;
  designCreatedAt: string | null;

  // 操作
  setGender: (gender: GenderType) => void;
  setActivePart: (part: PartType) => void;
  applyPreset: (part: PartType, presetId: string) => void;
  updateParameter: (part: PartType, paramId: string, value: number | string | boolean) => void;
  setView: (view: 'front' | 'back') => void;
  /** 切换视图模式: clean(纯线稿) / industrial(工业级纸样) */
  setViewMode: (mode: 'clean' | 'industrial') => void;
  setColor: (color: string) => void;
  setFabric: (fabricId: string) => void;
  setCostParams: (params: Partial<CostParameters>) => void;
  recalculate: () => void;

  // 商业化 (Milestone A) 操作
  /** 切换标准尺码, 自动从尺码表加载测量值并重算所有部件 */
  setSize: (size: StandardSize) => void;
  /** 部分更新测量值, 自动重算所有部件 */
  updateMeasurements: (partial: Partial<BodyMeasurements>) => void;
  /** 切换版型 (slim/regular/loose) */
  setFit: (fit: 'slim' | 'regular' | 'loose') => void;
  /**
   * 切换 Pattern (Block+Pattern 架构核心 API)
   *  - 清空 AnchorRegistry
   *  - 按声明顺序求解 Pattern 中的所有 Blocks
   *  - 输出所有路径到 patternPaths, 供画布渲染
   */
  applyPattern: (patternId: string) => void;
  /**
   * 修复 #4: 拆分后, 只重算当前 pattern 的 paths/anchors, 不改 activePatternId
   * setView / setSize / setFit / setGender 内部调此方法避免 self-assign
   */
  recomputePattern: () => void;
  /** 内部: 应用测量驱动的参数推导 (从 setSize/updateMeasurements/setFit 调用) */
  _applyMeasurementDrivenParams: (m: BodyMeasurements, gender: GenderType, fit: 'slim' | 'regular' | 'loose') => void;

  // 设计持久化
  saveDesign: () => Promise<string>;
  loadDesign: (id: string) => Promise<void>;
  newDesign: () => void;
  deleteDesign: (id: string) => Promise<void>;
  setDesignName: (name: string) => void;

  // 修复 #3: 错误反馈 (applyPattern 失败时设置, UI 监听显示)
  lastError: string | null;
  clearError: () => void;
}

/** 深拷贝基因实例 */
function deepCloneInstance(inst: GeneInstance): GeneInstance {
  return {
    ...inst,
    parameterValues: { ...inst.parameterValues },
    paths: inst.paths.map((p) => ({ ...p })),
    resolvedAnchors: { ...inst.resolvedAnchors },
    violations: inst.violations.map((v) => ({ ...v })),
  };
}

/** 创建默认基因实例 */
function createDefaultInstance(category: PartType, gender: GenderType): GeneInstance {
  const gene = GENE_DEFINITIONS.find((g) => g.category === category);
  const presets = getPresetsByGender(category, gender);
  const defaultPreset = presets.find((p) =>
    category === 'body' ? p.id.includes('regular') : p.id.includes(presets[0]?.id ?? '')
  ) ?? presets[0];

  const parameterValues: Record<string, number | string | boolean> = {};
  if (gene) {
    for (const param of gene.parameters) {
      parameterValues[param.id] = param.defaultValue;
    }
  }
  if (defaultPreset) {
    Object.assign(parameterValues, defaultPreset.parameterValues);
  }

  return {
    id: `instance-${category}`,
    geneId: gene?.id ?? '',
    name: gene?.name ?? category,
    category,
    parameterValues,
    paths: [],
    resolvedAnchors: {},
    violations: [],
  };
}

/** 初始化所有实例并解算 (先清理旧实例) */
function initAllInstances(gender: GenderType): Record<PartType, GeneInstance> {
  const solver = getDAGSolver();
  // 清理旧实例，避免残留
  solver.clearAll();

  const categories: PartType[] = ['body', 'collar', 'sleeve', 'pocket', 'placket', 'cuff'];
  const instances: Record<string, GeneInstance> = {};

  for (const cat of categories) {
    const instance = createDefaultInstance(cat, gender);
    solver.registerGeneInstance(instance);
    solver.solveGeneInstance(instance.id);
    const solved = solver.getInstance(instance.id);
    instances[cat] = solved ? deepCloneInstance(solved) : instance;
  }

  return instances as Record<PartType, GeneInstance>;
}

export const useParametricStore = create<ParametricState>()(
  immer((set, get) => {
    const initialGender: GenderType = 'male';
    const initialSize: StandardSize = 'M';
    const initialMeasurements = getMeasurementsBySize(initialGender, initialSize);
    const initialInstances = initAllInstances(initialGender);
    const solver = getDAGSolver();
    const costEngine = CostEngine.getInstance();
    const initialCost = costEngine.calculateFOBCost(
      Object.values(initialInstances),
      DEFAULT_COST_PARAMS
    );

    // 修复 #1: 启动时直接调 composePattern 初始化 patternPaths, 避免首屏 usePatternMode=false
    // (zustand create 内不允许调 action, 只能内联调 composePattern)
    const initialPattern = PATTERN_LIBRARY['t-shirt'];
    let initialPatternPaths: GeneInstance['paths'] = [];
    let initialPatternAnchors: any = {};
    if (initialPattern) {
      try {
        const initDerived = measurementsToAllParams(initialMeasurements, initialGender, 'regular');
        const initFlat: Record<string, number | string | boolean> = {};
        for (const pp of Object.values(initDerived)) {
          for (const [k, v] of Object.entries(pp)) {
            if (!k.startsWith('_')) initFlat[k] = v;
          }
        }
        const initResult = composePattern(initialPattern, initFlat, initialMeasurements, initialGender, { view: 'front' });
        initialPatternPaths = initResult.paths as any;
        initialPatternAnchors = initResult.anchors;
      } catch (err) {
        console.error('[store init] initial composePattern failed:', err);
      }
    }

    return {
      gender: initialGender,
      standardSize: initialSize,
      measurements: initialMeasurements,
      fit: 'regular',
      activePatternId: 't-shirt', // 默认 T-Shirt, UI 可切换
      patternPaths: initialPatternPaths as any, // 修复 #1: 启动时初始化
      patternAnchors: initialPatternAnchors,
      viewMode: 'clean', // 商业产品默认纯线稿, 用户按需切换到工业级
      activePart: 'body',
      instances: initialInstances,
      view: 'front',
      garmentColor: '#87CEEB',
      fabricId: 'solid',
      costBreakdown: initialCost,
      costParams: { ...DEFAULT_COST_PARAMS },
      violations: [],
      currentDesignId: null,
      designName: 'Untitled Design',
      designCreatedAt: null,
      // 修复 #3: 错误反馈 (applyPattern 失败时设置, UI 监听显示)
      lastError: null as string | null,

      setGender: (gender) => {
        // 切换性别时重新初始化所有实例
        const newInstances = initAllInstances(gender);
        const newCost = costEngine.calculateFOBCost(
          Object.values(newInstances),
          get().costParams
        );
        set((s) => {
          s.gender = gender;
          s.instances = newInstances;
          s.costBreakdown = newCost;
        });
        // 修复 Issue 5: 切换性别后重跑 pattern 链路
        get().applyPattern(get().activePatternId);
        get().recalculate();
      },

      setActivePart: (part) => {
        set((s) => { s.activePart = part; });
      },

      applyPreset: (part, presetId) => {
        const presetValues = getPresetValues(part, presetId);
        if (!presetValues) return;

        const instanceId = `instance-${part}`;
        const currentInstance = solver.getInstance(instanceId);
        if (!currentInstance) return;

        for (const [key, val] of Object.entries(presetValues)) {
          currentInstance.parameterValues[key] = val;
        }
        solver.solveGeneInstance(instanceId);

        // 更新当前部件 + 所有依赖此部件的部件
        const updatedIds = new Set<string>([instanceId]);
        const dependents = solver.getDependents(instanceId);
        for (const depId of dependents) {
          solver.solveGeneInstance(depId);
          updatedIds.add(depId);
        }

        set((s) => {
          for (const id of updatedIds) {
            const solved = solver.getInstance(id);
            if (solved) {
              const cat = solved.category as PartType;
              s.instances[cat] = deepCloneInstance(solved);
            }
          }
        });

        get().recalculate();
      },

      updateParameter: (part, paramId, value) => {
        const instanceId = `instance-${part}`;
        solver.updateParameter(instanceId, paramId, value);

        // 更新当前部件 + 所有依赖此部件的部件
        const updatedIds = new Set<string>([instanceId]);
        const dependents = solver.getDependents(instanceId);
        for (const depId of dependents) {
          solver.solveGeneInstance(depId);
          updatedIds.add(depId);
        }

        set((s) => {
          for (const id of updatedIds) {
            const solved = solver.getInstance(id);
            if (solved) {
              const cat = solved.category as PartType;
              s.instances[cat] = deepCloneInstance(solved);
            }
          }
        });

        get().recalculate();
      },

      setView: (view) => {
        set((s) => { s.view = view; });
        // 修复 #2: setView 触发 applyPattern 让 placket-block/pocket-block 等 view-aware
        //   的 Block 重新求解, 后片不输出 placket/pocket, 真正视觉变化
        get().applyPattern(get().activePatternId);
      },

      // 修复 #3: 清除错误 (UI 主动 dismiss)
      clearError: () => {
        set((s) => { s.lastError = null; });
      },

      setViewMode: (mode) => {
        set((s) => { s.viewMode = mode; });
      },

      setColor: (color) => {
        set((s) => { s.garmentColor = color; });
      },

      setFabric: (fabricId) => {
        set((s) => { s.fabricId = fabricId; });
      },

      // ─── Milestone A: 测量驱动 ───
      // 通过 setSize/updateMeasurements/setFit 触发后:
      // 1. 更新 measurements
      // 2. 通过 measurement-formulas 推导所有部件参数
      // 3. 批量更新所有实例的 parameterValues
      // 4. 重解算 + 重渲染
      _applyMeasurementDrivenParams: (m, gender, fit) => {
        const derived = measurementsToAllParams(m, gender, fit);
        for (const [cat, params] of Object.entries(derived)) {
          const instance = solver.getInstance(`instance-${cat}`);
          if (instance) {
            for (const [k, v] of Object.entries(params)) {
              if (k.startsWith('_')) continue; // 跳过内部辅助值
              instance.parameterValues[k] = v;
            }
            solver.solveGeneInstance(instance.id);
          }
        }
        // 收集最新实例状态一次性更新到 store
        const updatedInstances: Record<string, GeneInstance> = {};
        for (const cat of Object.keys(derived)) {
          const solved = solver.getInstance(`instance-${cat}`);
          if (solved) updatedInstances[cat] = deepCloneInstance(solved);
        }
        set((s) => {
          for (const [cat, inst] of Object.entries(updatedInstances)) {
            s.instances[cat as PartType] = inst;
          }
        });
      },

      setSize: (size) => {
        const { gender } = get();
        const m = getMeasurementsBySize(gender, size);
        set((s) => { s.standardSize = size; s.measurements = m; });
        get()._applyMeasurementDrivenParams(m, gender, get().fit);
        // 修复 Issue 1 + #4: 切换尺码时, 重算当前 pattern 链路
        get().recomputePattern();
        get().recalculate();
      },

      updateMeasurements: (partial) => {
        const { gender, fit } = get();
        const newMeasurements = { ...get().measurements, ...partial };
        set((s) => { s.measurements = newMeasurements; });
        get()._applyMeasurementDrivenParams(newMeasurements, gender, fit);
        // 修复 Issue 1 + #4: 调整测量值时, 重算当前 pattern 链路
        get().recomputePattern();
        get().recalculate();
      },

      setFit: (fit) => {
        const { gender, measurements } = get();
        set((s) => { s.fit = fit; });
        get()._applyMeasurementDrivenParams(measurements, gender, fit);
        // 修复 Issue 1 + #4: 切换版型时, 重算当前 pattern 链路
        get().recomputePattern();
        get().recalculate();
      },

      // ─── Block+Pattern 架构主入口 ───
      applyPattern: (patternId) => {
        const pattern = PATTERN_LIBRARY[patternId];
        if (!pattern) {
          console.error(`[applyPattern] Pattern not found: ${patternId}`);
          return;
        }
        // 修复 #4: 只在 pattern 真正变化时更新 activePatternId
        if (patternId !== get().activePatternId) {
          set((s) => { s.activePatternId = patternId; });
        }
        // 总是重算 (因为 view/measurements/fit 可能已变)
        get().recomputePattern();
      },

      /**
       * 修复 #4: 只重算当前 pattern 的 paths/anchors, 不改 activePatternId
       *  - 避免 setView 调 applyPattern('t-shirt') 时的 self-assign
       *  - setSize/setFit/setGender/setView/newDesign 内部都用此方法
       */
      recomputePattern: () => {
        const { activePatternId, gender, measurements, fit, view } = get();
        const pattern = PATTERN_LIBRARY[activePatternId];
        if (!pattern) {
          console.error(`[recomputePattern] Pattern not found: ${activePatternId}`);
          return;
        }
        // 1. 测量值 → 推导参数
        const derivedParams = measurementsToAllParams(measurements, gender, fit);
        // 2. 拍平为单个对象
        const flatParams: Record<string, number | string | boolean> = {};
        for (const partParams of Object.values(derivedParams)) {
          for (const [k, v] of Object.entries(partParams)) {
            if (!k.startsWith('_')) flatParams[k] = v;
          }
        }
        // 3. 求解 Pattern
        try {
          const solution = composePattern(pattern, flatParams, measurements, gender, { view });
          set((s) => {
            s.patternPaths = solution.paths;
            s.patternAnchors = solution.anchors as any;
            s.lastError = null;
          });
          // 4. 同步到老 instance 系统 (向后兼容)
          // 修复 #9: 优先用显式 category 元数据, fallback 到 id split
          const catPaths: Record<string, typeof solution.paths> = {
            body: [], sleeve: [], collar: [], cuff: [], pocket: [], placket: [],
          };
          for (const p of solution.paths) {
            const cat = p.category ?? p.id.split('-')[0];
            if (cat in catPaths) catPaths[cat].push(p);
          }
          for (const [cat, paths] of Object.entries(catPaths)) {
            const inst = solver.getInstance(`instance-${cat}`);
            if (inst && paths.length > 0) {
              inst.paths = paths as any;
            }
          }
        } catch (err) {
          // 修复 #3 + #15: 错误信息含 patternId, 写入 store 让 UI 显示
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[recomputePattern] Compose failed (patternId=${activePatternId}):`, err);
          set((s) => { s.lastError = `Pattern 切换失败 [${activePatternId}]: ${msg}`; });
        }
      },

      setCostParams: (params) => {
        set((s) => {
          Object.assign(s.costParams, params);
        });
        get().recalculate();
      },

      recalculate: () => {
        const { instances, costParams } = get();
        const allInstances = Object.values(instances);
        const breakdown = costEngine.calculateFOBCost(allInstances, costParams);

        const allViolations: RuleViolation[] = [];
        for (const inst of allInstances) {
          allViolations.push(...inst.violations);
        }

        set((s) => {
          s.costBreakdown = breakdown;
          s.violations = allViolations;
        });
      },

      // ─── 设计持久化 ───

      saveDesign: async () => {
        const { instances, garmentColor, fabricId, costParams, gender, currentDesignId, designName, designCreatedAt, activePatternId, viewMode, view } = get();
        const now = new Date().toISOString();

        // 只保存参数快照，不保存解算结果 (加载时重新解算)
        const paramSnapshots: Record<string, GeneInstance> = {};
        for (const [cat, inst] of Object.entries(instances)) {
          paramSnapshots[cat] = {
            ...inst,
            paths: [],           // 不保存路径数据
            resolvedAnchors: {},  // 不保存锚点数据
            violations: [],       // 不保存违规数据
          };
        }

        const doc: DesignDocument = {
          id: currentDesignId ?? `design-${Date.now()}`,
          name: designName,
          gender,
          createdAt: designCreatedAt ?? now,
          updatedAt: now,
          instances: paramSnapshots,
          garmentColor,
          fabricId,
          costParams,
          tags: [gender],
          // 修复 #10: 保存 Block+Pattern 架构状态
          activePatternId,
          viewMode,
          view,
        };

        await db.saveDesign(doc);
        set((s) => {
          s.currentDesignId = doc.id;
          if (!s.designCreatedAt) s.designCreatedAt = doc.createdAt;
        });
        return doc.id;
      },

      loadDesign: async (id) => {
        const doc = await db.getDesign(id);
        if (!doc) return;

        // 清理旧实例
        solver.clearAll();

        // 重新注册所有实例到 solver
        const categories: PartType[] = ['body', 'collar', 'sleeve', 'pocket', 'placket', 'cuff'];
        const newInstances: Record<string, GeneInstance> = {};

        for (const cat of categories) {
          const instance = doc.instances[cat];
          if (instance) {
            solver.registerGeneInstance(instance);
            solver.solveGeneInstance(instance.id);
            const solved = solver.getInstance(instance.id);
            newInstances[cat] = solved ? deepCloneInstance(solved) : instance;
          } else {
            // 缺失部件用默认实例填充
            const defaultInst = createDefaultInstance(cat, doc.gender);
            solver.registerGeneInstance(defaultInst);
            solver.solveGeneInstance(defaultInst.id);
            const solved = solver.getInstance(defaultInst.id);
            newInstances[cat] = solved ? deepCloneInstance(solved) : defaultInst;
          }
        }

        set((s) => {
          s.gender = doc.gender;
          s.instances = newInstances as Record<PartType, GeneInstance>;
          s.garmentColor = doc.garmentColor;
          s.fabricId = doc.fabricId;
          s.costParams = doc.costParams;
          s.currentDesignId = doc.id;
          s.designName = doc.name;
          s.designCreatedAt = doc.createdAt;
          // 修复 #10: 恢复 Block+Pattern 架构状态
          if (doc.activePatternId) s.activePatternId = doc.activePatternId;
          if (doc.viewMode) s.viewMode = doc.viewMode;
          if (doc.view) s.view = doc.view;
        });

        get().recalculate();
        // 修复 #2: 加载后重算 patternPaths (基于恢复的 activePatternId + measurements)
        get().recomputePattern();
      },

      newDesign: () => {
        const { gender } = get();
        const newInstances = initAllInstances(gender);
        const newCost = costEngine.calculateFOBCost(
          Object.values(newInstances),
          DEFAULT_COST_PARAMS
        );
        set((s) => {
          s.instances = newInstances;
          s.costBreakdown = newCost;
          s.currentDesignId = null;
          s.designName = 'Untitled Design';
          s.designCreatedAt = null;
          s.garmentColor = '#87CEEB';
          s.fabricId = 'solid';
          s.costParams = { ...DEFAULT_COST_PARAMS };
          s.violations = [];
        });
      },

      deleteDesign: async (id) => {
        await db.deleteDesign(id);
        if (get().currentDesignId === id) {
          get().newDesign();
        }
      },

      setDesignName: (name) => {
        set((s) => { s.designName = name; });
      },
    };
  })
);
