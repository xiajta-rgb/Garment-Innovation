/**
 * 设计持久化逻辑
 * 从 parametricStore.ts 拆出的纯函数
 */

import type { GeneInstance, GenderType, DesignDocument } from '@/types/gene';
import { db } from '@/lib/db/design-db';
import { getDAGSolver } from '@/lib/parametric/dag-solver';
import { deepCloneInstance, createDefaultInstance } from '../store-helpers';

type PartType = 'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff';

export interface SaveDesignInput {
  instances: Record<PartType, GeneInstance>;
  garmentColor: string;
  fabricId: string;
  costParams: any;
  gender: GenderType;
  currentDesignId: string | null;
  designName: string;
  designCreatedAt: string | null;
  activePatternId: string;
  viewMode: 'clean' | 'industrial';
  view: 'front' | 'back';
}

/** 保存设计到 IndexedDB */
export async function saveDesignToDB(input: SaveDesignInput): Promise<{ doc: DesignDocument; isNew: boolean }> {
  const now = new Date().toISOString();

  const paramSnapshots: Record<string, GeneInstance> = {};
  for (const [cat, inst] of Object.entries(input.instances)) {
    paramSnapshots[cat] = {
      ...inst,
      paths: [],
      resolvedAnchors: {},
      violations: [],
    };
  }

  const doc: DesignDocument = {
    id: input.currentDesignId ?? `design-${Date.now()}`,
    name: input.designName,
    gender: input.gender,
    createdAt: input.designCreatedAt ?? now,
    updatedAt: now,
    instances: paramSnapshots,
    garmentColor: input.garmentColor,
    fabricId: input.fabricId,
    costParams: input.costParams,
    tags: [input.gender],
    activePatternId: input.activePatternId,
    viewMode: input.viewMode,
    view: input.view,
  };

  await db.saveDesign(doc);
  return { doc, isNew: !input.currentDesignId };
}

export interface LoadDesignResult {
  doc: DesignDocument;
  instances: Record<PartType, GeneInstance>;
}

/** 从 IndexedDB 加载设计 */
export async function loadDesignFromDB(id: string): Promise<LoadDesignResult | null> {
  const doc = await db.getDesign(id);
  if (!doc) return null;

  const solver = getDAGSolver();
  solver.clearAll();

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
      const defaultInst = createDefaultInstance(cat, doc.gender);
      solver.registerGeneInstance(defaultInst);
      solver.solveGeneInstance(defaultInst.id);
      const solved = solver.getInstance(defaultInst.id);
      newInstances[cat] = solved ? deepCloneInstance(solved) : defaultInst;
    }
  }

  return { doc, instances: newInstances as Record<PartType, GeneInstance> };
}

/** 删除设计 */
export async function deleteDesignFromDB(id: string): Promise<void> {
  await db.deleteDesign(id);
}
