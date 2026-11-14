import {useState} from 'react';
import {readCompanyStyle} from '@/lib/pattern/company-style';
import type {CompanyStyleDraft} from '@/types/company-style';
import './sweatshirt-research-pilot.css';

interface EvidenceSummary {id:string;finding:string;boundary:string}
interface DesignDecision {keep:string[];change:string[];prohibited:string[]}
interface ValidationGate {stage:string;evidenceNeeded:string[];sequence:string[];decisionRule:string}
interface PilotCandidate {id:string;name:string;role:string;change:string;question:string;falsifier:string;needs:string[];evidenceIds:string[];evidenceSummary?:EvidenceSummary[];opportunityJudgment?:string;opportunityStatus?:string;opportunityBoundary?:string;designDecision?:DesignDecision;validationGate?:ValidationGate;nextAction?:string;draft:CompanyStyleDraft;svg:string;canApply?:boolean;patternStatus?:string}
interface Competitor {id:string;name:string;brand:string;kind:string;url:string;image?:string;fact:string;insight:string;limit:string}
interface MatrixData {competitors?:Competitor[]}
interface PilotManifest {schema:string;title:string;conclusion:string;boundary:string;sourceSummary:string;recommendation:string;comparisons:string[];candidates:PilotCandidate[];evidence:{id:string;label:string;url:string;window:string;nature:string}[];matrix?:{json:string;markdown:string;image:string};evidenceProvenance?:string;baseStyle?:{styleCode:string;lockedDNA:string[];sourceImage:string};experience?:{card:string;learned:string[];discarded?:string[];feedback:string}}
const root='/research-pilots/mens-sweatshirt-redesign-correction-20261113/';
const matrixRoot='/research-pilots/mens-sweatshirt-three-view-matrix-20261113/';
const statusLabel=(status?:string)=>({
 'baseline-only':'基准对照',
 'candidate-opportunity':'机会候选',
 'visual-hypothesis-only':'视觉假设',
 'blocked-pending-source-pattern':'来源阻断',
 } as Record<string,string>)[status??'']??status??'未定义';
export function SweatshirtResearchPilot({onSelect}:{onSelect:(draft:CompanyStyleDraft)=>void}){
 const [data,setData]=useState<PilotManifest>(),[matrixData,setMatrixData]=useState<MatrixData>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('all'),[selected,setSelected]=useState('');
 const load=async()=>{
  setBusy(true);setError('');
  try{
   const [response,matrixResponse]=await Promise.all([fetch(root+'manifest.json',{cache:'no-store'}),fetch(matrixRoot+'matrix.json',{cache:'no-store'})]);if(!response.ok)throw Error('本轮研究包尚未生成');
   const value: PilotManifest=await response.json();
   if(value.schema!=='garment-os/research-design-pilot/v1'||!Array.isArray(value.candidates)||!value.candidates.length)throw Error('研究包格式不兼容');
   const candidates=value.candidates.map(c=>({...c,draft:readCompanyStyle(c.draft)}));
   setData({...value,candidates});
   setMatrixData(matrixResponse.ok?await matrixResponse.json() as MatrixData:undefined);
   const requested=new URLSearchParams(location.search).get('candidate');
   setSelected(candidates.find(c=>c.id===requested)?.id??'S0');
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 const active=data?.candidates.find(c=>c.id===selected);
 return <section className="sweatshirt-pilot" data-testid="sweatshirt-research-pilot">
  <header><div><h3>男士卫衣 · 我司基款继承校正轮</h3><p>2026-11-13 · 基款 DNA 锁定、单变量改款与结构阻断</p></div><button onClick={()=>void load()} disabled={busy}>{busy?'正在读取研究包…':data?'重新读取校正轮':'查看基款校正与改款矩阵'}</button></header>
  {error&&<p role="alert">{error}</p>}
   {data&&<div data-testid="sweatshirt-pilot-content"><p><strong>{data.conclusion}</strong></p><p>{data.sourceSummary}</p><p className="pilot-boundary">{data.boundary}</p>{data.matrix&&<p className="pilot-matrix-links">设计矩阵：<a href={root+'design-matrix.md'} target="_blank" rel="noreferrer">文字矩阵</a> · <a href={root+'design-matrix.png'} target="_blank" rel="noreferrer">校正矩阵图</a> · <a href={matrixRoot+'three-view-matrix.png'} target="_blank" rel="noreferrer">七款三视图延展 + 竞品对标图</a> · <a href={matrixRoot+'competitor-benchmark.md'} target="_blank" rel="noreferrer">竞品对标文字卡</a></p>}{data.baseStyle&&<details open><summary>本轮基款硬锁</summary><p>基款：{data.baseStyle.styleCode}</p><ul>{data.baseStyle.lockedDNA.map(item=><li key={item}>{item}</li>)}</ul></details>}
   <label>对照范围 <select aria-label="卫衣研究对照范围" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部四组</option><option value="material">材料与基款</option><option value="blocked">暂不落图</option></select></label>
   <div className="pilot-scroll"><table><thead><tr><th>方案</th><th>试验角色</th><th>具体变化</th><th>机会判断</th><th>状态</th><th>要验证的问题</th><th>操作</th></tr></thead><tbody>{data.candidates.filter(c=>filter==='all'||(filter==='material'?c.id==='S0'||c.id==='S1'||c.id==='S2':c.id==='Q0')).map(c=><tr key={c.id} data-pilot-candidate={c.id} aria-selected={selected===c.id}><td>{c.id} · {c.name}</td><td>{c.role}</td><td>{c.change}</td><td>{c.opportunityJudgment??'待补证据与机会判断'}</td><td><span className={`pilot-status pilot-status-${c.opportunityStatus??'unknown'}`}>{statusLabel(c.opportunityStatus)}</span></td><td>{c.question}</td><td><button onClick={()=>setSelected(c.id)}>查看 {c.id}</button></td></tr>)}</tbody></table></div>
   {active&&<article className="pilot-active" data-testid="pilot-selected-candidate"><div><h4>{active.id} · {active.name}</h4><p>{active.falsifier}</p><p><strong>机会状态：</strong>{statusLabel(active.opportunityStatus)} <code>{active.opportunityStatus??'unknown'}</code></p><p><strong>证据：</strong>{active.evidenceIds.join(' / ')}</p>{active.opportunityJudgment&&<section className="pilot-judgment"><h5>证据与机会判断</h5><p>{active.opportunityJudgment}</p><p className="pilot-boundary">边界：{active.opportunityBoundary}</p><ul>{active.evidenceSummary?.map(item=><li key={item.id}><strong>{item.id}</strong>：{item.finding} <span className="pilot-boundary">边界：{item.boundary}</span></li>)}</ul></section>}{active.designDecision&&<section className="pilot-judgment"><h5>设计决策</h5><p><strong>保留：</strong>{active.designDecision.keep.join('；')}</p><p><strong>变化：</strong>{active.designDecision.change.length?active.designDecision.change.join('；'):'无'}</p><p><strong>禁止叠加：</strong>{active.designDecision.prohibited.join('；')}</p></section>}{active.validationGate&&<details open><summary>验证闸门：{active.validationGate.stage}</summary><p><strong>需要证据：</strong>{active.validationGate.evidenceNeeded.join('；')}</p><ol>{active.validationGate.sequence.map(step=><li key={step}>{step}</li>)}</ol><p className="pilot-boundary">判定：{active.validationGate.decisionRule}</p></details>}<p><strong>下一步：</strong>{active.nextAction}</p>{active.canApply===false?<p className="pilot-boundary">当前只能作为设计提案或结构开发单，不能送入当前设计台。</p>:<button data-apply-pilot={active.id} onClick={()=>onSelect(readCompanyStyle(active.draft))}>将 {active.id} 送入当前设计台</button>}<a href={root+active.svg} target="_blank" rel="noreferrer">打开原稿/开发单</a></div><img src={root+active.svg} alt={active.name+'正背侧设计草案'}/><details><summary>配套结构与待验证项</summary><ul>{active.needs.map(n=><li key={n}>{n}</li>)}</ul></details></article>}
   {matrixData?.competitors?.length&&<section className="pilot-competitors" data-testid="competitor-benchmark"><header><div><h4>竞品结构对标</h4><p>只读产品页和公开产品图用于结构观察；竞品不作为我司版型来源。</p></div><a href={matrixRoot+'competitor-benchmark.md'} target="_blank" rel="noreferrer">打开完整对标卡</a></header><div className="pilot-competitor-grid">{matrixData.competitors.map(item=><article key={item.id}><a className="pilot-competitor-visual" href={item.url} target="_blank" rel="noreferrer" aria-label={`${item.name}来源页`}><div className={`competitor-sketch competitor-sketch-${item.kind}`} aria-hidden="true"><span>{item.kind==='zip'?'1/4 ZIP':'RAGLAN'}</span></div></a><h5>{item.id} · {item.name}</h5><p className="competitor-brand">{item.brand}</p><dl><div><dt>观察事实</dt><dd>{item.fact}</dd></div><div><dt>设计启发</dt><dd>{item.insight}</dd></div><div><dt>边界</dt><dd>{item.limit}</dd></div></dl><a href={item.url} target="_blank" rel="noreferrer">查看公开来源页</a>{item.image&&<a href={item.image} target="_blank" rel="noreferrer">查看公开产品图</a>}</article>)}</div></section>}
   <details><summary>选款顺序与验证方法</summary><p>{data.recommendation}</p><ul>{data.comparisons.map(c=><li key={c}>{c}</li>)}</ul></details>
   {data.experience&&<details open><summary>本轮经验沉淀</summary><p>{data.experience.feedback}</p><p>已确认的方法经验：</p><ul>{data.experience.learned.map(item=><li key={item}>{item}</li>)}</ul>{data.experience.discarded?.length&&<><p>本轮淘汰的做法：</p><ul>{data.experience.discarded.map(item=><li key={item}>{item}</li>)}</ul></>}<a href={data.experience.card} target="_blank" rel="noreferrer">打开完整经验卡</a></details>}
   <details><summary>来源与时间窗口</summary><ul>{data.evidence.map(e=><li key={e.id}><a href={e.url} target="_blank" rel="noreferrer">{e.id} · {e.label}</a> · {e.window} · {e.nature}</li>)}</ul></details>
  </div>}
 </section>;
}
