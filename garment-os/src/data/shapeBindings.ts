import { ELEMENT_LIBRARY, type LibrarySnapshot } from './elementRegistry';
import type { BodyMeasurements } from '@/types/measurements';
import { BRIAN_VERSION } from '@/lib/pattern/reference/brian';

/** App keys and dictionary codes are distinct; a near name is never a semantic alias. */
export const BRIAN_INPUT_BINDINGS: Array<{
  appKey: keyof BodyMeasurements; parameterCode: string; upstreamKey: string; unit: string; kind: string;
}> = [
  { appKey: 'bust', parameterCode: 'chestCircumference', upstreamKey: 'chest', unit: 'mm', kind: '人体量' },
  { appKey: 'neckCirc', parameterCode: 'neckCircumference', upstreamKey: 'neck', unit: 'mm', kind: '人体量' },
  { appKey: 'shoulderWidth', parameterCode: 'shoulderToShoulder', upstreamKey: 'shoulderToShoulder', unit: 'mm', kind: '人体量' },
  { appKey: 'shoulderSlope', parameterCode: 'shoulderSlope', upstreamKey: 'shoulderSlope', unit: 'deg', kind: '人体量' },
  { appKey: 'hpsToBust', parameterCode: 'hpsToBust', upstreamKey: 'hpsToBust', unit: 'mm', kind: '人体量' },
  { appKey: 'hpsToWaistBack', parameterCode: 'hpsToWaistBack', upstreamKey: 'hpsToWaistBack', unit: 'mm', kind: '人体量' },
  { appKey: 'waistToArmpit', parameterCode: 'waistToArmpit', upstreamKey: 'waistToArmpit', unit: 'mm', kind: '人体量' },
  { appKey: 'hipDepth', parameterCode: 'waistToHips', upstreamKey: 'waistToHips', unit: 'mm', kind: '人体量' },
  { appKey: 'totalLength', parameterCode: 'hpsToHem', upstreamKey: 'lengthBonus', unit: 'mm', kind: '设计量' },
  { appKey: 'bicep', parameterCode: 'upperArmCircumference', upstreamKey: 'biceps', unit: 'mm', kind: '人体量' },
  { appKey: 'sleeveLength', parameterCode: 'shoulderToWrist', upstreamKey: 'shoulderToWrist', unit: 'mm', kind: '人体量' },
  { appKey: 'wristCirc', parameterCode: 'wristCircumference', upstreamKey: 'wrist', unit: 'mm', kind: '人体量' },
];
export const BRIAN_SETTING_BINDINGS = [
  { parameterCode: 'chestEaseRatio', unit: 'ratio', kind: '设计量' },
  { parameterCode: 'bicepsEaseRatio', unit: 'ratio', kind: '设计量' },
  { parameterCode: 'referenceSeamAllowance', unit: 'mm', kind: '工艺量' },
];
export const BRIAN_TEMPLATE_SOURCE = 'garment-os://pattern/brian-reference';
export const BRIAN_COMPONENT_SOURCES = ['garment-os://block/bodice-brian', 'garment-os://block/sleeve-brian'] as const;
export function brianComponentForPiece(pieceId: string): string {
  if (pieceId === 'front-body' || pieceId === 'back-body') return BRIAN_COMPONENT_SOURCES[0];
  if (pieceId === 'sleeve') return BRIAN_COMPONENT_SOURCES[1];
  throw new Error('裁片角色未绑定，不能登记');
}
/** Pending references may create pending candidates; never manufacturing approval. */
export function requireBrianLibrary(library: LibrarySnapshot = ELEMENT_LIBRARY) {
  const bindings = [...BRIAN_INPUT_BINDINGS, ...BRIAN_SETTING_BINDINGS];
  const definitions = bindings.map(b => {
    const p = library.parameters.find(p => p.code === b.parameterCode);
    if (!p || p.unit !== b.unit || p.kind !== b.kind || p.dataType !== 'number' || !p.basis || !p.recordId) {
      throw new Error(`参数定义缺失或语义不一致：${b.parameterCode}`);
    }
    return p;
  });
  const entities = [BRIAN_TEMPLATE_SOURCE, ...BRIAN_COMPONENT_SOURCES].map((sourceId, i) => {
    const e = library.elements.find(e => e.sourceId === sourceId);
    if (!e || e.domain !== '服装造型域' || e.type !== (i === 0 ? '版型模板' : '结构部件模板')
      || !['待核验', '可用'].includes(e.status) || e.rightsStatus === '限制使用'
      || e.specification?.engine !== '@freesewing/brian' || e.specification?.engine_version !== BRIAN_VERSION
      || e.specification?.input_contract !== 'brian-inputs-v1'
      || bindings.some(b => !e.parameterCodes.includes(b.parameterCode))) {
      throw new Error(`造型来源缺失、被隔离或版本不兼容：${sourceId}`);
    }
    return e;
  });
  if (BRIAN_COMPONENT_SOURCES.some(src => !entities[0].componentSourceIds.includes(src))) {
    throw new Error('模板与结构部件关系不完整，不能登记');
  }
  return { template: entities[0], components: entities.slice(1), definitions };
}
