import { useMemo, useState } from 'react';
import snapshot from '@/data/referencePieceCatalogue.snapshot.json';
import illustrations from '@/data/referenceIllustrations.json';
import { PIECE_ROLE_MAP } from '@/data/pieceTaxonomy';
import { referenceBounds, referenceCatalogueSvg, referenceCoverage } from '@/application/reference-catalogue';
import { downloadText } from '@/features/files/browser-files';
import { useDesignStore } from '@/store/useDesignStore';
import type { ReferenceBrowse } from '@/store/pieceLibraryStore';
import type { ReferenceCatalogueEntry, ReferenceCatalogueSnapshot } from '@/types/reference-catalogue';
import type { PieceFamilyId } from '@/types/piece-taxonomy';
import './reference-catalogue.css';

const catalogue=snapshot as ReferenceCatalogueSnapshot;
const coverage=referenceCoverage();
const sourceLink=(design:string)=>`https://www.npmjs.com/package/@freesewing/${encodeURIComponent(design)}/v/4.10.2`;
const PAGE_SIZE=12;

export function ReferenceCatalogue({initial={},onCurrent,onScopeChange}:{initial?:ReferenceBrowse;onCurrent:(family?:string,role?:string)=>void;onScopeChange?:(scope:ReferenceBrowse)=>void}) {
  const [family,setFamily]=useState<PieceFamilyId|''>(initial.family??'');
  const [role,setRole]=useState(initial.role??'');
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const [page,setPage]=useState(0);
  const [showDetails,setShowDetails]=useState(false);
  const current=useDesignStore(s=>s.draft.pieces);
  const q=query.trim().toLowerCase();
  const familyInfo=coverage.find(f=>f.id===family);
  const entries=useMemo(()=>catalogue.entries.filter(e=>{
    const r=PIECE_ROLE_MAP[e.roleId];
    return (!family||e.family===family)&&(!role||e.roleId===role)&&(!q||
      [r.label,r.definition,...r.variants,e.sourceId,e.variant,e.sampleId].join(' ').toLowerCase().includes(q));
  }),[family,role,q]);
  const photos=illustrations.filter(i=>(!family||i.family===family)&&(!role||i.roleIds.includes(role))&&
    (!q||[i.title,i.description,...i.roleIds].join(' ').toLowerCase().includes(q)));
  const selected=entries.find(e=>e.id===selectedId)??entries[page*PAGE_SIZE]??entries[0];
  const sample=selected?catalogue.samples.find(s=>s.id===selected.sampleId)!:null;
  const currentCount=current.filter(p=>(!family||p.category===family)&&(!role||p.paths[0]?.pieceRole===role)).length;
  const pending=(familyInfo? [familyInfo]:coverage).flatMap(f=>f.roles).filter(r=>!r.cadCount&&!r.imageCount);
  const resetPage=()=>{setPage(0);setSelectedId('');};
  const shown=entries.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);

  return <section className="reference-catalogue" data-testid="reference-catalogue" data-catalogue-family={family||'all'} aria-label="参考裁片库">
    <header className="reference-catalogue__header">
      <div><p className="reference-catalogue__eyebrow">GARMENTOS / 参考资产</p><h2>{familyInfo?.label??'全量'}参考裁片</h2>
        <p>{catalogue.entries.length} 份毫米源图纸 · {coverage.filter(f=>f.cadCount||f.imageCount).length} 大类有参考 · {new Set(catalogue.entries.map(e=>e.roleId)).size} 个角色有 CAD 样本</p></div>
      <button onClick={()=>onCurrent()}>返回当前款式</button>
    </header>
    <p className="reference-catalogue__notice" data-testid="catalogue-current-notice">
      当前款式有 {currentCount} 种符合所选部位的裁片。以下为独立参考样本，使用来源样本尺寸。
      <button onClick={()=>onCurrent(family||undefined,role||undefined)}>查看当前款式裁片</button>
    </p>
    <div className="reference-catalogue__filters">
      <label>参考大类<select aria-label="参考大类" value={family} onChange={e=>{
        const next=coverage.find(f=>f.id===e.target.value)?.id??'';setFamily(next);setRole('');resetPage();onScopeChange?.({family:next||undefined});
      }}>
        <option value="">全部大类</option>{coverage.map(f=><option key={f.id} value={f.id}>{f.label} · {f.cadCount} 图纸 / {f.imageCount} 图片</option>)}
      </select></label>
      <label>参考裁片角色<select aria-label="参考裁片角色" value={role} onChange={e=>{
        const nextRole=e.target.value,nextFamily=family||PIECE_ROLE_MAP[nextRole]?.family||'';
        setFamily(nextFamily);setRole(nextRole);resetPage();onScopeChange?.({family:nextFamily||undefined,role:nextRole||undefined});
      }}>
        <option value="">全部角色</option>{(familyInfo?[familyInfo]:coverage).flatMap(f=>f.roles).map(r=><option value={r.id} key={r.id}>{r.label} · {r.cadCount} 图纸 / {r.imageCount} 图片</option>)}
      </select></label>
      <label>搜索参考裁片<input aria-label="搜索参考裁片" value={query} onChange={e=>{setQuery(e.target.value);resetPage();}} placeholder="名称、构型或来源"/></label>
    </div>
    <p role="status" data-testid="catalogue-result-count">当前显示 {entries.length} 份源图纸、{photos.length} 份图片参考。净样为蓝色，源裁边为灰黑色；图形坐标单位 mm。</p>
    {entries.length>0&&<div className="reference-catalogue__workspace">
      <div>
        <div className="reference-catalogue__cards">
          {shown.map(entry=><button type="button" key={entry.id} data-catalogue-entry={entry.id} data-catalogue-role={entry.roleId}
            aria-pressed={selected?.id===entry.id} onClick={()=>setSelectedId(entry.id)}>
            <CatalogueDrawing entry={entry} thumbnail/>
            <strong>{PIECE_ROLE_MAP[entry.roleId].label}</strong><span>{entry.variant}</span><small>{entry.sourceId}</small>
          </button>)}
        </div>
        {entries.length>PAGE_SIZE&&<nav className="reference-catalogue__pages" aria-label="参考图纸分页">
          <button disabled={page===0} onClick={()=>{setPage(p=>p-1);setSelectedId('');}}>上一页</button>
          <span>{page+1} / {Math.ceil(entries.length/PAGE_SIZE)}</span>
          <button disabled={(page+1)*PAGE_SIZE>=entries.length} onClick={()=>{setPage(p=>p+1);setSelectedId('');}}>下一页</button>
        </nav>}
      </div>
      {selected&&sample&&<article className="reference-catalogue__detail" data-testid="catalogue-detail" data-reference-entry={selected.id}>
        <h3>{PIECE_ROLE_MAP[selected.roleId].label} · {selected.variant}</h3>
        <p>{selected.sourceId} · {sample.design} {sample.version} · {sample.profile}</p>
        <p>源设计：{sample.designer} · MIT</p>
        <label className="reference-catalogue__checkbox"><input type="checkbox" checked={showDetails} onChange={e=>setShowDetails(e.target.checked)}/>显示源细节线</label>
        <CatalogueDrawing entry={selected} showDetails={showDetails}/>
        {!selected.paths.some(p=>p.layer==='cut')&&<p>此来源未单列缝份轮廓；保留源图中的边界，不自行添加。</p>}
        <CatalogueDimensions entry={selected}/>
        <p>{PIECE_ROLE_MAP[selected.roleId].definition}</p>
        <details><summary>源下料指令与构型设置</summary><pre>{JSON.stringify({cutInstructions:selected.cutInstructions,options:sample.options},null,2)}</pre></details>
        <p className="reference-catalogue__limits">参考图纸；配缝、材料和制造适用性需按具体款式核验。</p>
        <div className="reference-catalogue__actions">
          <a href={sourceLink(sample.design)} target="_blank" rel="noreferrer">查看制版来源 · MIT</a>
          <button onClick={()=>downloadText(referenceCatalogueSvg(selected,sample),`参考裁片-${selected.sourceId}.svg`,'image/svg+xml')}>导出毫米参考 SVG</button>
          <button onClick={()=>downloadText(JSON.stringify({schema:'garment-os/reference-piece/v1',sample,piece:selected},null,2),`参考裁片-${selected.sourceId}.json`,'application/json')}>导出源数据</button>
        </div>
      </article>}
    </div>}
    {photos.map(photo=><article className="reference-catalogue__photo" key={photo.id} data-reference-photo={photo.id}>
      <div><h3>{photo.title}</h3><p>{photo.description}</p><strong>图片参考 · 尚无毫米 CAD 数据</strong>
        <p>{photo.author} · {photo.license}</p><a href={photo.sourceUrl} target="_blank" rel="noreferrer">查看原始纸样来源</a></div>
      <img src={photo.src} alt={photo.title} loading="lazy"/>
    </article>)}
    {!entries.length&&!photos.length&&<div className="reference-catalogue__gap" data-testid="catalogue-reference-gap">
      <h3>{role?PIECE_ROLE_MAP[role]?.label:'所选条件'}尚无对应参考图</h3>
      <p>{role?PIECE_ROLE_MAP[role]?.definition:'可调整名称或角色筛选。'}此处不使用其他部位的图形代替。</p>
      <p>待补：明确制版来源、独立闭合轮廓、关键尺寸及配接规则。</p>
    </div>}
    <details className="reference-catalogue__coverage"><summary>本类角色覆盖与待补项（{pending.length} 个角色暂无参考）</summary>
      <p>参考大类已覆盖不等于全部细分角色已具备 CAD。未接入项保留明确缺口。</p>
      <div>{(familyInfo?[familyInfo]:coverage).map(f=><section key={f.id}><h4>{f.label}</h4><ul>{f.roles.map(r=><li key={r.id} data-reference-coverage-role={r.id}>{r.label}：{r.cadCount} 份源图纸 / {r.imageCount} 份图片{!r.cadCount&&!r.imageCount?' · 待补参考':''}</li>)}</ul></section>)}</div>
    </details>
  </section>;
}

function CatalogueDimensions({entry}:{entry:ReferenceCatalogueEntry}) {
  const b=referenceBounds(entry);
  return <dl className="reference-catalogue__dimensions">
    <div><dt>图形范围宽</dt><dd>{b.width.toFixed(2)} mm</dd></div>
    <div><dt>图形范围高</dt><dd>{b.height.toFixed(2)} mm</dd></div>
    <div><dt>源净边周长</dt><dd>{entry.perimeterMm.toFixed(2)} mm</dd></div>
  </dl>;
}
function CatalogueDrawing({entry,thumbnail=false,showDetails=false}:{entry:ReferenceCatalogueEntry;thumbnail?:boolean;showDetails?:boolean}) {
  const b=referenceBounds(entry),pad=Math.max(12,Math.max(b.width,b.height)*.06);
  return <svg role="img" aria-label={PIECE_ROLE_MAP[entry.roleId].label+(thumbnail?'缩略图':'毫米参考图')} data-reference-drawing={thumbnail?'thumbnail':'detail'}
    viewBox={`${b.x-pad} ${b.y-pad} ${b.width+pad*2} ${b.height+pad*2}`}>
    {entry.paths.filter(p=>thumbnail?p.layer==='net':showDetails||p.layer!=='detail').map(p=><path key={p.key}
      data-reference-source={p.key} data-reference-layer={p.layer} d={p.data} fill="none"
      stroke={p.layer==='net'?'#24657b':p.layer==='cut'?'#374151':'#8296a1'} vectorEffect="non-scaling-stroke"
      strokeWidth={p.layer==='net'?1.3:.8} strokeDasharray={p.layer==='fold'?'4 3':p.layer==='detail'?'2 3':undefined}/>)}
  </svg>;
}
