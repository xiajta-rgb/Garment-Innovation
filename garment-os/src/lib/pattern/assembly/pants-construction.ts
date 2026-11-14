import type {BodyMeasurements} from '@/types/measurements';
import type {ConstructionReport,ConstructionSelection} from '@/types/construction';
import type {StandardPiece} from '../reference/standard';
export function auditPantsConstruction(m:BodyMeasurements,options:Record<string,number|boolean|string>,pieces:StandardPiece[],selection:ConstructionSelection|undefined,absolute:Record<string,number>|undefined):ConstructionReport{
  const f=pieces.find(p=>p.id==='paco.front')!,b=pieces.find(p=>p.id==='paco.back')!,w=pieces.find(p=>p.id==='paco.waistband')!;
  const d=(p:StandardPiece,a:string,b:string)=>Math.hypot(p.points[a].x-p.points[b].x,p.points[a].y-p.points[b].y);
  const height=absolute?.waistbandWidth;if(!Number.isFinite(height))throw Error('缺少源实际腰头高度');
  const waist=2*(d(f,'styleWaistIn','styleWaistOut')+d(b,'styleWaistIn','styleWaistOut'));
  const opening=2*(d(f,'floorIn','floorOut')+d(b,'floorIn','floorOut'));
  if(Math.abs(d(w,'topLeft','bottomLeft')-waist)>1e-6||Math.abs(d(w,'topLeft','topRight')-height!*2)>1e-6||Math.abs(opening/2-m.heel!*(1+Number(options.heelEase)))>1e-6)throw Error('基础裤装的腰头或脚口毫米约束失败');
  const metric=(label:string,value:number,formula:string)=>({label,value,formula,unit:'mm' as const});
  return {schema:'garment-os/construction-report/v1',method:'Paco 松紧腰直筒基础裤',revision:'paco-plain/v1',selection:selection??null,resolvedOptions:options,readyForAssembly:false,productionApproved:false,
    operations:[{id:'pants-base',label:'前后裤片与脚口',pieces:[f.id,b.id],source:'@freesewing/paco@4.10.2/src/front.mjs',status:'dimensioned',rule:'前后裤片同源重算，内外侧缝逐条检查。单腿脚口围等于脚跟通过围乘以通过松量。',metrics:[metric('单腿脚口净围',opening/2,'前脚口+后脚口'),metric('源裤腰完整净长',waist,'2×(前腰口+后腰口)')],steps:['左右前后裤片各2片，保持布纹和源裁边。'],requirements:['裆部合体、活动量和穿脱能力仍需实测。'],guides:[]},
      {id:'pants-waistband',label:'松紧腰头折返',pieces:[w.id],source:'@freesewing/paco@4.10.2/src/waistband.mjs',status:'needs-geometry',rule:'一片连裁折腰，高度使用源吸附后的实际毫米值，不重复记腰里。',metrics:[metric('请求腰头成品高',m.waistToFloor!*Number(options.waistbandWidth),'腰到地×比例'),metric('实际腰头成品高',height!,'源absoluteOptions'),metric('高度吸附差',height!-m.waistToFloor!*Number(options.waistbandWidth),'实际−请求'),metric('腰头展开长',waist,'完整装腰边')],steps:['沿源中折线折返。','确定松紧带长度、接头和开口工艺。'],requirements:['松紧材料回弹和完成态装接尚未验证。'],guides:[{piece:w.id,label:'源腰头中折线',pathD:w.sourcePaths.fold.data}]}],
    requiredInputs:[{code:'pants.elasticFinishedLengthMm',label:'松紧带成品长度',dataType:'number',unit:'mm',group:'material',scope:'garment',meaning:'闭合后的松紧带净长，来自材料试验和设计。',requiredWhen:'制造交付前',validation:'正数，验证腰围压缩及臀部通过；不从预览纹理推算。',evidence:'松紧带伸缩回弹测试',operations:['pants-waistband'],value:null}]};
}
