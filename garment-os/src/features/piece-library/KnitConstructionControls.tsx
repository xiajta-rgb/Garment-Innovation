import {foundationParameters} from '@/data/foundationMethods';
import { useState } from 'react';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { changeKnitOption } from '@/lib/pattern/construction-selection';
import type { ConstructionSelection, KnitParameter } from '@/types/construction';

const control={padding:'6px 8px',border:'1px solid var(--border)',borderRadius:4,color:'var(--text-primary)',background:'var(--bg-secondary)'};
function NumberControl({parameter:p,value,commit}:{parameter:KnitParameter;value:number;commit:(value:number)=>void}){
  const [text,setText]=useState(String(value));
  const [error,setError]=useState('');
  return <><input aria-label={p.label} type="number" style={control} value={text} min={p.min} max={p.max} step={p.step}
    onChange={e=>setText(e.target.value)} onBlur={()=>{try{if(text==='')throw new Error(`${p.label}不能为空`);commit(Number(text));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}}
    onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>{error&&<span role="alert">{error}</span>}</>;
}
export function KnitConstructionControls({patternId,selection,onChange}:{patternId:string;selection?:ConstructionSelection;onChange:(value:ConstructionSelection)=>void}){
  const options=selection?.options??{};
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(245px,1fr))',gap:10}}>
    {(foundationParameters(patternId)??KNIT_PARAMETERS[patternId]).filter(p=>!(options.ribbing===false&&['ribbingHeight','ribbingStretch'].includes(p.key))&&!(options.pocket===false&&p.key!=='pocket'&&p.key.startsWith('pocket'))).map(p=>{
      const value=options[p.key]??p.defaultValue;
      const commit=(value:number|boolean)=>onChange(changeKnitOption(patternId,selection,p.key,value));
      return <label key={p.key} style={{border:'1px solid var(--border)',borderRadius:5,padding:10,display:'flex',flexDirection:'column',gap:5}}>
        <b>{p.label}{p.unit==='ratio'?'（比例）':p.unit==='°'?'（°）':''}</b>
        {p.unit==='boolean'?<select aria-label={p.label} style={control} value={String(value)} onChange={e=>commit(e.target.value==='true')}><option value="true">启用</option><option value="false">关闭</option></select>:
          <NumberControl key={`${p.key}:${value}`} parameter={p} value={Number(value)} commit={commit}/>}
        <span>{p.meaning}</span><small>{p.unit==='boolean'?'整套构型联动':`源允许范围 ${p.min}–${p.max}；组合仍需通过几何检查`}</small>
      </label>;
    })}
  </div>;
}
