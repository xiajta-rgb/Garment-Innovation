import { listPatterns } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { TEMPLATE_STRUCTURAL_REVIEWS } from '@/data/templateStructuralReview';
import { newTeeBase } from './tee-matrix';
import { readConfiguration } from './design-document';
import { defaultPieceDesign } from '@/lib/pattern/piece-design-spec';
import type { DesignConfiguration } from '@/types/design';
import type { StandardSize } from '@/types/measurements';

export const DESK_SCHEMA = 'garment-os/design-desk/v1';
export const DESK_DRAWING_SCALE = .44;
export const DESK_AXES = {
  neckline: { label: '领型', values: { crew: '圆领', v: 'V领', henley: '亨利领' } },
  shoulder: { label: '肩袖结构', values: { 'set-in': '标准装袖', drop: '落肩', raglan: '插肩' } },
  fit: { label: '版型', values: { slim: '合体', regular: '常规', loose: '宽松' } },
  sleeve: { label: '袖长', values: { short: '常规短袖', extended: '延伸短袖', long: '最长短袖延伸' } },
  fabric: { label: '面料组织', values: { jersey: '平纹汗布', waffle: '华夫格', rib: '坑条罗纹', pique: '珠地', slub: '竹节' } },
} as const;
export type DeskAxis = keyof typeof DESK_AXES;
export type DeskChoices = { [K in DeskAxis]: Array<keyof (typeof DESK_AXES)[K]['values']> };
export type DeskIntent = { [K in DeskAxis]: DeskChoices[K][number] };
export interface DeskCustomization {
  templateId: string; size: StandardSize; color: string; choices: DeskChoices; columnAxis: DeskAxis;
  baseConfiguration?: DesignConfiguration;
}
export interface DeskCandidate {
  id: string; templateId: string; intent: DeskIntent; name: string; configuration: DesignConfiguration | null;
  previewAvailable: boolean; blockers: string[]; matrixEligible: false; productionApproved: false;
}
export interface DeskSelection { id: string; customization: DeskCustomization; candidate: DeskCandidate }
export interface DeskSession { schema: typeof DESK_SCHEMA; customization: DeskCustomization; selections: DeskSelection[] }
export const deskTemplates = () => listPatterns().slice().sort((a, b) => a.id === 't-shirt' ? -1 : b.id === 't-shirt' ? 1 : 0).map(p => ({ id: p.id, name: p.name, category: p.category,
  source: PATTERN_REVIEWS[p.id].engine, disposition: PATTERN_REVIEWS[p.id].disposition, scope: TEMPLATE_STRUCTURAL_REVIEWS[p.id].scope }));
export function newDeskCustomization(): DeskCustomization {
  return { templateId: 't-shirt', size: 'M', color: '#d9d7c9', columnAxis: 'sleeve', choices: {
    neckline: ['crew'], shoulder: ['set-in'], fit: ['regular', 'loose'], sleeve: ['short', 'extended'], fabric: ['jersey'],
  } };
}
export function deskLabel(axis: DeskAxis, value: string): string {
  return (DESK_AXES[axis].values as Record<string, string>)[value] ?? value;
}
export function readDeskCustomization(value: unknown): DeskCustomization {
  if (!value || typeof value !== 'object') throw Error('定制内容无效');
  const v = value as DeskCustomization;
  if (!deskTemplates().some(t => t.id === v.templateId) || !['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].includes(v.size)) throw Error('模板或参考尺码无效');
  if (typeof v.color !== 'string' || !/^#[a-f\d]{6}$/i.test(v.color) || !Object.hasOwn(DESK_AXES, v.columnAxis)) throw Error('颜色或排列方式无效');
  if (!v.choices || typeof v.choices !== 'object') throw Error('缺少定制维度');
  const choices = Object.fromEntries((Object.keys(DESK_AXES) as DeskAxis[]).map(axis => {
    const values = v.choices[axis];
    if (!Array.isArray(values) || !values.length || values.length > Object.keys(DESK_AXES[axis].values).length || new Set(values).size !== values.length || values.some(x => !Object.hasOwn(DESK_AXES[axis].values, x))) throw Error('定制选项无效：' + axis);
    // Canonical order keeps matrix cells and saved identities stable after toggling.
    return [axis, Object.keys(DESK_AXES[axis].values).filter(x => (values as string[]).includes(x))];
  })) as DeskChoices;
  const baseConfiguration = v.baseConfiguration === undefined ? undefined : readConfiguration(v.baseConfiguration);
  if (baseConfiguration && (baseConfiguration.activePatternId !== v.templateId || baseConfiguration.standardSize !== v.size || baseConfiguration.garmentColor !== v.color)) throw Error('定制基版与当前款式不一致');
  return { templateId: v.templateId, size: v.size, color: v.color, columnAxis: v.columnAxis, choices, ...(baseConfiguration ? { baseConfiguration } : {}) };
}
/** Enumerate design requests. This does not release an unreviewed construction template. */
export function buildDeskMatrix(value: DeskCustomization): DeskCandidate[] {
  const c = readDeskCustomization(value);
  if (c.templateId !== 't-shirt' || (c.baseConfiguration && c.baseConfiguration.gender !== 'male')) return [];
  let intents: Partial<DeskIntent>[] = [{}];
  for (const axis of Object.keys(DESK_AXES) as DeskAxis[]) intents = intents.flatMap(i => c.choices[axis].map(v => ({ ...i, [axis]: v })));
  return intents.map(partial => {
    const intent = partial as DeskIntent, blockers: string[] = [];
    if (intent.neckline !== 'crew') blockers.push(`${deskLabel('neckline', intent.neckline)}的领窝、领条/贴边及开口尚无配套方法。`);
    if (intent.shoulder === 'raglan') blockers.push('插肩源版是连帽长袖，前后插肩配缝超差，尚未重建为短T。');
    if (intent.shoulder === 'drop') blockers.push('落肩前后身、降低袖山和袖长平衡尚未配套，不能借用装袖。');
    if (intent.fabric !== 'jersey') blockers.push(`${deskLabel('fabric', intent.fabric)}尚无组织预览与实测材料条件，暂不套用平纹三视图。`);
    let configuration: DesignConfiguration | null = null;
    if (!blockers.length) {
      configuration = c.baseConfiguration ? readConfiguration(c.baseConfiguration) : newTeeBase(c.size);
      configuration.fit = intent.fit; configuration.garmentColor = c.color;
      configuration.construction ??= { schema: 'garment-os/construction/v1', options: {} };
      configuration.pieceDesign ??= { ...defaultPieceDesign(c.color), pocket: { ...defaultPieceDesign(c.color).pocket, kind: 'none' } };
      configuration.construction!.options.sleeveLength = { short: .3, extended: .65, long: 1 }[intent.sleeve];
      configuration.pieceDesign!.colors = { front: c.color, back: c.color, sleeve: c.color, neckband: c.color, pocket: c.color };
    }
    return { id: [c.templateId, ...Object.values(intent)].join('/'), templateId: c.templateId, intent,
      name: (Object.keys(DESK_AXES) as DeskAxis[]).map(axis => deskLabel(axis, intent[axis])).join(' · '), configuration,
      previewAvailable: configuration !== null, blockers, matrixEligible: false, productionApproved: false };
  });
}
export function deskMatrixRows(c: DeskCustomization, candidates = buildDeskMatrix(c)) {
  const otherAxes = (Object.keys(DESK_AXES) as DeskAxis[]).filter(a => a !== c.columnAxis);
  const rows = new Map<string, { key: string; label: string; candidates: DeskCandidate[] }>();
  for (const candidate of candidates) {
    const key = otherAxes.map(a => candidate.intent[a]).join('/');
    if (!rows.has(key)) rows.set(key, { key, label: otherAxes.filter(a => c.choices[a].length > 1).map(a => deskLabel(a, candidate.intent[a])).join(' · ') || '基础组合', candidates: [] });
    rows.get(key)!.candidates.push(candidate);
  }
  return [...rows.values()];
}
export function readDeskSession(value: unknown): DeskSession {
  if (!value || typeof value !== 'object') throw Error('设计台记录无效');
  const v = value as DeskSession;
  if (v.schema !== DESK_SCHEMA || !Array.isArray(v.selections) || v.selections.length > 24) throw Error('设计台记录版本或选款数量无效');
  const ids = new Set<string>();
  const selections = v.selections.map(s => {
    if (!s || typeof s.id !== 'string' || ids.has(s.id)) throw Error('选款编号无效');
    ids.add(s.id); const customization = readDeskCustomization(s.customization);
    // Rebuild from the saved request; never trust stored geometry or approval flags.
    const candidate = buildDeskMatrix(customization).find(c => c.id === s.candidate?.id);
    if (!candidate) throw Error('已选方案不属于保存的定制内容');
    return { id: s.id, customization, candidate };
  });
  return { schema: DESK_SCHEMA, customization: readDeskCustomization(v.customization), selections };
}
