import { expect, it } from 'vitest';
import { buildTeeMatrix, newTeeBase, resizeTeeBase, readTeeSelections, TEE_AXES } from '@/application/tee-matrix';

it('all old millimetre matrix axes are blocked while the complete template review remains unresolved', () => {
  const base = newTeeBase(), before = JSON.stringify(base);
  for (const axis of TEE_AXES) expect(() => buildTeeMatrix(base, axis.id)).toThrow(/全部模板结构审查/);
  expect(JSON.stringify(base)).toBe(before);
});

it('keeps saved legacy selections readable without regenerating or releasing them', () => {
  const c = { id: 'old', name: 'old selection', row: 'regular', column: 'old', note: 'historical', configuration: newTeeBase(), selectionId: 'one' };
  const frozen = readTeeSelections([c]); c.configuration.pieceDesign!.pocket.widthMm = 160;
  expect(frozen[0].configuration.pieceDesign!.pocket.widthMm).toBe(115);
  expect(() => readTeeSelections([{ ...c, configuration: { ...c.configuration, gender: 'female' } }])).toThrow(/男士/);
  expect(() => readTeeSelections(Array(25).fill(c))).toThrow();
});

it('reference sample resizing remains available for source inspection and preserves construction settings', () => {
  const c = newTeeBase(); c.pieceDesign!.pocket.widthMm = 125; c.measurements.totalLength += 40;
  const next = resizeTeeBase(c, 'XS');
  expect(next.standardSize).toBe('XS'); expect(next.construction).toEqual(c.construction); expect(next.pieceDesign).toEqual(c.pieceDesign);
  const ratio = c.measurements.totalLength / (c.measurements.hpsToWaistBack! + c.measurements.hipDepth);
  expect(next.measurements.totalLength).toBe(Math.round((next.measurements.hpsToWaistBack! + next.measurements.hipDepth) * ratio));
});
