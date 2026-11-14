import { createPendingElementCandidates } from '@/application/pending-element-candidates';
import { downloadText } from '@/features/files/browser-files';
import { useMemo, useState } from 'react';
import { auditPieceTaxonomy } from '@/application/piece-taxonomy-audit';
import { auditPieceElementLinks } from '@/application/piece-element-links';
import { PIECE_FAMILIES, PIECE_FAMILY_MAP } from '@/data/pieceTaxonomy';
import { PIECE_CLASSIFICATION_RULES, PIECE_SCENARIOS } from '@/data/pieceTaxonomyScope';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { REFERENCE_PIECE_INDEX } from '@/data/referencePieceIndex';
import referenceImages from '@/data/referenceIllustrations.json';

const control={padding:'5px 8px',border:'1px solid var(--border)',borderRadius:4,background:'var(--bg-primary)',color:'var(--text-primary)',fontSize:12};
export function PieceTaxonomyPanel({onInspect}:{onInspect:()=>void}){
  const pieces=useDesignStore(s=>s.draft.pieces),setFilter=usePieceLibraryStore(s=>s.setTagFilter);
  const report=useMemo(()=>auditPieceTaxonomy(pieces),[pieces]);
  const links=useMemo(()=>auditPieceElementLinks(),[]);
  const [family,setFamily]=useState(''),[query,setQuery]=useState(''),[stage,setStage]=useState(''),[scene,setScene]=useState('');
  const scenario=PIECE_SCENARIOS.find(s=>s.id===scene), q=query.trim().toLowerCase();
  const rows=report.rows.filter(r=>(!family||r.family===family)&&(!scenario||scenario.families.includes(r.family))&&
    (!stage||(stage==='current'?r.currentCount>0:r.stage===stage))&&
    (!q||[r.id,r.label,r.definition,...r.variants,...r.sourceIds].join(' ').toLowerCase().includes(q)));
  return <section data-testid="piece-taxonomy" style={{flex:1,overflow:'auto',padding:16,fontSize:12,color:'var(--text-primary)'}}>
    <h3 style={{marginTop:0}}>裁片分类总览</h3>
    <p data-testid="taxonomy-summary">{report.counts.families} 大类 · {report.counts.roles} 个具体角色 · {report.counts.materialRoles} 种材料身份 · {report.counts.scenarios} 类服装场景。已绑定参考源：{report.counts.sourceIdentities} 种源身份 / {report.counts.boundRoles} 个角色 / {report.counts.boundFamilies} 大类；当前模板 {report.counts.currentPieces} 种裁片。</p>
    <p>这是内部分类词典。当前制版接入与独立参考库分别统计；参考库已收录 {REFERENCE_PIECE_INDEX.length} 份源图纸，可用每行“查看参考图”查看。仅定义的角色尚无生成能力；参考源已绑定也不代表生产合格。</p>
    {!!report.issues.length&&<div role="alert">分类检查发现 {report.issues.length} 项冲突：{report.issues.map((i,n)=><p key={n}>{i.subject}：{i.message}</p>)}</div>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
      <input aria-label="搜索裁片分类" style={control} placeholder="名称、编码、造型或源身份" value={query} onChange={e=>setQuery(e.target.value)}/>
      <select aria-label="分类大类" style={control} value={family} onChange={e=>setFamily(e.target.value)}><option value="">全部大类</option>{PIECE_FAMILIES.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select>
      <select aria-label="分类建设状态" style={control} value={stage} onChange={e=>setStage(e.target.value)}><option value="">全部建设状态</option><option value="reference-bound">参考源已绑定</option><option value="definition-only">仅分类定义 · 待建设</option><option value="current">当前模板有裁片</option></select>
      <select aria-label="适用服装场景" style={control} value={scene} onChange={e=>setScene(e.target.value)}><option value="">全部服装场景</option>{PIECE_SCENARIOS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
      <button style={control} onClick={()=>{setFamily('');setQuery('');setStage('');setScene('');}}>重置目录筛选</button>
    </div>
    {scenario&&<p>{scenario.note} 此处列出相关分类，具体必选、互斥和数量仍由构型决定。</p>}
    <p role="status">显示 {rows.length} / {report.rows.length} 个角色；目录筛选只检索定义，点击“查看当前裁片”会同步筛选图纸。</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
      <thead><tr>{['大类 / 角色','定义 / 造型选项','关键尺寸 / 接口','接入与当前裁片','操作'].map(t=><th key={t} style={{padding:8,borderBottom:'1px solid var(--border)'}}>{t}</th>)}</tr></thead>
      <tbody>{rows.map(r=>{const f=PIECE_FAMILY_MAP[r.family],imageCount=referenceImages.filter(i=>i.roleIds.includes(r.id)).length;return <tr key={r.id} data-taxonomy-role={r.id}>
        <td style={{padding:8,borderBottom:'1px solid var(--border)',minWidth:130}}>{f.label} / {r.label}<small style={{display:'block'}}>{r.id}</small></td>
        <td style={{padding:8,borderBottom:'1px solid var(--border)',maxWidth:280}}>{r.definition}{!!r.variants.length&&<p>造型选项：{r.variants.join('、')}</p>}</td>
        <td style={{padding:8,borderBottom:'1px solid var(--border)',maxWidth:220}}>大类尺寸：{f.keyDimensions.join('、')}<p>接口：{f.interfaces.join('、')}</p></td>
        <td style={{padding:8,borderBottom:'1px solid var(--border)',maxWidth:240}}>{r.stage==='reference-bound'?'参考源已绑定':'仅分类定义 · 待建设'}<p>当前 {r.currentCount} 种 / 预览检查通过 {r.previewPassCount} 种</p><small>{r.sourceIds.join('、')||'尚未接入当前制版生成器'}</small>
          <p>独立参考库 {REFERENCE_PIECE_INDEX.filter(e=>e.roleId===r.id).length} 份图纸{imageCount?` / ${imageCount} 份图片`:''}</p></td>
        <td style={{padding:8,borderBottom:'1px solid var(--border)'}}><button style={control} onClick={()=>{setFilter([r.family,`role:${r.id}`]);onInspect();}}>查看当前裁片</button>
          <button style={{...control,marginTop:6}} onClick={()=>usePieceLibraryStore.getState().openReferenceCatalogue(r.family,r.id)}>
            查看参考图（{REFERENCE_PIECE_INDEX.filter(e=>e.roleId===r.id).length+imageCount}）
          </button>
        </td>
      </tr>;})}</tbody>
    </table></div>
    {!rows.length&&<p>没有符合目录条件的分类。</p>}
    <details style={{marginTop:16}}><summary>分类边界与新增规范</summary><ol>{PIECE_CLASSIFICATION_RULES.map(rule=><li key={rule} style={{margin:'8px 0'}}>{rule}</li>)}</ol><p>覆盖常见裁切缝制服装与扩展服饰；鞋靴、包袋、整织产品及专用防护认证另行管理。特殊民族服饰、历史服饰等仍需按独立裁切结构扩展并审查。</p></details>
    <details style={{marginTop:16}}><summary>元素库本地快照关联：{links.counts.linkedRecords} 条已对应 / {links.counts.quarantined} 条保持隔离</summary>
      <p>快照时间：{links.snapshotAt}。本地 {links.counts.linkedSourceIdentities} 种源裁片对应 {links.counts.linkedRecords} 条元素记录；远端分类尚未按新词典复核，本轮未写入飞书。</p>
      <button style={control} onClick={()=>downloadText(JSON.stringify(createPendingElementCandidates(),null,2),'新增模板与裁片-待登记候选.json','application/json')}>导出待登记候选</button>
      <p data-testid="taxonomy-pending-links">新增 {links.counts.pendingSourceIdentities} 种源身份待登记；本地候选不代表已同步。{links.pendingSourceIds.join("、")}</p>
      {links.issues.map(i=><p role="alert" key={i}>{i}</p>)}
      <ul>{links.rows.map(r=><li key={r.sourceId}>{r.name}：{r.disposition==='quarantined'?'保持隔离':r.localRoles.join('、')||'未匹配'}；快照旧部位标签：{r.legacyPartLabels.join('、')}</li>)}</ul>
    </details>
  </section>;
}
