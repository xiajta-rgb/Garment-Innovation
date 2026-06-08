/**
 * Pattern 求解逻辑
 * 从 parametricStore.ts 拆出的纯函数
 */

import type { GeneInstance } from '@/types/gene';
import type { BodyMeasurements } from '@/types/measurements';
import type { GenderType } from '@/types/gene';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { composePattern } from '@/lib/patterns/compose';
import { measurementsToAllParams } from '@/lib/parametric/measurement-formulas';
import { getDAGSolver } from '@/lib/parametric/dag-solver';

export interface PatternComputeResult {
  paths: GeneInstance['paths'];
  anchors: Record<string, { x: number; y: number }>;
  error: string | null;
}

/**
 * 重新求解当前 Pattern
 * @returns 求解结果 (paths + anchors + error)
 */
export function recomputePatternLogic(
  activePatternId: string,
  measurements: BodyMeasurements,
  gender: GenderType,
  fit: 'slim' | 'regular' | 'loose',
  view: 'front' | 'back',
): PatternComputeResult {
  const pattern = PATTERN_LIBRARY[activePatternId];
  if (!pattern) {
    return { paths: [], anchors: {}, error: `Pattern not found: ${activePatternId}` };
  }

  // 1. 从测量值推导的基础参数 (低优先级)
  const derivedParams = measurementsToAllParams(measurements, gender, fit);
  const flatParams: Record<string, number | string | boolean> = {};
  for (const partParams of Object.values(derivedParams)) {
    for (const [k, v] of Object.entries(partParams)) {
      if (!k.startsWith('_')) flatParams[k] = v;
    }
  }

  // 2. 从 DAGSolver 实例读取用户通过滑块修改的参数 (中等优先级)
  // 这些参数会被 pattern.defaultParams 覆盖, 但补充 defaultParams 中没有的参数
  const solver = getDAGSolver();
  const instanceParams: Record<string, number | string | boolean> = {};
  const partTypes = ['body', 'sleeve', 'collar', 'cuff', 'pocket', 'placket'] as const;
  for (const part of partTypes) {
    const inst = solver.getInstance(`instance-${part}`);
    if (inst?.parameterValues) {
      Object.assign(instanceParams, inst.parameterValues);
    }
  }

  // 合并: flatParams 作为 extraParams (低优先级)
  // instanceParams 作为 userOverrides (高于 defaultParams, 低于 ref.params)
  const extraParams: Record<string, number | string | boolean> = { ...flatParams };

  try {
    const solution = composePattern(pattern, extraParams, measurements, gender, { view, userOverrides: instanceParams });

    // 同步到旧 instance 系统 (向后兼容)
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

    return {
      paths: solution.paths,
      anchors: solution.anchors as Record<string, { x: number; y: number }>,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { paths: [], anchors: {}, error: `Pattern 切换失败 [${activePatternId}]: ${msg}` };
  }
}
