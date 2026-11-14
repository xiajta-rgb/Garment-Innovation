import { useState } from 'react';
import { PROFESSIONAL_DESIGN_ASSETS, DESIGN_ASSET_GROUPS } from '@/data/professionalDesignAssets';
import { applyDesignAsset, designAssetPackage, designAssetTags } from '@/application/professional-design-assets';
import { downloadText } from '@/features/files/browser-files';
import type { CompositionPlan, CompositionSource } from '@/types/piece-composition';
import type { DesignAssetGroup } from '@/types/design-asset';
import { MiniOptionThumb } from './MiniOptionThumb';
import './professional-assets.css';

function assetPreview(asset: typeof PROFESSIONAL_DESIGN_ASSETS[number]){
 const value = asset.group==='neck' ? asset.patch?.neckline ?? (asset.id.includes('.v')?'v':asset.id.includes('henley')?'henley':asset.id.includes('polo')?'polo':asset.id.includes('stand')?'stand':'crew')
  : asset.group==='opening' ? asset.craft?.opening ?? 'none'
  : asset.group==='shoulder' ? asset.patch?.shoulder ?? 'set-in'
  : asset.group==='panel' ? asset.details?.panel ?? 'none'
  : asset.group==='hood' ? asset.details?.hood ?? 'none'
  : asset.group==='pocket' ? (asset.pocket==='patch'?'1':asset.pocket==='welt'||asset.pocket==='zip-welt'?'2':'1')
  : asset.group==='graphic' ? (asset.graphic==='text'?'text':'emblem')
  : asset.group==='fabric' ? asset.patch?.fabric ?? 'jersey'
  : asset.id.includes('cuff') ? 'rib'
  : asset.id.includes('hem-rib') ? 'rib'
  : asset.id.includes('slit') ? 'side-slit'
  : asset.id.includes('piping') ? 'piping'
  : asset.id.includes('topstitch') ? 'topstitch'
  : asset.id.includes('binding') ? 'binding'
  : 'plain';
 const kind = asset.group==='finish' ? (asset.id.includes('cuff')?'cuff':asset.id.includes('hem')||asset.id.includes('slit')?'hem':asset.id.includes('piping')||asset.id.includes('topstitch')?'seam':'neck-finish') : asset.group;
 return <div className="professional-asset-preview" aria-label={`${asset.name}二维示意`}><MiniOptionThumb kind={kind} value={String(value)}/><small>二维结构示意</small></div>;
}

export function ProfessionalAssetLibrary({plan,source,onChange,onError,query='',onApplied}:{plan:CompositionPlan;source:CompositionSource;onChange:(p:CompositionPlan)=>void;onError:(s:string)=>void;query?:string;onApplied?:()=>void}){
 const [group,setGroup]=useState<DesignAssetGroup|'all'>('neck'),[search,setSearch]=useState(''),[notice,setNotice]=useState('');
 const assets=PROFESSIONAL_DESIGN_ASSETS.filter(a=>(group==='all'||a.group===group)&&`${a.name} ${a.description} ${a.tagNames.join(' ')}`.includes(query||search));
 const pack=designAssetPackage(plan);
 return <section className="professional-assets" data-testid="professional-asset-library"><header><div><h3>专业设计素材</h3><p>按部位组合 · 固定三视图 · 配套清单随方案保存</p></div><button onClick={()=>downloadText(JSON.stringify(pack,null,2),`${plan.name}-设计素材配套.json`,'application/json')}>下载配套清单</button></header>
  <div className="professional-asset-tools"><select aria-label="专业素材分类" value={group} onChange={event=>setGroup(event.target.value as typeof group)}><option value="all">全部设计素材</option>{DESIGN_ASSET_GROUPS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><input aria-label="搜索专业设计素材" type="search" placeholder="搜索领型、工艺、标签" value={search} onChange={e=>setSearch(e.target.value)}/><span>{assets.length} 项</span></div>
  {notice&&<p role="status">{notice}</p>}<div className="professional-asset-grid">{assets.map(a=><article key={a.id} data-professional-asset={a.id}><span className="asset-tag">设计可用 · 净样待完善</span>{assetPreview(a)}<h4>{a.name}</h4><p>{a.description}</p>{a.companyCodes.length?<><small>公司产品参照：{a.companyCodes.join(' / ')}</small><div className="professional-reference-strip">{a.companyCodes.slice(0,2).map(code=><figure key={code}><img src={`/company-reference/${code==='COT25M002'?code:`craft-${code}`}.webp`} alt={`${code} 公司产品设计稿`}/><figcaption>{code}</figcaption></figure>)}</div></>:<small>设计提案 · 待同款稿核验</small>}<details><summary>标签与配套 · {a.components.length} 类</summary><p>{designAssetTags(a.id).map(t=>`${t.name} · ${t.code}`).join('；')||'须指定图形和具体加工工艺'}</p><ul>{a.components.map((c,i)=><li key={i}>{c.name} · {c.quantity}<small>{c.requirement}</small></li>)}</ul><p>待核验：{a.needs.join('；')}</p></details><button data-apply-design-asset={a.id} onClick={()=>{try{onChange(applyDesignAsset(a.id,plan,source,()=>crypto.randomUUID()));onError('');setNotice(`已应用：${a.name}`);onApplied?.();}catch(e){onError(e instanceof Error?e.message:String(e));}}}>应用{a.name}</button></article>)}</div>
  {!assets.length&&<p>没有符合筛选的素材。</p>}<details className="professional-current-package"><summary>当前方案配套 · {pack.assets.length} 组</summary>{pack.assets.map(a=><p key={a.id}><strong>{a.name}</strong>：{a.components.map(c=>c.name).join('、')}</p>)}<p>设计轮廓已接通；需要净样的新增结构仍须配缝和制版核验。</p></details>
 </section>;
}
