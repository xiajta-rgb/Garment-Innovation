import type { PatternPath } from '@/types/pattern';
import { PIECE_FAMILIES, PIECE_ROLES, PIECE_MATERIALS, PIECE_ROLE_MAP, PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';

export type TagGroupId = 'family' | 'role' | 'layer' | 'material' | 'cut' | 'quantity';
export interface TagGroup { id: TagGroupId; label: string }
export const TAG_GROUPS:TagGroup[] = [
  {id:'family',label:'裁片大类'},{id:'role',label:'具体裁片'},{id:'layer',label:'结构层级'},
  {id:'material',label:'材料层'},{id:'cut',label:'裁剪方式'},{id:'quantity',label:'裁剪数量'},
];
export interface PieceTagDef { id:string;label:string;color:string;group:TagGroupId }
const tag=(id:string,label:string,group:TagGroupId,color='#64748b'):PieceTagDef=>({id,label,group,color});
export const PIECE_TAGS:Record<string,PieceTagDef> = Object.fromEntries([
  ...PIECE_FAMILIES.map(f=>tag(f.id,f.tagLabel,'family',f.color)),tag('unclassified','未分类','family'),
  ...PIECE_ROLES.map(r=>tag(`role:${r.id}`,r.label,'role')),tag('role:unknown','角色待核验','role'),
  tag('main','主裁片','layer','#1677ff'),tag('component','部件裁片','layer','#faad14'),tag('structure-unknown','结构层级待核验','layer'),
  ...PIECE_MATERIALS.map(m=>tag(`material:${m.id}`,m.label,'material')),tag('material:unknown','材料层未声明','material'),
  tag('fold','对折裁剪','cut','#52c41a'),tag('flat-cut','非对折裁剪','cut'),tag('fold-unknown','裁法未声明','cut'),
  ...Array.from({length:12},(_,i)=>tag(i===0?'single':`cut${i+1}`,`裁 ${i+1} 片`,'quantity','#fa8c16')),
  tag('cut-other','其他已知数量','quantity'),tag('cut-unknown','数量待定义','quantity'),
].map(t=>[t.id,t]));
export const tagDef=(id:string):PieceTagDef|undefined=>PIECE_TAGS[id]?.id===id?PIECE_TAGS[id]:undefined;
const quantityTag=(qty:number|null|undefined)=>Number.isInteger(qty)&&Number(qty)>0?Number(qty)===1?'single':Number(qty)<=12?`cut${qty}`:'cut-other':'cut-unknown';

/** Metadata must be authored by the method. Shape, count and mirror symmetry are not synonyms. */
export function classificationError(path:PatternPath):string|null {
  if(path.taxonomyVersion!==PIECE_TAXONOMY_VERSION)return '分类版本缺失或不兼容';
  const role=path.pieceRole?PIECE_ROLE_MAP[path.pieceRole]:undefined;
  if(!role||role.id!==path.pieceRole)return '裁片角色未注册';
  if(role.family!==path.category)return '结构大类与裁片角色不一致';
  if(!PIECE_MATERIALS.some(m=>m.id===path.materialRole))return '材料层缺少明确来源';
  return null;
}
export function tagsForPath(path:PatternPath):string[]{
  const role=path.pieceRole?PIECE_ROLE_MAP[path.pieceRole]:undefined;
  const known=!!role&&role.id===path.pieceRole&&role.family===path.category&&path.taxonomyVersion===PIECE_TAXONOMY_VERSION;
  const material=PIECE_MATERIALS.some(m=>m.id===path.materialRole)?`material:${path.materialRole}`:'material:unknown';
  return [known?role.family:'unclassified',known?`role:${role.id}`:'role:unknown',known?role.structure:'structure-unknown',material,
    path.cutOnFold===true?'fold':path.cutOnFold===false?'flat-cut':'fold-unknown',quantityTag(path.cutQty)];
}
/** OR within an axis, AND between axes. Unknown selectors match nothing. */
export function matchesTagFilter(itemTags:string[],selected:string[]):boolean{
  if(!selected.length)return true;
  const byGroup=new Map<TagGroupId,string[]>();
  for(const id of selected){const t=tagDef(id);if(!t)return false;const group=byGroup.get(t.group)??[];group.push(id);byGroup.set(t.group,group);}
  return [...byGroup.values()].every(group=>group.some(id=>itemTags.includes(id)));
}
export function cuttingLabel(path:PatternPath):string{
  const qty=Number.isInteger(path.cutQty)&&Number(path.cutQty)>0?path.cutQty:'待定义';
  return `${path.cutOnFold===true?'对折裁':path.cutOnFold===false?'非对折裁':'裁法待定义'} · 裁 ${qty} 片`;
}
