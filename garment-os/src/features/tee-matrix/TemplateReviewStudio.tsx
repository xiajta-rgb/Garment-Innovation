import { useMemo, useState } from 'react';
import { listPatterns } from '@/data/patternLibrary';
import { auditTemplateStructure } from '@/application/template-structural-audit';
import { templateAuditSheet } from '@/lib/pattern/template-audit-sheet';
import { supplementaryTemplateScope } from '@/application/template-review-scope';
import type { StandardSize } from '@/types/measurements';
import './template-review-studio.css';
const statusLabel = { incomplete: '结构待完成', blocked: '存在阻断项', 'rebuild-required': '待重建', retired: '已停用' };
const criterionLabel = { checked: '已核对', pending: '未完成', failed: '不通过', unavailable: '无可核对数据' };
export function TemplateReviewStudio({onDesign}:{onDesign?:()=>void}) {
  const [id, setId] = useState('t-shirt'), [size, setSize] = useState<StandardSize>('M');
  const catalogue = useMemo(() => listPatterns().map(p => auditTemplateStructure(p.id)), []);
  const a = useMemo(() => catalogue.find(a => a.id === id && a.configuration.standardSize === size) ?? auditTemplateStructure(id, size), [catalogue, id, size]);
  const svg = useMemo(() => templateAuditSheet(a), [a]);
  const scope = useMemo(() => supplementaryTemplateScope(), []);
  const exportAudit = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = `${a.id}-${size}-结构审查.json`; link.click(); URL.revokeObjectURL(url);
  };
  return <main className="template-review" data-testid="template-review-studio"><header><div><span>GARMENT / STRUCTURAL REVIEW</span><h1>全部模板 · 结构审查</h1><p>逐一核对裁片、配缝与完成态；设计需求可在设计台定制组合。</p></div><button onClick={onDesign}>返回定制矩阵</button></header>
    <div className="review-hold" role="status"><strong>整款结构验收未完成</strong><span>{catalogue.length}个正式模板 · {catalogue.filter(a => a.source).length}个源版参考 · {catalogue.filter(a => a.status === 'rebuild-required').length}个待重建 · {catalogue.filter(a => a.status === 'retired').length}个停用 · 0个通过整款验收</span></div>
    <div className="review-columns"><section className="review-list"><h2>模板清单</h2><p>状态对应默认M参考样本，点击查看实际裁片及问题。</p>{catalogue.map(item => <button key={item.id} data-review-template={item.id} aria-pressed={id === item.id} onClick={() => setId(item.id)}><strong>{item.name}</strong><small>{statusLabel[item.status]}</small></button>)}<div className="review-candidates">另有插肩、落肩两个结构候选，均未开放短T组合。跨款源图纸属于参考图库，不计为已审查整款模板。</div></section>
      <section className="review-detail" data-reviewed-id={a.id}><div className="review-detail-title"><div><h2>{a.name}</h2><p>{a.scope}</p><small>{a.source ?? '尚无可执行方法'} · {statusLabel[a.status]}</small></div><label>参考样本<select aria-label="模板审查参考尺码" value={size} onChange={e => setSize(e.target.value as StandardSize)}>{['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => <option key={s}>{s}</option>)}</select></label></div>
        <details className="review-scope"><summary>其他模板与方案也在审查范围内</summary><p>{scope.companyMasters.length}份公司图稿母版、{scope.structurePresets.length}个结构方案、{scope.appearancePresets.length}个外观预设及{scope.withdrawnDesignFamilies.length}个已撤下设计方向均未通过整款验收。图稿和参考图库不能代替完整裁片。</p><p>COT25M002原稿为微落肩，已撤销旧的普通装袖关联，仍需重建配套裁片。</p></details>
        <div className="review-criteria">{a.criteria.map(c => <article key={c.id} data-criterion={c.id} data-review-status={c.status}><div><strong>{c.label}</strong><span>{criterionLabel[c.status]}</span></div><p>{c.detail}</p></article>)}</div>
        <details className="review-findings" open><summary>必须解决的问题（{a.findings.length}）</summary><ol>{a.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ol></details>
        <details className="review-piece-panel" open><summary>真实源裁片（{a.pieces.length ? `${a.pieces.length}种` : '暂无'}）</summary>{svg ? <div className="template-audit-cad" dangerouslySetInnerHTML={{ __html: svg }} /> : <p>该模板没有可用几何，禁止用替代轮廓生成款式。</p>}</details>
        <details className="review-seams"><summary>配缝与制图依据</summary>{a.assembly ? <><p>以下只表示当前源边核对；待定义的接口不会视为通过。</p><table><thead><tr><th>配缝</th><th>A / B（mm）</th><th>结果</th></tr></thead><tbody>{a.assembly.joins.map(j => <tr key={j.id}><td>{j.label}</td><td>{j.aLengthMm?.toFixed(2) ?? '未知'} / {j.bLengthMm?.toFixed(2) ?? '未知'}</td><td>{j.status === 'passed' ? '长度/方向通过' : j.status === 'failed' ? '不通过' : '未定义完成态'}</td></tr>)}</tbody></table></> : <p>没有完整配缝规则。</p>}<p>制图依据：{a.sourceFiles.join('；')}</p></details>
        <div className="review-actions"><button onClick={exportAudit}>导出此模板审查记录</button><button disabled>整款验收 · 未通过</button></div><p className="review-limits">参考人体样本不是企业尺码表。源图一致、软件测试通过和成衣结构通过分别记录；当前没有模板被认定为整款无问题或生产可用。</p>
      </section></div></main>;
}
