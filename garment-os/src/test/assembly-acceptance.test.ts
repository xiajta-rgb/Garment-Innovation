import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { getReferenceMeasurements, referenceProfileId } from '@/data/referenceMeasurements';
import { validateAssembly } from '@/lib/pattern/assembly/validate';
import { draftBrian } from '@/lib/pattern/reference/brian';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { computeDraft } from '@/application/draft-service';
import type { AssemblyDefinition, AssemblyPiece, AssemblyReport } from '@/types/assembly';
import type { GenderType, StandardSize } from '@/types/measurements';
import { Path, Point } from '@freesewing/core';
import { contourTopologyError } from '@/lib/pattern/assembly/topology';

const dir = 'doc/evidence/assembly-20261111';
const evidence: Array<{ id: string; gender: GenderType; size: StandardSize; fit: string; report: AssemblyReport }> = [];
const faults: Array<{ name: string; expectedCode: string; detectedCodes: string[]; blocked: boolean }> = [];
const cases: Array<[string, GenderType]> = [['brian-reference', 'male'], ['brian-reference', 'female'], ['t-shirt', 'male'], ['womens-basic-tee', 'female'], ['long-sleeve-tee', 'male'], ['button-up-shirt', 'male']];
const config = (id: string, gender: GenderType = 'male', size: StandardSize = 'M', fit: 'slim' | 'regular' | 'loose' = 'regular') => ({
  activePatternId: id, gender, standardSize: size, fit, measurements: getReferenceMeasurements(gender, size), engineVersion: '4.10.2' as const, garmentColor: '#c0c0c0', fabricId: '',
});
const source = (id = 'button-up-shirt', gender: GenderType = 'male', size: StandardSize = 'M', fit: 'slim' | 'regular' | 'loose' = 'regular') =>
  id === 'brian-reference' ? draftBrian(getReferenceMeasurements(gender, size), { fit }).assemblyPieces : draftStandard(id, getReferenceMeasurements(gender, size), fit).assemblyPieces;

describe('replayable structural acceptance matrix', () => {
  for (const [id, gender] of cases) for (const size of ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const) for (const fit of ['slim', 'regular', 'loose'] as const) {
    it(`${id}/${gender}/${size}/${fit}: all contour edges classified and all piece inventories paired`, () => {
      const report = validateAssembly(getAssemblyDefinition(id), source(id, gender, size, fit));
      evidence.push({ id, gender, size, fit, report });
      expect(report.errors).toEqual([]);
      expect(report.integrityPass).toBe(true);
      expect(report.coverage.classifiedEdges).toBe(report.coverage.totalEdges);
      expect(report.coverage.allPiecesConnected).toBe(true);
      expect(report.boundaries.filter(b => b.disposition === 'join').every(b => b.used === b.availableUses)).toBe(true);
      expect(report.joins.filter(j => j.status === 'passed').every(j => j.directionChecked)).toBe(true);
      expect(report.status).toBe('incomplete'); // A reference method still has explicitly unresolved construction.
      expect(report.productionApproved).toBe(false);
    });
  }
});

function fault(name: string, expectedCode: string, mutate: (pieces: AssemblyPiece[], def: AssemblyDefinition) => void) {
  it(name, () => {
    const pieces = source(), def = getAssemblyDefinition('button-up-shirt');
    mutate(pieces, def);
    const report = validateAssembly(def, pieces), codes = report.errors.map(e => e.code);
    faults.push({ name, expectedCode, detectedCodes: codes, blocked: !report.integrityPass });
    expect(codes).toContain(expectedCode); expect(report.status).toBe('blocked'); expect(report.productionApproved).toBe(false);
  });
}
fault('missing collar stand blocks the full assembly', 'piece-missing', pieces => { pieces.splice(pieces.findIndex(p => p.id === 'simon.collarStand'), 1); });
fault('duplicate sleeve identity blocks rather than silently merging', 'piece-duplicate', pieces => { pieces.push(structuredClone(pieces.find(p => p.id === 'simon.sleeve')!)); });
fault('undeclared pocket cannot join a reviewed shirt', 'piece-unexpected', pieces => { pieces.push({ ...structuredClone(pieces[0]), id: 'simon.pocket' }); });
fault('mixed source version is rejected', 'source-mismatch', pieces => { pieces[0].version = '4.10.1'; });
fault('mixed source engine is rejected', 'source-mismatch', pieces => { pieces[0].engine = 'teagan'; });
fault('inherited yoke cut-on-fold annotation cannot override actual cutting plan', 'cut-plan-mismatch', pieces => { pieces.find(p => p.id === 'simon.yoke')!.onFold = true; });
fault('two cuffs cannot silently replace the four fabric layers', 'cut-plan-mismatch', pieces => { pieces.find(p => p.id === 'simon.cuff')!.quantity = 2; });
fault('cutting inventory must agree with source materials', 'cutlist-mismatch', pieces => { pieces.find(p => p.id === 'simon.cuff')!.materials.fabric[0].cut = 3; });
fault('missing named shoulder endpoint cannot fall back to nearest coordinate', 'boundary-unresolved', pieces => { delete pieces.find(p => p.id === 'simon.frontLeft')!.points.s3ArmholeSplit; });
fault('false edge length cannot masquerade as matching seams', 'geometry-invalid', pieces => { pieces[0].edges[0].lengthMm += 10; });
fault('a genuinely lengthened side seam blocks after curve lengths are recomputed', 'join-length-mismatch', pieces => {
  const p = pieces.find(p => p.id === 'simon.frontLeft')!;
  const e = p.edges.find(e => e.kind === 'curve' && Math.hypot(e.to.x - p.points.armhole.x, e.to.y - p.points.armhole.y) < 1e-7)!;
  e.cp1!.x += 100;
  e.lengthMm = new Path().move(new Point(e.from.x, e.from.y)).curve(new Point(e.cp1!.x, e.cp1!.y), new Point(e.cp2!.x, e.cp2!.y), new Point(e.to.x, e.to.y)).length();
});
fault('discontinuous contour is blocked', 'geometry-invalid', pieces => { pieces[0].edges[0].to.x += 10; });
fault('a finite closed bow-tie outline is blocked before assembly', 'geometry-topology', pieces => {
  const xy = [[0, 0], [100, 100], [0, 100], [100, 0]];
  pieces[0].edges = xy.map(([x, y], i) => { const [tx, ty] = xy[(i + 1) % xy.length]; return { id: `e${i}`, kind: 'line', from: { x, y }, to: { x: tx, y: ty }, lengthMm: Math.hypot(tx - x, ty - y) }; });
});
fault('nonfinite curve control is blocked', 'geometry-invalid', pieces => { pieces.find(p => p.id === 'simon.sleeve')!.edges.find(e => e.kind === 'curve')!.cp1!.x = NaN; });
fault('wrong side-to-shoulder pairing is rejected by semantic role', 'join-role-mismatch', (_pieces, def) => { def.joins.find(j => j.id === 'side-left')!.b = [{ piece: 'simon.yoke', boundary: 'shoulder-left', runs: 1, layers: 2 }]; });
fault('an equal-length underarm pair with reversed endpoints is rejected', 'join-direction-mismatch', (_pieces, def) => { def.joins.find(j => j.id === 'underarms')!.b[0].reverse = false; });
fault('armhole segment order cannot be permuted even when the total length is unchanged', 'join-direction-mismatch', (_pieces, def) => { def.joins.find(j => j.id === 'sleevecap-left')!.b.reverse(); });
fault('reusing a valid shoulder seam consumes inventory twice and blocks', 'boundary-overconsumed', (_pieces, def) => { def.joins.push({ ...structuredClone(def.joins.find(j => j.id === 'shoulder-left')!), id: 'duplicate-shoulder' }); });
fault('an unpaired join is rejected even when every contour is closed', 'boundary-unpaired', (_pieces, def) => { def.joins = def.joins.filter(j => j.id !== 'shoulder-left'); });
fault('a cut cannot use the same slit face twice', 'internal-face-duplicate', (_pieces, def) => { const slit = def.pieces.find(p => p.id === 'simon.sleeve')!.boundaries.filter(b => b.sourcePath); slit[1].sourceFace = slit[0].sourceFace; });
fault('removing both placket relations exposes disconnected components', 'piece-disconnected', (_pieces, def) => { def.joins = def.joins.filter(j => !j.id.startsWith('placket-')); });
fault('matching raw cuff edges cannot approve unresolved folded geometry', 'join-unresolved-interface', (_pieces, def) => { def.joins.find(j => j.id === 'cuffs')!.rule = { kind: 'equal', toleranceMm: 1000, basis: 'invalid promotion' }; });

it('application blocks invalid measurement and cannot retain old geometry or an old report', () => {
  const c = config('button-up-shirt'), result = computeDraft({ ...c, measurements: { ...c.measurements, neckCirc: NaN } });
  expect(result.status).toBe('blocked'); expect(result.paths).toEqual([]); expect(result.assembly).toBeNull();
});
it('closed finite outlines still fail when self-crossing, overlapping or degenerate', () => {
  const check = (xy: number[][]) => contourTopologyError(xy.map(([x, y], i) => {
    const [tx, ty] = xy[(i + 1) % xy.length];
    return { id: `e${i}`, kind: 'line' as const, from: { x, y }, to: { x: tx, y: ty }, lengthMm: Math.hypot(tx - x, ty - y) };
  }));
  expect(check([[0, 0], [100, 0], [100, 100], [0, 100]])).toBeNull();
  expect(check([[0, 0], [100, 100], [0, 100], [100, 0]])).toContain('自交');
  expect(check([[0, 0], [100, 0], [50, 0], [150, 0]])).toBeTruthy();
});
it('full-yoke material inventory and display metadata agree, independent of inherited cutOnFold annotations', () => {
  const result = computeDraft(config('button-up-shirt'));
  expect(result.error).toBeNull();
  const yoke = result.assembly!.pieces.find(p => p.id === 'simon.yoke')!;
  expect(yoke.onFold).toBe(false); expect(yoke.quantity).toBe(2);
  expect(result.paths.filter(p => p.pieceId === yoke.id).every(p => p.cutOnFold === false && p.cutQty === 2)).toBe(true);
  expect(result.assembly!.joins.filter(j => j.status === 'pending')).toHaveLength(5);
});

afterAll(() => {
  mkdirSync(dir, { recursive: true });
  const counts = { samples: evidence.length, passedIntegrity: evidence.filter(e => e.report.integrityPass).length, blocked: evidence.filter(e => !e.report.integrityPass).length, injectedFaults: faults.length, blockedFaults: faults.filter(f => f.blocked).length };
  writeFileSync(`${dir}/acceptance-matrix.json`, JSON.stringify({ scope: 'system architecture and assembly contracts', upstreamVersion: '4.10.2', productionApproved: false, counts, cases: evidence, faults }, null, 2));
  for (const [id, gender] of cases.filter(([id, g]) => !(id === 'brian-reference' && g === 'female'))) {
    const c = config(id, gender), result = computeDraft(c);
    writeFileSync(`${dir}/${id}.example.json`, JSON.stringify({ schema: 'garment-os/assembly-example/v1', scope: '系统结构与装配逻辑验收范例', profile: referenceProfileId(gender, 'M'), configuration: c, draftStatus: result.status, assembly: result.assembly, sourcePieces: source(id, gender), error: result.error }, null, 2));
  }
});
