import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { GarmentViewport } from './GarmentViewport';
import { fabricTile,readGarmentTexture } from './garment-material';
import { fitGarmentCamera,pickGarment } from '@/lib/pattern/mesh/garment-view';
import { DEFAULT_GARMENT_SURFACE } from '@/lib/pattern/mesh/garment-surface';
import { createFinishedGarment } from '@/lib/pattern/mesh/garment-finish';
import { DEFAULT_GARMENT_FINISH,validateGarmentFinish } from '@/lib/pattern/mesh/garment-finish-plan';
import { exportGarmentTechnicalSvg } from '@/lib/pattern/mesh/garment-technical-view';
import { GarmentTechnicalViews } from './GarmentTechnicalViews';
import { GarmentFashionSheet } from './GarmentFashionSheet';
import { GarmentFinishControls } from './GarmentFinishControls';
import { exportGarmentGltf } from '@/lib/pattern/mesh/garment-gltf';
import { downloadText } from '@/features/files/browser-files';
import type { GarmentAppearance,GarmentAssembly3d } from '@/types/garment3d';
import type { PatternMesh3d } from '@/types/pattern3d';
import type { GarmentJob,GarmentReply } from '@/application/garment-assembly-job';
import type { PhysicalCamera,ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import type { BodyMeasurements,GenderType,StandardSize } from '@/types/measurements';
import type { MannequinSpec } from '@/types/mannequin';
import { GarmentSimulationControls } from './GarmentSimulationControls';
import { DEFAULT_GARMENT_SIMULATION, type GarmentSimulationSettings } from './garment-simulation';
import { getPatternCapabilityReport } from '@/application/capability-status';

let sequence=0;
type AvatarMode='real-human'|'parametric'|'off';
type AppearanceProps={appearance:GarmentAppearance;onAppearance:(next:Partial<GarmentAppearance>)=>void};
export function GarmentAssemblyPanel({source,revision,appearance,onAppearance,measurements,gender,standardSize}:AppearanceProps&{source:PatternMesh3d;revision:string;measurements:BodyMeasurements;gender:GenderType;standardSize:StandardSize}){
  const [reply,setReply]=useState<GarmentReply|null>(null);
  useEffect(()=>{
    let active=true,worker:Worker|undefined;const requestId=++sequence;
    try{worker=new Worker(new URL('./garment.worker.ts',import.meta.url),{type:'module'});worker.onmessage=(event:MessageEvent<GarmentReply>)=>{if(active&&event.data.requestId===requestId&&event.data.revision===revision)setReply(event.data);};worker.onerror=()=>{if(active)setReply({requestId,revision,error:'成衣组装计算失败，请重试。'});};worker.postMessage({requestId,revision,model:source} satisfies GarmentJob);}
    catch{queueMicrotask(()=>{if(active)setReply({requestId,revision,error:'此环境无法启动成衣后台计算。'});});}
    return()=>{active=false;worker?.terminate();};
  },[source,revision]);
  const current=reply?.revision===revision?reply:null;
  if(!current)return <div className="mesh-empty-state" role="status"><h3>正在组装三维成衣</h3><p>生成内部网格、连接肩缝与侧缝、缝合袖片、计算曲面和贴图坐标…</p></div>;
  if(current.error)return <div className="mesh-empty-state" role="alert"><h3>此款成衣组装未完成</h3><p>{current.error}</p><p>可切换顶部 Brian 基型或包边背心范例，或进入裁片检查查看当前源图纸。</p></div>;
  return 'model' in current?<GarmentScene key={revision} source={source} model={current.model} appearance={appearance} onAppearance={onAppearance} measurements={measurements} gender={gender} standardSize={standardSize}/>:null;
}

function GarmentScene({source,model,appearance,onAppearance,measurements,gender,standardSize}:AppearanceProps&{source:PatternMesh3d;model:GarmentAssembly3d;measurements:BodyMeasurements;gender:GenderType;standardSize:StandardSize}){
  const surfaceSettings=appearance.surface??DEFAULT_GARMENT_SURFACE,finishSettings=appearance.finish??DEFAULT_GARMENT_FINISH,companyMasterId=appearance.companyMasterId,display=useMemo(()=>createFinishedGarment(model,{surface:surfaceSettings,finish:finishSettings,companyMasterId}),[model,surfaceSettings,finishSettings,companyMasterId]);
  const capabilities=useMemo(()=>getPatternCapabilityReport(source,model),[source,model]);
  const [technical,setTechnical]=useState(true),[fashionSheet,setFashionSheet]=useState(false),[avatarMode,setAvatarMode]=useState<AvatarMode>('real-human'),[avatarStatus,setAvatarStatus]=useState<'loading'|'ready'|'error'|'parametric'|'unsupported'>('loading'),[simulation,setSimulation]=useState<GarmentSimulationSettings>(DEFAULT_GARMENT_SIMULATION);
  const showMannequin=avatarMode!=='off';
  const mannequin=useMemo<MannequinSpec|undefined>(()=>showMannequin?{enabled:true,mode:avatarMode==='real-human'?'real-human':'parametric',gender,standardSize,measurements,clearanceMm:8}:undefined,[showMannequin,avatarMode,gender,standardSize,measurements]);
  const [size,setSize]=useState<ViewportSize>({width:900,height:650,dpr:1}),[camera,setCamera]=useState<PhysicalCamera>(()=>fitGarmentCamera(display,{width:900,height:650,dpr:1},25,8,mannequin)),[selected,setSelected]=useState(model.surfaces[0].id),[wire,setWire]=useState(false),[error,setError]=useState(''),[pick,setPick]=useState('');
  const [material,setMaterial]=useState<{tile:HTMLCanvasElement;url:string}|null>(null),[image,setImage]=useState<HTMLImageElement|null>(null),[uploading,setUploading]=useState(false);
  const first=useRef(true),uploadGeneration=useRef(0);
  const updateSize=useCallback((next:ViewportSize)=>{setSize(old=>old.width===next.width&&old.height===next.height&&old.dpr===next.dpr?old:next);if(first.current){first.current=false;setCamera(c=>fitGarmentCamera(display,next,c.yawDeg,c.tiltDeg,mannequin));}},[display,mannequin]);
  useEffect(()=>{let active=true;try{const tile=fabricTile({color:appearance.color,fabric:appearance.fabric}),url=tile.toDataURL('image/png');queueMicrotask(()=>{if(active)setMaterial({tile,url});});}catch{queueMicrotask(()=>{if(active)setError('面料图案生成失败');});}return()=>{active=false;};},[appearance.color,appearance.fabric]);
  useEffect(()=>{let active=true;if(!appearance.imageDataUrl){queueMicrotask(()=>{if(active)setImage(null);});return()=>{active=false;};}const next=new Image();next.onload=()=>{if(active)setImage(next);};next.onerror=()=>{if(active){setError('本地图案解码失败');setImage(null);}};next.src=appearance.imageDataUrl;return()=>{active=false;};},[appearance.imageDataUrl]);
  useEffect(()=>()=>{uploadGeneration.current++;},[]);
  const update=(patch:Partial<GarmentAppearance>)=>onAppearance(patch);
  const toggleMannequin=(enabled:boolean)=>{const nextMode:AvatarMode=enabled?(avatarMode==='off'?'real-human':avatarMode):'off';setAvatarMode(nextMode);const next=nextMode==='off'?undefined:{enabled:true,mode:(nextMode==='real-human'?'real-human':'parametric') as 'real-human'|'parametric',gender,standardSize,measurements,clearanceMm:8};setCamera(c=>fitGarmentCamera(display,size,c.yawDeg,c.tiltDeg,next));};
  const avatarStatusText=avatarMode==='real-human'
    ? avatarStatus==='ready'?'通用人体 GLB · Xbot · 参考模型':avatarStatus==='error'?'通用人体 GLB 加载失败 · 参考模型':avatarStatus==='unsupported'?'兼容模式不支持人体 GLB':'通用人体 GLB 加载中… · 参考模型'
    : avatarMode==='parametric'?'参数化人体 · 比例人台 · 仅用于版型比例':'人体模型已隐藏';
  return <>
    <div className="mesh-command-bar"><div className="mesh-tool-group"><button onClick={()=>setCamera(c=>fitGarmentCamera(display,size,c.yawDeg,c.tiltDeg,mannequin))}>适配成衣+人体</button><button onClick={()=>setCamera(fitGarmentCamera(display,size,0,0,mannequin))}>成衣正面</button><button onClick={()=>setCamera(fitGarmentCamera(display,size,180,0,mannequin))}>成衣背面</button><button onClick={()=>setCamera(fitGarmentCamera(display,size,90,0,mannequin))}>成衣侧面</button><button aria-pressed={technical} onClick={()=>setTechnical(v=>!v)}>二维三视图</button><button onClick={()=>setFashionSheet(true)}>前后款式稿</button></div><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>曲面网格</label><label><input data-testid="toggle-mannequin" type="checkbox" checked={showMannequin} onChange={e=>toggleMannequin(e.target.checked)}/>显示人体模型</label><label className="mesh-avatar-mode">人体模型模式<select aria-label="人体模型模式" value={avatarMode} onChange={e=>{const next=e.target.value as AvatarMode;setAvatarMode(next);const spec=next==='off'?undefined:{enabled:true,mode:(next==='real-human'?'real-human':'parametric') as 'real-human'|'parametric',gender,standardSize,measurements,clearanceMm:8};setCamera(c=>fitGarmentCamera(display,size,c.yawDeg,c.tiltDeg,spec));}}><option value="real-human">通用人体 GLB（参考）</option><option value="parametric">比例人台</option><option value="off">隐藏人体</option></select></label><span className="mesh-simulation-toolbar-state" data-testid="simulation-toolbar-state">{simulation.state==='preview'?'仿真预览配置':'静态版型预览'}</span><span className="mesh-command-spacer"/><button onClick={()=>downloadText(exportGarmentTechnicalSvg(display),`${model.templateId}-成衣三视图.svg`,'image/svg+xml')}>导出三视图</button><button disabled={!material} onClick={()=>{if(material)try{downloadText(exportGarmentGltf(model,appearance,material.url),`${model.templateId}-三维成衣.gltf`,'model/gltf+json');setError('');}catch(e){setError(String(e));}}}>导出成衣与贴图</button></div>
    <div className="mesh-workbench-body" data-testid="garment-scene"><div className="mesh-stage"><div className="mesh-viewport-label" style={{background:'#25262ad9',padding:'9px 12px',borderRadius:5}}><strong>{display.illustration?.sourceStyleCode?`公司母版 ${display.illustration.sourceStyleCode}`:'成衣示意'} · 三视图联动</strong><span>{model.surfaces.length} 片衣身袖片 / {display.finishPlan?.neckband?'另含领条工艺草案':'工艺示例'}</span><span>{companyMasterId?'公司图稿比例 · 参考裁片坐标 · 非同款毫米净样':'可旋转 · 可贴图 · 源裁片关联'}</span></div>
      {material?<GarmentViewport model={display} camera={camera} size={size} wire={wire} selected={selected} appearance={appearance} tile={material.tile} tileUrl={material.url} image={image} mannequin={mannequin} onAvatarStatus={setAvatarStatus} onSize={updateSize}
        onOrbit={(dx,dy)=>setCamera(c=>({...c,yawDeg:c.yawDeg+dx*.4,tiltDeg:Math.max(-85,Math.min(85,c.tiltDeg+dy*.4))}))}
        onPan={(dx,dy)=>setCamera(c=>({...c,panCss:[c.panCss[0]+dx,c.panCss[1]+dy]}))}
        onZoom={factor=>setCamera(c=>({...c,pixelsPerMm:Math.max(.03,Math.min(15,c.pixelsPerMm*factor))}))}
        onPick={point=>{const hit=pickGarment(display,camera,size,point);if(hit){const surface=display.surfaces.find(s=>s.id===hit.id)!;setSelected(surface.sourceSurfaceId);setPick(surface.detail?`${surface.detail.label} · 工艺 ${surface.detail.operationId} · ${surface.detail.coordinateSpace==='cut-piece-mm'?'领条裁片毫米坐标':'线迹/折边路径参数，非裁片坐标'}`:`${surface.sourceSurfaceId} · ${surface.layer==='rim'?'布厚边缘':surface.layer==='inner'?'内面':'外面'} · 展开 [${hit.uvMm.map(v=>v.toFixed(2)).join(', ')}] · 原始 CAD [${hit.sourceMm.map(v=>v.toFixed(2)).join(', ')}] mm`);}}}/>:<div className="mesh-empty-state">正在准备材质…</div>}
      {technical&&<GarmentTechnicalViews model={display} onView={yaw=>setCamera(fitGarmentCamera(display,size,yaw,0))} onExpand={()=>setFashionSheet(true)}/>}
    </div><aside className="mesh-inspector" aria-label="成衣材质与映射">
      <section className="mesh-inspector-section" data-testid="capability-status"><h4>当前能力边界</h4><ul className="mesh-capability-list">{Object.values(capabilities).map(cap=><li key={cap.label}><strong>{cap.label}</strong><span>{cap.reason}</span></li>)}</ul></section>
      <GarmentSimulationControls settings={simulation} setSettings={setSimulation} mannequinVisible={showMannequin}/>
      {display.finishPlan&&<GarmentFinishControls templateId={model.templateId} plan={display.finishPlan} onChange={finish=>{try{validateGarmentFinish(finish);update({finish});setError('');}catch(e){setError(String(e));}}}/>}
      <section className="mesh-inspector-section"><h4>表面与边缘</h4>
        <label className="mesh-field">曲面精细度<select aria-label="成衣曲面精细度" value={surfaceSettings.subdivision} onChange={e=>update({surface:{...surfaceSettings,subdivision:Number(e.target.value) as 0|1|2}})}><option value="0">原始网格</option><option value="1">平滑细分</option><option value="2">高精细分</option></select></label>
        <label className="mesh-field">显示布厚 mm<input aria-label="成衣显示布厚 mm" type="number" min="0" max="5" step="0.1" defaultValue={surfaceSettings.thicknessMm} onBlur={e=>{const n=Number(e.target.value);if(e.target.value.trim()&&n>=0&&n<=5)update({surface:{...surfaceSettings,thicknessMm:n}});else e.currentTarget.value=String(surfaceSettings.thicknessMm);}}/></label>
        <label><input aria-label="成衣开口圆角" type="checkbox" checked={surfaceSettings.roundedEdges} onChange={e=>update({surface:{...surfaceSettings,roundedEdges:e.target.checked}})}/>领口、袖口与下摆布厚圆角</label>
        <p data-testid="garment-surface-summary">共缝平滑 · {display.metrics.renderTriangles.toLocaleString()} 个显示三角面 · {surfaceSettings.thicknessMm>0?'内外面与边缘侧壁':'单层曲面'}</p>
        <p>示意曲面经过整形以消除僵硬尖折，领条与折边由上方工艺设定生成；用于款式表达，面料碰撞与试衣未标定。</p>{showMannequin&&<p data-testid="mannequin-status">{avatarStatusText} · {gender==='female'?'女':'男'}款 {standardSize}；不代表公司人体扫描，也不等于碰撞、垂坠或真人合体验证。</p>}
        <small>示意整形相对源配缝模型最大移动 {display.illustration?.maxDisplacementMm.toFixed(1)} mm；后续细分相对整形控制网格再移动最多 {display.metrics.maxControlDisplacementMm.toFixed(2)} mm。该数值用于说明显示调整，不是生产公差；二维CAD保留原值。</small>
      </section>
      <section className="mesh-inspector-section"><h4>面料与底色</h4><label className="mesh-field">成衣底色<input aria-label="成衣底色" type="color" value={appearance.color} onChange={e=>update({color:e.target.value})}/></label>
        <label className="mesh-field">面料图案<select aria-label="成衣面料图案" value={appearance.fabric} onChange={e=>update({fabric:e.target.value as GarmentAppearance['fabric']})}><option value="solid">纯色</option><option value="stripe">条纹</option><option value="plaid">格纹</option><option value="denim">斜纹</option><option value="checker">UV 检查格</option></select></label>
        <label className="mesh-field">循环单元 mm<input aria-label="图案单元 mm" type="number" min="10" max="500" defaultValue={appearance.repeatMm} onBlur={e=>{const n=Number(e.target.value);if(n>=10&&n<=500)update({repeatMm:n});else e.currentTarget.value=String(appearance.repeatMm);}}/></label><small>按原裁片毫米坐标重复；曲面形变会影响表观尺寸。</small>
      </section>
      <section className="mesh-inspector-section"><h4>图案与印花</h4><label className="garment-upload">{uploading?'正在读取图案…':'上传本地图案'}<input aria-label="上传成衣贴图" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const generation=++uploadGeneration.current;setUploading(true);try{const imageDataUrl=await readGarmentTexture(file);if(generation===uploadGeneration.current){update({imageDataUrl});setError('');}}catch(error){if(generation===uploadGeneration.current)setError(String(error));}finally{if(generation===uploadGeneration.current)setUploading(false);}}}/></label>
        <p>PNG / JPEG / WebP，最大10MB、边长4096px。图片在本机预览，导出时嵌入文件。</p>
        {appearance.imageDataUrl&&<><img className="garment-texture-thumb" src={appearance.imageDataUrl} alt="当前成衣贴图"/><button onClick={()=>update({imageDataUrl:undefined})}>移除上传图案</button></>}
        <label className="mesh-field">贴图方式<select aria-label="成衣贴图方式" value={appearance.imageMode} onChange={e=>update({imageMode:e.target.value as 'repeat'|'print'})}><option value="repeat">满幅循环</option><option value="print">单幅铺满裁片</option></select></label>
        <label className="mesh-field">应用位置<select aria-label="成衣贴图位置" value={appearance.imageTarget} onChange={e=>update({imageTarget:e.target.value as 'all'|'front'})}><option value="all">所有组装裁片</option><option value="front">仅前衣身</option></select></label>
        <label className="mesh-field">图案方向<select aria-label="成衣图案方向" value={appearance.rotationDeg} onChange={e=>update({rotationDeg:Number(e.target.value)})}><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>
      </section>
      <section className="mesh-inspector-section"><h4>已组装裁片</h4><div data-testid="garment-assembly-summary">{model.surfaces.length} 片组成 {model.quality.connectedComponents} 个连接体 · {model.seams.length} 组配缝</div>{model.surfaces.map(s=><button key={s.id} data-garment-panel={s.id} aria-pressed={selected===s.id} onClick={()=>setSelected(s.id)}>{s.sourceId.endsWith('.front')?'前衣身':s.sourceId.endsWith('.back')?'后衣身':`袖片 ${s.copy}`}</button>)}<p data-testid="garment-source-pick">{pick||'点击成衣表面可反查对应裁片与二维坐标。'}</p></section>
      <details className="mesh-inspector-section"><summary>源配缝诊断</summary><p>原配缝间隙 {model.quality.maxSeamGapMm.toFixed(3)} mm；二维组装轮廓偏差 {model.quality.maxBoundaryDeviationMm.toFixed(3)} mm</p><p data-testid="garment-strain">原配缝试验边长变化：95% ≤ {(model.quality.strainP95*100).toFixed(1)}%；最大 {(model.quality.maxStrain*100).toFixed(1)}%。当前成衣示意另做了曲面整形，不以这些数值代表示意模型精度。</p>{!!model.unassembledPanelIds.length&&<p>未组装：{model.unassembledPanelIds.join('、')}</p>}</details>
      <details className="mesh-inspector-section"><summary>二维关联与能力边界</summary><p>曲面顶点保留源裁片二维毫米与UV。原CAD不变；换色、贴图、旋转均不重新制版。二维三视图是当前完成态模型的正投影。</p><p>{model.quality.vertices} 个源顶点 · {model.quality.triangles} 个源三角面</p><p>当前领条、折边和线迹为可编辑工艺示例；源配缝试验的未完成事项：</p>{model.pending.map(p=><p key={p}>{p}</p>)}</details>{error&&<p role="alert" className="garment-error">{error}</p>}
    </aside></div><footer className="mesh-workbench-status"><span>左键拖动旋转 · Shift / 右键拖动平移 · 滚轮缩放 · 点击反查部位</span><span>成衣示意 · 物理试衣与生产未验收</span></footer>
    {fashionSheet&&<GarmentFashionSheet model={display} onClose={()=>setFashionSheet(false)}/>}
  </>;
}
