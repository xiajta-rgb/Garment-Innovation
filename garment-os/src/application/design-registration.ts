/** Candidate-only exchange: source lineage and compact metadata in Base, detailed CAD in the local package. */
import { v5 as uuidv5 } from 'uuid';
import { readConfiguration } from './design-document';
import type { DesignConfiguration } from '@/types/design';
import { cutpieceElementSourceId } from '@/data/element-links';
import { type LibrarySnapshot, type ParameterDefinition } from '@/data/elementRegistry';
import { BRIAN_INPUT_BINDINGS, BRIAN_TEMPLATE_SOURCE, brianComponentForPiece, requireBrianLibrary } from '@/data/shapeBindings';
import { BRIAN_SOURCE, BRIAN_VERSION } from '@/lib/pattern/reference/brian';
import { generateReferencePieces } from '@/lib/pattern/reference/generator';

export const REGISTRATION_NAMESPACE = 'b99840ac-878d-4d1c-bb66-b863d39c3972';
export interface RegistrationPiece {
  sourceId: string; name: string; qty: number; grossAreaMm2: number | null; netAreaMm2: number;
  templateSourceId: string; componentSourceId: string; pieceRole: string;
  geometry: unknown; feishuFields: Record<string, unknown>;
}
export interface RegistrationPackage {
  packageVersion: '2.0'; revisionId: string; identityPayload: string;
  designId: string; designName: string; patternId: string; gender: string; fit: string; standardSize: string;
  productionApproved: false;
  measurementProvenance: { status: 'unverified-input-snapshot'; note: string };
  librarySnapshot: { syncedAt: string; inputContract: 'brian-inputs-v1'; templateSourceId: string; sourceVersion: string | null };
  inputBindings: Array<{ appKey: string; parameterCode: string; parameterRecordId: string; upstreamKey: string; unit: string; value: number }>;
  parameterDefinitionsSnapshot: ParameterDefinition[];
  measurementsSnapshot: Record<string, number>; draftStats: unknown; pieces: RegistrationPiece[];
  feishuRecordMap: Record<string, string>;
}

export function createRegistrationPackage(s: DesignConfiguration & { currentDesignId: string | null; designName: string }, snapshot: LibrarySnapshot): RegistrationPackage {
  if (s.activePatternId !== 'brian-reference') throw new Error('此模板的候选登记协议尚未接通；当前仅 Brian 可导出元素库登记包');
  readConfiguration(s);
  const library = requireBrianLibrary(snapshot);
  const reference = generateReferencePieces(s.measurements, { fit: s.fit });
  if (!reference.draft.geometryPass) throw new Error('参考几何检查失败，不能生成注册包');
  const settings = reference.draft.settings;
  const inputs = BRIAN_INPUT_BINDINGS.map(b => ({
    appKey: b.appKey, parameterCode: b.parameterCode,
    parameterRecordId: library.definitions.find(p => p.code === b.parameterCode)!.recordId,
    upstreamKey: b.upstreamKey, unit: b.unit, value: s.measurements[b.appKey] as number,
  }));
  const measurements = Object.fromEntries(inputs.map(b => [b.appKey, b.value]));
  // A content revision prevents same-day collisions and preserves earlier dimensions when a design changes.
  const identityPayload = JSON.stringify({ engine: `@freesewing/brian@${BRIAN_VERSION}`,
    savedDesignId: s.currentDesignId, designName: s.designName, gender: s.gender, fit: s.fit, standardSize: s.standardSize,
    sourceVersion: library.template.sourceVersion, inputs, settings, definitions: library.definitions,
    paths: reference.pieces.map(p => ({ id: p.id, net: p.netPathD, cut: p.cuttingPathD })),
  });
  const revisionId = uuidv5(identityPayload, REGISTRATION_NAMESPACE);
  const designId = s.currentDesignId ?? `candidate-${revisionId}`;
  const designName = s.designName || designId;
  return {
    packageVersion: '2.0', revisionId, identityPayload, designId, designName,
    patternId: s.activePatternId, gender: s.gender, fit: s.fit, standardSize: s.standardSize,
    productionApproved: false,
    measurementProvenance: { status: 'unverified-input-snapshot', note: '当前输入快照；尚未登记实测对象、测量协议与材料条件。尺码名不代表实测或生产批准。' },
    librarySnapshot: { syncedAt: snapshot.syncedAt, inputContract: 'brian-inputs-v1',
      templateSourceId: BRIAN_TEMPLATE_SOURCE, sourceVersion: library.template.sourceVersion },
    inputBindings: inputs, parameterDefinitionsSnapshot: library.definitions, measurementsSnapshot: measurements,
    draftStats: { engine: '@freesewing/brian', version: BRIAN_VERSION, checks: reference.draft.checks,
      productionApproved: false, settings },
    feishuRecordMap: {},
    pieces: reference.pieces.map(p => {
      const componentSourceId = brianComponentForPiece(p.id);
      const component = library.components.find(e => e.sourceId === componentSourceId)!;
      const sourceId = cutpieceElementSourceId(designId, `${revisionId}/brian-${BRIAN_VERSION}-${p.id}`);
      const name = `${designName} · ${p.name}（候选）`;
      const specification = {
        engine: '@freesewing/brian', engine_version: BRIAN_VERSION, input_contract: 'brian-inputs-v1',
        design_id: designId, revision_id: revisionId, template_source_id: BRIAN_TEMPLATE_SOURCE,
        component_source_id: componentSourceId, piece_role: p.id, upstream_part: p.upstreamPart,
        inputs: Object.fromEntries(inputs.map(b => [b.parameterCode, b.value])),
        settings: { chestEaseRatio: settings.options.chestEase, bicepsEaseRatio: settings.options.bicepsEase, referenceSeamAllowance: settings.sa },
        input_provenance: 'unverified-input-snapshot', qty: p.qty, on_fold: p.onFold, length_unit: 'mm',
        net_area_mm2: p.netAreaMm2, gross_area_mm2: null, production_approved: false,
      };
      return {
        sourceId, name, qty: p.qty, grossAreaMm2: null, netAreaMm2: p.netAreaMm2,
        templateSourceId: BRIAN_TEMPLATE_SOURCE, componentSourceId, pieceRole: p.id,
        geometry: { engine: 'Brian', version: BRIAN_VERSION, upstreamPart: p.upstreamPart, netPathD: p.netPathD,
          coordinateSystem: { unit: 'mm', xDirection: 'right', yDirection: 'down', origin: 'upstream-part-local-0-0' },
          cuttingPathD: p.cuttingPathD, points: p.referencePoints,
          edges: p.edges.map((edge, i) => ({ ...edge, id: `${p.upstreamPart}:edge:${i}` })),
          grainPathD: reference.draft.pieces.find(d => d.id === p.id)!.grainPathD,
          notchPoints: reference.draft.pieces.find(d => d.id === p.id)!.notchPoints,
          seamPairing: null, materialProfile: null, onFold: p.onFold, tags: p.tags },
        feishuFields: {
          '素材名称': name, '来源素材标识': sourceId, '元素域': ['服装造型域'], '元素类型': ['纸样与裁片'],
          '资产粒度': ['单片实例'], '资产性质': ['开源参考'],
          '适用部位': [p.id === 'front-body' ? '前身' : p.id === 'back-body' ? '后身' : '袖部'], '对象层位': ['整体本体'],
          '生成依据': [{ id: library.template.feishuRecordId }, { id: component.feishuRecordId }],
          '参数定义': library.definitions.map(d => ({ id: d.recordId })),
          '规格信息': JSON.stringify(specification),
          '素材说明': `Brian ${BRIAN_VERSION} 男装基型的尺寸裁片候选；${p.upstreamPart}；${p.onFold ? '对折裁一片' : '镜像对裁两片'}。完整路径与控制点保存在本地裁片包。`,
          '适用类目': '上装参考基型（产品核与材料适用性待核验）', '来源渠道': 'FreeSewing Brian 参考制图',
          '来源链接': BRIAN_SOURCE, '来源版本': `@freesewing/brian@${BRIAN_VERSION}; brian-inputs-v1`,
          '素材状态': ['待核验'], '标签核验状态': ['未核验'], '权利核验状态': ['待确认'],
          '缺失项与限制': '输入来源待核验；材料/缩率、逐边缝份与剪口工艺、毛样用量、试坯和生产批准缺失；不可直接作为制造BOM。',
        },
      };
    }),
  };
}

