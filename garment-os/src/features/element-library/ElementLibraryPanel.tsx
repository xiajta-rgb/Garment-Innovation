import { useState, type CSSProperties } from 'react';
import { ELEMENT_LIBRARY, ELEMENT_REGISTRY, ELEMENT_TABLE_COORDS, filterLibrary, type ElementDomain } from '@/data/elementRegistry';
import { buildRegistrationPackage, downloadRegistrationPackage } from './design-registration';

const control: CSSProperties = { width: '100%', minWidth: 0, fontSize: 11, padding: 4, borderRadius: 4,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' };
const types = ['版型模板', '结构部件模板', '纸样与裁片', '廓形模板', '款式技术图', '其他造型元素'];
export function ElementLibraryPanel() {
  const [domain, setDomain] = useState<ElementDomain>('服装造型域');
  const [type, setType] = useState('');
  const [part, setPart] = useState('');
  const [query, setQuery] = useState('');
  const [includeIsolated, setIncludeIsolated] = useState(false);
  const [error, setError] = useState('');
  const items = filterLibrary(ELEMENT_REGISTRY, { domain, type, part, query, includeIsolated });
  const domainItems = ELEMENT_REGISTRY.filter(e => e.domain === domain);
  const parts = [...new Set(domainItems.flatMap(e => e.parts))];
  const typeOptions = domain === '服装造型域' ? types : [...new Set(domainItems.map(e => e.type))];
  const shapeCount = ELEMENT_REGISTRY.filter(e => e.domain === '服装造型域').length;
  const exportCandidate = () => {
    try { downloadRegistrationPackage(buildRegistrationPackage()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '裁片资料导出失败'); }
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      <b>服装造型库 · {shapeCount} 条</b><br />模板 → 结构部件 → 尺寸裁片<br />
      廓形控制松量；色、料、工艺配套引用。
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <button onClick={exportCandidate} style={{ ...control, width: 'auto', cursor: 'pointer' }}>导出候选裁片</button>
      <a href={ELEMENT_TABLE_COORDS.wikiUrl} target="_blank" rel="noreferrer">飞书造型库 ↗</a>
    </div>
    {error && <div role="alert" style={{ color: '#d4380d' }}>{error}</div>}
    <small style={{ color: 'var(--text-muted)' }} title={ELEMENT_LIBRARY.syncedAt}>
      飞书快照 · {ELEMENT_LIBRARY.syncedAt.slice(0, 10)} · 手动更新
    </small>
    <select aria-label="素材域" value={domain} style={control} onChange={e => {
      setDomain(e.target.value as ElementDomain); setType(''); setPart(''); setQuery('');
    }}>
      <option>服装造型域</option><option>色彩图案域</option><option>面料材质域</option><option>细节工艺域</option>
    </select>
    <select aria-label="造型类型" value={type} onChange={e => setType(e.target.value)} style={control}>
      <option value="">全部类型</option>{typeOptions.map(t => <option key={t}>{t}</option>)}
    </select>
    <select aria-label="适用部位" value={part} onChange={e => setPart(e.target.value)} style={control}>
      <option value="">全部部位</option>{parts.map(p => <option key={p}>{p}</option>)}
    </select>
    <input aria-label="搜索素材" placeholder="搜索名称或来源" value={query} onChange={e => setQuery(e.target.value)} style={control} />
    <label><input type="checkbox" checked={includeIsolated} onChange={e => setIncludeIsolated(e.target.checked)} /> 显示隔离及弃用素材</label>
    <span role="status">显示 {items.length} / {domainItems.length} 条</span>
    <div data-testid="library-results" style={{ maxHeight: 420, overflowY: 'auto' }}>
      {!items.length && <p>当前筛选无素材。尺寸裁片在生成并登记后进入库。</p>}
      {items.map(e => <details key={e.sourceId} data-source-id={e.sourceId} style={{ borderTop: '1px solid var(--border)', padding: '6px 0', lineHeight: 1.6 }}>
        <summary style={{ cursor: 'pointer', overflowWrap: 'anywhere' }}>{e.name} <small style={{ color: e.status === '隔离' ? '#d4380d' : '#ad6800' }}>{e.status}</small></summary>
        <div>{e.type} · {e.granularity} · {e.parts.join('、')}</div><p>{e.description}</p>
        <div>组成：{e.componentSourceIds.length ? e.componentSourceIds.map(src => ELEMENT_REGISTRY.find(item => item.sourceId === src)?.name ?? src).join('、') : '无组成引用'}</div>
        {e.basisSourceIds.length > 0 && <div>生成依据：{e.basisSourceIds.map(src => ELEMENT_REGISTRY.find(item => item.sourceId === src)?.name ?? src).join('、')}</div>}
        <div>参数定义：{e.parameterCodes.length} 项 · 标签：{e.labelStatus}</div><div>权利：{e.rightsStatus}</div>
        <p style={{ color: 'var(--text-secondary)' }}>{e.limitations || '使用限制尚未补齐'}</p>
        <a href={ELEMENT_TABLE_COORDS.recordUrl(e.sourceId)} target="_blank" rel="noreferrer">查看主档与规格 ↗</a>
      </details>)}
    </div>
  </div>;
}
