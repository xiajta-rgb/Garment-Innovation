import { afterAll, describe, expect, it } from 'vitest';
import { Brian } from '@freesewing/brian';
import * as models from '@freesewing/models';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getReferenceMeasurements, referenceProfileId } from '@/data/referenceMeasurements';
import { draftBrian, pathEdges } from '@/lib/pattern/reference/brian';
import { generateReferencePieces } from '@/lib/pattern/reference/generator';
import { composePattern } from '@/lib/patterns/compose';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { makeGateKey, pieceIsMapped } from '@/lib/pattern/preview-gate';
import { useDesignStore } from '@/store/useDesignStore';
import { buildRegistrationPackage } from '@/features/element-library/design-registration';
import type { StandardSize } from '@/types/measurements';

const evidence: unknown[] = [];
const sizes: StandardSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
describe('upstream Brian comparison: complete contours, control points, cutting paths', () => {
  for (const gender of ['male', 'female'] as const) for (const size of sizes) for (const fit of ['slim', 'regular', 'loose'] as const) {
    it(`${gender}/${size}/${fit} equals an independently drafted upstream sample`, () => {
      const m = getReferenceMeasurements(gender, size);
      const sourceId = referenceProfileId(gender, size);
      const sourceModel = models[sourceId];
      const options = fit === 'regular' ? { chestEase: 0.15, bicepsEase: 0.15 } : fit === 'slim' ? { chestEase: 0.08, bicepsEase: 0.1 } : { chestEase: 0.25, bicepsEase: 0.25 };
      const upstream = new Brian({ measurements: sourceModel, options, sa: 10 });
      upstream.draft();
      const ours = draftBrian(m, { fit });
      expect(ours.settings.measurements.hpsToWaistBack).toBe(sourceModel.hpsToWaistBack);
      expect(ours.settings.measurements.hpsToBust).toBe(sourceModel.hpsToBust);
      expect(ours.settings.measurements.shoulderSlope).toBe(sourceModel.shoulderSlope);
      expect(ours.geometryPass, JSON.stringify(ours.checks)).toBe(true);
      let count = 0;
      for (const piece of ours.pieces) {
        const part = upstream.parts[0][piece.upstreamPart] as { points: Record<string, { x: number; y: number }>; paths: Record<string, { asPathstring(): string }> };
        expect(piece.netPathD).toBe(part.paths.seam.asPathstring());
        expect(piece.cuttingPathD).toBe(part.paths.sa.asPathstring());
        for (const [name, p] of Object.entries(piece.points)) {
          expect(p.x, name).toBe(part.points[name].x);
          expect(p.y, name).toBe(part.points[name].y);
          count++;
        }
        for (let i = 0; i < piece.edges.length; i++) {
          const edge = piece.edges[i];
          const next = piece.edges[(i + 1) % piece.edges.length];
          expect(Math.hypot(edge.segs.at(-1)!.to.x - next.start.x, edge.segs.at(-1)!.to.y - next.start.y)).toBeLessThan(1e-6);
        }
        expect(piece.netAreaMm2).toBeGreaterThan(1000);
      }
      expect(ours.pieces[0].edges.filter(e => e.label.includes('袖窿'))).toHaveLength(3);
      expect(ours.pieces[2].edges.filter(e => e.label.includes('袖山'))).toHaveLength(5);
      expect(ours.productionStatus).toBe('unapproved');
      evidence.push({ sourceId, gender, size, fit, comparedPoints: count, maxCoordinateDeltaMm: 0, pathsEqual: true, checks: ours.checks });
    });
  }
});
it('measured slope and waist-to-armpit move the actual geometry; HPS-to-bust is a separate chest reference', () => {
  const m = getReferenceMeasurements('male', 'M');
  const base = draftBrian(m);
  const changed = draftBrian({ ...m, shoulderSlope: 18, waistToArmpit: m.waistToArmpit! + 10, hpsToBust: m.hpsToBust + 10 });
  expect(changed.pieces[0].netPathD).not.toBe(base.pieces[0].netPathD);
  expect(changed.pieces[2].netPathD).not.toBe(base.pieces[2].netPathD);
  expect(changed.pieces[0].points.shoulder.y).toBeGreaterThan(base.pieces[0].points.shoulder.y);
  expect(changed.pieces[0].points.armhole.y).toBeLessThan(base.pieces[0].points.armhole.y);
  expect(changed.pieces[1].points.cbChest.y).toBe(m.hpsToBust + 10);
});
it('does not guess missing production measurements or silently clamp incompatible lengths', () => {
  const m = getReferenceMeasurements('male', 'M');
  for (const key of ['shoulderSlope', 'hpsToWaistBack', 'waistToArmpit'] as const) expect(() => draftBrian({ ...m, [key]: undefined })).toThrow(/缺少/);
  expect(() => draftBrian({ ...m, bicep: Number.NaN })).toThrow();
  expect(() => draftBrian({ ...m, totalLength: 100 })).toThrow(/衣长/);
  expect(() => draftBrian({ ...m, waistToArmpit: m.hpsToWaistBack })).toThrow();
});
it('rejects unsupported path commands rather than inventing geometry', () => {
  expect(() => pathEdges({ ops: [{ type: 'arc' }], asPathstring: () => '', length: () => 0 }, 'front')).toThrow();
});
it('counts folded body material as full pieces and does not add unrelated components', () => {
  const result = generateReferencePieces(getReferenceMeasurements('male', 'M'));
  expect(result.pieces.map(p => p.kind)).toEqual(['front', 'back', 'sleeve']);
  expect(result.netAreaPerGarmentMm2).toBe(result.draft.pieces.reduce((s, p) => s + p.netAreaMm2 * 2, 0));
});
it('canvas and generator use identical source paths, including sleeve options', () => {
  const m = getReferenceMeasurements('male', 'M');
  const result = generateReferencePieces(m);
  for (const view of ['front', 'back'] as const) {
    const solution = composePattern(PATTERN_LIBRARY['brian-reference'], {}, m, 'male', { view });
    for (const piece of result.pieces.filter(p => p.kind === view || p.kind === 'sleeve')) {
      expect(solution.paths.find(p => p.id === `${piece.id}-reference-net`)?.data).toBe(piece.netPathD);
      expect(solution.paths.find(p => p.id === `${piece.id}-reference-cut`)?.data).toBe(piece.cuttingPathD);
    }
  }
});
it('missing or failed QC cannot be released via manual confirmation, and all inputs invalidate gates', () => {
  expect(pieceIsMapped(undefined)).toBe(false);
  expect(pieceIsMapped({ key:'failed', pass:false })).toBe(false);
  const store = usePieceLibraryStore.getState();
  store.ensureGate('test');
  store.setHidden('test','passed',true);
  expect(pieceIsMapped({ key:'passed',pass:true }, usePieceLibraryStore.getState().hiddenPieceKeys)).toBe(false);
  store.showAllChecked();
  expect(pieceIsMapped({ key:'failed',pass:false },usePieceLibraryStore.getState().hiddenPieceKeys)).toBe(false);
  expect(pieceIsMapped({ key:'passed',pass:true },usePieceLibraryStore.getState().hiddenPieceKeys)).toBe(true);
  const m = getReferenceMeasurements('male', 'M');
  const key = makeGateKey('brian-reference', 'male', 'regular', 'M', m as unknown as Record<string, number>);
  expect(makeGateKey('brian-reference', 'male', 'regular', 'M', { ...m, shoulderSlope: 13.001 } as unknown as Record<string, number>)).not.toBe(key);
});
it('registration keeps reference geometry and explicit missing cutting area without inventing production BOM', () => {
  const store = useDesignStore.getState();
  store.newDesign();
  const pkg = buildRegistrationPackage();
  const reference = generateReferencePieces(useDesignStore.getState().measurements);
  expect(pkg.pieces).toHaveLength(3);
  for (const [i, p] of pkg.pieces.entries()) {
    expect(p.grossAreaMm2).toBeNull();
    expect((p.geometry as { netPathD: string }).netPathD).toBe(reference.pieces[i].netPathD);
    expect(p.feishuFields['素材状态']).toEqual(['待核验']);
    expect(p.sourceId).toContain('brian-4.10.2');
  }
});
afterAll(() => {
  mkdirSync('doc/evidence', { recursive: true });
  writeFileSync('doc/evidence/brian-comparison.json', JSON.stringify({ baseline: '@freesewing/brian@4.10.2', generatedAt: new Date().toISOString(), status: 'reference-comparison-only', productionApproved: false, cases: evidence }, null, 2));
});
