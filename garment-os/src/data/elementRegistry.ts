/** Validated Feishu snapshot. Refresh with scripts/sync-shape-library.py; never implies live sync. */
import rawSnapshot from './elementLibrary.snapshot.json';

export type ElementDomain = '服装造型域' | '色彩图案域' | '面料材质域' | '细节工艺域';
export interface ElementRegistryEntry {
  sourceId: string; feishuRecordId: string; name: string; domain: ElementDomain; type: string;
  description: string; status: string; labelStatus: string; rightsStatus: string; granularity: string;
  parts: string[]; categories: string[]; productCores: string[];
  specification: Record<string, unknown> | null;
  componentSourceIds: string[]; basisSourceIds: string[]; parameterCodes: string[]; tagCandidates: string[];
  tagCodes: string | null; tagDictionaryVersion: string | null; sourceVersion: string | null;
  sourceUrl: string | null; limitations: string; updatedAt: string | null;
}
export interface ParameterDefinition {
  code: string; name: string; recordId: string; unit: string; roles: string[];
  kind: string; dataType: string; basis: string; requiredWhen: string;
  sourceRequirement: string; reviewStatus: string;
}
export interface LibrarySnapshot {
  snapshotVersion: string; syncedAt: string;
  source: { baseToken: string; tableId: string; parameterTableId: string; shapeViewId: string; wikiUrl: string };
  elements: ElementRegistryEntry[]; parameters: ParameterDefinition[];
}
export const ELEMENT_LIBRARY = rawSnapshot as LibrarySnapshot;
export const ELEMENT_REGISTRY = ELEMENT_LIBRARY.elements;
export const FEISHU_RECORD_MAP = Object.fromEntries(ELEMENT_REGISTRY.map(e => [e.sourceId, e.feishuRecordId]));
export const SOURCE_URL = 'https://github.com/xiajta-rgb/Garment-Innovation';
export function getElementFeishuRecordId(sourceId: string): string | undefined { return FEISHU_RECORD_MAP[sourceId]; }
export const ELEMENT_TABLE_COORDS = {
  ...ELEMENT_LIBRARY.source,
  wikiUrl: `${ELEMENT_LIBRARY.source.wikiUrl}?table=${ELEMENT_LIBRARY.source.tableId}&view=${ELEMENT_LIBRARY.source.shapeViewId}`,
  recordUrl(sourceId: string): string {
    const rec = getElementFeishuRecordId(sourceId);
    return rec ? `https://xcnplmqtjyqc.feishu.cn/base/${this.baseToken}?table=${this.tableId}&record=${rec}` : this.wikiUrl;
  },
};
export function groupElementsByDomain(): Record<ElementDomain, ElementRegistryEntry[]> {
  const groups: Record<ElementDomain, ElementRegistryEntry[]> = {
    '服装造型域': [], '色彩图案域': [], '面料材质域': [], '细节工艺域': [],
  };
  for (const e of ELEMENT_REGISTRY) groups[e.domain].push(e);
  return groups;
}
export function filterLibrary(elements: ElementRegistryEntry[], filter: {
  domain: ElementDomain; type: string; part: string; query: string; includeIsolated: boolean;
}): ElementRegistryEntry[] {
  const query = filter.query.trim().toLowerCase();
  return elements.filter(e => e.domain === filter.domain
    && (!filter.type || e.type === filter.type) && (!filter.part || e.parts.includes(filter.part))
    && (filter.includeIsolated || !['隔离', '弃用'].includes(e.status))
    && (!query || `${e.name} ${e.sourceId} ${e.type} ${e.parts.join(' ')}`.toLowerCase().includes(query)));
}
