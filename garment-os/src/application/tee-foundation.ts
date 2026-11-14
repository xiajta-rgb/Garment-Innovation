import { Hugo } from '@freesewing/hugo';
import { draftStandard, standardSettings } from '@/lib/pattern/reference/standard';
import type { StandardDraft } from '@/lib/pattern/reference/standard';
import { captureAssemblyPiece } from '@/lib/pattern/assembly/source';
import { validateAssembly } from '@/lib/pattern/assembly/validate';
import { raglanFoundationDefinition } from '@/data/raglanFoundation';
import { getAssemblyDefinition } from '@/data/assemblyPlans';
import { newTeeBase } from './tee-matrix';
import type { StandardSize } from '@/types/measurements';
import type { AssemblyReport } from '@/types/assembly';

export type TeeFoundationFamily = 'set-in' | 'raglan' | 'drop';
export interface FoundationPiece { id: string; name: string; netPath: string; cutPaths: string[]; grainPaths: string[]; quantity: number; onFold: boolean; notches: Array<{ x: number; y: number; label: string }> }
export interface TeeFoundation { family: TeeFoundationFamily; title: string; source: string | null; sourceSettings: StandardDraft['settings'] | null; pieces: FoundationPiece[]; report: AssemblyReport | null; selectable: boolean; blockers: string[]; productionApproved: false }
interface RawPath { asPathstring(): string; hidden?: boolean }
interface RawPart { points: Parameters<typeof captureAssemblyPiece>[0]['points']; paths: Record<string, RawPath & Parameters<typeof captureAssemblyPiece>[0]['paths'][string]>; snippets: Record<string, { def: string; anchor: { x: number; y: number } }> }

export function buildTeeFoundation(family: TeeFoundationFamily, size: StandardSize = 'M'): TeeFoundation {
  if (family === 'drop') return { family, title: '落肩短T', source: null, sourceSettings: null, pieces: [], report: null, selectable: false, blockers: ['缺少同源的落肩前身、后身与降低袖山的配套袖片。', '需要联动肩端外移、袖窿重画、袖山及袖长平衡；仅放大围度或延长肩线不能入库。'], productionApproved: false };
  const c = newTeeBase(size);
  if (family === 'set-in') {
    const source = draftStandard('t-shirt', c.measurements, c.fit, c.construction);
    return { family, title: '装袖短T主体基版', source: '@freesewing/teagan@4.10.2', sourceSettings: source.settings, report: source.assembly,
      selectable: source.assembly.integrityPass && source.assembly.status !== 'blocked',
      pieces: source.pieces.map(p => ({ id: p.id, name: p.name, netPath: p.netPathD, cutPaths: Object.values(p.cutPaths), grainPaths: Object.values(p.grainPaths), quantity: p.qty!, onFold: p.onFold,
        notches: Object.entries(p.markings).filter(([, n]) => /notch/.test(n.kind)).map(([label, n]) => ({ x: n.x, y: n.y, label })) })),
      blockers: ['主体配缝可核对；领条独立构型、材料伸缩及试样尚未验收。', '袖山整体长度及前后剪口来自源版；未把袖山最高点擅自当作肩缝对位点。'], productionApproved: false };
  }
  const settings = standardSettings('t-shirt', c.measurements, c.fit, c.construction);
  const pattern = new Hugo({ measurements: settings.measurements, sa: 10, options: { draftForHighBust: false }, expand: true });
  pattern.draft();
  const def = raglanFoundationDefinition(), parts = pattern.parts[0] as Record<string, RawPart>;
  const cutlist = pattern.setStores[0].get('cutlist', {}) as Record<string, Record<string, unknown>>;
  const captured = def.pieces.map(p => captureAssemblyPiece(parts[p.id], { id: p.id, name: p.id === 'hugo.front' ? '插肩前身' : p.id === 'hugo.back' ? '插肩后身' : '连肩插肩长袖片', engine: 'hugo', version: '4.10.2' }, cutlist[p.id]));
  const report = validateAssembly(def, captured);
  return { family, title: '插肩结构源版研究', source: '@freesewing/hugo@4.10.2 · 原版为连帽长袖', sourceSettings: { measurements: settings.measurements, options: structuredClone(pattern.settings[0].options), sa: 10 }, report, selectable: false,
    pieces: captured.map(p => ({ id: p.id, name: p.name, quantity: p.quantity, onFold: p.onFold, netPath: parts[p.id].paths.seam.asPathstring(), cutPaths: [parts[p.id].paths.sa.asPathstring()],
      grainPaths: Object.entries(parts[p.id].paths).filter(([id, v]) => /(?:grainline|cutonfold).*_line$/.test(id) && !v.hidden).map(([, v]) => v.asPathstring()),
      notches: Object.entries(parts[p.id].snippets).filter(([, v]) => /notch/.test(v.def)).map(([label, v]) => ({ x: v.anchor.x, y: v.anchor.y, label })) })),
    blockers: [...def.unresolved, ...report.errors.map(e => {
      const j = report.joins.find(j => j.id === e.subject);
      return j && e.code === 'join-length-mismatch' && j.deltaMm !== null && j.toleranceMm !== null
        ? `${j.label}：单条净边差 ${(j.deltaMm / j.a[0].runs).toFixed(2)}mm，研究核对限值 ${(j.toleranceMm / j.a[0].runs).toFixed(2)}mm。`
        : `${e.subject}：${e.message}`;
    })], productionApproved: false };
}

/** Selection is checked again at the application boundary; UI disabling alone is insufficient. */
export function requireTeeFoundationCombination(foundation: TeeFoundation, pieceIds: string[]) {
  if (!foundation.selectable || foundation.family !== 'set-in' || !foundation.report?.integrityPass || foundation.report.status === 'blocked') throw Error('此结构未形成可用短T主体组合，已阻止选款和款式导出。');
  const expected = getAssemblyDefinition('t-shirt').pieces.map(p => p.id);
  if (pieceIds.length !== expected.length || new Set(pieceIds).size !== expected.length || expected.some(id => !pieceIds.includes(id))) throw Error('衣身与袖片不属于同一套裁片；不可跨袖型混搭。');
  return { family: foundation.family, pieces: [...pieceIds], productionApproved: false };
}
