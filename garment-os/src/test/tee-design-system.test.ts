import { expect, it } from 'vitest';
import { buildTeeDesignMatrix, DEFAULT_TEE_INTENT, newTeeDesignBase, readTeeIntent, readDesignSelections, TEE_DESIGN_AXES } from '@/application/tee-design-system';
import { createTeeTechnicalDesign, teeTechnicalFigure } from '@/lib/pattern/tee-technical-flat';
import type { TeeDesignCandidate } from '@/types/tee-design';
const candidate = (): TeeDesignCandidate => ({ id: 'historical', row: 'set-in', column: 'crew', name: 'historical', ...newTeeDesignBase() });

it('blocks every visual matrix axis independently of the removed UI route', () => {
  const c = candidate();
  for (const axis of TEE_DESIGN_AXES) expect(() => buildTeeDesignMatrix(c.configuration, c.intent, axis.id)).toThrow(/设计矩阵暂停/);
});

it('blocks direct rendering and export of unsupported structure proposals, including previously saved candidates', () => {
  for (const shoulder of ['set-in', 'drop', 'raglan'] as const) for (const neckline of ['crew', 'v', 'henley', 'mock'] as const) {
    const c = candidate(); c.intent.shoulder = shoulder; c.intent.neckline = neckline;
    for (const view of ['front', 'back', 'side'] as const) expect(() => teeTechnicalFigure(c, view)).toThrow(/设计矩阵暂停/);
    expect(() => createTeeTechnicalDesign(c)).toThrow(/设计矩阵暂停/);
  }
});

it('preserves historical design records and their validation while preventing their reuse as approved patterns', () => {
  const c = candidate(), snapshots = readDesignSelections([{ ...c, selectionId: 'one' }]);
  c.intent.fabric = 'rib'; expect(snapshots[0].intent.fabric).toBe('jersey');
  expect(() => readTeeIntent({ ...DEFAULT_TEE_INTENT, shoulder: 'toString' })).toThrow();
  expect(() => readTeeIntent({ ...DEFAULT_TEE_INTENT, fabric: 'cotton' })).toThrow();
  expect(() => readDesignSelections([{ ...c, selectionId: 'one' }, { ...c, selectionId: 'one' }])).toThrow();
  expect(() => createTeeTechnicalDesign(snapshots[0])).toThrow(/设计矩阵暂停/);
});
