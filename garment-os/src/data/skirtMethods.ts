import type {SkirtParameter} from '@/types/construction';
const source='@freesewing/sandy@4.10.2/src/skirt.mjs';
/** Reviewed subset. Curved waistbands, single-panel 360-degree sectors and double-fold cutting stay closed. */
export const SKIRT_PARAMETERS:SkirtParameter[]=[
  {key:'circleRatio',label:'裙摆圆度比例',defaultValue:1,min:.2,max:1,step:.05,unit:'ratio',source,meaning:'1为整圆裙摆，0.5为半圆；腰弧半径与裙幅角度由源同时重算。'},
  {key:'panels',label:'实际裙幅片数',defaultValue:2,min:2,max:4,step:1,unit:'count',source,meaning:'每幅按源单轴对折裁剪；2、3、4片同步改变单幅角度及源裁剪数量。'},
  {key:'waistbandWidth',label:'腰头成品高比例',defaultValue:.04,min:.01,max:.08,step:.005,unit:'ratio',source,meaning:'请求高=腰至地长度×比例；源按常用规格吸附，实际毫米与差值在报告中列出。展开高为实际高×2，成品裙长包含实际腰头高。'},
  {key:'waistbandOverlap',label:'腰头搭量比例',defaultValue:.03,min:0,max:.15,step:.01,unit:'ratio',source,meaning:'搭量=腰围×比例；腰头展开长含搭量，装裙净长不含搭量。'},
  {key:'gathering',label:'腰节抽褶增加比例',defaultValue:0,min:0,max:1,step:.05,unit:'ratio',source,meaning:'裙腰弧展开长=装裙净长×(1+本值)；有褶时保留完成态待验证，不能直接视作等长缝合。'},
  {key:'hemWidth',label:'下摆整理宽比例',defaultValue:.02,min:.01,max:.1,step:.005,unit:'ratio',source,meaning:'源下摆裁边外扩量=成品裙长×比例；保留源裁边，不用任意偏移替换。'},
];
export const SKIRT_PATTERN_ID='panel-circle-skirt';
export const SKIRT_DEFAULTS=Object.fromEntries(SKIRT_PARAMETERS.map(p=>[p.key,p.defaultValue]));
export const SKIRT_MEASUREMENT_FIELDS=[
  {id:'waist',label:'人体腰围',min:400,max:1800,step:1,unit:'mm'},
  {id:'hip',label:'人体臀围',min:500,max:2000,step:1,unit:'mm'},
  {id:'hipDepth',label:'腰到臀深',min:80,max:450,step:1,unit:'mm'},
  {id:'waistToFloor',label:'腰到地长度',min:400,max:1500,step:1,unit:'mm'},
  {id:'skirtLength',label:'成品裙长（含腰头）',min:100,max:1500,step:1,unit:'mm'},
] as const;
