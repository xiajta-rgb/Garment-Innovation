import {foundationParameters} from '@/data/foundationMethods';
import { KnitConstructionControls } from './KnitConstructionControls';
import { SkirtConstructionControls } from './SkirtConstructionControls';
import { SKIRT_PATTERN_ID } from '@/data/skirtMethods';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { CONSTRUCTION_PARAMETERS, SHIRT_DEFAULTS } from '@/data/constructionMethods';
import { changeConstructionOption } from '@/lib/pattern/construction-selection';
import { measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import type { ConstructionOperation, ConstructionParameter } from '@/types/construction';
import { createAssemblyRecord } from '@/application/assembly-record';
import { downloadText } from '@/features/files/browser-files';

const control = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', background: 'var(--bg-secondary)' };
const labels = { dimensioned:'尺寸规则已定义', 'needs-redraft':'需重制接口', 'needs-input':'需工艺输入', 'needs-geometry':'需完成态几何' };
const groups = [{ id:'all',label:'全部' },{ id:'collar',label:'领部' },{ id:'sleeve',label:'袖与袖衩' },{ id:'cuff',label:'袖口' },{ id:'hem',label:'下摆' },{ id:'hood',label:'帽' },{ id:'binding',label:'包条' },{ id:'pocket',label:'袋' },{ id:'material',label:'材料' }] as const;
function groupOf(op: ConstructionOperation) {
  if (/^binding/.test(op.id)) return 'binding';
  if (/^hood/.test(op.id)) return 'hood';
  if (/^pocket/.test(op.id)) return 'pocket';
  if (/collar|neck/.test(op.id)) return 'collar';
  if (/cuff/.test(op.id)) return 'cuff';
  if (/sleeve|placket/.test(op.id)) return 'sleeve';
  return /hem|waistband/.test(op.id)?'hem':'material';
}
function NumberParameter({parameter:p,value,onCommit}:{parameter:ConstructionParameter;value:number;onCommit:(text:string)=>void}){
  const [text,setText]=useState(String(value));
  return <input aria-label={p.label} type="number" style={control} value={text} min={p.min} max={p.max} step={p.step}
    onChange={e=>setText(e.target.value)} onBlur={()=>onCommit(text)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>;
}

/** Choices operate on a whole same-method draft. No detached SVG swapping. */
export function ConstructionPanel() {
  const id = useDesignStore(s=>s.activePatternId), selection = useDesignStore(s=>s.construction), draft = useDesignStore(s=>s.draft);
  const setSelection = useDesignStore(s=>s.setConstruction);
  const [group,setGroup] = useState('all'), [error,setError] = useState(''),[resetKey,setResetKey]=useState(0);
  const report = draft.assembly?.construction;
  const sleeve = selection?.options.sleeveStyle ?? SHIRT_DEFAULTS.sleeveStyle;
  const operations = (report?.operations??[]).filter(op=>group==='all'||groupOf(op)===group);
  return <section data-testid="construction-panel" style={{ flex:1, minHeight:0, overflow:'auto', padding:16, color:'var(--text-primary)', fontSize:12 }}>
    <h3>专业部件组合与构造规则</h3>
    <p>选择部件后，同一制版方法会联动重算衣身、领、袖和配套片。结构完整、尺寸已定义和完成态可装配分别检查。</p>
    {(id==='button-up-shirt'||(foundationParameters(id)??KNIT_PARAMETERS[id])||id===SKIRT_PATTERN_ID)?<>
      <div style={{ display:'flex',gap:12,marginBottom:12 }}><button style={control} onClick={()=>{setSelection(undefined);setResetKey(k=>k+1);setError('');}}>恢复源构型</button>
        <button style={control} disabled={!report} onClick={()=>{
          try { const s=useDesignStore.getState(); downloadText(JSON.stringify(createAssemblyRecord(s.getConfiguration(),s.draft),null,2),`${id}-${s.standardSize}-部件组合.json`,'application/json'); setError(''); }
          catch(e){setError(e instanceof Error?e.message:String(e));}
        }}>导出组合与规则</button></div>
      <p>数值编辑后按 Enter 或移出输入框应用；超范围或空输入会说明原因，并保留上一次有效值；范围内的组合仍须通过几何检查，失败时撤回图形。</p>
      {id===SKIRT_PATTERN_ID?<SkirtConstructionControls key={`${id}:${resetKey}`} selection={selection} onChange={value=>{setSelection(value);setError('');}}/>:(foundationParameters(id)??KNIT_PARAMETERS[id])?<KnitConstructionControls key={`${id}:${resetKey}`} patternId={id} selection={selection} onChange={value=>{setSelection(value);setError('');}}/>:<div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(245px,1fr))',gap:10 }}>
        {CONSTRUCTION_PARAMETERS.filter(p=>!p.only||p.only===sleeve).map(p=><label key={p.key} style={{ border:'1px solid var(--border)',borderRadius:5,padding:10,display:'flex',flexDirection:'column',gap:5 }}>
          <b>{p.label}{p.unit==='ratio'?'（比例）':p.unit==='°'?'（°）':''}</b>
          {p.unit==='choice'?<select aria-label={p.label} style={control} value={String(selection?.options[p.key]??p.defaultValue)} onChange={e=>{
            try { setSelection(changeConstructionOption(selection,p.key,e.target.value)); setError(''); } catch(e){setError(String(e));}
          }}>{p.choices?.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>:<NumberParameter key={`${p.key}:${selection?.options[p.key]??p.defaultValue}:${resetKey}`} parameter={p} value={Number(selection?.options[p.key]??p.defaultValue)} onCommit={text=>{
            try { if(text==='')throw new Error(`${p.label}不能为空，当前保留上一次有效输入`);setSelection(changeConstructionOption(selection,p.key,Number(text))); setError(''); } catch(e){setError(e instanceof Error?e.message:String(e));}
          }}/>}
          <span style={{ color:'var(--text-secondary)' }}>{p.meaning}</span>
          <small>{p.unit==='choice'?'源构型选项':`源允许范围 ${p.min}–${p.max}；单项在范围内仍需通过整套几何检查`}</small>
        </label>)}
      </div>}
    </>:<p>此模板保留完整基型；下方列出已明确的构造合同与所需输入。领型、袖口等替换件需有同方法接口后才能启用。</p>}
    {(error||draft.error)&&<p role="alert" style={{ color:'#b91c1c' }}>{error||draft.error}</p>}
    <div role="status" data-testid="construction-summary" style={{ padding:'12px 0' }}>
      当前 {draft.pieces.length} 种裁片 · {report?.operations.length??0} 项构造合同 · {report?.method??'尚无构造报告'}<br/>
      {report?'规则尺寸可重算；尚有完成态或材料条件缺口，组合未获装配放行。':'当前组合没有可用结果；请修正输入或恢复源构型。'}
    </div>
    <nav aria-label="构造规则分类" style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:12 }}>{groups.map(g=><button key={g.id} style={control} aria-pressed={group===g.id} onClick={()=>setGroup(g.id)}>{g.label}</button>)}</nav>
    {report&&<details style={{ marginBottom:14 }}><summary>已定义的工艺与材料输入（{report.requiredInputs.filter(f=>group==='all'||f.group===group).length} 项）</summary>
      <p>此处明确每项数据的含义、单位、使用条件和校验要求。数值尚未录入，保留未知；本轮未把这些条件当作已实现的工艺。</p>
      <div style={{ overflowX:'auto' }}><table aria-label="工艺与材料输入定义" style={{ width:'100%',textAlign:'left',fontSize:11 }}><thead><tr><th>字段</th><th>含义 / 何时需要</th><th>校验要求</th><th>当前值</th></tr></thead><tbody>
        {report.requiredInputs.filter(f=>group==='all'||f.group===group).map(f=><tr key={f.code} data-construction-input={f.code}><td>{f.label}（{f.unit}）</td><td>{f.meaning}<br/>{f.requiredWhen}</td><td>{f.validation}<br/>依据：{f.evidence}</td><td>未录入</td></tr>)}
      </tbody></table></div>
    </details>}
    {operations.length===0&&<p>当前分类没有构造规则。</p>}
    {operations.map(op=><article key={op.id} data-construction-operation={op.id} data-status={op.status} style={{ border:'1px solid var(--border)',borderRadius:6,padding:12,marginBottom:12 }}>
      <h4 style={{ marginTop:0 }}>{op.label} · <span style={{ color:op.status==='needs-redraft'?'#b91c1c':'#9a6700' }}>{labels[op.status]}</span></h4>
      <p>{op.rule}</p>
      {op.metrics.length>0&&<table aria-label={`${op.label}尺寸`} style={{ width:'100%',textAlign:'left',fontSize:11 }}><thead><tr><th>尺寸语义</th><th>计算值</th><th>依据</th></tr></thead><tbody>{op.metrics.map((m,i)=><tr key={i}><td>{m.label}</td><td>{m.value===null?'未定义':`${m.value.toFixed(3)} ${m.unit==='count'?'个':m.unit}`}</td><td>{m.formula}</td></tr>)}</tbody></table>}
      <ol>{op.steps.map(s=><li key={s}>{s}</li>)}</ol>
      {op.guides.length>0&&<details><summary>查看源折线与定位线（{op.guides.length}）</summary><div style={{ display:'flex',flexWrap:'wrap',gap:10 }}>
        {op.guides.map((guide,i)=>{
          const contour = draft.paths.find(p=>p.pieceId===guide.piece&&p.layer==='seam-line');
          if(!contour)return null;
          const bbox=measurePieceBboxFull([{...contour,transform:undefined}]);
          return <figure key={i} style={{ margin:0,flex:'1 1 220px' }}><figcaption>{guide.label} · {guide.piece}</figcaption><svg aria-label={guide.label} viewBox={`${bbox.minX-15} ${bbox.minY-15} ${bbox.maxX-bbox.minX+30} ${bbox.maxY-bbox.minY+30}`} style={{ width:'100%',height:200,background:'#fafaf8' }}><path d={contour.data} fill="none" stroke="#94a3b8"/><path data-construction-guide={guide.label} d={guide.pathD} fill="none" stroke="#c2410c" strokeWidth={1.5}/></svg></figure>;
        })}</div></details>}
      <p style={{ color:'#9a6700' }}>{op.requirements.join(' ')}</p>
      <details><summary>规则来源</summary>{op.source}</details>
    </article>)}
  </section>;
}
