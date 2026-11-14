/**
 * V2 参数化设计 Store
 * 连接 DAGSolver + CostEngine + UI
 * 支持男女款切换 + 设计持久化
 *
 * 纯逻辑已拆分至:
 * - store/store-helpers.ts (deepCloneInstance, createDefaultInstance, initAllInstances)
 * - store/helpers/pattern-compute.ts (recomputePatternLogic)
 * - store/helpers/measurement-driven.ts (applyMeasurementDrivenParams)
 * - store/helpers/persistence.ts (saveDesignToDB, loadDesignFromDB, deleteDesignFromDB)
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GeneInstance, CostBreakdown, CostParameters, RuleViolation, GenderType } from '@/types/gene';
import type { BodyMeasurements, StandardSize } from '@/types/measurements';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { getDAGSolver } from '@/lib/parametric/dag-solver';
import { CostEngine, DEFAULT_COST_PARAMS } from '@/lib/bom-engine/cost-engine';
import { getPresetValues } from '@/data/geneLibrary';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { composePattern } from '@/lib/patterns/compose';
import { measurementsToAllParams } from '@/lib/parametric/measurement-formulas';
import { deepCloneInstance, initAllInstances } from './store-helpers';
import { recomputePatternLogic } from './helpers/pattern-compute';
import { applyMeasurementDrivenParams } from './helpers/measurement-driven';
import { saveDesignToDB, loadDesignFromDB, deleteDesignFromDB } from './helpers/persistence';
import { pushParamHistory, undoParam, redoParam, getParamHistoryState, resetParamHistory } from './helpers/param-history';
import { useBomStore } from './bomStore';
import { requireReviewedPattern } from '@/data/patternReview';
import { resolveReviewedImport } from '@/lib/pattern/reviewed-import';
import type { PatternExportEnvelope } from '@/lib/pattern/pattern-io';


type PartType = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';

export interface ParametricState {
  gender: GenderType;
  standardSize: StandardSize;
  measurements: BodyMeasurements;
  fit: 'slim' | 'regular' | 'loose';
  activePatternId: string;
  patternPaths: import('@/types/gene').GenePathData[];
  patternAnchors: Record<string, { x: number; y: number }>;
  activePart: PartType;
  instances: Record<PartType, GeneInstance>;
  view: 'front' | 'back';
  viewMode: 'clean' | 'industrial';
  garmentColor: string;
  fabricId: string;
  costBreakdown: CostBreakdown | null;
  costParams: CostParameters;
  violations: RuleViolation[];
  /** 制版可信度统计 (吃势/弧长匹配, 来自约束校验引擎) */
  draftStats: import('@/lib/pattern/drafting').DraftStats | null;
  currentDesignId: string | null;
  designName: string;
  designCreatedAt: string | null;
  lastError: string | null;
  canUndo: boolean;
  canRedo: boolean;

  setGender: (gender: GenderType) => void;
  setActivePart: (part: PartType) => void;
  applyPreset: (part: PartType, presetId: string) => void;
  updateParameter: (part: PartType, paramId: string, value: number | string | boolean) => void;
  setView: (view: 'front' | 'back') => void;
  setViewMode: (mode: 'clean' | 'industrial') => void;
  setColor: (color: string) => void;
  setFabric: (fabricId: string) => void;
  setCostParams: (params: Partial<CostParameters>) => void;
  recalculate: () => void;
  setSize: (size: StandardSize) => void;
  updateMeasurements: (partial: Partial<BodyMeasurements>) => void;
  setFit: (fit: 'slim' | 'regular' | 'loose') => void;
  applyPattern: (patternId: string) => void;
  restorePatternInputs: (envelope: PatternExportEnvelope) => void;
  recomputePattern: () => void;
  _applyMeasurementDrivenParams: (m: BodyMeasurements, gender: GenderType, fit: 'slim' | 'regular' | 'loose') => void;
  saveDesign: () => Promise<string>;
  loadDesign: (id: string) => Promise<void>;
  newDesign: () => void;
  deleteDesign: (id: string) => Promise<void>;
  setDesignName: (name: string) => void;
  clearError: () => void;
  undo: () => void;
  redo: () => void;
  _snapshot: () => void;
  _updateHistoryFlags: () => void;
}

export const useParametricStore = create<ParametricState>()(
  immer((set, get) => {
    const initialGender: GenderType = 'male';
    const initialSize: StandardSize = 'M';
    const initialMeasurements = getReferenceMeasurements(initialGender, initialSize);
    const initialInstances = initAllInstances(initialGender);
    const solver = getDAGSolver();
    const costEngine = CostEngine.getInstance();
    const initialCost = costEngine.calculateFOBCost(
      Object.values(initialInstances),
      DEFAULT_COST_PARAMS
    );

    // 启动时直接调 composePattern 初始化 patternPaths
    const initialPattern = PATTERN_LIBRARY['brian-reference'];
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
        // 同时计算 front 和 back 视图
        const frontResult = composePattern(initialPattern, initFlat, initialMeasurements, initialGender, { view: 'front' });
        const backResult = composePattern(initialPattern, initFlat, initialMeasurements, initialGender, { view: 'back' });
        const seen = new Set(frontResult.paths.map(p => p.id));
        initialPatternPaths = [...frontResult.paths, ...backResult.paths.filter(p => !seen.has(p.id))] as any;
        initialPatternAnchors = { ...backResult.anchors, ...frontResult.anchors };
      } catch (err) {
        console.error('[store init] initial composePattern failed:', err);
      }
    }

    return {
      gender: initialGender,
      standardSize: initialSize,
      measurements: initialMeasurements,
      fit: 'regular',
      activePatternId: 'brian-reference',
      patternPaths: initialPatternPaths as any,
      patternAnchors: initialPatternAnchors,
      viewMode: 'clean',
      activePart: 'body',
      instances: initialInstances,
      view: 'front',
      garmentColor: '#87CEEB',
      fabricId: 'solid',
      costBreakdown: initialCost,
      costParams: { ...DEFAULT_COST_PARAMS },
      violations: [{ ruleId: 'production-unapproved', level: 'warning', message: 'Brian 参考几何；试坯与生产工艺尚未验收。' }],
      draftStats: null,
      currentDesignId: null,
      designName: 'Untitled Design',
      designCreatedAt: null,
      lastError: null as string | null,
      canUndo: false,
      canRedo: false,

      setGender: (gender) => {
        const newInstances = initAllInstances(gender);
        const newCost = costEngine.calculateFOBCost(
          Object.values(newInstances),
          get().costParams
        );
        // 同步更新测量值为新性别的 M 码默认值
        const newMeasurements = getReferenceMeasurements(gender, 'M');
        set((s) => {
          s.gender = gender;
          s.standardSize = 'M';
          s.measurements = newMeasurements;
          s.instances = newInstances;
          s.costBreakdown = newCost;
        });
        get()._applyMeasurementDrivenParams(newMeasurements, gender, get().fit);
        get().recalculate();
        get().recomputePattern();
        get()._snapshot();
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
        get().recomputePattern();
        get()._snapshot();
      },

      updateParameter: (part, paramId, value) => {
        const instanceId = `instance-${part}`;
        solver.updateParameter(instanceId, paramId, value);

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
        get().recomputePattern();
        get()._snapshot();
      },

      setView: (view) => {
        set((s) => { s.view = view; });
        // 不需要 recomputePattern, 因为两个视图的路径已经同时计算好
        // 但仍需存快照以支持撤销
        get()._snapshot();
      },

      clearError: () => {
        set((s) => { s.lastError = null; });
      },

      _snapshot: () => {
        const { instances, measurements, gender, standardSize, fit, activePatternId, garmentColor, fabricId, view, viewMode } = get();
        pushParamHistory({ instances: JSON.parse(JSON.stringify(instances)), measurements: { ...measurements }, gender, standardSize, fit, activePatternId, garmentColor, fabricId, view, viewMode });
        get()._updateHistoryFlags();
      },

      _updateHistoryFlags: () => {
        const { canUndo, canRedo } = getParamHistoryState();
        set((s) => { s.canUndo = canUndo; s.canRedo = canRedo; });
      },

      undo: () => {
        const snapshot = undoParam();
        if (!snapshot) return;
        set((s) => {
          s.instances = snapshot.instances;
          s.measurements = snapshot.measurements;
          s.gender = snapshot.gender;
          s.standardSize = snapshot.standardSize;
          s.fit = snapshot.fit;
          s.activePatternId = snapshot.activePatternId;
          s.garmentColor = snapshot.garmentColor;
          s.fabricId = snapshot.fabricId;
          s.view = snapshot.view;
          s.viewMode = snapshot.viewMode;
        });
        get()._updateHistoryFlags();
        get().recalculate();
        get().recomputePattern();
      },

      redo: () => {
        const snapshot = redoParam();
        if (!snapshot) return;
        set((s) => {
          s.instances = snapshot.instances;
          s.measurements = snapshot.measurements;
          s.gender = snapshot.gender;
          s.standardSize = snapshot.standardSize;
          s.fit = snapshot.fit;
          s.activePatternId = snapshot.activePatternId;
          s.garmentColor = snapshot.garmentColor;
          s.fabricId = snapshot.fabricId;
          s.view = snapshot.view;
          s.viewMode = snapshot.viewMode;
        });
        get()._updateHistoryFlags();
        get().recalculate();
        get().recomputePattern();
      },

      setViewMode: (mode) => {
        set((s) => { s.viewMode = mode; });
        get().recomputePattern();
        get()._snapshot();
      },

      setColor: (color) => {
        set((s) => { s.garmentColor = color; });
        get()._snapshot();
      },

      setFabric: (fabricId) => {
        set((s) => { s.fabricId = fabricId; });
        get()._snapshot();
      },

      _applyMeasurementDrivenParams: (m, gender, fit) => {
        const updatedInstances = applyMeasurementDrivenParams(m, gender, fit);
        set((s) => {
          for (const [cat, inst] of Object.entries(updatedInstances)) {
            s.instances[cat as PartType] = inst;
          }
        });
      },

      setSize: (size) => {
        const { gender } = get();
        const m = getReferenceMeasurements(gender, size);
        set((s) => { s.standardSize = size; s.measurements = m; });
        get()._applyMeasurementDrivenParams(m, gender, get().fit);
        get().recomputePattern();
        get().recalculate();
        get()._snapshot();
      },

      updateMeasurements: (partial) => {
        const { gender, fit } = get();
        const newMeasurements = { ...get().measurements, ...partial };
        set((s) => { s.measurements = newMeasurements; });
        get()._applyMeasurementDrivenParams(newMeasurements, gender, fit);
        get().recomputePattern();
        get().recalculate();
        get()._snapshot();
      },

      setFit: (fit) => {
        const { gender, measurements } = get();
        set((s) => { s.fit = fit; });
        get()._applyMeasurementDrivenParams(measurements, gender, fit);
        get().recomputePattern();
        get().recalculate();
        get()._snapshot();
      },

      applyPattern: (patternId) => {
        try { requireReviewedPattern(patternId); }
        catch (err) { set(s => { s.lastError = err instanceof Error ? err.message : String(err); }); return; }
        set(s => { s.activePatternId = patternId; });
        get().recomputePattern();
        useBomStore.getState().clearBom();
        get()._snapshot();
      },

      restorePatternInputs: (envelope) => {
        const input = resolveReviewedImport(envelope);
        set(s => {
          s.activePatternId = input.patternId;
          s.measurements = input.measurements;
          s.gender = input.gender;
          s.fit = input.fit;
          s.standardSize = input.standardSize;
        });
        get()._applyMeasurementDrivenParams(input.measurements, input.gender, input.fit);
        get().recomputePattern();
        useBomStore.getState().clearBom();
        get()._snapshot();
      },

      recomputePattern: () => {
        const { activePatternId, gender, measurements, fit } = get();
        // 同时计算 front 和 back 两个视图, 合并路径和锚点
        const frontResult = recomputePatternLogic(activePatternId, measurements, gender, fit, 'front');
        const backResult = recomputePatternLogic(activePatternId, measurements, gender, fit, 'back');
        // 合并路径: front 标记 'front', back 标记 'back'
        // view='all' 的裁片 (袖/领/部件) 只保留 front 求解的一份 — 防止双份渲染/QC 重复
        const seenAll = new Set<string>();
        // 先登记 front 的 view=all 裁片指纹
        for (const p of frontResult.paths) {
          if ((p as any).view === 'all') seenAll.add(`${(p as any).id}|${(p as any).transform ?? ''}`);
        }
        const allPaths = [
          ...frontResult.paths.map((p: any) => ({ ...p, view: p.view || 'front' })),
          ...backResult.paths
            .map((p: any) => ({ ...p, view: p.view || 'back' }))
            .filter((p: any) => {
              if (p.view !== 'all') return true;
              const dk = `${p.id}|${p.transform ?? ''}`;
              if (seenAll.has(dk)) return false;
              seenAll.add(dk);
              return true;
            }),
        ];
        // 合并锚点: front 锚点优先, back 补充 (同名锚点取 front 值)
        const allAnchors = { ...backResult.anchors, ...frontResult.anchors };
        set((s) => {
          s.patternPaths = allPaths as any;
          s.patternAnchors = allAnchors as any;
          s.lastError = frontResult.error || backResult.error;
          // 制版约束校验 (front/back 共用同一公式源, 校验结果一致)
          s.violations = frontResult.violations ?? [];
          s.draftStats = frontResult.draftStats ?? null;
        });
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
          // Keep geometric blocking and production status when cost estimates refresh.
          s.violations = [...s.violations.filter(v => v.ruleId === 'production-unapproved' || v.ruleId === 'draft-blocked'), ...allViolations];
        });
      },

      saveDesign: async () => {
        const { instances, garmentColor, fabricId, costParams, gender, currentDesignId, designName, designCreatedAt, activePatternId, viewMode, view } = get();
        const { doc, isNew } = await saveDesignToDB({
          instances, garmentColor, fabricId, costParams, gender,
          currentDesignId, designName, designCreatedAt, activePatternId, viewMode, view,
          draftInputs: { engineVersion: '4.10.2', measurements: { ...get().measurements }, standardSize: get().standardSize, fit: get().fit },
        });
        set((s) => {
          s.currentDesignId = doc.id;
          if (isNew) s.designCreatedAt = doc.createdAt;
        });
        return doc.id;
      },

      loadDesign: async (id) => {
        const result = await loadDesignFromDB(id);
        if (!result) return;

        const { doc, instances: newInstances } = result;
        if (!doc.draftInputs || doc.draftInputs.engineVersion !== '4.10.2') {
          set(s => { s.patternPaths = []; s.patternAnchors = {}; s.lastError = '旧设计缺少可追溯的制版输入，已停止显示；请补录测量快照'; });
          return;
        }
        set((s) => {
          s.gender = doc.gender;
          s.measurements = doc.draftInputs!.measurements;
          s.standardSize = doc.draftInputs!.standardSize;
          s.fit = doc.draftInputs!.fit;
          s.instances = newInstances;
          s.garmentColor = doc.garmentColor;
          s.fabricId = doc.fabricId;
          s.costParams = doc.costParams;
          s.currentDesignId = doc.id;
          s.designName = doc.name;
          s.designCreatedAt = doc.createdAt;
          if (doc.activePatternId) s.activePatternId = doc.activePatternId;
          if (doc.viewMode) s.viewMode = doc.viewMode;
          if (doc.view) s.view = doc.view;
        });

        get().recalculate();
        get().recomputePattern();
        // 重置历史并保存新基线快照
        resetParamHistory();
        get()._snapshot();
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
          s.view = 'front';
          s.viewMode = 'clean';
          s.activePart = 'body';
          s.activePatternId = 'brian-reference';
          s.fit = 'regular';
          s.standardSize = 'M';
          s.measurements = getReferenceMeasurements(gender, 'M');
        });
        get().recalculate();
        get().recomputePattern();
        // 重置历史并保存新基线快照
        resetParamHistory();
        get()._snapshot();
      },

      deleteDesign: async (id) => {
        await deleteDesignFromDB(id);
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
