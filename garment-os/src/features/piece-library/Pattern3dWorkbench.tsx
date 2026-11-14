import { useCallback,useRef,useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { exportPatternGltf } from '@/lib/pattern/mesh/gltf-export';
import { downloadText } from '@/features/files/browser-files';
import { matchesTagFilter } from '@/lib/pattern/piece-tags';
import { cameraBasis,fitPhysicalCamera,framePhysicalCamera,frontCamera,calibrateScreen,measureSurfaceAnchors,pickPhysicalSurface } from '@/lib/pattern/mesh/viewport-mapping';
import { MESH_PRECISION } from '@/lib/pattern/mesh/precision-policy';
import { MeshViewport } from './MeshViewport';
import type { PhysicalCamera,SurfaceAnchor,ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import type { PanelMesh,PatternMesh3d } from '@/types/pattern3d';
import type { MeshRenderData } from '@/lib/pattern/mesh/render-data';

const initialSize:ViewportSize={width:800,height:600,dpr:1};
type ViewPreset='front'|'back'|'right'|'top'|'iso';
type Tool='select'|'orbit'|'measure';
function AxisGizmo({camera,onPreset}:{camera:PhysicalCamera;onPreset:(view:ViewPreset)=>void}) {
  const basis=cameraBasis(camera);
  return <svg className="mesh-axis-gizmo" viewBox="0 0 100 100" aria-label="三维方向导航">
    {[{label:'X',color:'#e88787',view:'right' as const,k:0},{label:'Y',color:'#8dcba7',view:'top' as const,k:1},{label:'Z',color:'#85aeee',view:'front' as const,k:2}]
      .sort((a,b)=>basis.forward[a.k]-basis.forward[b.k]).map(a=>{
        const x=50+basis.right[a.k]*30,y=50-basis.up[a.k]*30;
        return <g key={a.label} role="button" tabIndex={0} aria-label={`${a.label} 轴视图`} onClick={()=>onPreset(a.view)} onKeyDown={e=>{if(e.key==='Enter')onPreset(a.view);}}>
          <line x1="50" y1="50" x2={x} y2={y} stroke={a.color} strokeWidth="2"/>
          <circle cx={x} cy={y} r="10" fill={a.color}/><text x={x} y={y+4} textAnchor="middle" fill="#202126" fontSize="11" fontWeight="700">{a.label}</text>
        </g>;
      })}<circle cx="50" cy="50" r="3" fill="#b7bcc8"/>
  </svg>;
}

export function Pattern3dWorkbench({model,data,durationMs}:{model:PatternMesh3d;data:MeshRenderData;durationMs:number}) {
  const draft=useDesignStore(s=>s.draft),filter=usePieceLibraryStore(s=>s.tagFilter),clear=usePieceLibraryStore(s=>s.clearTagFilter);
  const [camera,setCamera]=useState<PhysicalCamera>(()=>fitPhysicalCamera(model,initialSize)),[size,setSize]=useState(initialSize),[selected,setSelected]=useState('');
  const [tool,setTool]=useState<Tool>('select'),[wire,setWire]=useState(false),[seams,setSeams]=useState(false),[grid,setGrid]=useState(true);
  const [hidden,setHidden]=useState<string[]>([]),[isolated,setIsolated]=useState<string|null>(null);
  const [anchors,setAnchors]=useState<SurfaceAnchor[]>([]),[exportError,setExportError]=useState('');
  const [page,setPage]=useState({panel:'',index:0}),[edgeId,setEdgeId]=useState(''),[measuredMm,setMeasuredMm]=useState(''),[calibration,setCalibration]=useState<ReturnType<typeof calibrateScreen>|null>(null),[calibrationError,setCalibrationError]=useState(''),[device,setDevice]=useState({raw:'',generation:0});
  const hasFramed=useRef(false);
  const updateSize=useCallback((next:ViewportSize)=>{
    setSize(previous=>previous.width===next.width&&previous.height===next.height&&previous.dpr===next.dpr?previous:next);
    if(!hasFramed.current){hasFramed.current=true;setCamera(c=>framePhysicalCamera(model,next,c));}
  },[model]);
  const updateDevice=useCallback((raw:string)=>setDevice(previous=>previous.raw===raw?previous:{raw,generation:previous.generation+1}),[]);
  const deviceKey=JSON.stringify(device);
  const filtered=model.panels.filter(p=>matchesTagFilter(draft.pieces.find(x=>x.key===p.sourceId)?.tags??[],filter));
  const visible=filtered.filter(p=>!hidden.includes(p.id)&&(!isolated||isolated===p.id)),ids=visible.map(p=>p.id),current=visible.find(p=>p.id===selected)??visible[0];
  const shownAnchors=anchors.filter(a=>ids.includes(a.panelId)),measure=shownAnchors.length===2?measureSurfaceAnchors(shownAnchors[0],shownAnchors[1]):null;
  const validCalibration=calibration?.deviceKey===deviceKey?calibration:null;
  const frontAligned=current&&Math.abs(camera.yawDeg+current.placement.yawDeg)<1e-6&&Math.abs(camera.tiltDeg)<1e-6;
  const index=current&&page.panel===current.id?page.index:0,edge=current?.sourceEdges.find(e=>e.id===edgeId)??current?.sourceEdges[0];
  const pieceName=(p:PanelMesh)=>(draft.pieces.find(x=>x.key===p.sourceId)?.name??p.sourceId)+` · ${p.copy}`;
  const frameAll=()=>setCamera(c=>framePhysicalCamera(model,size,c,ids));
  const frameSelected=()=>current&&setCamera(c=>framePhysicalCamera(model,size,c,[current.id]));
  const preset=(view:ViewPreset)=>setCamera(c=>framePhysicalCamera(model,size,{...c,yawDeg:view==='back'?180:view==='right'?90:view==='iso'?25:0,tiltDeg:view==='top'?90:view==='iso'?18:0},ids));
  const isolate=()=>{if(isolated){setIsolated(null);setCamera(c=>framePhysicalCamera(model,size,c,filtered.filter(p=>!hidden.includes(p.id)).map(p=>p.id)));}else if(current){setIsolated(current.id);frameSelected();}};
  const resetVisibility=()=>{clear();setHidden([]);setIsolated(null);};
  const dimension=(axis:0|1)=>current?Math.max(...current.vertices.map(v=>v.localMm[axis]))-Math.min(...current.vertices.map(v=>v.localMm[axis])):0;
  return <>
    <div className="mesh-command-bar">
      <div className="mesh-tool-group" role="group" aria-label="视口工具">
        {([['select','↖','选择'],['orbit','↻','旋转'],['measure','⌁','量尺']] as const).map(([id,icon,label])=><button key={id} aria-pressed={tool===id} aria-label={`${label}工具`} onClick={()=>setTool(id)}><span>{icon}</span>{label}</button>)}
      </div>
      <div className="mesh-tool-group"><button onClick={frameAll} title="Home">适配全部</button><button disabled={!current} onClick={frameSelected} title="F">聚焦当前片</button><button disabled={!current} onClick={()=>current&&setCamera(c=>framePhysicalCamera(model,size,frontCamera(current,c),[current.id]))}>当前片正视</button></div>
      <div className="mesh-tool-group mesh-display-options"><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>网格</label><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>显示三角网格</label><label><input type="checkbox" checked={seams} onChange={e=>setSeams(e.target.checked)}/>显示未缝合对应线</label></div>
      <span className="mesh-command-spacer"/><button title="导出完整模型，显示筛选不改变裁剪清单" onClick={()=>{try{downloadText(exportPatternGltf(model),`${model.templateId}-裁片映射.gltf`,'model/gltf+json');setExportError('');}catch(e){setExportError(String(e));}}}>导出三维 glTF</button>
    </div>
    {exportError&&<p role="alert">{exportError}</p>}
    <div className="mesh-workbench-body">
      <div className="mesh-stage" tabIndex={0} aria-label="三维视口工作区" onKeyDown={e=>{
        if((e.target as HTMLElement).closest('input,select,textarea,button'))return;
        if(e.key.toLowerCase()==='f'){e.preventDefault();frameSelected();}else if(e.key==='Home'){e.preventDefault();frameAll();}
        else if(e.key==='1'||e.key==='3'||e.key==='7'){e.preventDefault();preset(e.key==='1'?'front':e.key==='3'?'right':'top');}
        else if(e.key==='Escape'){setAnchors([]);setTool('select');}
      }}>
        <div className="mesh-viewport-label"><strong>用户正交</strong><span>Y 向上 · mm</span><span>{isolated?'局部隔离':'裁片展开'} / {current?pieceName(current):'无选择'}</span></div>
        <AxisGizmo camera={camera} onPreset={preset}/>
        <div className="mesh-view-presets">{([['iso','立体视图'],['front','前视图'],['back','后视图'],['right','右视图'],['top','顶视图']] as const).map(([id,label])=><button key={id} onClick={()=>preset(id)}>{label}</button>)}</div>
        {!visible.length?<div data-testid="mesh-empty" className="mesh-empty-state"><h3>当前没有可见裁片</h3><p>筛选、隐藏或隔离仅影响显示。</p><button onClick={resetVisibility}>显示全部三维裁片</button></div>:
          <MeshViewport model={model} data={data} camera={camera} size={size} onSize={updateSize} onDevice={updateDevice} visible={ids} selected={current?.id??''} wire={wire} seams={seams} grid={grid} anchors={shownAnchors} tool={tool}
            onOrbit={(dx,dy)=>setCamera(c=>({...c,yawDeg:((c.yawDeg+dx*.4+540)%360)-180,tiltDeg:Math.max(-89.5,Math.min(89.5,c.tiltDeg+dy*.4))}))}
            onFrame={frameSelected} onPan={(dx,dy)=>setCamera(c=>({...c,panCss:[c.panCss[0]+dx,c.panCss[1]+dy]}))}
            onZoom={factor=>setCamera(c=>({...c,pixelsPerMm:Math.min(30,Math.max(.01,c.pixelsPerMm*factor))}))}
            onPick={point=>{const picked=pickPhysicalSurface(model,ids,point,camera,size);if(picked){setSelected(picked.panelId);if(tool==='measure')setAnchors(a=>{const active=a.filter(x=>ids.includes(x.panelId));return active.length===1?[...active,picked]:[picked];});}}}/>}
        <div className="mesh-stage-navigation"><button aria-label="放大" onClick={()=>setCamera(c=>({...c,pixelsPerMm:Math.min(30,c.pixelsPerMm*1.25)}))}>＋</button><button aria-label="缩小" onClick={()=>setCamera(c=>({...c,pixelsPerMm:Math.max(.01,c.pixelsPerMm/1.25)}))}>−</button><button disabled={!current} aria-pressed={!!isolated} onClick={isolate}>{isolated?'退出隔离':'隔离当前片'}</button></div>
      </div>
      <aside className="mesh-inspector" aria-label="裁片与属性">
        <section className="mesh-inspector-section mesh-outliner"><header><h4>裁片集合</h4><span>{visible.length} / {model.panels.length}</span><button onClick={resetVisibility} title="清除三维筛选">全部显示</button></header>
          <div className="mesh-outliner-list">{filtered.map(p=><div className={`mesh-outliner-row ${current?.id===p.id?'selected':''}`} key={p.id}>
            <button data-mesh-panel={p.id} title={p.id} aria-pressed={current?.id===p.id} onClick={()=>{setSelected(p.id);setHidden(h=>h.filter(id=>id!==p.id));if(isolated)setIsolated(p.id);}}><span>◇</span>{pieceName(p)}</button>
            <button aria-label={`${hidden.includes(p.id)?'显示':'隐藏'} ${p.id}`} aria-pressed={!hidden.includes(p.id)} onClick={()=>setHidden(h=>h.includes(p.id)?h.filter(id=>id!==p.id):[...h,p.id])}>{hidden.includes(p.id)?'○':'◉'}</button>
          </div>)}</div>
          <p data-testid="mesh-summary">{model.panels.length} 片实际数量 · 当前 {visible.length} 片可见</p>
        </section>
        <section className="mesh-inspector-section"><h4>当前裁片</h4>{current?<><strong>{pieceName(current)}</strong><code>{current.id}</code><dl className="mesh-properties"><dt>展开外接框</dt><dd>{dimension(0).toFixed(1)} × {dimension(1).toFixed(1)} mm</dd><dt>净轮廓面积</dt><dd>{(current.metrics.sourceAreaMm2/10000).toFixed(2)} dm²</dd><dt>主材料</dt><dd>{current.material}</dd><dt>裁剪指令</dt><dd>{current.unfolded?'对折裁片已展开':'非对折裁片'} · 第 {current.copy}/{current.quantity} 片</dd></dl><button onClick={frameSelected}>定位选中裁片</button></>:<p>选择一个可见裁片</p>}</section>
        <section className="mesh-inspector-section"><h4>毫米量尺</h4><p data-testid="surface-measure" className="mesh-measure-result">{measure?measure.restMm===null?`跨片空间间距 ${measure.spatialMm.toFixed(3)} mm（不表示服装尺寸）`:`同片平面直线 ${measure.restMm.toFixed(3)} mm · 三维直线 ${measure.spatialMm.toFixed(3)} mm`:'选择量尺工具，在同一裁片上依次点击两点。'}</p><button onClick={()=>setTool('measure')} aria-pressed={tool==='measure'}>开始量尺</button><button onClick={()=>setAnchors([])}>清除量尺</button>
          {current&&<><label className="mesh-field">源轮廓边<select aria-label="源轮廓边" value={edge?.id} onChange={e=>setEdgeId(e.target.value)}>{current.sourceEdges.map(e=><option key={e.id} value={e.id}>{e.id} · {e.kind==='curve'?'曲线':'直线'}</option>)}</select></label><p data-testid="source-edge-length">源轮廓长度 {edge?.lengthMm.toFixed(3)} mm</p><small>源曲线积分值；两点直线与曲线弧长分别读取。</small></>}
        </section>
        <details className="mesh-inspector-section"><summary>视图精调</summary><label className="mesh-field">水平旋转<input aria-label="三维水平旋转" type="range" min={-180} max={180} value={camera.yawDeg} onChange={e=>setCamera(c=>({...c,yawDeg:Number(e.target.value)}))}/></label><label className="mesh-field">俯仰<input aria-label="三维俯仰" type="range" min={-90} max={90} value={camera.tiltDeg} onChange={e=>setCamera(c=>({...c,tiltDeg:Number(e.target.value)}))}/></label><p>显示比例 {camera.pixelsPerMm.toFixed(4)} CSS px/mm。窗口变化保留显示比例。</p></details>
        <details className="mesh-inspector-section"><summary>实体尺寸校准</summary><p>用实体尺测量两端刻线距离。换屏或缩放须重新校准，斜视会缩短投影。</p><svg aria-label="屏幕校准标尺" width="220" height="24" viewBox="0 0 220 24" style={{display:'block',maxWidth:'none'}}><path d="M0 2V22 M0 12H220 M220 2V22" stroke="currentColor" fill="none"/></svg><label className="mesh-field">实体尺读数 mm<input aria-label="实体尺读数 mm" type="number" min="10" max="1000" value={measuredMm} onChange={e=>setMeasuredMm(e.target.value)}/></label><button onClick={()=>{try{setCalibration(calibrateScreen(220,Number(measuredMm),deviceKey));setCalibrationError('');}catch(e){setCalibrationError(String(e));}}}>保存本屏校准</button><button disabled={!validCalibration||!frontAligned} onClick={()=>validCalibration&&setCamera(c=>({...c,pixelsPerMm:validCalibration.cssPxPerPhysicalMm}))}>按实体 1:1 显示当前片</button><p data-testid="screen-calibration">{validCalibration?`本屏已校准 ${validCalibration.cssPxPerPhysicalMm.toFixed(4)} CSS px/实体 mm；当前实体比例 ${(camera.pixelsPerMm/validCalibration.cssPxPerPhysicalMm).toFixed(3)}:1${frontAligned?'（当前片正视）':'（当前片斜视，长度会缩短）'}`:calibration?'屏幕或缩放已变化，校准失效。':'尚未用实体尺校准；屏幕显示不宣称实体 1:1。'}</p>{calibrationError&&<p role="alert">{calibrationError}</p>}</details>
        <details className="mesh-inspector-section"><summary>量尺与二维来源</summary>{shownAnchors.map((a,i)=><p key={i} data-testid="surface-anchor">点 {i+1}：{a.panelId} · 三角面 {a.triangle} · 重心 {a.weights.map(v=>v.toFixed(6)).join(', ')} · 展开二维 [{a.localMm.map(v=>v.toFixed(3)).join(', ')}] · 源二维 [{a.sourceMm.map(v=>v.toFixed(3)).join(', ')}] · 三维 [{a.worldMm.map(v=>v.toFixed(3)).join(', ')}] mm{a.mirrored?' · 对折反映射':''}</p>)}
          {current&&<><p>{current.sourceId} · 顶点按每页 50 行展示。</p><button disabled={index===0} onClick={()=>setPage({panel:current.id,index:index-1})}>上一页</button><span> {index+1}/{Math.ceil(current.vertices.length/50)} </span><button disabled={(index+1)*50>=current.vertices.length} onClick={()=>setPage({panel:current.id,index:index+1})}>下一页</button><div className="mesh-table-scroll"><table aria-label="三维顶点来源"><thead><tr><th>顶点</th><th>源二维 mm</th><th>源边 / 参数</th><th>三维 mm</th></tr></thead><tbody>{current.vertices.slice(index*50,(index+1)*50).map((v,i)=><tr key={i}><td>{index*50+i}{v.mirrored?' · 对折展开':''}</td><td>{v.sourceMm.map(n=>n.toFixed(3)).join(', ')}</td><td>{v.sourceEdge} / {v.t.toFixed(6)}</td><td>{current.positionsMm[index*50+i].map(n=>n.toFixed(3)).join(', ')}</td></tr>)}</tbody></table></div></>}
        </details>
        <details className="mesh-inspector-section"><summary>映射质量与能力边界</summary><p>源二维毫米 → 对折展开 → 三维毫米 → 相机投影。当前为平面裁片的空间预置，尚未实现缝合闭合、碰撞与布料垂坠。网格不含缝份与布厚。</p><p>后台生成 {durationMs.toFixed(0)} ms · {data.geometries.length} 份共享几何 · {model.panels.reduce((s,p)=>s+p.triangles.length/3,0)} 个三角面 · {model.seams.length} 组未缝合对应。</p><p>曲线细分误差限 {MESH_PRECISION.curveChordMm} mm · 局部坐标转换误差 {data.maxUploadErrorMm.toExponential(2)} mm · 实例变换浮点量化估算 {data.maxTransformQuantizationMm.toExponential(2)} mm。以上不是生产公差或实际 GPU 精度证明。</p><ul>{model.pending.map((p,i)=><li key={i}>{p}</li>)}</ul><button onClick={()=>downloadText(JSON.stringify(model,null,2),`${model.templateId}-三维追溯.json`,'application/json')}>导出映射与缺口</button></details>
      </aside>
    </div>
    <footer className="mesh-workbench-status"><span><b>●</b> 源 CAD 已连接</span><span>左键选择 / 拖动旋转 · 中键旋转 · Shift 拖动平移 · 滚轮缩放 · F 聚焦 · Home 全部</span><span>参考检查 · 生产未验收</span></footer>
  </>;
}
