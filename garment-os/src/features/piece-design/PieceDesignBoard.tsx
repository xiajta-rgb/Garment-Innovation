import { useRef,useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { defaultPieceDesign,supportsPieceDesign } from '@/lib/pattern/piece-design-spec';
import { readConfiguration } from '@/application/design-document';
import { exportPieceDesignCad } from '@/application/piece-design';
import { TEE_PARAMETERS } from '@/data/foundationMethods';
import { usePieceDesign } from './usePieceDesign';
import { downloadText } from '@/features/files/browser-files';
import { downloadStylePng } from '@/features/company-design/style-image-reference';
import type { PieceDesignSpec } from '@/types/piece-design';
import type { DesignConfiguration } from '@/types/design';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { COMPANY_TEE_GUIDE_ID } from '@/lib/pattern/company-tee-flat';
import './piece-design.css';
import { CompositionEditor } from './CompositionEditor';

function DimensionInput({label,value,min,max,step,commit,invalid}:{label:string;value:number;min:number;max:number;step:number;commit:(value:number)=>void;invalid:(message:string)=>void}){
  const [text,setText]=useState(String(value));
  function apply(){const v=Number(text);if(!text.trim()||!Number.isFinite(v)||v<min||v>max){invalid(`${label}需填写 ${min}–${max} 的数值，当前输入未应用。`);return;}if(v===value){invalid('');return;}commit(v);}
  return <label>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={text} onChange={e=>setText(e.target.value)} onBlur={apply} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
export function PieceDesignBoard({onReferences}:{onReferences?:()=>void}={}){
  const session=useDesignStore(s=>s.sessionId);
  return <PieceDesignWorkspace key={session} onReferences={onReferences}/>;
}
function PieceDesignWorkspace({onReferences}:{onReferences?:()=>void}){
 const [paired,setPaired]=useState(false);
 return paired?<div className="piece-design-board"><div className="composition-toolbar"><button onClick={()=>setPaired(false)}>返回自由裁片组合</button><span className="piece-muted">配套参数与配缝核对</span></div><PieceDesignSession/></div>:<CompositionEditor onReferences={onReferences} onPaired={()=>setPaired(true)}/>;
}
function PieceDesignSession(){
  const state=useDesignStore(),configuration=state.getConfiguration(),enabled=!!state.pieceDesign&&supportsPieceDesign(state.activePatternId);
  const [error,setError]=useState(''),[fieldErrors,setFieldErrors]=useState<Record<string,string>>({}),[selected,setSelected]=useState('front');
  const [lineOnly,setLineOnly]=useState(false),[reference,setReference]=useState(false);
  const guide=companyStyleMaster(COMPANY_TEE_GUIDE_ID);
  const d=state.pieceDesign??defaultPieceDesign(state.companyDraft?.color??state.garmentColor);
  const {result,loading,error:calculationError}=usePieceDesign(configuration,enabled);
  const fieldError=Object.values(fieldErrors).find(Boolean);
  const current=enabled&&!loading&&!calculationError&&!error&&!fieldError?result:undefined;
  let displaySvg=current?.threeViewSvg??'';
  if(lineOnly)displaySvg=displaySvg.replace(/(<path data-(?:source-piece|contour-underlay)="[^"]+"[^>]*?)fill="[^"]*"/g,'$1fill="#f6f7f5"');
  const drag=useRef<{pointer:number;x:number;y:number;sourceX:number;sourceY:number;scaleX:number;scaleY:number}|null>(null),[ghost,setGhost]=useState<{x:number;y:number}>();
  function change(next:DesignConfiguration){try{state.applyReviewedConfiguration(readConfiguration(next));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}
  function patch(partial:Partial<PieceDesignSpec>){try{state.setPieceDesign({...d,...partial});setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}
  function create(women=false){const color=state.companyDraft?.color??guide.color,base=defaultPieceDesign(color);change({...configuration,activePatternId:women?'womens-basic-tee':'t-shirt',construction:undefined,garmentColor:color,pieceDesign:{...base,colors:{front:color,back:color,sleeve:color,neckband:color,pocket:color},pocket:{...base.pocket,kind:'none'}}});state.setDesignName('圆领短T · 公司稿绘图规范');}
  const options=configuration.construction?.options??{};
  function option(key:string,value:number){change({...configuration,construction:{schema:'garment-os/construction/v1',options:{...options,[key]:value}}});}
  const number=(label:string,value:number,min:number,max:number,onChange:(value:number)=>void,step=1)=><DimensionInput key={`${label}/${value}`} label={label} value={value} min={min} max={max} step={step} commit={v=>{setFieldErrors(errors=>({...errors,[label]:''}));onChange(v);}} invalid={message=>setFieldErrors(errors=>({...errors,[label]:message}))}/>;
  return <section className="piece-design-board" data-testid="piece-design-board"><header className="piece-design-heading"><div><h2>裁片组合设计</h2><p>以毫米裁片改款 · 配套检查 · 三视图</p></div><div className="piece-design-actions">
    <button data-workbench-export disabled={!current} onClick={()=>downloadText(displaySvg,'裁片组合-三视图.svg','image/svg+xml')}>下载组合三视图</button><button disabled={!current} onClick={()=>void downloadStylePng(displaySvg,'裁片组合-三视图.png').catch(e=>setError(String(e)))}>下载参考 PNG</button><button disabled={!current} onClick={()=>downloadText(exportPieceDesignCad(current!),'裁片组合-毫米裁片.svg','image/svg+xml')}>下载毫米裁片 SVG</button><button disabled={!current} onClick={()=>downloadText(JSON.stringify(current!.metadata,null,2),'裁片组合-设计与配缝.json','application/json')}>下载裁片与配缝</button>
  </div></header>
  {!enabled?<div className="piece-start"><h3>从配套裁片开始</h3><p>先接通配套圆领T恤：前后衣身、袖片、对折领条及独立贴袋。使用当前工作区尺寸（{configuration.gender} / {configuration.standardSize}），不是从图片估算尺寸。帽衫、翻领和任意跨款拼接尚未接入此组合入口。</p><button className="piece-primary" onClick={()=>create()}>创建直身T恤裁片组合</button><button onClick={()=>create(true)}>创建收腰T恤裁片组合</button></div>:
  <div className="piece-design-layout"><div className="piece-design-main">
    <div className="piece-component-bar" aria-label="配套裁片选择">{[['front','前衣身'],['back','后衣身'],['sleeve','配套袖片'],['neckband','罗纹领条'],['pocket','贴袋裁片']].map(([id,label])=><button key={id} aria-pressed={selected===id} onClick={()=>setSelected(id)}>{label}</button>)}</div>
    {loading&&<p role="status">正在重算裁片、检查配缝并生成三视图…</p>}{(error||calculationError||fieldError)&&<p role="alert" className="piece-error">{error||calculationError||fieldError}</p>}
    {current&&<><div className="piece-flat-toolbar"><div><strong>款式设计图</strong><span>参照公司 COT25M002 · 肩袖、领圈与缝线规范</span></div><button aria-pressed={reference} onClick={()=>setReference(!reference)}>{reference?'收起公司原稿':'对照公司原稿'}</button><button aria-pressed={lineOnly} onClick={()=>setLineOnly(!lineOnly)}>{lineOnly?'恢复配色':'仅看结构线'}</button></div>
      <div className="piece-three-view" data-testid="piece-design-three-view" dangerouslySetInnerHTML={{__html:displaySvg}}/>
      {reference&&<figure className="piece-company-reference" data-testid="piece-company-reference"><img src={guide.source.image} alt="COT25M002 公司原始设计稿"/><figcaption>公司原稿：微落肩短T。当前款式图为装袖派生，领型、配色、袋位及尺寸变化另行表达；同款裁片尚未取得。</figcaption></figure>}
      <details className="piece-fit-spec" data-testid="flat-specification"><summary>参考裁片规格 · mm · 展开核对</summary><p>以下为当前Teagan参考净样，胸宽为单面、胸围为整圈；不是公司原稿的实测尺寸。上方款式图采用公司绘图比例，实际纸样对应需另行确认。</p><table className="piece-join-table"><thead><tr><th>量点</th><th>净样 mm</th><th>量法</th></tr></thead><tbody>{current.flatSpecification.rows.map(r=><tr key={r.id} data-spec-row={r.id}><td>{r.label}</td><td>{r.valueMm.toFixed(1)}</td><td>{r.definition}</td></tr>)}</tbody></table><details><summary>展开净样量点图</summary><div className="piece-three-view" dangerouslySetInnerHTML={{__html:current.netReferenceSvg}}/></details></details>
      <details className="piece-fit-spec"><summary>查看同款组装三视图</summary><p>同一组裁片的体积参考，便于对照；组装投影宽度不作为平铺胸宽。</p><div className="piece-three-view" dangerouslySetInnerHTML={{__html:current.assemblyThreeViewSvg}}/></details>
      <div className="piece-section-title"><h3>裁片净样与裁边</h3><span>每片保留来源、裁法和数量；点击裁片选择部件</span></div>
      <div className="piece-pattern-grid">{current.pieces.map(p=>{const b=p.bounds,role=p.id.includes('neckband')?'neckband':p.id.includes('pocket')?'pocket':p.id.includes('sleeve')?'sleeve':p.id.endsWith('.back')?'back':'front';return <button key={p.id} className="piece-pattern-card" data-pattern-piece={p.id} aria-pressed={selected===role} onClick={()=>setSelected(role)}><svg viewBox={`${b.minX-28} ${b.minY-28} ${b.maxX-b.minX+56} ${b.maxY-b.minY+56}`}><path d={p.cutPath} fill="none" stroke="#b07442" strokeWidth="1.8"/><path d={p.netPath} fill={d.colors[role as keyof typeof d.colors]} fillOpacity=".22" stroke="#304c3a" strokeWidth="1.5"/></svg><strong>{p.name}</strong><span>裁 {p.quantity??'待确认'} 片{p.onFold?' · 对折裁':''} · mm</span></button>;})}</div>
      <div className="piece-section-title"><h3>前衣身袋位设计</h3><span>拖动袋片定位；数字均为裁片毫米</span></div>
      <svg className="piece-placement" data-testid="piece-pocket-placement" viewBox={`${current.front.bounds.x} ${current.front.bounds.y} ${current.front.bounds.width} ${current.front.bounds.height}`} onPointerMove={e=>{const a=drag.current;if(a&&e.pointerId===a.pointer)setGhost({x:Math.round(a.sourceX+(e.clientX-a.x)*a.scaleX),y:Math.round(a.sourceY+(e.clientY-a.y)*a.scaleY)});}} onPointerUp={e=>{if(drag.current&&ghost){patch({pocket:{...d.pocket,xMm:ghost.x,yMm:ghost.y}});}drag.current=null;setGhost(undefined);e.currentTarget.releasePointerCapture?.(e.pointerId);}} onPointerCancel={()=>{drag.current=null;setGhost(undefined);}}>
        <path d={current.front.outline} fill={d.colors.front} fillOpacity=".15" stroke="#3c5944" strokeWidth="2"/><path d={`M${current.front.origin[0]} ${current.front.bounds.y+30}v${current.front.bounds.height-60}`} stroke="#80927e" strokeDasharray="6 5" fill="none"/>
        {d.pocket.kind!=='none'&&<g data-testid="draggable-pocket" transform={`translate(${current.front.pocketOffset[0]+(ghost?ghost.x-d.pocket.xMm:0)} ${current.front.pocketOffset[1]+(ghost?ghost.y-d.pocket.yMm:0)})`} style={{cursor:'move'}} onPointerDown={e=>{const svg=e.currentTarget.ownerSVGElement!;const m=svg.getScreenCTM()!;drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,sourceX:d.pocket.xMm,sourceY:d.pocket.yMm,scaleX:1/m.a,scaleY:1/m.d};svg.setPointerCapture(e.pointerId);setSelected('pocket');e.preventDefault();}}><path d={current.front.pocketCut} fill="none" stroke="#b07442" strokeWidth="1" strokeDasharray="4 3"/><path d={current.front.pocketNet} fill={d.colors.pocket} stroke="#304c3a" strokeWidth="2"/></g>}
      </svg><p className="piece-muted">袋片净样和裁边同时移动；距衣身边界不足10mm会阻止生成。衣身及袖片按配缝重算，不以画面拖动改变尺寸。</p>
      <div className="piece-section-title"><h3>配套与配缝检查</h3><span>源净边实际弧长</span></div><table className="piece-join-table"><thead><tr><th>部位</th><th>两侧净长 mm</th><th>差值 mm</th><th>结果</th></tr></thead><tbody>{current.metadata.joins.map(j=><tr key={j.id}><td>{j.label}</td><td>{j.aLengthMm?.toFixed(2)??'待定'} / {j.bLengthMm?.toFixed(2)??'待定'}</td><td>{j.deltaMm?.toFixed(2)??'待定'}</td><td>{j.status==='passed'?'配套通过':j.status==='pending'?'工艺待确认':'不通过'}</td></tr>)}<tr><td>罗纹领条</td><td>领窝 {current.metrics.necklineMm.toFixed(1)} / 领条净长 {current.metrics.bandNetMm.toFixed(1)}</td><td>设计缩率 {(1-d.neckRatio)*100}%</td><td>回弹待实测</td></tr><tr><td>独立贴袋</td><td>{d.pocket.kind==='none'?'未选用':`${d.pocket.widthMm} × ${d.pocket.heightMm}；侧底装接 ${current.metrics.pocketAttachmentMm?.toFixed(1)}`}</td><td>袋口折边20 / 缝份6</td><td>{d.pocket.kind==='none'?'—':'袋位检查通过，试样待确认'}</td></tr></tbody></table>
    </>}
  </div><aside className="piece-design-inspector"><h3>组合方案</h3><label>方案名称<input aria-label="裁片组合方案名称" value={state.designName} onChange={e=>state.setDesignName(e.target.value)}/></label><p className="piece-muted">随顶部“保存”保存，支持撤销、重做与重开。</p>
    <label>衣身裁片<select aria-label="组合衣身裁片" value={state.activePatternId} onChange={e=>change({...configuration,activePatternId:e.target.value,construction:undefined,pieceDesign:d})}><option value="t-shirt">直身T恤 · Teagan</option><option value="womens-basic-tee">收腰T恤 · Teagan</option></select></label>
    <label>衣身松量<select aria-label="组合衣身松量" value={state.fit} onChange={e=>change({...configuration,fit:e.target.value as DesignConfiguration['fit']})}><option value="slim">修身</option><option value="regular">常规</option><option value="loose">宽松</option></select></label>
    {number('设计衣长 mm',state.measurements.totalLength,450,1000,value=>change({...configuration,measurements:{...state.measurements,totalLength:value}}))}
    <small>输入沿用源 HPS 衣长基准。拓领后肩颈点会下移，实际净衣长见规格{current?`：前 ${current.flatSpecification.rows[0].valueMm.toFixed(1)} / 后 ${current.flatSpecification.rows[1].valueMm.toFixed(1)} mm`:'，待重算'}。</small>
    <h3>配套袖片与领口</h3><label>袖片方案<select aria-label="组合袖片方案" value={Number(options.sleeveLength??.3)} onChange={e=>option('sleeveLength',Number(e.target.value))}><option value={.3}>常规短袖</option><option value={.65}>延伸短袖</option><option value={1}>最长短袖延伸</option></select></label>
    {TEE_PARAMETERS.filter(p=>p.key!=='sleeveLength').map(p=><div key={p.key}>{number(p.label,Number(options[p.key]??p.defaultValue),p.min!,p.max!,value=>option(p.key,value),p.step)}<small>{p.meaning}</small></div>)}
    <h3>配套领条</h3>{number('领条成品高 mm',d.neckWidthMm,8,35,value=>patch({neckWidthMm:value}))}{number('领条净长 / 领窝净长',d.neckRatio,.75,1,value=>patch({neckRatio:value}),.01)}
    <h3>独立贴袋裁片</h3><label>袋型<select aria-label="组合贴袋类型" value={d.pocket.kind} onChange={e=>patch({pocket:{...d.pocket,kind:e.target.value as PieceDesignSpec['pocket']['kind']}})}><option value="none">无口袋</option><option value="square">方底贴袋</option><option value="pointed">尖底贴袋</option><option value="round">圆角贴袋</option></select></label>
    {d.pocket.kind!=='none'&&<>{number('袋宽 mm',d.pocket.widthMm,60,180,value=>patch({pocket:{...d.pocket,widthMm:value}}))}{number('袋高 mm',d.pocket.heightMm,70,210,value=>patch({pocket:{...d.pocket,heightMm:value}}))}{number('袋中心距前中 mm',d.pocket.xMm,-220,220,value=>patch({pocket:{...d.pocket,xMm:value}}))}{number('袋口距肩颈最高点 mm',d.pocket.yMm,100,520,value=>patch({pocket:{...d.pocket,yMm:value}}))}</>}
    <h3>逐片配色</h3>{Object.entries({front:'前衣身',back:'后衣身',sleeve:'配套两袖',neckband:'罗纹领条',pocket:'贴袋'}).map(([key,label])=><label key={key}>{label}<input aria-label={`裁片配色${label}`} type="color" value={d.colors[key as keyof typeof d.colors]} onChange={e=>patch({colors:{...d.colors,[key]:e.target.value}})}/></label>)}
    <details><summary>来源与待确认项</summary><p>衣身、袖片：FreeSewing Teagan 4.10.2。领条与贴袋为尺寸化设计规则，未作生产验收。</p>{current?.pending.map(p=><p key={p}>{p}</p>)}</details>
  </aside></div>}
  </section>;
}
