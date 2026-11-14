import type {KnitParameter} from '@/types/construction';
export const PANTS_PATTERN_ID='elastic-waist-pants';
export const TEE_PATTERN_IDS=['t-shirt','womens-basic-tee'] as const;
const teeSource='@freesewing/teagan@4.10.2/src/';
export const TEE_PARAMETERS:KnitParameter[]=[
  {key:'sleeveLength',label:'短袖延伸比例',unit:'ratio',defaultValue:.3,min:.2,max:1,step:.05,source:teeSource+'sleeve.mjs',meaning:'源袖下口距上臂线的延伸量=源半上臂宽×比例；不是肩点到袖口的成品袖长。袖山与衣身继续同源配套。'},
  {key:'sleeveEase',label:'袖下口宽度增量',unit:'ratio',defaultValue:.15,min:.05,max:.35,step:.01,source:teeSource+'sleeve.mjs',meaning:'源袖下口宽=上臂围×(1+上臂松量)×(1+本值)，上限为源上臂线宽；实际宽度与达到上限的情况在报告中显示。'},
  {key:'necklineDepth',label:'前领深比例',unit:'ratio',defaultValue:.25,min:.2,max:.4,step:.01,source:teeSource+'front.mjs',meaning:'按源前领曲线规则重算领窝；同时更新后续装领长度，不是把整个图形缩放。'},
  {key:'necklineWidth',label:'领宽比例',unit:'ratio',defaultValue:.3,min:.1,max:.5,step:.01,source:teeSource+'front.mjs',meaning:'前后领宽使用同一源参数，肩缝和袖窿继续检查。领条材料与缩率仍需另行定义。'},
];
export const PANTS_PARAMETERS:KnitParameter[]=[
  {key:'seatEase',label:'臀围松量比例',unit:'ratio',defaultValue:.05,min:0,max:.15,step:.01,source:'@freesewing/paco@4.10.2/src/back.mjs',meaning:'调整源前后裤片及裆部；穿脱腰口由完整源方法核对，不用胸围推算。'},
  {key:'heelEase',label:'脚口通过松量比例',unit:'ratio',defaultValue:.05,min:0,max:.5,step:.01,source:'@freesewing/paco@4.10.2/src/back.mjs',meaning:'前后脚口总围=脚跟通过围×(1+本值)；同步改变裤腿轮廓。'},
  {key:'lengthBonus',label:'裤长变化比例',unit:'ratio',defaultValue:0,min:-.15,max:.1,step:.01,source:'@freesewing/paco@4.10.2/src/back.mjs',meaning:'源腰到地长度的变化比例；实际内外侧缝长度单独列示，不称为任意成品裤长。'},
  {key:'waistbandWidth',label:'松紧腰头高度比例',unit:'ratio',defaultValue:.03,min:.01,max:.06,step:.005,source:'@freesewing/paco@4.10.2/src/back.mjs',meaning:'请求成品高=腰到地×比例；源按常用松紧规格吸附，报告列出实际高和吸附差。腰头是一片连裁折腰。'},
];
export function foundationParameters(id:string){return TEE_PATTERN_IDS.some(p=>p===id)?TEE_PARAMETERS:id===PANTS_PATTERN_ID?PANTS_PARAMETERS:undefined;}
export const PANTS_MEASUREMENT_FIELDS=[
  {id:'waist',native:'waist',label:'人体腰围',min:400,max:1800},
  {id:'waistBack',native:'waistBack',label:'后腰弧长',min:150,max:1100},
  {id:'seat',native:'seat',label:'臀峰围',min:500,max:2000},
  {id:'seatBack',native:'seatBack',label:'后臀弧长',min:200,max:1200},
  {id:'crossSeam',native:'crossSeam',label:'前后总裆弧长',min:400,max:1600},
  {id:'crossSeamFront',native:'crossSeamFront',label:'前裆弧长',min:180,max:800},
  {id:'hipDepth',native:'waistToHips',label:'腰到高臀线',min:60,max:450},
  {id:'waistToSeat',native:'waistToSeat',label:'腰到臀峰线',min:100,max:550},
  {id:'waistToUpperLeg',native:'waistToUpperLeg',label:'腰到大腿根线',min:180,max:650},
  {id:'waistToKnee',native:'waistToKnee',label:'腰到膝线',min:300,max:1000},
  {id:'waistToFloor',native:'waistToFloor',label:'腰到地长度',min:600,max:1600},
  {id:'knee',native:'knee',label:'人体膝围',min:200,max:800},
  {id:'heel',native:'heel',label:'脚跟通过围',min:200,max:600},
] as const;
