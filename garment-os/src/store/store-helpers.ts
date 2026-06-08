/**
 * parametricStore 共享工具函数
 * 从 parametricStore.ts 拆出的纯函数
 */

import type { GeneInstance, GenderType } from '@/types/gene';
import { GENE_DEFINITIONS, getPresetsByGender } from '@/data/geneLibrary';
import { getDAGSolver } from '@/lib/parametric/dag-solver';

export type PartType = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';

/** 深拷贝基因实例 */
export function deepCloneInstance(inst: GeneInstance): GeneInstance {
  return {
    ...inst,
    parameterValues: { ...inst.parameterValues },
    paths: inst.paths.map((p) => ({ ...p })),
    resolvedAnchors: { ...inst.resolvedAnchors },
    violations: inst.violations.map((v) => ({ ...v })),
  };
}

/** 创建默认基因实例 */
export function createDefaultInstance(category: PartType, gender: GenderType): GeneInstance {
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
export function initAllInstances(gender: GenderType): Record<PartType, GeneInstance> {
  const solver = getDAGSolver();
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
