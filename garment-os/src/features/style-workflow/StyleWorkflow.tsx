import { useEffect,useMemo,useRef,useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignStore } from '@/store/useDesignStore';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PIECE_MATERIALS } from '@/data/pieceTaxonomy';
import { configureStyle,createStyleWorkflow,createWorkflowSheet,readStyleObservation,STYLE_TEMPLATE_IDS,supportsStylePlan } from '@/application/style-workflow';
import type { StyleObservation,StylePlan,StyleTemplateId } from '@/application/style-workflow';
import {foundationParameters} from '@/data/foundationMethods';
import type {ConstructionSelection} from '@/types/construction';
import type { SenlingReference,VisionModel } from '@/application/style-image';
import { measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import { downloadText } from '@/features/files/browser-files';
import type { PatternPath } from '@/types/pattern';
import { SenlingImagePanel } from './SenlingImagePanel';
import './style-workflow.css';

const steps=['企划设计稿','裁片映射','BOM 草案','技术与工艺稿'] as const;
const defaultNeck=Number(KNIT_PARAMETERS['bound-tank'].find(x=>x.key==='necklineDrop')!.defaultValue)*100;
const methodName=(id:string)=>PATTERN_LIBRARY[id]?.name??id;
const materialName=(id:string)=>PIECE_MATERIALS.find(m=>m.id===id)?.label??id;
const planForm=(templateId:StyleTemplateId,options?:ConstructionSelection['options'])=>({templateId,
  neck:String(options?.necklineDrop===undefined?defaultNeck:Math.round(options.necklineDrop*10000)/100),pocket:options?.pocket??true,ribbing:options?.ribbing??true,
  parameters:Object.fromEntries((foundationParameters(templateId)??[]).map(p=>[p.key,String(options?.[p.key]??p.defaultValue)])),
});
function currentPlanForm(){const s=useDesignStore.getState();return supportsStylePlan(s.activePatternId)?planForm(s.activePatternId,s.construction?.options):planForm('bound-tank');}
type ReferenceRecord=Omit<SenlingReference,'imageUrl'>;

function PieceDrawing({name,paths}:{name:string;paths:PatternPath[]}){
  const box=measurePieceBboxFull(paths),{minX,minY,maxX,maxY}=box;
  return <svg role="img" aria-label={name+'源裁片'} viewBox={`${minX-18} ${minY-18} ${maxX-minX+36} ${maxY-minY+36}`}>
    {paths.filter(p=>['seam-line','cutting-line','fold-line','grain-line','detail','notch'].includes(p.layer??'')).map(p=><path key={p.id} data-workflow-path={p.id} d={p.data} transform={p.transform} fill="none" stroke={p.layer==='seam-line'?'#146b86':p.layer==='cutting-line'?'#27374b':'#556a80'} vectorEffect="non-scaling-stroke" strokeWidth={p.layer==='seam-line'?1.5:1} strokeDasharray={p.layer==='fold-line'?'4 3':undefined}/>)}
  </svg>;
}

export function StyleWorkflow(){
  const session=useDesignStore(s=>s.sessionId);
  return <WorkflowSession key={session}/>;
}
function WorkflowSession(){
  const draft=useDesignStore(s=>s.draft),designName=useDesignStore(s=>s.designName);
  const config=useDesignStore(useShallow(s=>({activePatternId:s.activePatternId,gender:s.gender,standardSize:s.standardSize,fit:s.fit,
    measurements:s.measurements,engineVersion:s.engineVersion,garmentColor:s.garmentColor,fabricId:s.fabricId,construction:s.construction})));
  const {standardSize:size,measurements,fit}=config;
  const [step,setStep]=useState(0);
  const [form,setForm]=useState(currentPlanForm);
  const [run,setRun]=useState<{gate:string;source:StyleObservation|null;imageName:string|null;senling?:ReferenceRecord;vision?:VisionModel}|null>(null);
  const [error,setError]=useState(''),[imageFile,setImageFile]=useState<File|null>(null),[imageUrl,setImageUrl]=useState('');
  const [senling,setSenling]=useState<SenlingReference|null>(null);
  const [vision,setVision]=useState<VisionModel>();
  const activeReference=useRef<string|null>(null);
  const [observation,setObservation]=useState<StyleObservation|null>(null),[observationName,setObservationName]=useState(''),[observationUsed,setObservationUsed]=useState(false);
  const observationRequest=useRef(0);
  useEffect(()=>{
    if(!imageFile)return;
    const url=URL.createObjectURL(imageFile);
    queueMicrotask(()=>{if(active)setImageUrl(url);});let active=true;
    return ()=>{active=false;URL.revokeObjectURL(url);};
  },[imageFile]);
  useEffect(()=>()=>{observationRequest.current++;},[]);
  const work=useMemo(()=>{
    if(!run||run.gate!==draft.gateKey||draft.status!=='reference')return null;
    return createStyleWorkflow(config,draft);
  },[run,draft,config]);
  const planChanged=()=>{setRun(null);setError('');};
  const update=(change:Partial<typeof form>)=>{setForm(f=>({...f,...change}));setObservationUsed(false);planChanged();};
  const clearObservation=()=>{
    observationRequest.current++;
    setObservation(null);setObservationName('');setObservationUsed(false);setVision(undefined);planChanged();
  };
  const changeReference=(reference:SenlingReference|null,file:File|null=null)=>{
    activeReference.current=reference?.id??null;
    setSenling(reference);setImageUrl('');setImageFile(file);clearObservation();
  };
  const apply=()=>{
    setError('');setRun(null);
    try{
      const s=useDesignStore.getState();
      const plan:StylePlan=form.templateId==='bound-tank'
        ?{templateId:form.templateId,necklineDrop:form.neck.trim()?Number(form.neck)/100:NaN}
        :form.templateId==='hooded-zip-sweatshirt'?{templateId:form.templateId,pocket:form.pocket,ribbing:form.ribbing}
        :{templateId:form.templateId,options:Object.fromEntries(Object.entries(form.parameters).map(([key,value])=>[key,value.trim()?Number(value):NaN]))};
      const config=configureStyle(s.getConfiguration(),plan);
      s.applyReviewedConfiguration(config);
      const result=useDesignStore.getState();
      const image=senling?{provider:senling.provider,id:senling.id,providerJobId:senling.providerJobId,model:senling.model}:undefined;
      setRun({gate:result.draft.gateKey,source:observationUsed?observation:null,imageName:imageFile?.name??(senling?'森灵生成参考稿':null),
        senling:image,vision:observationUsed?vision:undefined});setStep(1);
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
  };
  const exportDraft=()=>{
    if(!work||!run)return;
    downloadText(JSON.stringify({...work,designName,reference:{imageName:run.imageName,observation:run.source,senling:run.senling,visionModel:run.vision}},null,2),`款式工作流-${work.revisionId}.json`,'application/json');
  };
  const exportSvg=()=>{
    if(!work)return;
    downloadText(createWorkflowSheet(designName,work),`裁片技术图-${work.revisionId}.svg`,'image/svg+xml');
  };
  return <section className="style-flow" aria-label="款式工作流" data-testid="style-workflow">
    <div className="style-flow__hero"><div>
      <div className="style-flow__kicker">GARMENTOS / 款式开发</div>
      <h2>款式工作流</h2>
      <p>确认设计结构，生成同一版本的裁片、裁剪清单和技术草案。</p>
    </div><span className="style-flow__badge">参考阶段 · 生产未放行</span></div>
    <nav className="style-flow__steps" aria-label="款式开发步骤">
      {steps.map((title,i)=><button key={title} type="button" data-workflow-step={i+1} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);setError('');}}><span>0{i+1}</span>{title}</button>)}
    </nav>
    {error&&<p className="style-flow__error" role="alert">{error}</p>}
    <div className="style-flow__grid" hidden={step!==0}>
      <article className="style-flow__card">
        <h3>参考设计稿</h3>
        <p>使用森灵生成参考稿，或添加本机图片。本机图片只在本页预览；制版尺寸使用工作区的测量数据。</p>
        <label>上传参考设计稿<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{
          const f=e.target.files?.[0];if(!f)return;
          if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>10*1024*1024){setError('参考稿需为 10 MB 以内的 PNG、JPG 或 WebP');return;}
          changeReference(null,f);
        }}/></label>
        {senling?<><img className="style-flow__reference" src={senling.imageUrl} alt="森灵参考设计稿" referrerPolicy="no-referrer" onError={()=>setError('森灵参考图无法加载，请重新生成或选用本机图片。')}/>
          <p>森灵生成参考稿 · {senling.model}</p><button onClick={()=>changeReference(null)}>移除参考图</button></>
          :imageFile&&imageUrl?<><img className="style-flow__reference" src={imageUrl} alt="本地企划参考稿" onError={()=>{changeReference(null);setError('参考图片无法读取');}}/><p>{imageFile.name}</p><button onClick={()=>changeReference(null)}>移除参考图</button></>:<div className="style-flow__placeholder">没有参考图时，也可直接确认结构化设计稿。</div>}
        <details><summary>森灵 / 图稿解析试验</summary>
          <SenlingImagePanel activeReferenceId={senling?.id} onReference={changeReference} beginObservation={()=>++observationRequest.current}
            onObservation={(id,ticket,candidate,model)=>{
            if(activeReference.current!==id||ticket!==observationRequest.current)return false;
            clearObservation();
            setObservation(candidate);setObservationName(candidate?`森灵识图 · ${model}`:'');setVision(candidate?model:undefined);
            return true;
          }}/>
          <p>也可导入外部结构观察。所有候选都要核对后才能填入结构选择。</p>
          <label>导入结构观察<input type="file" accept=".json,application/json" onChange={async e=>{
            const file=e.target.files?.[0];e.currentTarget.value='';if(!file)return;
            const ticket=++observationRequest.current;
            try{
              if(file.size>64*1024)throw new Error('结构观察文件最大 64 KB');
              const candidate=readStyleObservation(JSON.parse(await file.text()));
              if(ticket!==observationRequest.current)return;
              setObservation(candidate);setObservationName(file.name);setObservationUsed(false);setVision(undefined);planChanged();
            }catch(cause){if(ticket===observationRequest.current)setError(cause instanceof Error?cause.message:String(cause));}
          }}/></label>
          <button onClick={()=>downloadText(JSON.stringify({schema:'garment-os/style-observation/v1',templateId:'hooded-zip-sweatshirt',pocket:false,ribbing:true},null,2),'结构观察示例.json','application/json')}>下载接口示例</button>
          {observation&&<div className="style-flow__candidate" data-testid="style-observation">
            <p>{observationName} · {methodName(observation.templateId)}{observation.templateId==='hooded-zip-sweatshirt'?` · 前贴袋：${observation.pocket?'有':'无'} · 罗纹：${observation.ribbing?'有':'无'}`:''}</p>
            <button onClick={()=>{update(observation.templateId==='bound-tank'?{templateId:observation.templateId}:{templateId:observation.templateId,pocket:observation.pocket,ribbing:observation.ribbing});setObservationUsed(true);}}>将观察填入结构选择</button>
            <button onClick={clearObservation}>移除观察</button>
          </div>}
        </details>
      </article>
      <article className="style-flow__card">
        <h3>确认款式结构</h3>
        <p>当前尺码 {size} · {({slim:'合身',regular:'标准',loose:'宽松'})[fit]}。尺寸使用当前工作区输入，可在左侧修改；未核验实测来源。</p>
        <label>结构模板<select value={form.templateId} onChange={e=>{const id=e.target.value;if(supportsStylePlan(id)){const s=useDesignStore.getState();update(planForm(id,id===s.activePatternId?s.construction?.options:undefined));}}}>
          {STYLE_TEMPLATE_IDS.map(id=><option key={id} value={id}>{methodName(id)}</option>)}
        </select></label>
        {supportsStylePlan(config.activePatternId)&&<button onClick={()=>update(currentPlanForm())}>从当前裁片同步结构</button>}
        {foundationParameters(form.templateId)?<>
          {(foundationParameters(form.templateId)??[]).map(p=><label key={p.key}>{p.label}（比例）<input aria-label={p.label} type="number" min={p.min} max={p.max} step={p.step} value={form.parameters[p.key]??''} onChange={e=>update({parameters:{...form.parameters,[p.key]:e.target.value}})}/><small>{p.meaning}</small></label>)}
          <p>沿用当前工作区的独立人体测量。这里修改已接通的基础款参数；口袋、插肩/落肩及独立领条尚未接通，未生成的部件不会列入裁剪清单。</p>
        </>:form.templateId==='bound-tank'?<>
          <label>前领口下降比例（%）<input type="number" min={10} max={35} step="0.1" value={form.neck} onChange={e=>update({neck:e.target.value})}/></label>
          <p>允许 10–35%，以颈肩点到后腰的长度为基准。改领深会同步重算前身领口与领口包条。</p>
        </>:<>
          <label>前贴袋<select value={String(form.pocket)} onChange={e=>update({pocket:e.target.value==='true'})}><option value="true">有</option><option value="false">无</option></select></label>
          <label>罗纹接条<select value={String(form.ribbing)} onChange={e=>update({ribbing:e.target.value==='true'})}><option value="true">有</option><option value="false">无</option></select></label>
          <p>当前头围：{measurements.headCirc===undefined?'未录入，生成时将阻断':`${measurements.headCirc} mm`}。贴袋和罗纹开关决定实际裁片组成。</p>
        </>}
        <button className="style-flow__primary" onClick={apply}>确认设计并生成裁片</button>
      </article>
    </div>
    {step!==0&&!work&&<article className="style-flow__card"><h3>等待有效裁片</h3><p>{draft.status==='blocked'?draft.error:'先确认设计结构并生成裁片。变更尺寸或结构后，需要重新确认。'}</p><button onClick={()=>setStep(0)}>返回企划设计稿</button></article>}
    {step!==0&&work&&<>
      <div className="style-flow__summary" data-testid="workflow-summary">
        <strong>{methodName(work.configuration.activePatternId)} · {work.configuration.standardSize}</strong>
        <span>{work.sourcePieceCount} 种源裁片 / {work.primaryCutQuantity} 片主材料裁剪量</span>
        <small title={work.revisionId}>版本 {work.revisionId.slice(0,8)}</small>
      </div>
      {step===1&&<>
        <div className="style-flow__pieces" data-testid="workflow-cad">
          {draft.pieces.map(piece=><article className="style-flow__card style-flow__piece" key={piece.key} data-workflow-piece={piece.key}><strong>{piece.name}</strong>
            <PieceDrawing name={piece.name} paths={piece.paths}/><small>{piece.key} · 源坐标 mm</small></article>)}
        </div><button className="style-flow__primary" onClick={()=>setStep(2)}>查看 BOM 草案</button>
      </>}
      {step===2&&<article className="style-flow__card">
        <h3>裁剪清单 · BOM 草案</h3><p>下表数量来自源材料裁剪指令，表示裁几片。实际面辅料规格和排料采购用量待确认。</p>
        <div className="style-flow__table"><table><thead><tr><th>裁片</th><th>材料角色</th><th>裁剪数量</th><th>对折裁</th><th>采购用量</th></tr></thead>
          <tbody>{work.bom.lines.map(line=><tr key={line.id} data-workflow-bom={line.id}><td>{line.pieceName}</td><td>{materialName(line.materialRole)}</td><td>{line.cutQuantity} {line.cutUnit}</td><td>{line.onFold?'是':'否'}</td><td>待核定</td></tr>)}</tbody>
        </table></div><button className="style-flow__primary" onClick={()=>setStep(3)}>查看技术与工艺稿</button>
      </article>}
      {step===3&&<article className="style-flow__card">
        <h3>技术与工艺草案</h3><p>列出此款式版本的源尺寸、构造和待复核事项。整款成衣正背技术图与制造工艺单待接入。</p>
        {work.technical.operations.map(op=><details key={op.id} data-workflow-operation={op.id} open><summary>{op.label} · {op.status==='dimensioned'?'源关系已计算':'工艺待补齐'}</summary>
          <p>{op.rule}</p><dl>{op.metrics.map(m=><div key={m.label}><dt>{m.label}</dt><dd>{m.value===null?'待核定':`${Number(m.value.toFixed(3))} ${m.unit==='count'?'处':m.unit}`}</dd></div>)}</dl>
          {op.steps.length>0&&<ol>{op.steps.map(s=><li key={s}>{s}</li>)}</ol>}
        </details>)}
        <details><summary>复核事项（{work.technical.pending.length}）</summary><ul>{work.technical.pending.map(p=><li key={p}>{p}</li>)}</ul></details>
        <div className="style-flow__actions"><button data-workbench-export onClick={exportSvg}>导出参考裁片图 SVG</button><button className="style-flow__primary" onClick={exportDraft}>导出联动草案 JSON</button></div>
      </article>}
    </>}
  </section>;
}
