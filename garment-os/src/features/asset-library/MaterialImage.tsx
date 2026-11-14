import { useEffect, useRef, useState } from 'react';
import type { ManagedMaterial } from '@/types/managed-material';

export function MaterialImage({material,onOpen,compact=false}:{material:ManagedMaterial;onOpen?:()=>void;compact?:boolean}){
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [retry,setRetry]=useState(0);
  const image=useRef<HTMLImageElement>(null);
  const name=material.materialName??material.materialCode??'面料';
  useEffect(()=>{const el=image.current;if(el?.complete&&el.naturalWidth>0)setState('ready');},[]);
  const content=<>
    {material.materialPic&&state!=='error'&&<img ref={image} key={retry} src={material.materialPic} alt={`${name} 来源图片`} referrerPolicy="no-referrer" loading="lazy" onLoad={()=>setState('ready')} onError={()=>setState('error')}/>}
    {(!material.materialPic||state!=='ready')&&<span className="managed-image-state">{!material.materialPic?'暂无来源图片':state==='error'?'图片加载失败':'图片加载中…'}</span>}
    {material.materialPic&&state==='ready'&&!compact&&<span className="managed-image-open">查看原图 ↗</span>}
  </>;
  return <div className={`managed-image${compact?' managed-image-compact':''}`} data-image-state={!material.materialPic?'missing':state}>
    {material.materialPic&&onOpen?<button type="button" className="managed-image-button" aria-label={`查看原图 ${material.materialCode??material.materialId}`} onClick={onOpen}>{content}</button>:content}
    {material.materialPic&&state==='error'&&<button type="button" className="managed-image-retry" onClick={()=>{setState('loading');setRetry(n=>n+1);}}>重试图片</button>}
  </div>;
}

export function MaterialImagePreview({material,onClose}:{material:ManagedMaterial;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [size,setSize]=useState<{width:number;height:number}|null>(null),[error,setError]=useState(false),[zoom,setZoom]=useState(0),[retry,setRetry]=useState(0);
  const src=material.materialPic;
  useEffect(()=>{const el=dialog.current,opener=document.activeElement;el?.showModal();return()=>{el?.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});};},[]);
  if(!src)return null;
  return <dialog ref={dialog} className="managed-image-dialog" aria-label="面料原图预览" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="managed-image-dialog-content"><header><div><h3>{material.materialName??'面料原图'}</h3><p>{material.materialCode??material.materialId} · {size?`${size.width} × ${size.height} 像素`:'来源图片'}</p></div><button autoFocus aria-label="关闭面料原图" onClick={onClose}>关闭 ×</button></header>
      <div className="managed-image-controls"><button aria-pressed={zoom===0} onClick={()=>setZoom(0)}>适合窗口</button>{[.5,1,2].map(n=><button key={n} disabled={!size||error} aria-pressed={zoom===n} onClick={()=>setZoom(n)}>{n*100}%</button>)}<a href={src} target="_blank" rel="noreferrer">打开来源原图 ↗</a></div>
      <div className={`managed-image-stage${zoom?' managed-image-actual':''}`} aria-busy={!size&&!error}>
        {error?<p role="alert">原图加载失败。<button onClick={()=>{setError(false);setRetry(n=>n+1);}}>重试图片</button></p>:<>{!size&&<span className="managed-image-loading">正在加载来源原图…</span>}<img key={retry} src={src} referrerPolicy="no-referrer" alt={`${material.materialName??'面料'} 原图`} style={zoom&&size?{width:size.width*zoom,height:size.height*zoom}:undefined} onLoad={e=>setSize({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} onError={()=>setError(true)}/></>}
      </div><footer>图片来自面料管理。缩放查看纹理；实际颜色、纹理比例与物性以面料实样为准。</footer>
    </div>
  </dialog>;
}
