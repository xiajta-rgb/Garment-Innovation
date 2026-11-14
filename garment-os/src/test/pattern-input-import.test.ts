import { beforeEach, expect, it } from 'vitest';
import { listExecutablePatterns, PATTERN_LIBRARY } from '@/data/patternLibrary';
import { serializePattern, deserializePattern } from '@/lib/pattern/pattern-format';
import { useDesignStore } from '@/store/useDesignStore';

beforeEach(() => useDesignStore.getState().newDesign());
function exported() {
  const s = useDesignStore.getState();
  return deserializePattern(serializePattern(PATTERN_LIBRARY[s.activePatternId], { engineVersion: '4.10.2', measurements: s.measurements, gender: s.gender, fit: s.fit, standardSize: s.standardSize }));
}
for (const p of listExecutablePatterns()) it(`${p.id}: file roundtrip restores exact measurements, fit, size and every source path`, () => {
  const s = useDesignStore.getState();
  s.applyPattern(p.id); s.setFit('slim'); s.updateMeasurements({ neckCirc: 395, wristCirc: 190 });
  const file = exported(), expected = structuredClone(useDesignStore.getState().draft.paths);
  s.newDesign(); s.setSize('XL');
  s.restorePatternInputs(file);
  expect(useDesignStore.getState().activePatternId).toBe(p.id);
  expect(useDesignStore.getState().measurements).toEqual(file.overrides!.measurements);
  expect(useDesignStore.getState().fit).toBe('slim');
  expect(useDesignStore.getState().standardSize).toBe('M');
  expect(useDesignStore.getState().draft.paths).toEqual(expected);
});
it('missing inputs, wrong versions and modified definitions cannot partially change the active design', () => {
  const s = useDesignStore.getState(), valid = exported();
  const missing = structuredClone(valid); delete missing.overrides!.measurements!.waistToArmpit;
  const wrongVersion = structuredClone(valid); wrongVersion.overrides!.engineVersion = 'unknown';
  const changed = structuredClone(valid); changed.pattern.blocks = [];
  const blocked = structuredClone(valid); blocked.pattern = PATTERN_LIBRARY['polo-shirt'];
  const before = structuredClone({ paths: s.draft.paths, m: s.measurements, id: s.activePatternId });
  for (const bad of [missing, wrongVersion, changed, blocked, { ...valid, overrides: undefined }]) {
    expect(() => s.restorePatternInputs(bad)).toThrow();
    const current = useDesignStore.getState();
    expect({ paths: current.draft.paths, m: current.measurements, id: current.activePatternId }).toEqual(before);
  }
});
