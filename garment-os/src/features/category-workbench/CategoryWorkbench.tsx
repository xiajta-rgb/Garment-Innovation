import { useEffect,useMemo,useState } from 'react';
import { GARMENT_CATEGORIES,CATEGORY_GROUPS,CATEGORY_SCOPE } from '@/data/garmentCategories';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { PIECE_ROLE_MAP } from '@/data/pieceTaxonomy';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { categoryCoverage,exportCategoryCoverage } from '@/application/category-coverage';
import { readConfiguration } from '@/application/design-document';
import {configureStructureAsset} from '@/application/asset-library';
import {foundationParameters} from '@/data/foundationMethods';
import {foundationModules} from '@/data/foundationModules';
import { newCompanyStyle } from '@/lib/pattern/company-style';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { downloadText } from '@/features/files/browser-files';
import type { CategoryWorkspaceAction } from '@/types/category-workbench';
import './category-workbench.css';

const stageLabel:Record<string,string>={'cad-reference':'有整款参考 CAD','company-drawing':'公司二维母版','definition-only':'构型定义 / 待接入'};
const reports=GARMENT_CATEGORIES.map(c=>categoryCoverage(c.id));
const totals=exportCategoryCoverage().counts;
export function CategoryWorkbench({categoryId,onCategoryChange,onNavigate}:{categoryId:string;onCategoryChange:(id:string)=>void;onNavigate:(action:CategoryWorkspaceAction)=>void}){
  const s=useDesignStore();
  const [group,setGroup]=useState('all'),[stage,setStage]=useState('all'),[query,setQuery]=useState(''),[error,setError]=useState('');
  const visible=useMemo(()=>reports.filter(r=>(group==='all'||r.category.group===group)&&(stage==='all'||r.stage===stage)&&
    [r.category.label,r.category.construction,...r.category.requiredRoles.map(id=>PIECE_ROLE_MAP[id].label)].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[group,stage,query]);
  const selected=visible.find(r=>r.category.id===categoryId)??visible[0];
  const selectedId=selected?.category.id;
  useEffect(()=>{if(selectedId&&selectedId!==categoryId)onCategoryChange(selectedId);},[selectedId,categoryId,onCategoryChange]);
  const c=selected?.category,active=!!selected?.executableIds.includes(s.activePatternId),valid=active&&s.draft.status==='reference';
  const currentRolePieces=(id:string)=>s.draft.paths.filter(p=>p.layer==='seam-line'&&p.pieceRole===id);
  const currentRoleText=(id:string)=>{
    if(!valid)return '未选用 / 被阻断';
    const pieces=currentRolePieces(id);
    if(!pieces.length)return '当前构型未生成';
    const quantity=pieces.every(p=>typeof p.cutQty==='number')?pieces.reduce((n,p)=>n+p.cutQty!,0):null;
    return `${pieces.length} 种源身份 / ${quantity===null?'数量待确认':`${quantity} 片`}`;
  };
  const asset=(tab:'template'|'structure'|'material'|'finish'|'color')=>{if(c)onNavigate({kind:'assets',categoryId:c.id,tab});};
  const run=(fn:()=>void)=>{try{fn();setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
  return <section className="category-workbench" data-testid="category-workbench">
    <header><div><h2>品类与裁片工作台</h2><p>选择品类 → 选用模板 → 检查版片与配缝 → 配置面料 → 形成二维设计资产。</p></div><button onClick={()=>downloadText(JSON.stringify(exportCategoryCoverage(),null,2),'服装品类-映射与缺口.json','application/json')}>导出品类审查表</button></header>
    <div className="category-summary"><span>{totals.categories} 种明确构型</span><span>{totals.templates} 个可执行参考模板</span><span>{totals.companyOnlyCategories} 类公司二维母版</span><span>{totals.definitionOnlyCategories} 类待接整款 CAD</span></div>
    <p className="category-note">{CATEGORY_SCOPE.includes} 当前工作台聚焦二维裁片、结构组合与证据关联。</p>
    <div className="category-filters"><label>服装品类<select aria-label="服装品类分组" value={group} onChange={e=>setGroup(e.target.value)}><option value="all">全部品类</option>{CATEGORY_GROUPS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>接通程度<select aria-label="品类接通程度" value={stage} onChange={e=>setStage(e.target.value)}><option value="all">全部进度</option>{Object.entries(stageLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><input aria-label="搜索服装构型" type="search" placeholder="名称、构型或裁片角色" value={query} onChange={e=>setQuery(e.target.value)}/><span role="status">显示 {visible.length} 类</span></div>
    {error&&<p role="alert">{error}</p>}
    <div className="category-columns"><nav aria-label="服装构型列表">{visible.map(r=><button key={r.category.id} data-category-id={r.category.id} aria-pressed={selected?.category.id===r.category.id} onClick={()=>onCategoryChange(r.category.id)}><strong>{r.category.label}</strong><span>{stageLabel[r.stage]}</span><small>模板 {r.executableIds.length} · 必需角色 {r.roles.length}</small></button>)}{visible.length===0&&<p>没有符合条件的品类。</p>}</nav>
    {selected&&c&&<div className="category-detail" data-testid="category-detail" data-category-id={c.id}>
      <h3>{c.label}</h3><p>{c.construction}</p><p className="category-note">当前裁片：{PATTERN_LIBRARY[s.activePatternId].name} · {active?'与所选品类匹配':'与所选品类不同，请先明确选用模板'}{active&&!valid?' · 当前参数检查未通过':''}</p>
      {selected.executableIds.some(id=>foundationParameters(id))&&<section data-testid="foundation-variants"><h4>基础款快速改款</h4><p>先明确选用基型，再选配同方法变化。尺寸、配缝和裁片 BOM 随完整构型更新。</p><div className="category-actions">{selected.structures.filter(a=>foundationParameters(a.templateId)).map(a=><button key={a.id} disabled={!valid||a.templateId!==s.activePatternId} onClick={()=>run(()=>{s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),a.id));onNavigate({kind:'pieces',view:'construction'});})}>应用{a.name}</button>)}</div><table aria-label="基础款部件接口"><thead><tr><th>部件</th><th>状态</th><th>关键尺寸与接口</th></tr></thead><tbody>{foundationModules(selected.executableIds).map(m=><tr key={m.id} data-component-contract={m.id}><td>{m.label}</td><td>{m.stage==='parameterized'?'参数变化可用':m.stage==='source-conflict'?'源裁法待核实':'已定义 / 待接通'}</td><td>{m.requiredDimensions.join('、')}；{m.interfaces.join('、')}{m.blockingReasons.length>0&&<p className="category-gap">{m.blockingReasons.join(' ')}</p>}</td></tr>)}</tbody></table></section>}
      <section><h4>模板与母版</h4><div className="category-template-list">{c.templateIds.map(id=><article key={id}><b>{PATTERN_LIBRARY[id].name}</b><p>{PATTERN_REVIEWS[id].limitations}</p><button disabled={!selected.executableIds.includes(id)} onClick={()=>run(()=>s.applyReviewedConfiguration(readConfiguration({...s.getConfiguration(),activePatternId:id,construction:undefined})))}>{selected.executableIds.includes(id)?'选用此品类模板':PATTERN_REVIEWS[id].disposition==='retired'?'已停用':'待重建'}</button></article>)}{selected.companies.map(m=><article key={m.id}><b>{m.source.styleCode} · 公司母版</b><p>{m.cadTemplateId?'设计稿可明确关联参考 CAD，需在公司设计稿中应用。':'二维造型可用，整体 CAD 仍待接通。'}</p><button onClick={()=>run(()=>{s.setCompanyDraft(newCompanyStyle(m.id));onNavigate({kind:'company'});})}>打开公司原稿母版</button></article>)}</div>{!selected.executableIds.length&&<p className="category-gap">此构型尚无可用的整款制图方法。以下独立参考裁片用于研究，不能自动拼成合格成衣。</p>}</section>
      <section><h4>素材与工艺</h4><div className="category-actions"><button onClick={()=>asset('material')}>本品类面料</button><button onClick={()=>asset('finish')}>本品类工艺</button><button onClick={()=>asset('color')}>屏幕配色</button></div><p className="category-note">面料选择应用到资产库中明确显示的公司母版。克重、门幅、厚度、伸缩与弯曲需实测；屏幕纹理不是物性数据。</p></section>
      <section><h4>二维裁片交付</h4><div className="category-actions"><button disabled={!valid} onClick={()=>onNavigate({kind:'pieces',view:'generator'})}>尺寸与裁片生成</button><button disabled={!valid} onClick={()=>onNavigate({kind:'pieces',view:'assembly'})}>配缝方向与裁片 BOM</button><button disabled={!valid} onClick={()=>onNavigate({kind:'pieces',view:'construction'})}>部件构型与走缝约束</button></div><p>从当前已审查模板生成二维裁片、配缝检查和可复用设计资产。{!active?' 选用模板后才可进入对应裁片功能。':''}</p></section>
      <section><h4>必需裁片角色与证据</h4><p className="category-note">“源绑定”指整款模板中已登记的身份；实际用片和数量须以当前构型检查为准。“独立参考”是其他设计的单片样本，不能代替本款净样。</p><div className="category-table"><table><thead><tr><th>结构角色</th><th>整款源绑定</th><th>当前构型</th><th>独立参考 CAD / 图示</th><th>查看</th></tr></thead><tbody>{selected.roles.map(r=><tr key={r.id}><td>{r.label}<small>{r.id}</small></td><td>{r.sourceBound?'有参考绑定':'待接入'}</td><td>{currentRoleText(r.id)}</td><td>{r.cadCount} / {r.imageCount}</td><td><button onClick={()=>usePieceLibraryStore.getState().openReferenceCatalogue(r.family,r.id)}>该角色参考</button></td></tr>)}</tbody></table></div>{c.optionalRoles.length>0&&<p>可选部件：{c.optionalRoles.map(id=>PIECE_ROLE_MAP[id].label).join('、')}。选用后须另查净样、配缝、数量及材料层。</p>}</section>
      <section><h4>待补齐与边界</h4><ul>{c.gaps.map(g=><li key={g}>{g}</li>)}{selected.missingSourceRoles.length>0&&<li>本构型缺少同源身份：{selected.missingSourceRoles.map(id=>PIECE_ROLE_MAP[id].label).join('、')}。</li>}<li>面料物性、试穿验证、任意 DXF 编辑、规则放码、自动排料、云端审签尚未接通。</li></ul><p>{CATEGORY_SCOPE.excludes}</p></section>
      <details><summary>功能组织参考</summary><p>当前页面按二维裁片、素材、结构与属性分区；模板状态以本页审查证据为准。</p><p>当前公司母版：{s.companyDraft?companyStyleMaster(s.companyDraft.masterId).source.styleCode:'未选择'}；生产验收：未通过。</p></details>
    </div>}</div>
  </section>;
}



