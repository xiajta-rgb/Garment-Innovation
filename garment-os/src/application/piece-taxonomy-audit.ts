import { PIECE_FAMILIES, PIECE_ROLES, PIECE_MATERIALS, PIECE_TAXONOMY_VERSION } from '@/data/pieceTaxonomy';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { PIECE_SCENARIOS } from '@/data/pieceTaxonomyScope';
import { classificationError } from '@/lib/pattern/piece-tags';
import type { PieceRecord } from '@/lib/pattern/piece-registry';
import type { PieceFamilyDefinition, PieceRoleDefinition, PieceSourceRoleBinding } from '@/types/piece-taxonomy';

export interface TaxonomyCatalogue {
  families:PieceFamilyDefinition[]; roles:PieceRoleDefinition[]; bindings:Record<string,PieceSourceRoleBinding>;
}
export interface TaxonomyIssue {subject:string;message:string}
export function auditPieceTaxonomy(pieces:PieceRecord[] = [], catalogue:TaxonomyCatalogue = {
  families:PIECE_FAMILIES,roles:PIECE_ROLES,bindings:SOURCE_PIECE_ROLES,
}) {
  const {families,roles,bindings}=catalogue, issues:TaxonomyIssue[]=[];
  const add=(subject:string,message:string)=>issues.push({subject,message});
  for(const [label,items] of [['大类',families],['角色',roles]] as const){
    const seen=new Set<string>();
    for(const item of items){
      if(seen.has(item.id))add(item.id,`${label}编码重复`);
      seen.add(item.id);
      if(!item.id||!item.label.trim()||!item.definition.trim())add(item.id,`${label}定义不完整`);
    }
  }
  for(const f of families){
    if(!f.keyDimensions.length||!f.interfaces.length)add(f.id,'缺少关键尺寸或装接接口');
    if(!roles.some(r=>r.family===f.id))add(f.id,'大类没有具体角色');
    if(!PIECE_SCENARIOS.some(s=>s.families.includes(f.id)))add(f.id,'没有适用服装场景');
  }
  for(const r of roles){
    if(!families.some(f=>f.id===r.family)||!r.id.startsWith(`${r.family}.`))add(r.id,'角色归属不一致或大类不存在');
    if(!['main','component'].includes(r.structure))add(r.id,'结构层级非法');
  }
  for(const [id,b] of Object.entries(bindings)){
    if(!roles.some(r=>r.id===b.role))add(id,'源绑定指向未注册角色');
    if(!PIECE_MATERIALS.some(m=>m.id===b.material))add(id,'源绑定材料身份无效');
  }
  for(const s of PIECE_SCENARIOS)for(const id of s.examples)if(!roles.some(r=>r.id===id))add(s.id,`场景示例未注册：${id}`);
  for(const p of pieces){
    const net=p.paths.find(path=>path.layer==='seam-line');
    if(!net){add(p.key,'当前裁片缺少净样');continue;}
    if(!Number.isInteger(net.cutQty)||Number(net.cutQty)<=0||typeof net.cutOnFold!=='boolean')add(p.key,'数量或裁法未明确声明');
    for(const path of p.paths){
      const error=classificationError(path);
      if(error)add(p.key,`${path.id}：${error}`);
      if(path.pieceRole!==net.pieceRole||path.materialRole!==net.materialRole||path.cutQty!==net.cutQty||path.cutOnFold!==net.cutOnFold||path.pieceId!==p.key)add(p.key,'同一裁片的路径元信息不一致');
    }
    const bound=bindings[p.key];
    if(!bound||bound.role!==net.pieceRole||bound.material!==net.materialRole)add(p.key,'当前源身份与分类绑定不一致');
    if(p.category!==net.category)add(p.key,'清单类别与路径类别不一致');
  }
  const rows=roles.map(r=>{
    const sourceIds=Object.entries(bindings).filter(([,b])=>b.role===r.id).map(([id])=>id);
    const current=pieces.filter(p=>p.paths.some(path=>path.layer==='seam-line'&&path.pieceRole===r.id));
    return {...r,sourceIds,currentPieceIds:current.map(p=>p.key),currentCount:current.length,previewPassCount:current.filter(p=>p.pass).length,
      stage:sourceIds.length?'reference-bound' as const:'definition-only' as const};
  });
  return {version:PIECE_TAXONOMY_VERSION,classificationPass:!issues.length,productionApproved:false as const,issues,rows,
    counts:{families:families.length,roles:roles.length,materialRoles:PIECE_MATERIALS.length,scenarios:PIECE_SCENARIOS.length,
      sourceIdentities:Object.keys(bindings).length,boundRoles:rows.filter(r=>r.sourceIds.length).length,
      boundFamilies:new Set(rows.filter(r=>r.sourceIds.length).map(r=>r.family)).size,
      definitionOnlyRoles:rows.filter(r=>!r.sourceIds.length).length,currentPieces:pieces.length},
  };
}
