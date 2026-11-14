import { GRAPHIC_TECHNIQUES } from '@/application/graphic-techniques';
import type { GraphicTechnique } from '@/types/composition-elements';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { useCompositionUiStore } from '@/store/compositionUiStore';
import { compositionCatalogue, compositionMovable, compositionReplaceable, compositionSource, compositionStarter, replaceCompositionAsset, resolveCompositionPiece } from '@/application/composition-catalogue';
import type { CompositionAsset, CompositionCatalogue } from '@/application/composition-catalogue';
import { emptyPieceComposition } from '@/lib/pattern/piece-composition';
import type { CompositionPiece, CompositionPlan, CompositionView, PieceComposition } from '@/types/piece-composition';
import { CompositionCanvas } from './CompositionCanvas';
import { COMPOSITION_VIEWS, VIEW_LABELS } from './composition-views';
import { downloadText } from '@/features/files/browser-files';
import { downloadStylePng } from '@/features/company-design/style-image-reference';
import { CompositionElementPicker } from './CompositionElementPicker';
import type { CompositionGraphic } from '@/types/composition-elements';
import { accessoryScale } from './accessory-transform';
import './composition-editor.css';

const uid=()=>crypto.randomUUID();
function Numeric({label,value,min,max,step=1,onChange}:{label:string;value:number;min:number;max:number;step?:number;onChange:(n:number)=>void}){
 const [draft,setDraft]=useState(String(Number(value.toFixed(2)))),[error,setError]=useState(false);
 return <label>{label}<input aria-label={label} type="number" value={draft} min={min} max={max} step={step} aria-invalid={error} onChange={e=>{setDraft(e.target.value);setError(false);}} onBlur={()=>{const n=Number(draft);if(!draft.trim()||!Number.isFinite(n)||n<min||n>max){setError(true);return;}if(n!==Number(value.toFixed(2)))onChange(n);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>{error&&<small role="alert">请输入 {min}–{max}</small>}</label>;
}
export function CompositionEditor({onPaired,onReferences}: {onPaired:()=>void;onReferences?:()=>void}){
 const state=useDesignStore(),template=useCompositionUiStore(s=>s.templateId)??state.activePatternId;
 const [initial]=useState(()=>emptyPieceComposition(uid())),composition=state.pieceComposition??initial;
 const plan=composition.plans.find(p=>p.id===composition.activePlanId)!;
 const [selected,setSelected]=useState<string>(),[view,setView]=useState<CompositionView>('front'),[mode,setMode]=useState<'edit'|'compare'>('edit');
 const [grid,setGrid]=useState(true),[net,setNet]=useState(false),[filter,setFilter]=useState('all'),[error,setError]=useState('');
 const [compareView,setCompareView]=useState<CompositionView>('front');
 const canvasRef=useRef<HTMLDivElement>(null);
 const source=compositionSource(state.getConfiguration(),template),revision=JSON.stringify(source);
 const [reply,setReply]=useState<{revision:string;catalogue?:CompositionCatalogue;error?:string}>();
 const catalogue=reply?.revision===revision?reply.catalogue:undefined;
 const loading=reply?.revision!==revision;
 useEffect(()=>{useCompositionUiStore.getState().setActive(mode==='edit'&&!net);return()=>useCompositionUiStore.getState().setActive(false);},[mode,net]);
 useEffect(()=>{let live=true;const timer=setTimeout(()=>{try{const result=compositionCatalogue(JSON.parse(revision));if(live)setReply({revision,catalogue:result});}catch(e){if(live)setReply({revision,error:String(e)});}},30);return()=>{live=false;clearTimeout(timer);};},[revision]);
 const current=plan.pieces.find(p=>p.id===selected),graphic=plan.elements?.graphics.find(g=>g.id===selected);
 const selectedAsset=(()=>{if(!current)return;try{return resolveCompositionPiece(current);}catch{return undefined;}})();
 const movable=selectedAsset?compositionMovable(selectedAsset):false;
 function commit(next:PieceComposition){try{state.setPieceComposition(next);setError('');}catch(e){setError(String(e));}}
 function updatePlan(next:CompositionPlan){commit({...composition,plans:composition.plans.map(p=>p.id===next.id?next:p)});}
 function patch(p:CompositionPiece){updatePlan({...plan,pieces:plan.pieces.map(old=>old.id===p.id?p:old)});}
 function patchGraphic(graphic:CompositionGraphic){if(plan.elements)updatePlan({...plan,elements:{...plan.elements,graphics:plan.elements.graphics.map(g=>g.id===graphic.id?graphic:g)}});}
 const removeSelected=useCallback(()=>{
  const store=useDesignStore.getState(),c=store.pieceComposition,p=c?.plans.find(p=>p.id===c.activePlanId);
  if(!c||!p||p.id!==plan.id)return;
  const piece=p.pieces.find(p=>p.id===selected),logo=p.elements?.graphics.find(g=>g.id===selected);
  if(!logo&&(!piece||!compositionMovable(piece)))return;
  const next={...p,pieces:p.pieces.filter(p=>p.id!==selected),...(p.elements?{elements:{...p.elements,graphics:p.elements.graphics.filter(g=>g.id!==selected)}}:{})};
  try{store.setPieceComposition({...c,plans:c.plans.map(old=>old.id===p.id?next:old)});setSelected(undefined);setError('');}catch(e){setError(String(e));}
 },[selected,plan.id,setSelected,setError]);
 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{
   if(mode!=='edit'||net||event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
   const target=event.target;if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="dialog"],[role="alertdialog"]'))return;
   if(document.querySelector('dialog[open],[aria-modal="true"]'))return;
   if(event.key==='Escape'){setSelected(undefined);return;}
   if(event.key!=='Delete'||!selected)return;
   event.preventDefault();removeSelected();
  };
  window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
 },[mode,net,selected,removeSelected]);
 function scaleSelected(ratio:number){
  if(graphic){const size=accessoryScale(graphic.width,graphic.height,ratio,10,5,300,300);patchGraphic({...graphic,...size});}
  else if(current&&movable){const size=accessoryScale(current.widthMm,current.heightMm,ratio,1,1,3000,3000);patch({...current,widthMm:size.width,heightMm:size.height});}
 }
 function rotateSelected(delta:number){
  const angle=(rotation:number)=>((rotation+delta+180)%360+360)%360-180;
  if(graphic)patchGraphic({...graphic,rotation:angle(graphic.rotation??0)});else if(current&&movable)patch({...current,rotation:angle(current.rotation)});
 }
 function add(asset:CompositionAsset,cat=catalogue,target=view,x?:number,y?:number){if(!cat||net)return;
  const result=replaceCompositionAsset(plan,asset,cat,uid,target,x,y);
  updatePlan(result.plan);setSelected(result.selectedId);setMode('edit');
 }
 function starter(){try{
  const pieces=compositionStarter(source,uid);
  if(!plan.pieces.length)updatePlan({...plan,pieces});else {const id=uid();commit({...composition,activePlanId:id,plans:[...composition.plans,{id,name:`${source.templateId==='elastic-waist-pants'?'男裤':'短T'}起稿 ${composition.plans.length+1}`,pieces}]});}
  useCompositionUiStore.getState().selectTemplate(source.templateId);setSelected(undefined);setMode('edit');
 }catch(e){setError(String(e));}}
 function copyPlan(empty=false){const id=uid(),elements=!empty&&plan.elements?structuredClone(plan.elements):undefined;if(elements)elements.graphics=elements.graphics.map(g=>({...g,id:uid()}));commit({...composition,activePlanId:id,plans:[...composition.plans,{id,name:`方案 ${String(composition.plans.length+1).padStart(2,'0')}`,pieces:empty?[]:structuredClone(plan.pieces).map(p=>({...p,id:uid()})),...(elements?{elements}:{})}]});setSelected(undefined);setMode('edit');}
 function exportSvg(){const svg=canvasRef.current?.querySelector('svg')?.cloneNode(true) as SVGSVGElement|undefined;if(!svg)throw Error('请先打开编辑画布');svg.querySelectorAll('[data-editor-handle]').forEach(e=>e.remove());svg.querySelectorAll('[stroke="#ef5274"]').forEach(e=>e.setAttribute('stroke','none'));return new XMLSerializer().serializeToString(svg);}
 const filtered=catalogue?.assets.filter(a=>filter==='all'||a.role.startsWith(filter))??[];
 const mixed=new Set(plan.pieces.map(p=>p.source.templateId)).size>1,changed=plan.pieces.some(p=>{try{const a=resolveCompositionPiece(p);return Math.abs(a.widthMm-p.widthMm)>.01||Math.abs(a.heightMm-p.heightMm)>.01;}catch{return true;}});
 return <section className="piece-design-board composition-editor" data-testid="piece-design-board"><header className="piece-design-heading"><div><h2>裁片组合设计</h2><p>固定三视图 · 按部位替换 · 多方案比对</p></div><div className="piece-design-actions">
  <button className="piece-primary" data-testid="save-design-asset" disabled={mode==='compare'||!plan.pieces.length||state.isSaving} onClick={()=>{void state.saveDesign().catch(e=>setError(e instanceof Error?e.message:String(e)));}}>保存并沉淀资产</button><button onClick={onPaired}>配套尺寸与配缝</button><button data-workbench-export disabled={mode==='compare'||!plan.pieces.length} onClick={()=>{try{downloadText(exportSvg(),`${plan.name}-三视图.svg`,'image/svg+xml');}catch(e){setError(String(e));}}}>下载组合三视图</button>
  <button disabled={mode==='compare'||!plan.pieces.length} onClick={()=>{try{void downloadStylePng(exportSvg(),`${plan.name}-三视图.png`).catch(e=>setError(String(e)));}catch(e){setError(String(e));}}}>下载参考 PNG</button>
 </div></header><div className="composition-toolbar"><div className="composition-plan-tabs">{composition.plans.map(p=><button key={p.id} aria-pressed={mode==='edit'&&p.id===plan.id} onClick={()=>{commit({...composition,activePlanId:p.id});setSelected(undefined);setMode('edit');}}>{p.name}<span>{p.pieces.length}</span></button>)}</div><button disabled={composition.plans.length>=12} onClick={()=>copyPlan(true)}>＋ 空白方案</button><button disabled={composition.plans.length>=12} onClick={()=>copyPlan()}>复制改款</button><button aria-pressed={mode==='compare'} disabled={composition.plans.length<2} onClick={()=>{setSelected(undefined);setMode(mode==='compare'?'edit':'compare');}}>{mode==='compare'?'返回编辑':'并排比对'}</button></div>
 <div className="composition-layout"><main className="composition-main">
  {(error||reply?.revision===revision&&reply.error)&&<p role="alert" className="piece-error">{error||reply?.error}</p>}
  {mode==='compare'?<><div className="composition-canvas-toolbar"><div>{COMPOSITION_VIEWS.map(v=><button key={v} aria-pressed={compareView===v} onClick={()=>setCompareView(v)}>比对{VIEW_LABELS[v]}</button>)}</div></div><div className="composition-comparison" data-testid="composition-comparison">{composition.plans.map(p=><article key={p.id}><header><div><strong>{p.name}</strong><span>{p.pieces.length} 片 · 同视角同缩放</span></div><button onClick={()=>{commit({...composition,activePlanId:p.id});setMode('edit');setSelected(undefined);}}>继续编辑</button></header><CompositionCanvas plan={p} showGrid={false} focusView={compareView}/></article>)}</div></>:<>
   <div className="composition-canvas-toolbar"><div>{COMPOSITION_VIEWS.map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>附件放置：{VIEW_LABELS[v]}</button>)}</div><div><button aria-pressed={grid} onClick={()=>setGrid(!grid)}>网格</button><button aria-pressed={net} onClick={()=>{setNet(!net);setSelected(undefined);}}>{net?'返回款式片':'查看源净样'}</button></div></div>
   {!plan.pieces.length&&<div className="composition-start"><div><strong>选择改款元素，即可开始设计</strong><p>{template==='elastic-waist-pants'?'腰头、裤腿比例、袋型、撞色、Logo与面料按需组合，三视图固定呈现。':'肩袖、领型、撞色、Logo与面料按需组合，三视图固定呈现。'}</p></div><button className="piece-primary" onClick={starter}>{template==='elastic-waist-pants'?'从男士松紧腰直筒裤起稿':'从男士短T起稿'}</button></div>}
   {!net&&<CompositionElementPicker key={plan.id} plan={plan} plans={composition.plans} onReferences={onReferences} onCreatePlans={newPlans=>{if(composition.plans.length+newPlans.length>12){setError('每个设计最多12个方案');return;}commit({...composition,activePlanId:newPlans[0]?.id??plan.id,plans:[...composition.plans,...newPlans]});setSelected(undefined);}} onCreatePlan={p=>{if(composition.plans.length>=12){setError('每个设计最多12个方案');return;}commit({...composition,activePlanId:p.id,plans:[...composition.plans,p]});setSelected(undefined);setMode('edit');}} source={source} view={view} onChange={updatePlan} onSelectGraphic={setSelected} onError={setError}/> }
   {net&&<p className="composition-preview-note" role="status">源净样仅用于查看参考；返回款式片后可编辑口袋、Logo和改款元素。</p>}
   {!net&&(graphic||current&&movable)&&<div className="composition-accessory-toolbar" role="toolbar" aria-label="附件调整"><strong>{graphic?'Logo / 图案':current?.name}</strong><div><button aria-label="缩小所选附件" onClick={()=>scaleSelected(1/1.1)}>− 缩小</button><button aria-label="放大所选附件" onClick={()=>scaleSelected(1.1)}>＋ 放大</button><button aria-label="向左旋转15度" onClick={()=>rotateSelected(-15)}>↶ 15°</button><button aria-label="向右旋转15度" onClick={()=>rotateSelected(15)}>↷ 15°</button><button className="composition-delete" aria-label="删除所选附件" onClick={removeSelected}>删除 <kbd>Del</kbd></button></div><small>拖角点缩放 · 拖圆柄旋转</small></div>}
   <div ref={canvasRef} className="composition-stage"><CompositionCanvas plan={plan} selected={net?undefined:selected} showGrid={grid} showNet={net} onDeselect={()=>setSelected(undefined)} onSelect={id=>{setSelected(id);const p=plan.pieces.find(p=>p.id===id);if(p)setView(p.view);}} onSelectGraphic={setSelected} onChangeGraphic={net?undefined:patchGraphic} onChange={net?undefined:patch} onDrop={(templateId,assetKey,target,x,y)=>{try{const cat=compositionCatalogue(compositionSource(state.getConfiguration(),templateId));if(assetKey){const a=cat.assets.find(a=>a.key===assetKey);if(!a)throw Error('裁片不存在');add(a,cat,target,x,y);}else {useCompositionUiStore.getState().selectTemplate(templateId);setView(target);}}catch(e){setError(String(e));}}}/></div>
   <div className="composition-caption"><span>{template==='elastic-waist-pants'?'三视图固定 · 腰头与裤片按锚点替换 · Logo可定位':'三视图固定 · 口袋与Logo可定位 · 结构变化联动衣身与袖片'}</span><span>{mixed?'跨模板组合':changed?'尺寸已改款':'创意组合'} · 制版待核对</span></div>
   <details className="composition-source-catalogue"><summary>制版参考 · 模板裁片明细</summary><section className="composition-picker" aria-label="模板裁片选择"><header><div><h3>{catalogue?.name??'模板裁片'}</h3><p>源裁片用于尺寸与配套核对；创意改款请使用上方设计元素。</p></div>{plan.pieces.length>0&&<button disabled={net||composition.plans.length>=12} onClick={starter}>另起{template==='elastic-waist-pants'?'男裤':'短T'}方案</button>}</header>
    <div className="composition-filters">{[['all','全部'],['body','衣身'],['sleeve','袖片'],['collar','领片'],['binding','领条 / 包边'],['pocket','口袋'],['hood','帽片'],['cuff','袖口']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    {loading?<p role="status">正在读取模板裁片…</p>:<div className="composition-assets">{filtered.map(a=><button key={a.key} className="composition-asset" data-composition-asset={a.key} disabled={net||!compositionReplaceable(a)} title={compositionReplaceable(a)?undefined:'保留源净样查看；成衣三视图映射尚未接通'} draggable={!net&&compositionReplaceable(a)} onDragStart={e=>{e.dataTransfer.setData('application/x-garment-template',template);e.dataTransfer.setData('application/x-garment-piece',a.key);e.dataTransfer.effectAllowed='copy';}} onClick={()=>add(a)}>
     <svg viewBox={`${a.artBounds.x-.02*a.artBounds.width} ${a.artBounds.y-.02*a.artBounds.height} ${a.artBounds.width*1.04} ${a.artBounds.height*1.04}`} style={{color:'#dce3dd'}}><g dangerouslySetInnerHTML={{__html:a.markup}}/></svg><strong>{a.name}</strong><span>{Math.round(a.widthMm)} × {Math.round(a.heightMm)} mm</span><small>{!compositionReplaceable(a)?'源净样 · 待款式映射':compositionMovable(a)?`＋ 加入口袋 · ${VIEW_LABELS[view]}`:'替换对应部位'}</small></button>)}</div>}
    {!loading&&!filtered.length&&<p className="piece-muted">此模板暂无这类裁片，选择其他分类或左侧模板。</p>}
   </section></details></>}
 </main><aside className="composition-inspector">{mode==='compare'?<div className="composition-selection-hint"><strong>同视角方案比对</strong><p>比对时保留各方案内容，点击方案上的“继续编辑”后再调整。</p><button onClick={()=>{setMode('edit');setSelected(undefined);}}>编辑当前方案</button></div>:net?<div className="composition-selection-hint"><strong>源净样参考</strong><p>当前仅预览来源裁片，不修改成衣款式。</p><button onClick={()=>setNet(false)}>回到改款编辑</button></div>:<><label>当前方案名称<input aria-label="自由组合方案名称" key={plan.id+plan.name} defaultValue={plan.name} maxLength={100} onBlur={e=>{if(e.target.value.trim()&&e.target.value!==plan.name)updatePlan({...plan,name:e.target.value.trim()});}}/></label>
  {graphic?<><div className="composition-selected-heading"><h3>Logo / 图案</h3><span>{graphic.kind==='image'?'上传素材':'可编辑通用图形'}</span></div>{graphic.kind!=='image'&&<label>文字<input aria-label="Logo文字" key={graphic.id+graphic.text} defaultValue={graphic.text} maxLength={40} onBlur={e=>{const text=e.target.value.trim();if(text&&text!==graphic.text)patchGraphic({...graphic,text});else e.target.value=graphic.text;}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>}<label>加工工艺意向<select aria-label="Logo加工工艺" value={graphic.technique??'artwork'} onChange={event=>patchGraphic({...graphic,technique:event.target.value as GraphicTechnique})}>{GRAPHIC_TECHNIQUES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><small>登记工艺意向，图形保留原稿；需工艺打样。</small></label><label>所在视图<select aria-label="Logo所在视图" value={graphic.view} onChange={e=>patchGraphic({...graphic,view:e.target.value as CompositionView})}>{COMPOSITION_VIEWS.map(v=><option key={v} value={v}>{VIEW_LABELS[v]}</option>)}</select></label><div className="composition-input-pair">{[['Logo宽度','width',10,300],['Logo高度','height',5,300],['Logo水平位置','x',0,500],['Logo垂直位置','y',65,700],['Logo旋转角度 °','rotation',-360,360]].map(([label,key,min,max])=><Numeric key={`${graphic.id}/${key}/${graphic[key as 'x']}`} label={String(label)} value={graphic[key as 'x']??0} min={Number(min)} max={Number(max)} onChange={n=>patchGraphic({...graphic,[key]:n})}/>)}</div>{graphic.kind!=='image'&&<label>Logo配色<input type="color" aria-label="Logo配色" value={graphic.color} onChange={e=>patchGraphic({...graphic,color:e.target.value})}/></label>}<div className="composition-piece-actions">{([['left-chest','左胸',315,270],['centre','前胸居中',250,305],['upper-back','后背上方',250,230]] as const).map(([id,label,x,y])=><button key={id} onClick={()=>patchGraphic({...graphic,x,y,view:id==='upper-back'?'back':'front'})}>{label}</button>)}<button onClick={()=>{if(plan.elements){const g={...structuredClone(graphic),id:uid(),y:Math.min(700,graphic.y+35)};updatePlan({...plan,elements:{...plan.elements,graphics:[...plan.elements.graphics,g]}});setSelected(g.id);}}} disabled={(plan.elements?.graphics.length??0)>=12}>复制Logo</button><button className="composition-delete" onClick={removeSelected}>删除Logo</button></div></>:current&&selectedAsset?<><div className="composition-selected-heading"><h3>{current.name}</h3><span>{current.source.templateId} · {current.source.standardSize}</span></div><label>裁片名称<input aria-label="选中裁片名称" key={current.id+current.name} defaultValue={current.name} onBlur={e=>{if(e.target.value.trim())patch({...current,name:e.target.value.trim()});}}/></label>
   {movable?<label>所在视图<select aria-label="裁片所在视图" value={current.view} onChange={e=>patch({...current,view:e.target.value as CompositionView})}>{COMPOSITION_VIEWS.map(v=><option key={v} value={v}>{VIEW_LABELS[v]}</option>)}</select></label>:<p className="composition-source-note" data-testid="fixed-placement-note">{VIEW_LABELS[current.view]} · 固定部位，替换后自动落位</p>}
   <div className="composition-input-pair">{[['宽度 mm','widthMm',1,3000],['高度 mm','heightMm',1,3000],...(movable?[['水平位置','x',-1000,1500],['垂直位置','y',-1000,1800],['旋转角度 °','rotation',-360,360]]:[])].map(([label,key,min,max])=><Numeric key={`${current.id}/${key}/${current[key as keyof CompositionPiece]}`} label={String(label)} value={current[key as 'x']} min={Number(min)} max={Number(max)} step={key==='rotation'?1:.1} onChange={value=>patch({...current,[key]:value})}/>)}</div>
   <label>裁片配色<input type="color" aria-label="选中裁片配色" value={current.color} onChange={e=>patch({...current,color:e.target.value})}/></label>
   <div className="composition-piece-actions">{movable&&<><button onClick={()=>patch({...current,mirrored:!current.mirrored})} aria-pressed={current.mirrored}>水平镜像</button><button onClick={()=>{const p={...current,id:uid(),x:Math.min(1500,current.x+24),y:Math.min(1800,current.y+24)};updatePlan({...plan,pieces:[...plan.pieces,p]});setSelected(p.id);}}>复制裁片</button><button onClick={()=>updatePlan({...plan,pieces:[...plan.pieces.filter(p=>p.id!==current.id),current]})}>置于顶层</button><button onClick={()=>updatePlan({...plan,pieces:[current,...plan.pieces.filter(p=>p.id!==current.id)]})}>置于底层</button></>}<button onClick={()=>patch({...current,widthMm:selectedAsset.widthMm,heightMm:selectedAsset.heightMm})}>恢复源尺寸</button>{movable&&<button className="composition-delete" onClick={removeSelected}>删除裁片</button>}</div>
   <p className="composition-source-note">{selectedAsset.netReferenceAvailable===false?'设计尺寸':'源净样'} {selectedAsset.widthMm.toFixed(1)} × {selectedAsset.heightMm.toFixed(1)} mm。{selectedAsset.netReferenceAvailable===false?'设计轮廓，尚无配套净样。':selectedAsset.illustration?'款式片按公司稿比例呈现，尺寸调整按源净样比例联动。':'按源净样展开显示。'}{movable?'口袋位置为画布坐标。':'结构裁片保持固定连接位置。'}跨模板组合及缩放后需重新制版核对。</p>
  </>:<div className="composition-selection-hint"><strong>当前设计</strong><p>{plan.elements?`${{'set-in':'装袖',raglan:'插肩',drop:'落肩'}[plan.elements.shoulder]} · ${({crew:'圆领',v:'V领',henley:'亨利领',polo:'Polo领',stand:'立领'}[plan.elements.neckline])} · ${plan.elements.graphics.length} 个Logo`:template==='elastic-waist-pants'?'男裤 · 从裤型与腰头开始组合':'男士短T · 从改款元素开始组合'}</p><p>{template==='elastic-waist-pants'?'使用上方裤型 / 腰头、Logo和面料选项；结构袋型与门襟待补同源素材。':'使用上方元素调整结构、撞色与面料，选中口袋或Logo可进一步定位。'}</p></div>}
  <details className="composition-layer-details"><summary>部位细节 · {plan.pieces.length}</summary><div className="composition-layers">{!plan.pieces.length&&<p>选择改款元素，或使用短T起稿。</p>}{plan.pieces.slice().reverse().map(p=><div key={p.id} data-layer-id={p.id} className={selected===p.id?'selected':''}><button aria-label={`${p.visible?'隐藏':'显示'}${p.name}`} onClick={()=>patch({...p,visible:!p.visible})}>{p.visible?'◉':'○'}</button><button onClick={()=>{setSelected(p.id);setView(p.view);}}><strong>{p.name}</strong><span>{VIEW_LABELS[p.view]} · {Math.round(p.widthMm)}×{Math.round(p.heightMm)}</span></button></div>)}</div></details>
  {composition.plans.length>1&&<button className="composition-remove-plan" onClick={()=>{const plans=composition.plans.filter(p=>p.id!==plan.id);commit({...composition,activePlanId:plans[0].id,plans});setSelected(undefined);}}>删除当前方案</button>}
  <p className="composition-save-note">随顶部 Save 保存 · 支持撤销与重做</p></>}
 </aside></div></section>;
}
