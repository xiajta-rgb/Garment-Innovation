import { describe, expect, it } from 'vitest';
import { getPatternCapabilityReport } from '@/application/capability-status';
import { createPattern3d } from '@/application/pattern-3d';
import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';

describe('capability status boundary', () => {
  it('separates source geometry, preview and physical approval', () => {
    const configuration = {
      activePatternId: 't-shirt', gender: 'male' as const, standardSize: 'M' as const, fit: 'regular' as const,
      measurements: getReferenceMeasurements('male', 'M'), engineVersion: '4.10.2' as const,
      garmentColor: '#446688', fabricId: 'solid',
    };
    const mesh = createPattern3d(configuration);
    const report = getPatternCapabilityReport(mesh, assembleGarment(mesh));

    expect(report.sourcePanels.state).toBe('available');
    expect(report.seamMapping.state).toBe('preview-only');
    expect(report.garmentPreview.state).toBe('available');
    expect(report.materialPhysics.state).toBe('not-implemented');
    expect(report.drapeValidation.state).toBe('blocked');
    expect(report.productionApproval.state).toBe('blocked');
  });

  it('does not infer a capability from a missing garment model', () => {
    const mesh = { panels: [], seams: [] } as never;
    const report = getPatternCapabilityReport(mesh);
    expect(report.sourcePanels.state).toBe('blocked');
    expect(report.garmentPreview.state).toBe('not-implemented');
    expect(report.productionApproval.state).toBe('blocked');
  });
});

