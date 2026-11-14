import { describe, expect, it } from 'vitest';
import { buildTeeFoundation, requireTeeFoundationCombination } from '@/application/tee-foundation';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { raglanFoundationDefinition } from '@/data/raglanFoundation';
import { auditSleeveTopology } from '@/lib/pattern/assembly/sleeve-topology';
import { validateAssembly } from '@/lib/pattern/assembly/validate';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { newTeeBase } from '@/application/tee-matrix';

describe('T-shirt foundation: source patterns precede style selection', () => {
  it.each(['XS', 'M', 'XXXL'] as const)('keeps a complete source set with cutting, orientation, notch and seam evidence for %s', size => {
    const d = buildTeeFoundation('set-in', size);
    expect(d.selectable).toBe(true);
    expect(d.pieces.map(p => [p.id, p.quantity, p.onFold])).toEqual([['teagan.front', 1, true], ['teagan.back', 1, true], ['teagan.sleeve', 2, false]]);
    expect(d.report?.errors).toEqual([]);
    expect(d.sourceSettings?.measurements.chest).toBe(newTeeBase(size).measurements.bust);
    expect(d.sourceSettings?.options.sleeveLength).toBe(.3);
    expect(d.report?.joins.every(j => j.directionChecked && j.status === 'passed')).toBe(true);
    const sleeve = d.pieces.find(p => p.id === 'teagan.sleeve')!;
    expect(sleeve.notches.map(n => n.label)).toEqual(expect.arrayContaining(['frontNotch', 'backNotch']));
    expect(d.pieces.every(p => p.cutPaths.length && p.grainPaths.length)).toBe(true);
    expect(requireTeeFoundationCombination(d, d.pieces.map(p => p.id)).productionApproved).toBe(false);
  }, 20000);

  it('shows the actual raglan source topology and checks front and back separately without releasing it as a short T', () => {
    const d = buildTeeFoundation('raglan');
    expect(d.pieces).toHaveLength(3);
    expect(d.pieces.find(p => p.id === 'hugo.sleeve')!.netPath).not.toBe(buildTeeFoundation('set-in').pieces[2].netPath);
    expect(d.report?.coverage.classifiedEdges).toBe(d.report?.coverage.totalEdges);
    expect(d.report?.boundaries.filter(b => b.piece === 'hugo.sleeve').map(b => b.role)).toEqual(expect.arrayContaining(['neckline', 'raglan-front', 'raglan-back']));
    expect(d.report?.boundaries.some(b => b.role === 'shoulder' || b.role === 'sleevecap')).toBe(false);
    expect(d.report?.joins.filter(j => j.id.startsWith('raglan-'))).toHaveLength(2);
    expect(d.selectable).toBe(false);
    expect(d.blockers.join(' ')).toContain('连帽长袖');
    expect(() => requireTeeFoundationCombination(d, d.pieces.map(p => p.id))).toThrow(/阻止/);
  }, 20000);

  it('does not invent missing dropped-shoulder pieces or treat size ease as a shoulder construction', () => {
    const d = buildTeeFoundation('drop');
    expect(d.pieces).toEqual([]); expect(d.report).toBeNull(); expect(d.source).toBeNull();
    expect(() => requireTeeFoundationCombination(d, [])).toThrow(/阻止/);
  });

  it('rejects missing, duplicated and mixed-family body/sleeve sets at the selection boundary', () => {
    const d = buildTeeFoundation('set-in');
    for (const ids of [['teagan.front', 'teagan.back'], ['teagan.front', 'teagan.back', 'hugo.sleeve'], ['teagan.front', 'teagan.front', 'teagan.sleeve']])
      expect(() => requireTeeFoundationCombination(d, ids)).toThrow(/同一套/);
  });

  it('blocks a set-in body relabeled as raglan even when the original seam lengths still match', () => {
    const c = newTeeBase(), draft = draftStandard('t-shirt', c.measurements, c.fit, c.construction), def = getAssemblyDefinition('t-shirt');
    def.sleeveTopology!.family = 'raglan';
    const report = validateAssembly(def, draft.assemblyPieces);
    expect(report.status).toBe('blocked');
    expect(report.errors.some(e => e.code === 'sleeve-topology')).toBe(true);
    expect(report.joins.every(j => j.status === 'passed')).toBe(true); // Length alone would have incorrectly passed.
    delete def.sleeveTopology;
    expect(validateAssembly(def, draft.assemblyPieces).errors.some(e => e.code === 'sleeve-topology')).toBe(true);
  });

  it('blocks missing sleeve neck segment and front/back substitutions in a raglan definition', () => {
    const def = raglanFoundationDefinition(); expect(auditSleeveTopology(def)).toEqual([]);
    def.pieces[2].boundaries = def.pieces[2].boundaries.filter(b => b.role !== 'neckline');
    expect(auditSleeveTopology(def).some(e => e.message.includes('neckline'))).toBe(true);
    const swapped = raglanFoundationDefinition(); swapped.joins[0].b[0].boundary = 'raglan-back';
    expect(auditSleeveTopology(swapped).some(e => e.message.includes('分别'))).toBe(true);
  });
});
