import { newTeeBase,readTeeBase } from './tee-matrix';
import type { TeeDesignIntent,TeeDesignCandidate,TeeDesignAxis,TeeDesignSelection } from '@/types/tee-design';
import type { DesignConfiguration } from '@/types/design';
import { requireDesignMatrixReady } from '@/data/templateStructuralReview';
export const TEE_DESIGN_LABELS={
  neckline:{crew:'罗纹圆领',v:'V领',henley:'亨利领',mock:'小高领'},
  shoulder:{'set-in':'标准装袖',drop:'落肩装袖',raglan:'插肩袖'},
  silhouette:{regular:'经典直身',boxy:'宽短箱型',oversized:'宽大廓形'},
  fabric:{jersey:'平纹汗布',waffle:'华夫格',rib:'坑条罗纹',pique:'珠地',slub:'竹节肌理'},
  sleeve:{short:'常规短袖',elbow:'及肘袖',turnup:'翻折袖口'},
  hem:{straight:'平直下摆',split:'侧开叉',curved:'弧形下摆'},
  blocking:{solid:'同色净面',sleeve:'肩袖撞色',side:'侧片拼色'},
} as const;
export const TEE_DESIGN_ROWS=[{id:'set-in',label:'标准装袖',note:'肩端装袖 · 基础肩型'},{id:'drop',label:'落肩装袖',note:'肩线外延 · 宽松袖窿'},{id:'raglan',label:'插肩袖',note:'领口至腋下 · 斜向分割'}] as const;
export const TEE_DESIGN_AXES:{id:TeeDesignAxis;label:string;values:string[];notes:string[]}[]=[
  {id:'neckline',label:'领型',values:['crew','v','henley'],notes:['圆弧领窝 · 罗纹领条','V形领窝 · 前中拼接','圆领开襟 · 三粒扣']},
  {id:'fabric',label:'面料组织',values:['jersey','waffle','rib'],notes:['干净平整 · 细密针织','凹凸方格 · 立体组织','纵向坑条 · 方向感']},
  {id:'silhouette',label:'廓形',values:['regular','boxy','oversized'],notes:['常规围度与衣长','加宽减长 · 方正比例','明显加宽 · 加深袖窿']},
  {id:'sleeve',label:'袖型',values:['short','elbow','turnup'],notes:['标准短袖长度','延伸至肘部附近','独立翻折层次']},
  {id:'hem',label:'下摆',values:['straight','split','curved'],notes:['平齐双针卷边','前后摆分开 · 侧缝开叉','弧形摆线 · 连续卷边']},
  {id:'blocking',label:'拼色',values:['solid','sleeve','side'],notes:['组织与轮廓作为重点','按肩袖结构划分色块','身侧纵向拼片']},
];
export const DEFAULT_TEE_INTENT:TeeDesignIntent={schema:'garment-os/tee-design-intent/v1',neckline:'crew',shoulder:'set-in',silhouette:'regular',fabric:'jersey',sleeve:'short',hem:'straight',blocking:'solid',color:'#e7e2d5',accent:'#455b52'};
export const TEE_DESIGN_FAMILIES:{id:string;name:string;note:string;patch:Partial<TeeDesignIntent>}[]=[
  {id:'essential',name:'都市基础',note:'净面 / 装袖 / 圆领',patch:{...DEFAULT_TEE_INTENT}},
  {id:'sport',name:'运动插肩',note:'插肩 / 撞色 / 开叉',patch:{shoulder:'raglan',neckline:'crew',fabric:'jersey',blocking:'sleeve',hem:'split',silhouette:'regular',sleeve:'short',color:'#e5e1d7',accent:'#344e48'}},
  {id:'relaxed',name:'松弛落肩',note:'落肩 / 箱型 / 及肘袖',patch:{shoulder:'drop',neckline:'crew',fabric:'slub',blocking:'solid',hem:'straight',silhouette:'boxy',sleeve:'elbow',color:'#b9b7a6'}},
  {id:'waffle',name:'华夫肌理',note:'华夫格 / 亨利领',patch:{shoulder:'set-in',neckline:'henley',fabric:'waffle',blocking:'solid',hem:'curved',silhouette:'regular',sleeve:'short',color:'#d5c7ad'}},
  {id:'rib',name:'罗纹V领',note:'纵向坑条 / V领',patch:{shoulder:'set-in',neckline:'v',fabric:'rib',blocking:'solid',hem:'straight',silhouette:'regular',sleeve:'short',color:'#9caaa1'}},
  {id:'pique',name:'珠地箱型',note:'珠地 / 落肩 / 翻折袖',patch:{shoulder:'drop',neckline:'mock',fabric:'pique',blocking:'solid',hem:'split',silhouette:'boxy',sleeve:'turnup',color:'#9da7b3'}},
];
export function readTeeIntent(value:unknown):TeeDesignIntent{
  if(!value||typeof value!=='object')throw Error('设计设定无效');const v=value as Record<string,unknown>;
  if(v.schema!==DEFAULT_TEE_INTENT.schema)throw Error('设计版本不支持');
  for(const [key,values] of Object.entries(TEE_DESIGN_LABELS))if(typeof v[key]!=='string'||!Object.hasOwn(values,v[key] as string))throw Error('设计维度无效：'+key);
  for(const key of ['color','accent'])if(typeof v[key]!=='string'||!/^#[a-f\d]{6}$/i.test(v[key] as string))throw Error('设计颜色无效');
  return Object.fromEntries(Object.keys(DEFAULT_TEE_INTENT).map(k=>[k,v[k]])) as unknown as TeeDesignIntent;
}
export function teeDesignKey(c:Pick<TeeDesignCandidate,'configuration'|'intent'>){return JSON.stringify([c.configuration,readTeeIntent(c.intent)]);}
export function teeDesignName(d:TeeDesignIntent){return `${TEE_DESIGN_LABELS.shoulder[d.shoulder]} · ${TEE_DESIGN_LABELS.neckline[d.neckline]} · ${TEE_DESIGN_LABELS.fabric[d.fabric]}`;}
export function buildTeeDesignMatrix(base:DesignConfiguration,intent:TeeDesignIntent,axis:TeeDesignAxis):TeeDesignCandidate[]{
  requireDesignMatrixReady();
  const configuration=readTeeBase(base),d=readTeeIntent(intent),dimension=TEE_DESIGN_AXES.find(a=>a.id===axis);if(!dimension)throw Error('矩阵维度无效');
  return TEE_DESIGN_ROWS.flatMap(row=>dimension.values.map((value,col)=>{
    const next=readTeeIntent({...d,shoulder:row.id,[axis]:value});
    return {id:`${axis}-${row.id}-${col}`,row:row.id,column:TEE_DESIGN_LABELS[axis][value as never],name:teeDesignName(next),configuration:structuredClone(configuration),intent:next};
  }));
}
export function readDesignSelections(value:unknown):TeeDesignSelection[]{
  if(!Array.isArray(value)||value.length>24)throw Error('选款夹记录无效');
  const ids=new Set<string>();return value.map(v=>{if(!v||typeof v.selectionId!=='string'||ids.has(v.selectionId)||typeof v.name!=='string'||typeof v.id!=='string'||typeof v.row!=='string'||typeof v.column!=='string')throw Error('选款方案缺少信息或重复');ids.add(v.selectionId);return {...v,configuration:readTeeBase(v.configuration),intent:readTeeIntent(v.intent)};});
}
export function newTeeDesignBase(){return {configuration:newTeeBase(),intent:structuredClone(DEFAULT_TEE_INTENT)};}
