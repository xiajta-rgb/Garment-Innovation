import { expect, it } from 'vitest';
import { buildDeskMatrix, DESK_AXES, DESK_SCHEMA, deskMatrixRows, deskTemplates, newDeskCustomization, readDeskCustomization, readDeskSession } from '@/application/design-desk';
import { buildTeeMatrix, newTeeBase } from '@/application/tee-matrix';

it('enumerates exactly the chosen dimensions and maps compatible requests into real source configurations', () => {
  const c = newDeskCustomization(), before = JSON.stringify(c), matrix = buildDeskMatrix(c);
  expect(matrix).toHaveLength(4); expect(new Set(matrix.map(v => v.id)).size).toBe(4);
  expect(matrix.every(v => v.previewAvailable && v.configuration?.activePatternId === 't-shirt')).toBe(true);
  expect(new Set(matrix.map(v => v.configuration?.fit))).toEqual(new Set(['regular', 'loose']));
  expect(new Set(matrix.map(v => v.configuration?.construction?.options.sleeveLength))).toEqual(new Set([.3, .65]));
  expect(matrix.every(v => !v.matrixEligible && !v.productionApproved)).toBe(true);
  expect(JSON.stringify(c)).toBe(before);
});

it('retains unsupported neck, shoulder and textile requests without substituting set-in or jersey geometry', () => {
  const c = newDeskCustomization(); c.choices.neckline = ['crew', 'v']; c.choices.shoulder = ['set-in', 'raglan', 'drop']; c.choices.fabric = ['jersey', 'waffle', 'rib'];
  const matrix = buildDeskMatrix(c);
  expect(matrix).toHaveLength(72); expect(matrix.filter(v => v.previewAvailable)).toHaveLength(4);
  for (const candidate of matrix.filter(v => !v.previewAvailable)) { expect(candidate.configuration).toBeNull(); expect(candidate.blockers.length).toBeGreaterThan(0); }
  expect(matrix.find(v => v.intent.shoulder === 'raglan')?.blockers.join(' ')).toContain('连帽长袖');
  expect(matrix.find(v => v.intent.fabric === 'rib')?.blockers.join(' ')).toContain('实测材料');
  expect(() => buildTeeMatrix(newTeeBase(), 'neck')).toThrow(/结构审查/);
});

it('reorients rows and columns without changing or losing design combinations', () => {
  const c = newDeskCustomization(); c.choices.neckline = ['crew', 'v', 'henley'];
  const before = buildDeskMatrix(c), rows = deskMatrixRows(c);
  expect(rows).toHaveLength(6); expect(rows.every(r => r.candidates.length === 2)).toBe(true);
  c.columnAxis = 'neckline'; const reoriented = deskMatrixRows(c);
  expect(reoriented).toHaveLength(4); expect(reoriented.every(r => r.candidates.length === 3)).toBe(true);
  expect(reoriented.flatMap(r => r.candidates.map(v => v.id)).sort()).toEqual(before.map(v => v.id).sort());
});

it('does not silently cap the Cartesian space and does not generate tee geometry for other templates', () => {
  const c = newDeskCustomization();
  for (const a of Object.keys(DESK_AXES) as Array<keyof typeof DESK_AXES>) Object.assign(c.choices, { [a]: Object.keys(DESK_AXES[a].values) });
  expect(buildDeskMatrix(c)).toHaveLength(405);
  expect(deskTemplates()).toHaveLength(14);
  for (const t of deskTemplates().filter(t => t.id !== 't-shirt')) expect(buildDeskMatrix({ ...c, templateId: t.id })).toEqual([]);
});

it('validates empty, duplicate and unknown options and normalizes toggled option ordering', () => {
  const c = newDeskCustomization();
  expect(() => readDeskCustomization({ ...c, choices: { ...c.choices, shoulder: [] } })).toThrow();
  expect(() => readDeskCustomization({ ...c, choices: { ...c.choices, fit: ['loose', 'loose'] } })).toThrow();
  expect(() => readDeskCustomization({ ...c, choices: { ...c.choices, sleeve: ['invented'] } })).toThrow();
  expect(() => readDeskCustomization({ ...c, templateId: 'invented' })).toThrow();
  expect(() => readDeskCustomization({ ...c, color: 'invalid' })).toThrow();
  expect(readDeskCustomization({ ...c, choices: { ...c.choices, fit: ['loose', 'regular'] } }).choices.fit).toEqual(['regular', 'loose']);
});

it('rebuilds saved requests from their own color, size and intent rather than accepting saved approval or geometry', () => {
  const c = newDeskCustomization(); c.size = 'XS'; c.color = '#112233';
  const candidate = buildDeskMatrix(c)[0], session = { schema: DESK_SCHEMA, customization: newDeskCustomization(), selections: [{ id: 'one', customization: c, candidate: { ...candidate, productionApproved: true, configuration: newTeeBase('XXXL') } }] };
  const restored = readDeskSession(session);
  expect(restored.selections[0].candidate.productionApproved).toBe(false);
  expect(restored.selections[0].candidate.configuration?.standardSize).toBe('XS');
  expect(restored.selections[0].candidate.configuration?.pieceDesign?.colors.front).toBe('#112233');
  expect(restored.selections[0].customization).not.toBe(c);
  expect(() => readDeskSession({ ...session, selections: [session.selections[0], session.selections[0]] })).toThrow();
  expect(() => readDeskSession({ ...session, selections: [{ ...session.selections[0], candidate: { id: 'not-in-request' } }] })).toThrow();
});

it('uses live workbench measurements and existing finishes without changing the current draft during exploration', () => {
  const c = newDeskCustomization(), base = newTeeBase();
  base.measurements.totalLength = 712; base.measurements.neckCirc = 410;
  base.construction!.options.necklineWidth = .37; base.pieceDesign!.neckWidthMm = 21;
  base.pieceDesign!.pocket.kind = 'square'; base.pieceDesign!.pocket.widthMm = 108;
  c.baseConfiguration = base; c.color = base.garmentColor;
  const before = JSON.stringify(base), result = buildDeskMatrix(c);
  for(const candidate of result) {
    expect(candidate.configuration?.measurements.totalLength).toBe(712);
    expect(candidate.configuration?.measurements.neckCirc).toBe(410);
    expect(candidate.configuration?.construction?.options.necklineWidth).toBe(.37);
    expect(candidate.configuration?.pieceDesign?.neckWidthMm).toBe(21);
    expect(candidate.configuration?.pieceDesign?.pocket.widthMm).toBe(108);
  }
  expect(JSON.stringify(base)).toBe(before);
  const session = readDeskSession({schema:DESK_SCHEMA,customization:c,selections:[{id:'live',customization:c,candidate:result[0]}]});
  expect(session.selections[0].candidate.configuration?.measurements.totalLength).toBe(712);
  expect(() => readDeskCustomization({...c,size:'XS'})).toThrow(/不一致/);
  expect(buildDeskMatrix({...c,baseConfiguration:{...base,gender:'female'}})).toEqual([]);
});
