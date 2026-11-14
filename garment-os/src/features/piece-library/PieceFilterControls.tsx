import { TAG_GROUPS, PIECE_TAGS, tagDef } from '@/lib/pattern/piece-tags';
import { PIECE_FAMILIES, PIECE_ROLES } from '@/data/pieceTaxonomy';

const button={fontSize:11,padding:'3px 8px',border:'1px solid var(--border)',borderRadius:5,cursor:'pointer',background:'var(--bg-tertiary)',color:'var(--text-secondary)'};
/** Every piece view uses the same axes; a large role dictionary stays in a grouped selector. */
export function PieceFilterControls({filter,toggle,clear,prefix,clearLabel='清除筛选'}:{filter:string[];toggle:(id:string)=>void;clear:()=>void;prefix:string;clearLabel?:string}){
  const families=filter.filter(id=>tagDef(id)?.group==='family');
  const selectedRoles=filter.filter(id=>tagDef(id)?.group==='role');
  return <div className="piece-filter-controls" aria-label="裁片分类筛选">
    {TAG_GROUPS.map(group=><div key={group.id} style={{marginBottom:8,fontSize:11}}>
      <div style={{marginBottom:4}}>{group.label}</div>
      {group.id==='role'?<>
        <select aria-label="具体裁片筛选" style={{...button,maxWidth:'100%'}} value="" onChange={e=>{if(e.target.value)toggle(e.target.value);}}>
          <option value="">添加具体裁片条件…</option>
          {PIECE_FAMILIES.filter(f=>!families.length||families.includes(f.id)).map(f=><optgroup key={f.id} label={f.label}>{PIECE_ROLES.filter(r=>r.family===f.id).map(r=><option key={r.id} value={`role:${r.id}`} disabled={selectedRoles.includes(`role:${r.id}`)}>{r.label}</option>)}</optgroup>)}
          <option value="role:unknown">角色待核验</option>
        </select>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:4}}>{selectedRoles.map(id=><button key={id} style={button} aria-pressed="true" onClick={()=>toggle(id)}>{tagDef(id)?.label} ×</button>)}</div>
      </>:<div style={{display:'flex',flexWrap:'wrap',gap:4}}>{Object.values(PIECE_TAGS).filter(t=>t.group===group.id).map(t=><button key={t.id} {...{[`data-${prefix}-tag`]:t.id}} aria-pressed={filter.includes(t.id)} onClick={()=>toggle(t.id)} style={{...button,borderColor:filter.includes(t.id)?'var(--accent)':'var(--border)',color:filter.includes(t.id)?'var(--accent)':'var(--text-secondary)',background:filter.includes(t.id)?'var(--accent-dim)':'var(--bg-secondary)'}}>{t.label}</button>)}</div>}
    </div>)}
    {filter.some(id=>!tagDef(id))&&<p role="alert">存在不认识的筛选条件，已停止匹配；请清除筛选后重新选择。</p>}
    <button style={button} onClick={clear}>{clearLabel}</button>
  </div>;
}
