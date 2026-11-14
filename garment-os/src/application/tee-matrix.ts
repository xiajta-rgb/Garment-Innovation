import { readConfiguration } from './design-document';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { defaultPieceDesign } from '@/lib/pattern/piece-design-spec';
import { requireDesignMatrixReady } from '@/data/templateStructuralReview';
import { ENGINE_VERSION,type DesignConfiguration } from '@/types/design';
import type { StandardSize } from '@/types/measurements';

export type TeeAxis='neck'|'sleeve'|'length'|'pocket'|'color';
export interface TeeCandidate { id:string; name:string; row:string; column:string; note:string; configuration:DesignConfiguration }
export interface TeeSelection extends TeeCandidate { selectionId:string }
export const TEE_ROWS=[{id:'slim',label:'合体直身',note:'收净身量，保留基础肩型'},{id:'regular',label:'经典直身',note:'日常衣身松量，基础款主线'},{id:'loose',label:'宽松直身',note:'增加围度，不额外加落肩'}] as const;
export const TEE_AXES:{id:TeeAxis;label:string;columns:{label:string;note:string}[]}[]=[
  {id:'neck',label:'领口',columns:[{label:'小圆领',note:'领窝收拢，领条成品高20mm'},{label:'经典圆领',note:'基础领宽领深，领条成品高18mm'},{label:'舒展圆领',note:'加宽加深领窝，领条成品高15mm'}]},
  {id:'sleeve',label:'袖型',columns:[{label:'利落短袖',note:'缩短袖下口延伸，袖口较收净'},{label:'日常短袖',note:'适中袖下口延伸与宽度余量'},{label:'延伸短袖',note:'延长袖下口段，放宽袖口余量'}]},
  {id:'length',label:'衣长',columns:[{label:'利落衣长',note:'在当前基础衣长上减30mm'},{label:'基础衣长',note:'保留当前基础衣长'},{label:'延长衣长',note:'在当前基础衣长上加40mm'}]},
  {id:'pocket',label:'贴袋',columns:[{label:'无袋净面',note:'保留完整前衣身，突出廓形'},{label:'方底贴袋',note:'独立平口贴袋，方底结构'},{label:'尖底贴袋',note:'独立平口贴袋，尖底结构'}]},
  {id:'color',label:'配色',columns:[{label:'同色基础',note:'衣身、袖片与领条同色'},{label:'撞色领条',note:'只改变领条颜色'},{label:'撞色袖领',note:'两袖、领条及已有贴袋用配色'}]},
];
export function newTeeBase(size:StandardSize='M'):DesignConfiguration {
  const color='#e8e5dc',pieceDesign=defaultPieceDesign(color),measurements=getReferenceMeasurements('male',size);
  // Design length is a declared starting proposal, separate from the reference body's measurements.
  measurements.totalLength=Math.round(measurements.totalLength*1.1);
  return readConfiguration({activePatternId:'t-shirt',gender:'male',standardSize:size,fit:'regular',measurements,engineVersion:ENGINE_VERSION,garmentColor:color,fabricId:'solid',construction:{schema:'garment-os/construction/v1',options:{sleeveLength:.3,sleeveEase:.15,necklineDepth:.25,necklineWidth:.3}},pieceDesign:{...pieceDesign,colors:{front:color,back:color,sleeve:color,neckband:color,pocket:color},pocket:{...pieceDesign.pocket,kind:'none'}}});
}
export function readTeeBase(value:unknown){
  const c=readConfiguration(value);
  if(c.activePatternId!=='t-shirt'||c.gender!=='male'||!c.pieceDesign)throw Error('选款方案需为配套的男士短袖T恤');
  return c;
}
export function resizeTeeBase(input:DesignConfiguration,size:StandardSize){
  const base=readTeeBase(input),measurements=getReferenceMeasurements('male',size);
  const lengthRatio=base.measurements.totalLength/(base.measurements.hpsToWaistBack!+base.measurements.hipDepth);
  measurements.totalLength=Math.round((measurements.hpsToWaistBack!+measurements.hipDepth)*lengthRatio);
  return readTeeBase({...base,standardSize:size,measurements});
}
export function buildTeeMatrix(input:DesignConfiguration,axis:TeeAxis,accent='#344b42'):TeeCandidate[]{
  requireDesignMatrixReady();
  const base=readTeeBase(input),dimension=TEE_AXES.find(d=>d.id===axis);
  if(!dimension)throw Error('不支持的矩阵维度');
  if(!/^#[a-f\d]{6}$/i.test(accent))throw Error('配色无效');
  return TEE_ROWS.flatMap((row,r)=>dimension.columns.map((column,c)=>{
    const configuration=structuredClone(base),d=configuration.pieceDesign!;
    configuration.construction??={schema:'garment-os/construction/v1',options:{}};
    const o=configuration.construction.options;
    configuration.fit=row.id;
    if(axis==='neck'){o.necklineWidth=[.22,.3,.4][c];o.necklineDepth=[.2,.25,.36][c];d.neckWidthMm=[20,18,15][c];}
    if(axis==='sleeve'){o.sleeveLength=[.2,.45,.8][c];o.sleeveEase=[.05,.15,.3][c];}
    if(axis==='length')configuration.measurements.totalLength=base.measurements.totalLength+[-30,0,40][c];
    if(axis==='pocket')d.pocket.kind=(['none','square','pointed'] as const)[c];
    if(axis==='color'){const main=d.colors.front;d.colors={front:main,back:main,sleeve:c===2?accent:main,neckband:c>0?accent:main,pocket:c===2?accent:main};}
    return {id:`${axis}-${row.id}-${c}`,name:`${row.label} · ${column.label}`,row:row.id,column:column.label,note:column.note,configuration:readConfiguration(configuration),code:`T${r+1}${c+1}`};
  }));
}
/** Common scale for all nine technical views; mm coordinates are never stretched. */
export function teeMatrixScale(base:DesignConfiguration){return Math.min(.5,390/Math.max(base.measurements.totalLength,base.measurements.bust*1.2));}
export const teeConfigurationKey=(c:DesignConfiguration)=>JSON.stringify(c);
export function readTeeSelections(value:unknown):TeeSelection[]{
  if(!Array.isArray(value)||value.length>24)throw Error('选款夹记录无效');
  return value.map(v=>{
    if(!v||typeof v!=='object'||typeof v.selectionId!=='string'||typeof v.id!=='string'||typeof v.name!=='string'||typeof v.column!=='string'||typeof v.row!=='string'||typeof v.note!=='string')throw Error('选款夹记录缺少设计信息');
    return {...v,configuration:readTeeBase(v.configuration)};
  });
}
