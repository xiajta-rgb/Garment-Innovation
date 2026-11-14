import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { ELEMENT_LIBRARY } from '@/data/elementRegistry';
import { BRIAN_INPUT_BINDINGS, BRIAN_COMPONENT_SOURCES, requireBrianLibrary } from '@/data/shapeBindings';
import { buildRegistrationPackage } from '@/features/element-library/design-registration';
import { useDesignStore } from '@/store/useDesignStore';

describe('shape master data and exact runtime bindings', () => {
  it('requires precise measurement semantics and a complete template-component graph', () => {
    const binding = requireBrianLibrary();
    expect(binding.definitions).toHaveLength(15);
    expect(binding.components.map(e => e.sourceId)).toEqual([...BRIAN_COMPONENT_SOURCES]);
    expect(BRIAN_INPUT_BINDINGS.find(b => b.appKey === 'shoulderWidth')?.parameterCode).toBe('shoulderToShoulder');
    expect(BRIAN_INPUT_BINDINGS.find(b => b.appKey === 'hpsToBust')?.parameterCode).toBe('hpsToBust');
    const missing = structuredClone(ELEMENT_LIBRARY);
    missing.parameters = missing.parameters.filter(p => p.code !== 'hpsToBust');
    expect(() => requireBrianLibrary(missing)).toThrow(/hpsToBust/);
    const wrongUnit = structuredClone(ELEMENT_LIBRARY);
    wrongUnit.parameters.find(p => p.code === 'chestEaseRatio')!.unit = 'mm';
    expect(() => requireBrianLibrary(wrongUnit)).toThrow(/语义/);
    const broken = structuredClone(ELEMENT_LIBRARY);
    broken.elements.find(e => e.sourceId.endsWith('/brian-reference'))!.componentSourceIds = [];
    expect(() => requireBrianLibrary(broken)).toThrow(/关系不完整/);
  });
  it('blocks a quarantined or incompatible upstream entity', () => {
    for (const change of ['status', 'version'] as const) {
      const library = structuredClone(ELEMENT_LIBRARY);
      const e = library.elements.find(e => e.sourceId === BRIAN_COMPONENT_SOURCES[1])!;
      if (change === 'status') e.status = '隔离';
      else e.specification!.engine_version = 'unknown';
      expect(() => requireBrianLibrary(library)).toThrow(/不兼容/);
    }
  });
  it('keeps candidate lineage, dimensions and immutable revisions; never exports legacy mock geometry', () => {
    useDesignStore.getState().newDesign();
    const first = buildRegistrationPackage();
    expect(buildRegistrationPackage().revisionId).toBe(first.revisionId);
    expect(first.packageVersion).toBe('2.0');
    expect(first.productionApproved).toBe(false);
    expect(first.inputBindings).toHaveLength(12);
    expect(first.parameterDefinitionsSnapshot).toHaveLength(15);
    for (const p of first.pieces) {
      expect(p.feishuFields['生成依据']).toHaveLength(2);
      expect(p.feishuFields['参数定义']).toHaveLength(15);
      expect(p.grossAreaMm2).toBeNull();
      expect(JSON.parse(p.feishuFields['规格信息'] as string).production_approved).toBe(false);
    }
    useDesignStore.setState(s => ({ measurements: { ...s.measurements, shoulderSlope: s.measurements.shoulderSlope! + 1 } }));
    const changed = buildRegistrationPackage();
    expect(changed.revisionId).not.toBe(first.revisionId);
    expect(changed.pieces[0].sourceId).not.toBe(first.pieces[0].sourceId);
    useDesignStore.setState({ activePatternId: 't-shirt-pro' });
    expect(() => buildRegistrationPackage()).toThrow(/登记协议/);
    useDesignStore.getState().newDesign();
    mkdirSync('doc/evidence/shape-collaboration-20261111', { recursive: true });
    writeFileSync('doc/evidence/shape-collaboration-20261111/candidate-package.json', JSON.stringify(buildRegistrationPackage(), null, 2));
  });
});
