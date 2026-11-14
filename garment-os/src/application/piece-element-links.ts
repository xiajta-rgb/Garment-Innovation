import { PENDING_SOURCE_IDS } from '@/data/pendingElementRegistrations';
import { ELEMENT_LIBRARY, type LibrarySnapshot } from '@/data/elementRegistry';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';

/** Local crosswalk only. No writes, inferred promotion or claim of live remote verification. */
export function auditPieceElementLinks(snapshot:LibrarySnapshot=ELEMENT_LIBRARY){
  const issues:string[]=[],seen=new Set<string>(),matchedSources=new Set<string>();
  const rows=snapshot.elements.filter(e=>e.type==='结构部件模板').map(e=>{
    if(seen.has(e.sourceId))issues.push(`元素源身份重复：${e.sourceId}`);
    seen.add(e.sourceId);
    const key=e.sourceId.replace(/^garment-os:\/\/block\//,'');
    const sourceIds=key==='bodice-brian'?['brian.front','brian.back']:key==='sleeve-brian'?['library.sleeve']:
      Object.hasOwn(SOURCE_PIECE_ROLES,key)?[key]:[];
    const isolated=['隔离','弃用'].includes(e.status);
    if(isolated&&sourceIds.length)issues.push(`隔离元素不得绑定可执行裁片：${e.sourceId}`);
    if(!isolated&&!sourceIds.length)issues.push(`非隔离元素没有精确源身份：${e.sourceId}`);
    if(!isolated)sourceIds.forEach(id=>matchedSources.add(id));
    return {sourceId:e.sourceId,recordId:e.feishuRecordId,name:e.name,remoteStatusAtSnapshot:e.status,
      legacyPartLabels:e.parts,sourceIds:isolated?[]:sourceIds,localRoles:isolated?[]:[...new Set(sourceIds.map(id=>SOURCE_PIECE_ROLES[id].role))],
      disposition:isolated?'quarantined' as const:sourceIds.length?'local-crosswalk' as const:'unmapped' as const,
      remoteClassificationVerified:false as const};
  });
  const pendingSourceIds=Object.keys(SOURCE_PIECE_ROLES).filter(id=>!matchedSources.has(id)&&PENDING_SOURCE_IDS.some(p=>p===id));
  for(const id of Object.keys(SOURCE_PIECE_ROLES))if(!matchedSources.has(id)&&!pendingSourceIds.includes(id))issues.push(`可执行源身份缺少快照关联：${id}`);
  return {snapshotAt:snapshot.syncedAt,tableId:snapshot.source.tableId,taxonomyVersion:PIECE_TAXONOMY_VERSION,
    scope:'local-snapshot-only',remoteWritten:false,remoteClassificationVerified:false,issues,rows,pendingSourceIds,
    counts:{records:rows.length,quarantined:rows.filter(r=>r.disposition==='quarantined').length,
      linkedRecords:rows.filter(r=>r.disposition==='local-crosswalk').length,linkedSourceIdentities:matchedSources.size,
      pendingSourceIdentities:pendingSourceIds.length,unmapped:rows.filter(r=>r.disposition==='unmapped').length}};
}
