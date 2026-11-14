import { useEffect,useRef,useState } from 'react';
import { IMAGE_MODELS,STYLE_IMAGE_API } from '@/application/style-image';
import type { ImageJob,ImageModel } from '@/application/style-image';
import { styleDesignImagePrompt } from '@/application/style-design-image';
import { exportStyleThreeViewSvg } from '@/lib/pattern/style-variation-drawing';
import { styleVariationSummary } from '@/lib/pattern/style-variation';
import { styleReferencePng } from './style-image-reference';
import type { CompanyStyleDraft } from '@/types/company-style';
import { downloadText } from '@/features/files/browser-files';
async function call<T>(action:string,args:object,signal:AbortSignal):Promise<T>{
 const response=await fetch(STYLE_IMAGE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...args}),signal});
 const value=await response.json();if(!response.ok)throw Error(value.error??'森灵未完成请求');return value as T;
}
type Snapshot={id:string;draft:CompanyStyleDraft;prompt:string;referencePng:string;model:ImageModel};
export function StyleDesignSenlingPanel({draft}:{draft:CompanyStyleDraft}){
 const [model,setModel]=useState<ImageModel>('nano-banana-pro'),[effect,setEffect]=useState<'technical'|'fabric'>('technical'),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[snapshot,setSnapshot]=useState<Snapshot>(),[job,setJob]=useState<ImageJob>();
 const active=useRef<AbortController|null>(null);useEffect(()=>()=>{active.current?.abort();},[]);
 const run=async(fn:(signal:AbortSignal)=>Promise<void>)=>{
  if(active.current)return;const c=new AbortController();active.current=c;setBusy(true);setError('');
  try{await fn(c.signal);}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:String(e));}finally{if(active.current===c){active.current=null;setBusy(false);}}
 };
 const poll=async(id:string,result:ImageJob,signal:AbortSignal)=>{
  const deadline=Date.now()+8*60000;
  while(result.state==='pending'&&!signal.aborted&&Date.now()<deadline){setJob(result);setStatus('三视图已提交，森灵正在生成…');await new Promise(r=>setTimeout(r,5000));if(signal.aborted)return;result=await call<ImageJob>('status',{id},signal);}
  if(signal.aborted)return;setJob(result);setStatus(result.state==='done'?'已返回测试图，请对照参考图检查设计。':result.state==='failed'?'本次未生成图片，可重新测试。':'等待已结束，请继续查询同一任务。');
 };
 const pending=!!snapshot&&(!job||job.state==='pending'),changed=!!snapshot&&JSON.stringify(snapshot.draft)!==JSON.stringify(draft);
 return <section className="company-senling" data-testid="style-design-senling"><header><div><h3>森灵三视图测试</h3><p>把当前二维三视图作为图片参考传入森灵，测试稿与提交时方案一起保留。</p></div><button disabled={busy} onClick={()=>void run(async signal=>{setStatus('正在检查连接…');await call('connection',{},signal);setStatus('森灵已连接');})}>检查森灵连接</button></header>
  <div className="company-senling-options"><label>生图模型<select aria-label="三视图生图模型" value={model} disabled={busy||pending} onChange={e=>setModel(e.target.value as ImageModel)}>{IMAGE_MODELS.map(m=><option key={m}>{m}</option>)}</select></label><label>测试效果<select aria-label="三视图测试效果" value={effect} disabled={busy||pending} onChange={e=>setEffect(e.target.value as typeof effect)}><option value="technical">技术款式三视图</option><option value="fabric">面料效果三视图</option></select></label>
   <button className="company-primary" disabled={busy||pending} onClick={()=>void run(async signal=>{
    setStatus('正在准备当前三视图…');const d=structuredClone(draft),referencePng=await styleReferencePng(exportStyleThreeViewSvg(d,true));if(signal.aborted)return;
    const next:Snapshot={id:crypto.randomUUID(),draft:d,referencePng,prompt:styleDesignImagePrompt(d,effect),model};setSnapshot(next);setJob(undefined);setStatus('正在提交三视图参考…');
    await poll(next.id,await call<ImageJob>('generate',{id:next.id,model,prompt:next.prompt,referencePng},signal),signal);
   })}>{snapshot?'用当前方案再测试':'将当前三视图送入森灵'}</button>
   {pending&&<button disabled={busy} onClick={()=>void run(async signal=>{await poll(snapshot!.id,await call<ImageJob>('status',{id:snapshot!.id},signal),signal);})}>查询这次测试</button>}
  </div>
  {status&&<p role="status" data-testid="style-design-image-status">{status}</p>}{error&&<p role="alert" className="company-error">{error}{pending?' 请查询这次测试，避免重复提交。':''}</p>}
  {snapshot&&<><p>{changed?'当前设计已修改；以下结果对应提交时方案。':'本次方案：'}{styleVariationSummary(snapshot.draft).join(' · ')||'母版设计'}</p><div className="company-senling-comparison"><figure><figcaption>提交的三视图参考</figcaption><img src={snapshot.referencePng} alt="提交到森灵的二维三视图"/></figure><figure><figcaption>森灵测试结果</figcaption>{job?.state==='done'?<img src={job.reference.imageUrl} alt="森灵三视图测试结果" referrerPolicy="no-referrer"/>:<p>{pending?'生成中 / 待查询':'未生成图片'}</p>}</figure></div>
   <details><summary>本次设计要求</summary><p>{snapshot.prompt}</p></details>
   <button onClick={()=>downloadText(JSON.stringify({schema:'garment-os/style-image-test/v1',id:snapshot.id,design:snapshot.draft,referencePng:snapshot.referencePng,prompt:snapshot.prompt,model:snapshot.model,result:job??{state:'unknown'},reviewStatus:'待人工检查',productionApproved:false},null,2),'三视图-森灵测试记录.json','application/json')}>下载本次测试记录</button>
  </>}
 </section>;
}
