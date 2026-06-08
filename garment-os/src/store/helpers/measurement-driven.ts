/**
 * 测量驱动参数推导逻辑
 * 从 parametricStore.ts 拆出的纯函数
 */

import type { GeneInstance, GenderType } from '@/types/gene';
import type { BodyMeasurements } from '@/types/measurements';
import { measurementsToAllParams } from '@/lib/parametric/measurement-formulas';
import { getDAGSolver } from '@/lib/parametric/dag-solver';
import { deepCloneInstance } from '../store-helpers';

/**
 * 应用测量驱动的参数推导
 * 更新 solver 中的实例参数，返回更新后的实例快照
 */
export function applyMeasurementDrivenParams(
  m: BodyMeasurements,
  gender: GenderType,
  fit: 'slim' | 'regular' | 'loose',
): Record<string, GeneInstance> {
  const solver = getDAGSolver();
  const derived = measurementsToAllParams(m, gender, fit);

  for (const [cat, params] of Object.entries(derived)) {
    const instance = solver.getInstance(`instance-${cat}`);
    if (instance) {
      for (const [k, v] of Object.entries(params)) {
        if (k.startsWith('_')) continue;
        instance.parameterValues[k] = v;
      }
      solver.solveGeneInstance(instance.id);
    }
  }

  const updatedInstances: Record<string, GeneInstance> = {};
  for (const cat of Object.keys(derived)) {
    const solved = solver.getInstance(`instance-${cat}`);
    if (solved) updatedInstances[cat] = deepCloneInstance(solved);
  }
  return updatedInstances;
}
