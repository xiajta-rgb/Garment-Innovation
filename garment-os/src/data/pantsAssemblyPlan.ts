import type {AssemblyDefinition,BoundaryDefinition,BoundaryUse,JoinDefinition} from '@/types/assembly';
import {PANTS_PATTERN_ID} from './foundationMethods';
const boundary=(id:string,label:string,role:BoundaryDefinition['role'],from:string,to:string,disposition:BoundaryDefinition['disposition']='join'):BoundaryDefinition=>({id,label,role,from,to,disposition});
const ref=(piece:string,boundary:string,runs=1):BoundaryUse=>({piece,boundary,runs,layers:1});
export function pantsAssembly():AssemblyDefinition{
  const f='paco.front',b='paco.back',w='paco.waistband';
  const equal=(id:string,label:string,a:BoundaryUse[],bb:BoundaryUse[],roles:JoinDefinition['roles']):JoinDefinition=>({id,label,a,b:bb,roles,rule:{kind:'equal',toleranceMm:.1,basis:'Paco前后裤片曲线修正后的参考数值限值0.1mm；不是制造公差'}});
  const pieces:AssemblyDefinition['pieces']=[
    {id:f,quantity:2,onFold:false,source:'@freesewing/paco@4.10.2/src/front.mjs',boundaries:[
      boundary('outseam','前外侧缝','side','styleWaistOut','floorOut'),boundary('hem','前脚口','hem','floorOut','floorIn','hem'),
      boundary('inseam','前内侧缝','inseam','floorIn','fork'),boundary('crotch','前裆弧','crotch','fork','styleWaistIn'),
      boundary('waist','前腰口','waist','styleWaistIn','styleWaistOut','pending'),
    ]},
    {id:b,quantity:2,onFold:false,source:'@freesewing/paco@4.10.2/src/back.mjs',boundaries:[
      boundary('inseam','后内侧缝','inseam','fork','floorIn'),boundary('hem','后脚口','hem','floorIn','floorOut','hem'),
      boundary('outseam','后外侧缝','side','floorOut','styleWaistOut'),boundary('waist','后腰口','waist','styleWaistOut','styleWaistIn','pending'),
      boundary('crotch','后裆弧','crotch','styleWaistIn','fork'),
    ]},
    {id:w,quantity:1,onFold:false,source:'@freesewing/paco@4.10.2/src/waistband.mjs',boundaries:[
      boundary('attach','完整装腰边','waist','topLeft','bottomLeft','pending'),boundary('end-bottom','腰头拼接端一','perimeter','bottomLeft','bottomRight','pending'),
      boundary('inner','折返内侧长边','perimeter','bottomRight','topRight','pending'),boundary('end-top','腰头拼接端二','perimeter','topRight','topLeft','pending'),
    ]},
  ];
  const stations:Record<string,Record<string,[string,string]>>={
    [f]:{outseam:['waist','hem'],inseam:['hem','fork'],crotch:['fork','waist']},
    [b]:{outseam:['hem','waist'],inseam:['fork','hem'],crotch:['waist','fork']},
  };
  for(const p of pieces)for(const boundary of p.boundaries)if(stations[p.id]?.[boundary.id])boundary.stations=stations[p.id][boundary.id];
  return {id:PANTS_PATTERN_ID,engine:'paco',version:'4.10.2',revision:'paco-plain/v1',pieces,joins:[
    equal('outseams','左右外侧缝',[ref(f,'outseam',2)],[{...ref(b,'outseam',2),reverse:true}],['side','side']),
    equal('inseams','左右内侧缝',[ref(f,'inseam',2)],[{...ref(b,'inseam',2),reverse:true}],['inseam','inseam']),
    equal('front-crotch','两前片裆缝',[ref(f,'crotch')],[ref(f,'crotch')],['crotch','crotch']),
    equal('back-crotch','两后片裆缝',[ref(b,'crotch')],[ref(b,'crotch')],['crotch','crotch']),
    {id:'waistband',label:'全部裤腰接完整腰头',a:[ref(f,'waist',2),ref(b,'waist',2)],b:[ref(w,'attach')],roles:['waist','waist'],rule:{kind:'pending',reason:'原始总长已校验；仍需分配左右裤片实例及腰头接头、松紧与折返完成态。'}},
  ],unresolved:['腰头折返、松紧带成品长度与穿脱回弹尚需完成态规则及实测。','当前为无袋直筒基础裤；源前袋的对折声明不一致，暂不开放，不能遗漏袋布后放行。','前后裆使用同源两片镜像配对；整体裆形和人体活动合体仍待实物核验。']};
}
