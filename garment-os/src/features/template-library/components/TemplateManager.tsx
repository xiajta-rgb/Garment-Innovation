import { useMemo, useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { listPatterns, PATTERN_CATEGORIES, PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS, isReferencePattern } from '@/data/patternReview';
import { FABRIC_COLORS, FABRIC_PATTERNS } from '@/data/fabrics';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { composePattern } from '@/lib/patterns/compose';
import { measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import { patternFeishuUrl, isPatternRegistered } from '@/data/element-links';
import { useCompositionUiStore } from '@/store/compositionUiStore';
import { useCompositionAppearance } from '@/features/piece-design/useCompositionAppearance';
import { COMPOSITION_FABRICS } from '@/application/composition-decoration';
const button: React.CSSProperties = { padding: 7, fontSize: 11, border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' };
export function TemplateManager() {
  const active = useDesignStore(s => s.activePatternId), apply = useDesignStore(s => s.applyPattern);
  const composition=useCompositionUiStore();
  const appearance=useCompositionAppearance();
  const color = useDesignStore(s => s.garmentColor), setColor = useDesignStore(s => s.setColor);
  const fabric = useDesignStore(s => s.fabricId), setFabric = useDesignStore(s => s.setFabric);
  const [category, setCategory] = useState('t-shirt');
  const [tab, setTab] = useState('template');
  return <section data-testid="template-manager" style={{ color: 'var(--text-primary)', fontSize: 11 }}>
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>{[['template','模板'],['color','颜色'],['fabric','面料']].map(([id,label]) => <button key={id} style={button} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'template' && <>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>{PATTERN_CATEGORIES.map(c => <button key={c.id} style={{ ...button, color: category === c.id ? 'var(--accent)' : undefined }} onClick={() => setCategory(c.id)}>{c.label}</button>)}</div>
      <p style={{ fontSize: 10, lineHeight: 1.6 }}>{listPatterns().length} 项已审查：{listPatterns().filter(p=>isReferencePattern(p.id)).length} 项可生成参考稿，{Object.values(PATTERN_REVIEWS).filter(r=>r.disposition==='rebuild-required').length} 项待重建，{Object.values(PATTERN_REVIEWS).filter(r=>r.disposition==='retired').length} 项合并停用。可生成项均为参考版，生产待验收。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 7 }}>{listPatterns().filter(p => p.category === category).map(p => {
        const review = PATTERN_REVIEWS[p.id], enabled = isReferencePattern(p.id);
        return <article key={p.id} data-template-review={p.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}>
          <button data-testid={`template-${p.id}`} disabled={!enabled} draggable={enabled} onDragStart={e=>{e.dataTransfer.setData('application/x-garment-template',p.id);e.dataTransfer.effectAllowed='copy';}} onClick={() => composition.active?composition.selectTemplate(p.id):apply(p.id)} title={composition.active?'选择此模板的裁片，加入自由组合':`${review.reason} ${review.limitations}`} style={{ ...button, width: '100%', padding: 3, borderColor: (composition.active?(composition.templateId??active):active) === p.id ? 'var(--accent)' : 'var(--border)', opacity: enabled ? 1 : .65 }}>
            {enabled ? <PatternThumbnail id={p.id} /> : <div style={{ minHeight: 54, display: 'grid', placeItems: 'center' }}>生成已停用</div>}
            <span style={{ display: 'block', fontWeight: 600, marginTop: 4 }}>{p.name}</span>
          </button>
          <div style={{ marginTop: 5, fontSize: 10, color: enabled ? '#1677ff' : '#ad6800' }}>{enabled ? `${review.engine} 4.10.2 · 参考待试坯` : review.disposition === 'retired' ? '合并至圆领 T 恤' : '缺少构型依据 · 待重建'}</div>
          <details style={{ marginTop: 4, fontSize: 10, lineHeight: 1.6 }}><summary>审查与缺口</summary>{review.reason}<br />{review.limitations}</details>
          <a href={patternFeishuUrl(p.id)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 10 }}>{isPatternRegistered(p.id)?'元素库快照资料 ↗':'元素库待登记 · 查看表 ↗'}</a>
        </article>;
      })}</div>
    </>}
    {tab === 'color' && <><p>{composition.active?'应用到当前组合方案主色':'应用到当前原始裁片配色'}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>{FABRIC_COLORS.map(c => <button key={c.hex} title={c.name} aria-label={`选择${c.name}`} aria-pressed={(composition.active?appearance.color:color).toLowerCase()===c.hex.toLowerCase()} onClick={() => composition.active?appearance.setColor(c.hex):setColor(c.hex)} style={{ ...button, background: c.hex, width: 27, height: 27, borderColor: (composition.active?appearance.color:color).toLowerCase() === c.hex.toLowerCase() ? 'var(--accent)' : 'var(--border)' }} />)}</div></>}
    {tab === 'fabric' && <><p>纹理仅为外观预览；成分、门幅、克重和用量需实际材料资料。</p>{composition.active?<div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:5}}>{COMPOSITION_FABRICS.map(f=><button key={f.id} style={button} aria-pressed={appearance.fabric===f.id} onClick={()=>appearance.setFabric(f.id)}>{f.name}</button>)}</div>:<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>{FABRIC_PATTERNS.map(f => <button key={f.id} onClick={() => setFabric(f.id)} style={{ ...button, background: f.bg, color: '#333', minHeight: 55, borderColor: fabric === f.id ? 'var(--accent)' : 'var(--border)' }}>{f.name}</button>)}</div>}</>}
  </section>;
}
function PatternThumbnail({ id }: { id: string }) {
  const geometry = useMemo(() => {
    try {
      const m = getReferenceMeasurements(id === 'womens-basic-tee' ? 'female' : 'male', 'M');
      const source = composePattern(PATTERN_LIBRARY[id], {}, m, 'male', { view: 'all' }).paths.filter(p => p.layer === 'seam-line');
      const paths = source.filter(p => p.category === (PATTERN_LIBRARY[id].category==='skirt'?'skirt':PATTERN_LIBRARY[id].category==='pants'?'trouser':'body'));
      if(!paths.length)throw new Error('模板缺少主裁片净样');
      const b = measurePieceBboxFull(paths);
      return { paths, viewBox: `${b.minX-15} ${b.minY-15} ${b.maxX-b.minX+30} ${b.maxY-b.minY+30}` };
    } catch { return null; }
  }, [id]);
  return geometry ? <svg aria-label={PATTERN_LIBRARY[id].category==='skirt'?'M 参考样本裙幅净样':PATTERN_LIBRARY[id].category==='pants'?'M 参考样本裤片净样':'M 参考样本衣身净样'} viewBox={geometry.viewBox} style={{ width: '100%', height: 85 }}>{geometry.paths.map(p => <path key={p.id} d={p.data} transform={p.transform} fill="none" stroke="currentColor" strokeWidth={3} />)}</svg> : <span>参考几何载入失败</span>;
}
