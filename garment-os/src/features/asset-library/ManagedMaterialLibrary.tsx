import { useEffect, useRef, useState } from 'react';
import { DEFAULT_MATERIAL_ENDPOINT, MATERIAL_API, MATERIAL_SEASONS, canAssignMaterial, materialValue, readMaterialQuery } from '@/application/managed-materials';
import type { ManagedMaterial, MaterialPage, MaterialQuery } from '@/types/managed-material';
import type { MaterialSlot } from '@/types/reusable-assets';
import { MATERIAL_SLOT_LABELS } from '@/data/reusableAssets';
import { useDesignStore } from '@/store/useDesignStore';
import './managed-materials.css';
import { ManagedMaterialAssignments } from './ManagedMaterialAssignments';
import { invalidateMaterialHome, loadMaterialHome, materialApi as api, MATERIAL_HOME_QUERY } from './managed-material-browser';
import { MaterialImage, MaterialImagePreview } from './MaterialImage';
import { useManagedMaterialTarget } from './useManagedMaterialTarget';

const initialQuery=MATERIAL_HOME_QUERY;
const detailsFields:Array<[keyof ManagedMaterial,string]>=[['materialCode','编码'],['materialId','面料ID'],['materialName','名称'],['ingredients','成分'],['className','分类'],['classCode','分类编码'],['fabricKindName','面料类型'],['materialType','物料类型'],['rangeWidth','有效幅宽（原值）'],['gramWeight','克重（原值）'],['unit','计量单位'],['fabricFunction','功能'],['season','季节'],['productType','产品类型'],['usageStyle','使用款式'],['usageArea','使用区域'],['sunProtectionFactor','防晒指数'],['status','启停状态'],['performanceStatus','表现状态'],['processStatus','流程状态'],['qualityLevel','品质等级'],['strategyLevel','战略等级'],['fabricDesc','面料描述'],['isProcessingFabric','加工面料'],['isCut','切边'],['hasCorrespondGreyFabric','对应坯布'],['unitQty','单位数量'],['deliveryMethod','配送方式'],['purchasePrice','采购价（币种未提供）'],['inventoryValue','库存价值（币种未提供）'],['materialDeveloperName','开发人'],['remark','备注'],['createTime','创建时间（原值）'],['updateTime','更新时间（原值）'],['creator','创建人'],['updater','更新人']];
export function ManagedMaterialLibrary(){
  const [query,setQuery]=useState<MaterialQuery>(initialQuery),[page,setPage]=useState<MaterialPage|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [connection,setConnection]=useState({configured:false,endpoint:DEFAULT_MATERIAL_ENDPOINT}),[endpoint,setEndpoint]=useState(DEFAULT_MATERIAL_ENDPOINT),[token,setToken]=useState('');
  const [connectionReady,setConnectionReady]=useState(false),[connecting,setConnecting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [slot,setSlot]=useState<MaterialSlot>('main'),[includePhoto,setIncludePhoto]=useState(true);
  const [view,setView]=useState<'gallery'|'table'>('gallery'),[onlyImages,setOnlyImages]=useState(false),[preview,setPreview]=useState<ManagedMaterial|null>(null);
  const {target,setTarget,plan,linked,applying,assign}=useManagedMaterialTarget();
  const effectiveSlot=target==='composition'&&slot==='hem'?'main':slot;
  const currentDesign=useDesignStore(s=>s.designName);
  const request=useRef<AbortController|null>(null),ticket=useRef(0);
  useEffect(()=>{let active=true;const controller=new AbortController();const id=ticket.current;
    api<{configured:boolean;endpoint:string}>(MATERIAL_API+'/connection',undefined,controller.signal).then(async c=>{
      if(!active)return;setConnection(c);setEndpoint(c.endpoint);setConnectionReady(true);
      if(c.configured&&id===ticket.current){setBusy(true);try{const result=await loadMaterialHome(c.endpoint);if(active&&id===ticket.current){setPage(result);setSelected(result.items.find(m=>m.materialPic)?.materialId??result.items[0]?.materialId??null);}}catch(e){if(active&&id===ticket.current)setError(e instanceof Error?e.message:'面料查询未完成。');}finally{if(active&&id===ticket.current)setBusy(false);}}
    }).catch(e=>{if(active&&e.name!=='AbortError'){setError(e.message);setConnectionReady(true);}});
    return()=>{active=false;controller.abort();request.current?.abort();};},[]);
  async function connect(clear=false){
    invalidateMaterialHome();
    ticket.current++;request.current?.abort();setBusy(false);setConnecting(true);setError('');setPage(null);setSelected(null);setNotice('');
    try{const c=await api<{configured:boolean;endpoint:string}>(MATERIAL_API+'/connection',clear?{clear:true}:{endpoint,...(token?{token}:{})});setConnection(c);setEndpoint(c.endpoint);setToken('');setNotice(clear?'已清除本次面料连接。':'连接配置已更新。');if(c.configured)await search(initialQuery);}catch(e){setError(e instanceof Error?e.message:'连接未完成。');}finally{setConnecting(false);}
  }
  async function search(value:MaterialQuery){
    request.current?.abort();const controller=new AbortController();request.current=controller;const id=++ticket.current;
    setError('');setNotice('');setPage(null);setSelected(null);
    try{const checked=readMaterialQuery(value);setQuery(checked);setBusy(true);const result=await api<MaterialPage>(MATERIAL_API,checked,controller.signal);if(id!==ticket.current)return;setPage(result);setSelected(result.items.find(m=>m.materialPic)?.materialId??result.items[0]?.materialId??null);}
    catch(e){if(id===ticket.current&&!(e instanceof Error&&e.name==='AbortError')){invalidateMaterialHome();setError(e instanceof Error?e.message:'面料查询未完成。');}}finally{if(id===ticket.current)setBusy(false);}
  }
  const material=page?.items.find(m=>m.materialId===selected),changed=page&&(query.pageNo!==page.pageNo||query.pageSize!==page.pageSize);
  const imageCount=page?.items.filter(m=>m.materialPic).length??0;
  const visibleItems=(page?.items??[]).filter(m=>!onlyImages||m.materialPic).sort((a,b)=>Number(!!b.materialPic)-Number(!!a.materialPic));
  const update=(key:keyof MaterialQuery,value:string)=>{ticket.current++;request.current?.abort();setBusy(false);setPage(null);setSelected(null);setError('');setQuery(q=>({...q,[key]:key==='pageSize'?Number(value):value,pageNo:1}));};
  return <div className="managed-materials" data-testid="managed-material-library">
    <header className="managed-material-intro"><div><h3>面料管理</h3><p>查询企业面料，保留来源并关联到当前款式。</p></div><span className={connection.configured?'managed-connected':''}>{connectionReady?(connection.configured?'已配置连接':'尚未连接'):'正在检查连接…'}</span></header>
    {!!Object.keys(linked??{}).length&&<details className="managed-connection" open><summary>{target==='composition'?plan?.name:'原始裁片'}已关联面料 · {Object.keys(linked??{}).length} 个部位</summary><ManagedMaterialAssignments composition={target==='composition'}/></details>}
    <details className="managed-connection"><summary>连接设置</summary><form onSubmit={e=>{e.preventDefault();void connect();}}><label>服务地址<input aria-label="面料服务地址" type="url" value={endpoint} onChange={e=>setEndpoint(e.target.value)} required/></label><label>访问凭证<input aria-label="面料访问凭证" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder={connection.configured?'已在服务端配置，更新时填写':'填写访问凭证'}/></label><button disabled={connecting}>{connecting?'正在更新…':'更新连接'}</button><button type="button" disabled={connecting} onClick={()=>{setToken('');void connect(true);}}>清除连接</button></form><p>凭证只用于本次服务连接，不随款式保存；更换服务地址时须提供对应凭证。</p></details>
    <form className="managed-material-filters" onSubmit={e=>{e.preventDefault();void search({...query,pageNo:1});}}>
      <label>面料编码<input aria-label="面料编码查询" value={query.materialCode??''} onChange={e=>update('materialCode',e.target.value)}/></label>
      <label>面料名称<input aria-label="面料名称查询" value={query.materialName??''} onChange={e=>update('materialName',e.target.value)}/></label>
      <details className="managed-extra-filters"><summary>更多筛选 · {query.status?materialValue('status',query.status):'全部状态'}</summary><div>
      <label>分类<input aria-label="面料分类查询" value={query.className??''} maxLength={50} onChange={e=>update('className',e.target.value)}/></label>
      <label>功能<input aria-label="面料功能查询" value={query.fabricFunction??''} maxLength={50} onChange={e=>update('fabricFunction',e.target.value)}/></label>
      <label>启停状态<select aria-label="面料状态查询" value={query.status??''} onChange={e=>update('status',e.target.value)}><option value="">全部状态</option><option value="0">启用</option><option value="1">停用</option></select></label>
      <label>季节<select aria-label="面料季节查询" value={query.season??''} onChange={e=>update('season',e.target.value)}><option value="">全部季节</option>{Object.entries(MATERIAL_SEASONS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>面料ID<input aria-label="面料ID查询" inputMode="numeric" value={query.materialId??''} onChange={e=>update('materialId',e.target.value)}/></label><label>防晒指数<input aria-label="面料防晒指数查询" value={query.sunProtectionFactor??''} maxLength={50} onChange={e=>update('sunProtectionFactor',e.target.value)}/></label>
      </div></details>
      <div className="managed-query-actions"><button className="managed-primary" disabled={busy||connecting||!connection.configured}>{busy?'查询中…':'查询面料'}</button><button type="button" disabled={busy} onClick={()=>{setQuery(initialQuery);setPage(null);setSelected(null);setError('');setNotice('');}}>重置条件</button></div>
    </form>
    {error&&<p role="alert" className="managed-error">{error}<button disabled={busy||!connection.configured} onClick={()=>void search(query)}>重新查询</button></p>}
    {notice&&<p role="status" className="managed-notice">{notice}</p>}
    <div className="managed-material-layout"><section className="managed-material-results" aria-busy={busy}>
      <div className="managed-results-toolbar"><span role="status">{busy?'正在读取面料管理…':page?`第 ${page.pageNo} 页 · 本页 ${page.items.length} 条 · ${imageCount} 条提供图片`:'尚未查询'}</span><label>每页<select aria-label="面料每页条数" disabled={busy} value={query.pageSize} onChange={e=>update('pageSize',e.target.value)}>{[25,50,100].map(n=><option key={n} value={n}>{n}条</option>)}</select></label></div>
      {page&&<div className="managed-view-toolbar"><div role="group" aria-label="面料展示方式"><button aria-pressed={view==='gallery'} onClick={()=>setView('gallery')}>图片</button><button aria-pressed={view==='table'} onClick={()=>setView('table')}>列表</button></div><label><input type="checkbox" checked={onlyImages} onChange={e=>setOnlyImages(e.target.checked)}/>仅看本页有图</label><small>本页图片优先</small></div>}
      {!page&&!busy&&!error&&<p className="managed-empty">{connection.configured?'输入条件后查询，或直接查看启用面料。':'请展开连接设置，接入面料管理。'}</p>}
      {page?.items.length===0&&<p className="managed-empty">当前页没有符合条件的面料。</p>}
      {!!page?.items.length&&visibleItems.length===0&&<p className="managed-empty">本页没有提供图片的面料，可取消筛选或查看下一页。</p>}
      {!!visibleItems.length&&(view==='gallery'?<div className="managed-material-gallery">{visibleItems.map(m=><article key={m.materialId} data-managed-material-id={m.materialId} data-selected={m.materialId===selected}>
        <MaterialImage key={m.materialPic??m.materialId} material={m} onOpen={()=>setPreview(m)}/><div className="managed-material-card-info"><span>{m.materialCode??m.materialId}</span><h4>{materialValue('materialName',m.materialName)}</h4><p>{materialValue('ingredients',m.ingredients)}</p><small>{materialValue('fabricKindName',m.fabricKindName??m.className)} · {materialValue('status',m.status)}</small><button aria-label={`查看面料 ${m.materialCode??m.materialId}`} aria-pressed={m.materialId===selected} onClick={()=>setSelected(m.materialId)}>{m.materialId===selected?'已选 · 查看明细':'查看明细 / 关联'}</button></div>
      </article>)}</div>:<div className="managed-table-scroll"><table><thead><tr>{['面料编码 / 名称','图片','成分','分类 / 功能','幅宽 / 克重（原值）','季节','状态',''].map((t,i)=><th key={i}>{t}</th>)}</tr></thead><tbody>{visibleItems.map(m=><tr key={m.materialId} data-managed-material-id={m.materialId} aria-selected={m.materialId===selected}><td><button onClick={()=>setSelected(m.materialId)}>{m.materialCode??m.materialId}<strong>{materialValue('materialName',m.materialName)}</strong></button></td><td><MaterialImage key={m.materialPic??m.materialId} material={m} compact onOpen={()=>setPreview(m)}/></td><td>{materialValue('ingredients',m.ingredients)}</td><td>{materialValue('className',m.className)}<small>{materialValue('fabricFunction',m.fabricFunction)}</small></td><td>{materialValue('rangeWidth',m.rangeWidth)} / {materialValue('gramWeight',m.gramWeight)}</td><td>{materialValue('season',m.season)}</td><td>{materialValue('status',m.status)}</td><td><button aria-label={`查看面料 ${m.materialCode??m.materialId}`} onClick={()=>setSelected(m.materialId)}>查看</button></td></tr>)}</tbody></table></div>)}
      {page&&<footer className="managed-pagination"><button disabled={busy||page.pageNo<=1} onClick={()=>void search({...query,pageNo:page.pageNo-1})}>上一页</button><span>第 {page.pageNo} 页</span><button disabled={busy||!page.mayHaveNext||!!changed} onClick={()=>void search({...query,pageNo:page.pageNo+1})}>下一页</button><small>接口未提供总数；下一页由实际查询确认。</small></footer>}
      <p className="managed-source-note">幅宽与克重保留原值，接口未声明单位；计量单位是面料交易单位。关联不会自动改变裁片尺寸或面料参数。</p>
    </section><aside className="managed-material-detail">{material&&page?<>
      <h3>{material.materialName??'面料明细'}</h3><p>{material.materialCode??material.materialId}</p>
      <MaterialImage key={material.materialPic??material.materialId} material={material} onOpen={()=>setPreview(material)}/>
      <label>应用目标<select aria-label="面料应用目标" value={target} disabled={applying} onChange={e=>{setTarget(e.target.value as 'composition'|'pattern');setNotice('');setError('');}}>{!!plan?.pieces.length&&<option value="composition">当前组合方案 · {plan.name}</option>}<option value="pattern">原始裁片资料</option></select></label><label>关联部位<select aria-label="中台面料关联部位" disabled={applying} value={effectiveSlot} onChange={e=>setSlot(e.target.value as MaterialSlot)}>{Object.entries(MATERIAL_SLOT_LABELS).filter(([id])=>target!=='composition'||id!=='hem').map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {target==='composition'&&<><label>应用方式<select aria-label="面料应用方式" disabled={applying} value={includePhoto?'photo':'info'} onChange={e=>setIncludePhoto(e.target.value==='photo')}><option value="photo">套用来源图片与资料</option><option value="info">仅关联资料</option></select></label><small>大图自动压缩后套用，保留面料来源与原图查看。</small></>}
      <button className="managed-primary" disabled={!canAssignMaterial(material)||busy||applying} onClick={()=>{setError('');setNotice('');void assign(effectiveSlot,{source:'basedata.material.list',version:'1',endpoint:page.endpoint,fetchedAt:page.fetchedAt,material},includePhoto).then(photo=>setNotice(photo?`已套用到${plan?.name}的${MATERIAL_SLOT_LABELS[effectiveSlot]}，来源图片已保存，可返回设计台查看。`:`已关联${MATERIAL_SLOT_LABELS[effectiveSlot]}资料：${material.materialName}，可撤销或保存。`)).catch(e=>setError(e instanceof Error?e.message:'关联未完成。'));}}>{applying?'正在套用图片…':linked?.[effectiveSlot]?.material.materialId===material.materialId?'更新此部位面料快照':`关联为${MATERIAL_SLOT_LABELS[effectiveSlot]}`}</button>
      <small>目标：{target==='composition'?`组合方案 · ${plan?.name}`:`原始裁片 · ${currentDesign}`}。只关联明确启用的面料；适配、物性与试样仍需确认。</small>
      <dl>{detailsFields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{materialValue(key,material[key])}</dd></div>)}</dl><p className="managed-source-note">来源：面料管理 · 查询于 {new Date(page.fetchedAt).toLocaleString('zh-CN')}。来源图片为实时接口附加字段；未提供时不生成示意图。</p>
    </>:<p className="managed-empty">查询后选择一条面料，查看明细并关联。</p>}</aside></div>
    {preview&&<MaterialImagePreview key={preview.materialId} material={preview} onClose={()=>setPreview(null)}/>}
  </div>;
}


