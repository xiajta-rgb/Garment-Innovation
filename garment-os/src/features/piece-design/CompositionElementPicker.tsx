import { RedesignBatchControls } from './RedesignBatchControls';
import { RedesignMethodControls } from './RedesignMethodControls';
import { ProfessionalAssetLibrary } from './ProfessionalAssetLibrary';
import { MiniOptionThumb } from './MiniOptionThumb';
export { MiniOptionThumb } from './MiniOptionThumb';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CompositionPlan, CompositionSource, CompositionView } from '@/types/piece-composition';
import type { CompositionElements, CompositionGraphic, GraphicKind } from '@/types/composition-elements';
import type { ManagedMaterial, MaterialPage } from '@/types/managed-material';
import { DEFAULT_COMPOSITION_ELEMENTS, DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_DETAILS } from '@/lib/pattern/composition-elements';
import { TagDesignControls } from './TagDesignControls';
import { COMPOSITION_FABRICS } from '@/application/composition-decoration';
import { compositionCatalogue, compositionStarter, replaceCompositionAsset } from '@/application/composition-catalogue';
import { MATERIAL_API, canAssignMaterial } from '@/application/managed-materials';
import { loadMaterialHome, materialApi, MATERIAL_HOME_QUERY } from '@/features/asset-library/managed-material-browser';
import { MaterialImage } from '@/features/asset-library/MaterialImage';
import { logoRaster, materialRaster } from './composition-raster';
import { VIEW_LABELS } from './composition-views';
import './composition-elements.css';

const tabs=[['batch','批量改款'],['redesign','改款方案'],['library','专业素材'],['pants','裤型 / 腰头'],['detail','拼片 / 收口 / 帽体'],['structure','肩袖 / 领型'],['craft','开襟 / 工艺'],['tags','标签组合'],['color','撞色配色'],['pocket','口袋'],['logo','Logo'],['fabric','面料']] as const;
const uid=()=>crypto.randomUUID();
function piecesOption(plan:CompositionPlan,key:string):number{
 const value=plan.pieces.find(p=>p.source.templateId==='elastic-waist-pants')?.source.construction?.options[key];
 return typeof value==='number'?value:key==='heelEase'?.05:key==='waistbandWidth'?.03:0;
}
function CraftNumber({label,name,value,min,max,disabled,onChange}:{label:string;name:string;value:number;min:number;max:number;disabled?:boolean;onChange:(n:number)=>void}){
 const [invalid,setInvalid]=useState(false);
 return <label>{label}<input aria-label={name} type="number" min={min} max={max} defaultValue={value} disabled={disabled} aria-invalid={invalid} onChange={()=>setInvalid(false)} onBlur={event=>{const value=Number(event.target.value);if(!event.target.value.trim()||!Number.isFinite(value)||value<min||value>max){setInvalid(true);return;}onChange(value);}} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/>{invalid&&<small role="alert">请输入 {min}–{max}</small>}</label>;
}
function StructureThumb({kind}:{kind:CompositionElements['shoulder']}){
 const body=kind==='raglan'?'M42 15Q47 37 27 53L27 98H93V53Q73 37 78 15Z':kind==='drop'?'M42 15L25 25Q24 40 27 53V98H93V53Q96 40 95 25L78 15Z':'M42 15L34 22Q35 43 27 53V98H93V53Q85 43 86 22L78 15Z';
 return <svg viewBox="0 0 120 110" aria-hidden="true"><path d="M42 15L24 23L6 51L23 61L27 53V98H93V53L97 61L114 51L96 23L78 15Q60 31 42 15Z" fill="#566c7c" stroke="#263a30" strokeWidth="1.5" strokeLinejoin="round"/><path d={body} fill="#e5e5db" stroke="#263a30" strokeWidth="1.2"/><path d="M42 15Q60 34 78 15L75 16Q60 28 45 16Z" fill="#566c7c"/><path d="M28 94H92M9 49L25 58M95 58L111 49" stroke="#35483c" strokeWidth=".7"/></svg>;
}
type Choice = readonly [string, string];
function ChoicePreviews({label,value,options,kind,onChange}:{label:string;value:string;options:Choice[];kind:string;onChange:(value:string)=>void}){
 return <div className="composition-choice-previews" aria-label={`${label}示意图`}><span>{label}示意</span><div>{options.map(([id,text])=><button type="button" key={id} aria-pressed={value===id} onClick={()=>onChange(id)}><MiniOptionThumb kind={kind} value={id}/><small>{text}</small></button>)}</div></div>;
}
interface Props {onCreatePlans:(plans:CompositionPlan[])=>void;onReferences?:()=>void;plans:CompositionPlan[];onCreatePlan:(p:CompositionPlan)=>void;plan:CompositionPlan;source:CompositionSource;view:CompositionView;onChange:(plan:CompositionPlan)=>void;onSelectGraphic:(id:string)=>void;onError:(message:string)=>void}
export function CompositionElementPicker({plan,plans,source,view,onChange,onCreatePlan,onCreatePlans,onReferences,onSelectGraphic,onError}:Props){
 const pants=source.templateId==='elastic-waist-pants';
 const visibleTabs=tabs.filter(([id])=>!pants||['batch','redesign','library','pants','color','logo','fabric'].includes(id));
 const [tab,setTab]=useState<(typeof tabs)[number][0]>(plan.redesign?'redesign':pants?'pants':'structure'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [materialSlot,setMaterialSlot]=useState<'main'|'neck'|'cuff'|'hem'>('main');
 const latest=useRef({plan,onChange,onSelectGraphic,onError,source});useLayoutEffect(()=>{latest.current={plan,onChange,onSelectGraphic,onError,source};});
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const e=plan.elements??DEFAULT_COMPOSITION_ELEMENTS;
  function ready(p=plan):CompositionPlan{
  return p.pieces.length?p:{...p,pieces:compositionStarter(source,uid)};
 }
 function changePantsOptions(patch:Record<string,number>){
  const p=ready(),options={seatEase:.05,heelEase:.05,lengthBonus:0,waistbandWidth:.03,...(p.pieces[0]?.source.construction?.options??{}),...patch};
  const construction={schema:'garment-os/construction/v1' as const,options};
  onChange({...p,pieces:p.pieces.map(piece=>({...piece,source:{...piece.source,templateId:'elastic-waist-pants',construction}}))});
 }
 function change(patch:Partial<CompositionElements>,mainColor?:string){
  const p=ready();onChange({...p,pieces:mainColor?p.pieces.map(piece=>({...piece,color:mainColor})):p.pieces,elements:{...(p.elements??structuredClone(DEFAULT_COMPOSITION_ELEMENTS)),tagIntent:undefined,...patch}});
 }
 function pockets(count:number){
  let p=ready();const src=p.pieces.find(p=>p.assetKey==='body-front')?.source??{...source,templateId:'t-shirt',construction:undefined};
  const cat=compositionCatalogue(src),asset=cat.assets.find(a=>a.key==='design.patch-pocket');if(!asset){onError(`当前${source.templateId==='elastic-waist-pants'?'男裤':'模板'}尚未接通贴袋，请先补同源裁片`);return;}
  const existing=p.pieces.filter(p=>p.assetKey==='design.patch-pocket');
  if(existing.length===count){if(count)onSelectGraphic(existing[0].id);return;}
  const retained=existing.slice(0,count),ids=new Set(retained.map(p=>p.id));
  p={...p,pieces:p.pieces.filter(p=>p.assetKey!=='design.patch-pocket'||ids.has(p.id))};
  for(let i=retained.length;i<count;i++)p=replaceCompositionAsset(p,asset,cat,uid,'front',i===0?315:185,285).plan;
  onChange(p);if(count>0)onSelectGraphic(p.pieces.filter(p=>p.assetKey==='design.patch-pocket').at(-1)!.id);
 }
 function addGraphic(kind:GraphicKind,image?:CompositionGraphic['image'],text?:string){
  const p=ready(latest.current.plan),e=p.elements??structuredClone(DEFAULT_COMPOSITION_ELEMENTS);if(e.graphics.length>=12){onError('每个方案最多12个Logo');return;}
  const g:CompositionGraphic={id:uid(),kind,text:text??(kind==='monogram'?'SL':'STUDIO'),color:'#eee7d7',view,x:view==='side'?250:315,y:270,width:kind==='text'?72:38,height:kind==='text'?18:38,...(image?{image}:{})};
  if(image){g.width=65;g.height=Math.max(5,Math.min(160,65*image.height/image.width));}
  latest.current.onChange({...p,elements:{...e,graphics:[...e.graphics,g]}});latest.current.onSelectGraphic(g.id);
 }
 async function upload(file:File){const token=++generation.current;setBusy(true);setNotice('');try{const image=await logoRaster(file);if(token===generation.current)addGraphic('image',image,file.name.slice(0,40));}catch(error){if(token===generation.current)latest.current.onError(String(error));}finally{if(token===generation.current)setBusy(false);}}
 async function applyMaterial(material:ManagedMaterial,page:MaterialPage){
  if(!canAssignMaterial(material))return;const token=++generation.current,slot=materialSlot;setBusy(true);setNotice('正在读取来源图片…');onError('');
  try{
   const image=material.materialPic?await materialRaster(material):undefined;if(token!==generation.current)return;
   const p=ready(latest.current.plan),e=p.elements??structuredClone(DEFAULT_COMPOSITION_ELEMENTS),materialImages={...e.materialImages};
   if(image)materialImages[slot]={...image,materialId:material.materialId};else delete materialImages[slot];
   const assignment={source:'basedata.material.list' as const,version:'1' as const,endpoint:page.endpoint,fetchedAt:page.fetchedAt,material:structuredClone(material)};
   latest.current.onChange({...p,elements:{...e,materials:{...e.materials,[slot]:assignment},materialImages,...(slot==='neck'?{neckContrast:true}:slot==='cuff'?{cuffContrast:true}:{})}});
   setNotice(image?`已套用：${material.materialName}`:`已关联：${material.materialName}；来源未提供图片`);
  }catch(error){if(token===generation.current){latest.current.onError(error instanceof Error?error.message:'面料未套用');setNotice('面料未套用，请重试或选择其他面料');}}finally{if(token===generation.current)setBusy(false);}
 }
 const pocketCount=plan.pieces.filter(p=>p.assetKey==='design.patch-pocket').length;
 const mainColor=plan.pieces.find(p=>p.assetKey==='body-front')?.color??'#364038';
 const craft={...DEFAULT_COMPOSITION_CRAFT,...e.craft};
 const details={...DEFAULT_COMPOSITION_DETAILS,...e.details};
 const changeDetails=(patch:Partial<typeof details>)=>change({details:{...details,...patch}});
 const changeCraft=(patch:Partial<typeof craft>)=>change({craft:{...craft,...patch}});
 const setNeck=(neckline:CompositionElements['neckline'])=>change({neckline,...(neckline!=='crew'?{details:{...details,hood:'none',drawcord:false}}:{}),craft:{...craft,opening:neckline==='henley'?'buttons':neckline==='polo'?(craft.opening==='quarter-zip'?'quarter-zip':'buttons'):neckline==='v'?'none':craft.opening}});
  return <section className="composition-picker composition-element-picker" aria-label="改款元素选择" data-testid="composition-element-picker">
  <header><div><h3>改款元素</h3><p>{pants?'裤型、腰头、Logo和面料自由组合，正背侧固定锚点同步呈现。':'肩袖结构、撞色、Logo和面料自由组合，正背侧同步呈现。'}</p></div><span className="composition-element-status">设计视图 · 结构改款待制版</span></header>
  <div className="composition-element-tabs" role="tablist" aria-label="改款元素分类" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=visibleTabs.findIndex(([id])=>id===tab),next=event.key==='Home'?0:event.key==='End'?visibleTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+visibleTabs.length)%visibleTabs.length;setTab(visibleTabs[next][0]);document.getElementById(`element-tab-${visibleTabs[next][0]}`)?.focus();}}>{visibleTabs.map(([id,label])=><button key={id} role="tab" tabIndex={tab===id?0:-1} aria-selected={tab===id} aria-controls="composition-element-panel" id={`element-tab-${id}`} onClick={()=>setTab(id)}>{label}</button>)}</div>
  <div id="composition-element-panel" role="tabpanel" aria-labelledby={`element-tab-${tab}`}>
  {tab==='batch'&&<RedesignBatchControls plan={plan} plans={plans} source={source} onCreatePlans={onCreatePlans} onReferences={onReferences}/>}
  {tab==='redesign'&&<RedesignMethodControls plan={plan} plans={plans} source={source} onCreatePlan={onCreatePlan} onReferences={onReferences}/>}
  {tab==='library'&&<ProfessionalAssetLibrary plan={plan} source={source} onChange={onChange} onError={onError}/>}
  {tab==='pants'&&source.templateId==='elastic-waist-pants'&&<div className="composition-craft-fields" data-testid="pants-design-controls"><p className="composition-element-help">男裤结构裁片固定锚点；这里只改变源制图参数，腰头、前后裤片和侧面参考不会自由漂移。</p><div className="composition-structure-cards"><button aria-pressed={Math.abs(Number(piecesOption(plan,'heelEase'))-.05)<.001} onClick={()=>changePantsOptions({heelEase:.05,lengthBonus:0})}><MiniOptionThumb kind="pants-fit" value="straight"/><strong>标准直筒</strong><small>脚口通过松量 5%</small></button><button aria-pressed={Number(piecesOption(plan,'heelEase'))>.2} onClick={()=>changePantsOptions({heelEase:.3,lengthBonus:0})}><MiniOptionThumb kind="pants-fit" value="wide"/><strong>宽腿廓形</strong><small>脚口通过松量 30%</small></button><button aria-pressed={Number(piecesOption(plan,'heelEase'))<.01} onClick={()=>changePantsOptions({heelEase:0,lengthBonus:.02})}><MiniOptionThumb kind="pants-fit" value="tapered"/><strong>微锥加长</strong><small>脚口收窄并保留裤长</small></button></div><div className="composition-craft-fields"><label>腰头完成高<select aria-label="男裤腰头完成高" value={String(piecesOption(plan,'waistbandWidth'))} onChange={event=>changePantsOptions({waistbandWidth:Number(event.target.value)})}><option value="0.03">常规 3%</option><option value="0.04">偏高 4%</option><option value="0.05">高腰 5%</option></select><ChoicePreviews label="腰头完成高" kind="waistband" value={String(piecesOption(plan,'waistbandWidth'))} options={[["0.03","常规"],["0.04","偏高"],["0.05","高腰"]]} onChange={value=>changePantsOptions({waistbandWidth:Number(value)})}/></label><label>裤长方案<select aria-label="男裤裤长方案" value={String(piecesOption(plan,'lengthBonus'))} onChange={event=>changePantsOptions({lengthBonus:Number(event.target.value)})}><option value="-0.1">九分长度</option><option value="0">常规长度</option><option value="0.05">加长长度</option></select><ChoicePreviews label="裤长方案" kind="pants-length" value={String(piecesOption(plan,'lengthBonus'))} options={[["-0.1","九分"],["0","常规"],["0.05","加长"]]} onChange={value=>changePantsOptions({lengthBonus:Number(value)})}/></label></div><p className="composition-element-help">袋型、门襟、腰袢和结构膝片尚未接入 Paco 同源净样，先保留为开发缺口，不用贴图冒充。</p></div>}
  {tab==='detail'&&<div className="composition-craft-fields">
   <label>袖口结构<select aria-label="袖口结构" value={details.cuffFinish} onChange={event=>changeDetails({cuffFinish:event.target.value as typeof details.cuffFinish})}><option value="turned">常规折边</option><option value="rib">独立罗纹袖口</option></select><ChoicePreviews label="袖口结构" kind="cuff" value={details.cuffFinish} options={[["turned","常规折边"],["rib","独立罗纹"]]} onChange={value=>changeDetails({cuffFinish:value as typeof details.cuffFinish})}/></label>
   {details.cuffFinish==='rib'&&<CraftNumber key={'cuff'+details.cuffHeightMm} label="罗纹袖口成品高 mm" name="罗纹袖口高度" value={details.cuffHeightMm} min={15} max={70} onChange={value=>changeDetails({cuffHeightMm:value})}/>}
   <label>下摆结构<select aria-label="下摆结构" value={details.hemFinish} onChange={event=>changeDetails({hemFinish:event.target.value as typeof details.hemFinish})}><option value="turned">常规折边</option><option value="rib">独立罗纹摆</option><option value="side-slit">侧缝开衩</option></select><ChoicePreviews label="下摆结构" kind="hem" value={details.hemFinish} options={[["turned","常规折边"],["rib","独立罗纹摆"],["side-slit","侧缝开衩"]]} onChange={value=>changeDetails({hemFinish:value as typeof details.hemFinish})}/></label>
   {details.hemFinish==='rib'&&<CraftNumber key={'hem'+details.hemHeightMm} label="罗纹摆成品高 mm" name="罗纹下摆高度" value={details.hemHeightMm} min={20} max={80} onChange={value=>changeDetails({hemHeightMm:value})}/>}
   {details.hemFinish==='side-slit'&&<CraftNumber key={'slit'+details.slitHeightMm} label="开衩设计高度 mm" name="开衩高度" value={details.slitHeightMm} min={20} max={120} onChange={value=>changeDetails({slitHeightMm:value})}/>}
   <label>衣身分割<select aria-label="衣身分割" value={details.panel} onChange={event=>changeDetails({panel:event.target.value as typeof details.panel})}><option value="none">无分割</option><option value="yoke">弧线育克拼片</option><option value="side">侧身拼片</option></select><ChoicePreviews label="衣身分割" kind="panel" value={details.panel} options={[["none","无分割"],["yoke","弧线育克"],["side","侧身拼片"]]} onChange={value=>changeDetails({panel:value as typeof details.panel})}/></label>
   {details.panel==='yoke'&&<CraftNumber key={'panel'+details.panelDepthMm} label="分割设计深度 mm" name="分割深度" value={details.panelDepthMm} min={60} max={220} onChange={value=>changeDetails({panelDepthMm:value})}/>}
   <label>拼片 / 罗纹颜色<input aria-label="拼片配色" type="color" value={details.panelColor} onChange={event=>changeDetails({panelColor:event.target.value})}/></label>
   <label>帽体结构<select aria-label="帽体结构" value={details.hood} onChange={event=>{const hood=event.target.value as typeof details.hood;change({neckline:hood==='none'?e.neckline:'crew',craft:{...craft,opening:'none'},details:{...details,hood,drawcord:hood==='none'?false:details.drawcord}});}}><option value="none">无帽</option><option value="two-piece">两片垂帽</option><option value="three-piece">三片垂帽</option></select><ChoicePreviews label="帽体结构" kind="hood" value={details.hood} options={[["none","无帽"],["two-piece","两片垂帽"],["three-piece","三片垂帽"]]} onChange={value=>{const hood=value as typeof details.hood;change({neckline:hood==='none'?e.neckline:'crew',craft:{...craft,opening:'none'},details:{...details,hood,drawcord:hood==='none'?false:details.drawcord}})}}/></label>
   {details.hood!=='none'&&<><CraftNumber key={'hood'+details.hoodHeightMm} label="帽高设计值 mm" name="帽高" value={details.hoodHeightMm} min={250} max={400} onChange={value=>changeDetails({hoodHeightMm:value})}/><label><input aria-label="帽绳套件" type="checkbox" checked={details.drawcord} onChange={event=>changeDetails({drawcord:event.target.checked})}/>帽口绳道 / 鸡眼 / 帽绳</label></>}
   <p className="composition-element-help">尺寸为设计比例。拼片有闭合色区与共享边界；新增净样、罗纹伸缩率、帽颈配缝和内部工艺仍需制版核验。</p>
  </div>}
  {tab==='structure'&&<div className="composition-structure-controls"><div className="composition-structure-cards">{([['set-in','装袖短袖','肩端接袖'],['raglan','插肩短袖','袖片延伸至领口'],['drop','落肩短袖','肩缝外移']] as const).map(([id,label,description])=><button key={id} data-design-shoulder={id} aria-pressed={e.shoulder===id} onClick={()=>change({shoulder:id})}><StructureThumb kind={id}/><strong>{label}</strong><small>{description}</small></button>)}</div><ChoicePreviews label="领型" kind="neckline" value={e.neckline} options={[["crew","圆领"],["v","V领"],["henley","亨利领"],["polo","Polo领"],["stand","立领"]]} onChange={value=>setNeck(value as CompositionElements['neckline'])}/></div>}
  {tab==='craft'&&<div className="composition-craft-controls"><div className="composition-craft-fields">
   <label>门襟 / 开合<select aria-label="门襟开合" value={craft.opening} onChange={event=>changeCraft({opening:event.target.value as typeof craft.opening})}>{([['none','无开襟'],['buttons','纽扣短门襟'],['quarter-zip','半开襟拉链'],['full-zip','全开襟拉链']] as const).filter(([id])=>e.neckline==='henley'?id==='buttons':e.neckline==='polo'?['buttons','quarter-zip'].includes(id):e.neckline==='v'?id==='none':true).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><ChoicePreviews label="门襟 / 开合" kind="opening" value={craft.opening} options={([['none','无开襟'],['buttons','纽扣短门襟'],['quarter-zip','半开襟拉链'],['full-zip','全开襟拉链']] as const).filter(([id])=>e.neckline==='henley'?id==='buttons':e.neckline==='polo'?['buttons','quarter-zip'].includes(id):e.neckline==='v'?id==='none':true)} onChange={value=>changeCraft({opening:value as typeof craft.opening})}/></label>
   {craft.opening!=='none'&&<><CraftNumber key={'openingLengthMm'+craft.openingLengthMm} label="开口设计长度 mm" name="开口设计长度" value={craft.openingLengthMm} min={60} max={350} disabled={craft.opening==='full-zip'} onChange={value=>changeCraft({openingLengthMm:value})}/><CraftNumber key={'placketWidthMm'+craft.placketWidthMm} label="门襟设计宽度 mm" name="门襟设计宽度" value={craft.placketWidthMm} min={10} max={50} onChange={value=>changeCraft({placketWidthMm:value})}/></>}
   {['stand','polo'].includes(e.neckline)&&<CraftNumber key={'collarHeightMm'+craft.collarHeightMm} label="领高设计值 mm" name="领高设计值" value={craft.collarHeightMm} min={15} max={70} onChange={value=>changeCraft({collarHeightMm:value})}/>}
   {!['stand','polo'].includes(e.neckline)&&<label>领口处理<select aria-label="领口工艺" value={craft.neckFinish} onChange={event=>changeCraft({neckFinish:event.target.value as typeof craft.neckFinish})}><option value="rib">罗纹领条</option><option value="binding">窄包边</option></select><ChoicePreviews label="领口处理" kind="neck-finish" value={craft.neckFinish} options={[["rib","罗纹领条"],["binding","窄包边"]]} onChange={value=>changeCraft({neckFinish:value as typeof craft.neckFinish})}/></label>}
   <CraftNumber key={'bindingWidthMm'+craft.bindingWidthMm} label="包边 / 包条成品宽 mm" name="包边设计宽度" value={craft.bindingWidthMm} min={3} max={20} onChange={value=>changeCraft({bindingWidthMm:value})}/>
   <label>肩袖拼缝<select aria-label="肩袖拼缝工艺" value={craft.seamFinish} onChange={event=>changeCraft({seamFinish:event.target.value as typeof craft.seamFinish})}><option value="plain">常规拼缝</option><option value="topstitch">外露压线</option><option value="piping">嵌边 / 嵌条</option></select><ChoicePreviews label="肩袖拼缝" kind="seam" value={craft.seamFinish} options={[["plain","常规拼缝"],["topstitch","外露压线"],["piping","嵌边 / 嵌条"]]} onChange={value=>changeCraft({seamFinish:value as typeof craft.seamFinish})}/></label>
   <label>配料颜色<input aria-label="工艺配料颜色" type="color" value={craft.trimColor} onChange={event=>changeCraft({trimColor:event.target.value})}/></label>
  </div><label><input type="checkbox" aria-label="后领内侧包条" checked={craft.backNeckTape} onChange={event=>changeCraft({backNeckTape:event.target.checked})}/>后领内侧包条</label><p className="composition-element-help">设计值用于轮廓与比例表达；拉链、门襟贴边、领片及包条净样与工序配套尚需完善。全开襟需拆分左右前片。</p></div>}
  {tab==='tags'&&<TagDesignControls key={plan.id} plan={plan} source={source} onChange={onChange} onError={onError}/>}
  {tab==='color'&&<><div className="composition-color-controls"><label>主色<input type="color" aria-label="服装主色" value={mainColor} onChange={event=>change({},event.target.value)}/></label>{([['sleeve','袖片撞色'],['neck','领口撞色'],['cuff','袖口撞色']] as const).map(([key,label])=><div key={key} className="composition-contrast-control"><label><input type="checkbox" aria-label={label} checked={e[`${key}Contrast`]} onChange={event=>change({[`${key}Contrast`]:event.target.checked})}/>{label}</label><input type="color" aria-label={`${label}颜色`} value={e[`${key}Color`]} onChange={event=>change({[`${key}Color`]:event.target.value,[`${key}Contrast`]:true})}/></div>)}</div><div className="composition-color-presets"><span>配色参考</span>{[{name:'海军 × 米白',main:'#ece7dc',accent:'#344b65'},{name:'灰绿 × 浅沙',main:'#3e5149',accent:'#dbceae'},{name:'浅灰 × 炭黑',main:'#d3d5d2',accent:'#2d3335'}].map(p=><button key={p.name} onClick={()=>change({sleeveContrast:true,neckContrast:true,cuffContrast:true,sleeveColor:p.accent,neckColor:p.accent,cuffColor:p.accent},p.main)}><svg className="composition-color-preview" viewBox="0 0 56 38" aria-hidden="true"><path d="M20 5 11 10 4 18l8 5 4-4v14h24V19l4 4 8-5-7-8-9-5q-8 7-16 0Z" fill={p.main} stroke="#3d5b4a"/><path d="M20 5q8 7 16 0" fill="none" stroke={p.accent} strokeWidth="4"/><path d="M12 23h5v10h-5zm27 0h5v10h-5z" fill={p.accent}/></svg><i style={{background:p.main}}/><i style={{background:p.accent}}/>{p.name}</button>)}</div></>}
  {tab==='pocket'&&<div className="composition-pocket-options"><ChoicePreviews label="口袋数量" kind="pocket" value={String(pocketCount)} options={[["0","无口袋"],["1","单胸贴袋"],["2","双胸贴袋"]]} onChange={value=>pockets(Number(value))}/><p>口袋可在画布拖动定位，选中后调整大小与配色。</p></div>}
  {tab==='logo'&&<><div className="composition-logo-options"><ChoicePreviews label="Logo类型" kind="logo" value="" options={[["text","文字标"],["monogram","字母框标"],["emblem","几何山形标"]]} onChange={value=>addGraphic(value as GraphicKind)}/><label className="composition-upload">＋ 上传Logo<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传Logo" disabled={busy||e.graphics.length>=12} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.target.value='';}}/></label></div><p className="composition-element-help">加入{VIEW_LABELS[view]}，可改文字、配色、大小与位置。内置图形为通用设计素材，支持上传自己的Logo。</p>{e.graphics.length>0&&<div className="composition-graphic-list">{e.graphics.map(g=><button key={g.id} onClick={()=>onSelectGraphic(g.id)}>{g.text} · {VIEW_LABELS[g.view]}</button>)}</div>}</>}
  {tab==='fabric'&&<><div className="composition-fabric-presets" aria-label="面料肌理">{COMPOSITION_FABRICS.map(f=><button key={f.id} data-design-fabric={f.id} aria-pressed={e.fabric===f.id&&!e.materials?.main} onClick={()=>{const materials={...e.materials},images={...e.materialImages};delete materials.main;delete images.main;change({fabric:f.id,materials,materialImages:images});}}><span className={`composition-swatch swatch-${f.id}`}/>{f.name}</button>)}</div><details className="composition-enterprise-materials"><summary>从企业面料库选择 {Object.keys(e.materials??{}).length>0&&`· 已选 ${Object.keys(e.materials??{}).length} 个部位`}</summary><label>套用部位<select aria-label="设计面料套用部位" value={materialSlot} onChange={event=>setMaterialSlot(event.target.value as typeof materialSlot)}><option value="main">主体 / 袖片 / 口袋</option><option value="neck">领口</option><option value="cuff">袖口</option><option value="hem">罗纹下摆</option></select></label><MaterialChoices busy={busy} onApply={(m,page)=>void applyMaterial(m,page)}/></details>{Object.entries(e.materials??{}).map(([slot,a])=><div className="composition-material-chip" key={slot}><span>{{main:'主体',neck:'领口',cuff:'袖口',hem:'下摆'}[slot]} · {a.material.materialName}{!e.materialImages?.[slot as 'main']?'（资料关联）':''}</span><button aria-label={`移除${slot}面料`} onClick={()=>{const materials={...e.materials},images={...e.materialImages};delete materials[slot as 'main'];delete images[slot as 'main'];change({materials,materialImages:images});}}>×</button></div>)}<p className="composition-element-help">肌理预设为设计示意；企业面料使用来源图片套入轮廓，实际比例与颜色以实样为准。</p></>}
  {notice&&<p role="status" className="composition-element-help">{notice}</p>}
  </div>
 </section>;
}

function MaterialChoices({busy,onApply}:{busy:boolean;onApply:(m:ManagedMaterial,page:MaterialPage)=>void}){
 const [page,setPage]=useState<MaterialPage>(),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const ticket=useRef(0),mounted=useRef(false);
 useEffect(()=>{let live=true;mounted.current=true;const id=++ticket.current;
  materialApi<{configured:boolean;endpoint:string}>(MATERIAL_API+'/connection').then(async connection=>{if(!connection.configured)throw Error('企业面料尚未连接，请在资产库的面料管理中配置');const result=await loadMaterialHome(connection.endpoint);if(live&&id===ticket.current)setPage(result);}).catch(error=>{if(live&&id===ticket.current)setError(error.message);}).finally(()=>{if(live&&id===ticket.current)setLoading(false);});return()=>{live=false;mounted.current=false;};
 },[]);
 async function search(pageNo=1){const id=++ticket.current;setLoading(true);setError('');try{const result=await materialApi<MaterialPage>(MATERIAL_API,{...MATERIAL_HOME_QUERY,materialName:query,pageNo});if(mounted.current&&id===ticket.current)setPage(result);}catch(error){if(mounted.current&&id===ticket.current){setPage(undefined);setError(String(error));}}finally{if(mounted.current&&id===ticket.current)setLoading(false);}}
 return <div className="composition-material-choices"><form onSubmit={event=>{event.preventDefault();void search();}}><input aria-label="设计面料名称查询" placeholder="搜索企业面料名称" value={query} onChange={event=>{ticket.current++;setQuery(event.target.value);setPage(undefined);setLoading(false);setError('');}}/><button disabled={loading||busy}>查询</button></form>{loading?<p role="status">正在读取企业面料…</p>:error?<p role="alert">{error}</p>:<><div className="composition-material-cards">{page?.items.slice().sort((a,b)=>Number(!!b.materialPic)-Number(!!a.materialPic)).map(m=><button key={m.materialId} data-composition-material={m.materialId} disabled={busy||!canAssignMaterial(m)} onClick={()=>onApply(m,page)}><MaterialImage material={m} compact/><strong>{m.materialName??'未提供名称'}</strong><small>{m.materialCode??m.materialId}</small><span>{m.materialPic?'选择并套用图片':'关联资料 · 无图片'}</span></button>)}</div>{!page&&<p>条件已更改，请点击查询。</p>}{page&&!page.items.length&&<p>没有查到符合条件的面料</p>}{page&&<div className="composition-material-paging"><button disabled={loading||busy||page.pageNo<=1} onClick={()=>void search(page.pageNo-1)}>上一页</button><span>第 {page.pageNo} 页</span><button disabled={loading||busy||!page.mayHaveNext} onClick={()=>void search(page.pageNo+1)}>下一页</button></div>}</>}</div>;
}
