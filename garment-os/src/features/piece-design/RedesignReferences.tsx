import { REDESIGN_METHODS, REDESIGN_SOURCE } from '@/data/redesignMethods';
import corpus from '@/data/redesignCorpus.snapshot.json';
import './redesign-methods.css';

export function RedesignReferences({onDesign}:{onDesign:()=>void}){
 return <section className="redesign-reference-library" data-testid="redesign-reference-library">
  <header><div><h2>商业改款文献</h2><p>从已读方法到可复用操作，保留文献与应用的区别。</p></div><button onClick={onDesign}>返回裁片组合设计</button></header>
  <div className="redesign-source-summary"><a href={REDESIGN_SOURCE.collectionUrl} target="_blank" rel="noreferrer">WPS · {REDESIGN_SOURCE.collectionTitle}</a><p>2026-11-12 核对：合集实际列出19个子文链接；已核对16篇收藏的可见正文与145张图片，另外3篇尚未取得正文。部分表格为裁切预览或低清图，缺失内容没有补写。</p><p><a href={REDESIGN_SOURCE.url} target="_blank" rel="noreferrer">已读：{REDESIGN_SOURCE.title}</a> · F先生绘</p><p>文章将改款分为形、色、质、细节四个维度。当前把11类方法适配至短T设计台；品类转移待目标模板接通。下列执行动作是平台应用提案。</p></div>
  <div className="redesign-reference-methods">{REDESIGN_METHODS.map(m=><article key={m.id}><small>{m.group} · {m.implemented?'短T适配':'待接通'}</small><h3>{m.name}</h3><p>{m.summary}</p><p>当前应用：{m.scope}</p></article>)}</div>
  <details className="redesign-sources" open><summary>19篇阅读清单 · 16篇可见内容已读</summary><ol>{corpus.articles.map(a=><li key={a.blockId}><a href={a.wpsFileId?'https://365.kdocs.cn/office/o/'+a.wpsFileId:a.url} target="_blank" rel="noreferrer">{a.title}</a><small>{a.status==='reviewed-visible-content'?'可见正文与图片已读':'待取得正文'}</small><p>{a.summary}</p><details><summary>阅读范围与限制</summary>{a.limitations.map(s=><p key={s}>{s}</p>)}</details></li>)}</ol></details>
  <div className="redesign-source-summary"><h3>素材库推进顺序</h3><p>短T已接通：领型与开合、装袖/插肩/微落肩、口袋、边口、拼片、撞色和5类肌理。新增结构的配套净样与工艺尚待核验。</p><p>优先补齐：衬衫领座/领面/门襟/袖衩/袖口配套；女装方领/心形领/荡领、泡泡袖/羊腿袖、收省与腰节；随后补褶裥/荷叶边/系带/可拆卸连接。每种素材需对应真实标签、适用品类、三视图边界、配套裁片与禁配条件。</p><p>真实面料还需成分、克重、弹性、垂坠、缩水与色牢度；图形需源稿及工艺；功能整理、成本、销量均需独立资料支持。</p></div>
  <p>结构净样、配缝及工艺仍须专业核验。文中经验公式不作为经过验证的销量预测模型。</p>
 </section>;
}
