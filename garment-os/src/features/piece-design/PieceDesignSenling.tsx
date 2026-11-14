import { useEffect,useRef,useState } from 'react';
import { IMAGE_MODELS,STYLE_IMAGE_API } from '@/application/style-image';
import type { ImageJob,ImageModel } from '@/application/style-image';
import { pieceDesignImagePrompt } from '@/application/piece-design';
import type { PieceDesignResult } from '@/application/piece-design';
import type { PieceImageEffect } from '@/types/piece-design';
import { styleReferencePng } from '@/features/company-design/style-image-reference';
import { downloadText } from '@/features/files/browser-files';
import { readConfiguration } from '@/application/design-document';

type Test={id:string;effect:PieceImageEffect;referencePng:string;prompt:string;model:ImageModel;composition:PieceDesignResult['metadata'];job?:ImageJob;error?:string};
const sessionKey='garment-os/piece-design-image-tests/v1';
function restore():Test[]{
  try{const raw:unknown=JSON.parse(sessionStorage.getItem(sessionKey)??'[]');if(!Array.isArray(raw)||raw.length>8)return [];
    return raw.filter((t):t is Test=>{
      if(!t||typeof t!=='object'||!/^[-0-9a-f]{36}$/i.test(t.id)||!['product','model'].includes(t.effect)||!IMAGE_MODELS.includes(t.model)||typeof t.referencePng!=='string'||t.referencePng.length>2800000||!t.referencePng.startsWith('data:image/png;base64,')||typeof t.prompt!=='string')return false;
      try{readConfiguration(t.composition?.configuration);}catch{return false;}
      return !t.job||['pending','failed'].includes(t.job.state)||(t.job.state==='done'&&typeof t.job.reference?.imageUrl==='string'&&/^https:\/\//.test(t.job.reference.imageUrl));
    });
  }catch{return [];}
}
async function request<T>(body:object,signal:AbortSignal):Promise<T>{const r=await fetch(STYLE_IMAGE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const v=await r.json();if(!r.ok)throw Error(v.error??'森灵请求未完成');return v as T;}
export function PieceDesignSenling({result}:{result?:PieceDesignResult}){
  const [effect,setEffect]=useState<PieceImageEffect>('product'),[model,setModel]=useState<ImageModel>('nano-banana-pro'),[tests,setTests]=useState<Test[]>(restore),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[storageError,setStorageError]=useState(false);
  const storageFailed=useRef(false);
  useEffect(()=>{try{sessionStorage.setItem(sessionKey,JSON.stringify(tests));storageFailed.current=false;}catch{storageFailed.current=true;}},[tests]);
  const active=useRef<AbortController|null>(null);useEffect(()=>()=>active.current?.abort(),[]);
  const update=(id:string,patch:Partial<Test>)=>setTests(items=>items.map(t=>t.id===id?{...t,...patch}:t));
  const pending=tests.find(t=>!t.job||t.job.state==='pending');
  async function run(task:(signal:AbortSignal)=>Promise<void>){if(active.current)return;const c=new AbortController();active.current=c;setBusy(true);setNotice('');try{await task(c.signal);}catch(e){if(!c.signal.aborted)setNotice(e instanceof Error?e.message:String(e));}finally{if(active.current===c){active.current=null;setBusy(false);}}}
  async function poll(test:Test,job:ImageJob,signal:AbortSignal){
    update(test.id,{job});const deadline=Date.now()+8*60000;
    while(job.state==='pending'&&!signal.aborted&&Date.now()<deadline){await new Promise(r=>setTimeout(r,5000));if(signal.aborted)return;job=await request<ImageJob>({action:'status',id:test.id},signal);update(test.id,{job});}
    if(!signal.aborted){setStorageError(storageFailed.current);setNotice(job.state==='done'?'已收到森灵图片，请核对款式、袋位、领口和袖型。':job.state==='failed'?'本次生成失败。':'仍在等待，请继续查询原任务。');}
  }
  return <section className="piece-senling" data-testid="piece-design-senling"><div className="piece-section-title"><div><h3>用这组裁片生成效果图</h3><p>上传正背侧三视图，锁定同一方案的轮廓、裁片配色与袋位。</p></div></div>
    <div className="piece-image-controls"><label>输出效果<select aria-label="裁片组合生成效果" value={effect} disabled={busy||!!pending} onChange={e=>setEffect(e.target.value as PieceImageEffect)}><option value="product">立体产品图</option><option value="model">模特穿着图</option></select></label><label>生图模型<select aria-label="裁片组合生图模型" value={model} disabled={busy||!!pending} onChange={e=>setModel(e.target.value as ImageModel)}>{IMAGE_MODELS.map(m=><option key={m}>{m}</option>)}</select></label>
    <button className="piece-primary" disabled={!result||busy||!!pending||tests.length>=8} onClick={()=>void run(async signal=>{
      const snapshot=structuredClone(result!);const referencePng=await styleReferencePng(snapshot.threeViewSvg);if(signal.aborted)return;
      const test:Test={id:crypto.randomUUID(),effect,referencePng,prompt:pieceDesignImagePrompt(snapshot,effect),model,composition:snapshot.metadata};
      // Persist the intent before sending a paid request. If storage is full,
      // nothing is submitted and refreshing cannot silently repeat the job.
      sessionStorage.setItem(sessionKey,JSON.stringify([...tests,test]));setTests(items=>[...items,test]);
      try{await poll(test,await request<ImageJob>({action:'generate',id:test.id,model,prompt:test.prompt,referencePng,aspectRatio:effect==='model'?'3:4':'4:5'},signal),signal);}catch(e){update(test.id,{error:e instanceof Error?e.message:String(e)});throw e;}
    })}>{busy?'森灵处理中…':'生成当前方案效果图'}</button>
    {pending&&<button disabled={busy} onClick={()=>void run(async signal=>{await poll(pending,await request<ImageJob>({action:'status',id:pending.id},signal),signal);})}>查询原任务</button>}
    </div>{notice&&<p role="status">{notice}</p>}
    <p className="piece-muted">本次默认表现棉感平纹针织效果，成分与克重待确认。图片用于设计评审；立体产品图是图片，不是可旋转的三维模型。模特图不代表实测合体或布料仿真。同一浏览器标签刷新可恢复测试记录；离开前仍应下载备份。本地任务保留30分钟，服务重启后须凭任务编号另行核查。</p>
    {storageError&&<p role="alert">本次结果未能保存在浏览器中，请立即下载测试记录。</p>}
    {tests.map(t=><article key={t.id} className="piece-image-test" data-effect={t.effect}><h4>{t.effect==='product'?'立体产品图':'模特穿着图'} · {t.job?.state==='done'?'已返回':'待确认'}</h4>
      {result&&JSON.stringify(t.composition.configuration)!==JSON.stringify(result.metadata.configuration)&&<p>当前裁片已修改；本图对应提交时的方案。</p>}
      <div className="piece-image-pair"><figure><figcaption>提交的裁片组合三视图</figcaption><img src={t.referencePng} alt="裁片组合三视图参考"/></figure><figure><figcaption>森灵生成结果</figcaption>{t.job?.state==='done'?<img src={t.job.reference.imageUrl} referrerPolicy="no-referrer" alt={t.effect==='product'?'森灵立体产品图':'森灵模特穿着图'}/>:<p>{t.error??'等待结果，请查询原任务，避免重复提交。'}</p>}</figure></div>
      <button onClick={()=>downloadText(JSON.stringify({schema:'garment-os/piece-design-image-test/v1',...t,reviewStatus:'待人工核对',productionApproved:false},null,2),`裁片组合-${t.effect}-${t.id}.json`,'application/json')}>下载本次测试记录</button><details><summary>设计要求</summary><p>{t.prompt}</p></details>
    </article>)}
  </section>;
}
