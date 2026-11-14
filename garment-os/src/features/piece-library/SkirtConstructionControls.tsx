import {useState} from 'react';
import {SKIRT_PARAMETERS,SKIRT_PATTERN_ID} from '@/data/skirtMethods';
import {readConstructionSelection} from '@/lib/pattern/construction-selection';
import type {ConstructionSelection,SkirtParameter} from '@/types/construction';
function Field({p,value,onCommit}:{p:SkirtParameter;value:number;onCommit:(n:number)=>void}){
  const [text,setText]=useState(String(value)),[error,setError]=useState('');
  return <label style={{border:'1px solid var(--border)',borderRadius:5,padding:10,display:'grid',gap:6}}><b>{p.label}（{p.unit==='count'?'片':'比例'}）</b><input type="number" aria-label={p.label} value={text} min={p.min} max={p.max} step={p.step} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onBlur={()=>{try{if(text==='')throw Error(`${p.label}不能为空`);onCommit(Number(text));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}}/><span>{p.meaning}</span><small>已审查范围 {p.min}–{p.max}</small>{error&&<span role="alert">{error}</span>}</label>;
}
export function SkirtConstructionControls({selection,onChange}:{selection?:ConstructionSelection;onChange:(s:ConstructionSelection)=>void}){
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}>{SKIRT_PARAMETERS.map(p=><Field key={`${p.key}:${selection?.options[p.key]??p.defaultValue}`} p={p} value={Number(selection?.options[p.key]??p.defaultValue)} onCommit={n=>onChange(readConstructionSelection(SKIRT_PATTERN_ID,{schema:'garment-os/construction/v1',options:{...selection?.options,[p.key]:n}})!)}/>)}</div>;
}
