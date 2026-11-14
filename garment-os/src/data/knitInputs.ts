import type { ConstructionInputDefinition } from '@/types/construction';
const entry=(code:string,label:string,unit:ConstructionInputDefinition['unit'],meaning:string,requiredWhen:string,validation:string,operations:string[],choices?:string[]):ConstructionInputDefinition=>({
  code,label,unit,meaning,requiredWhen,validation,operations,choices,dataType:choices?'choice':unit==='text'?'text':'number',group:'material',scope:'each-seam',
  evidence:'版本化工艺定义与相同方向、负荷和回复条件下的材料测试；未录入保持未知',value:null,
});
export const KNIT_CONSTRUCTION_INPUTS:ConstructionInputDefinition[]=[
  entry('binding.endMethod','包条端头连接方式','choice','先明确闭合接缝、搭接或开肩连续装接，再确定有效环长。','四折包条装接','必须与源展开长度及工序一致；选择不代表完成态已实现',['binding-neck','binding-armhole'],['闭合接缝','搭接','开肩连续装接']),
  entry('binding.endLossMm','包条闭合长度损耗','mm','完成端头后相对源展开条长减少的有效装接长度，不能用普通缝份默补。','闭合接缝或搭接时','有限数值且 ≥0、<展开条长；0也须有工序依据',['binding-neck','binding-armhole']),
  entry('binding.acceptedReductionRatio','包条材料验证后缩率','ratio','以闭合后的有效条长为基准，验证装接所需伸长和回复；源95%仅作设计假设。','包条需拉伸装接时','0≤值<1，需求伸长＝缩率/(1−缩率)；须有同轴材料测试',['binding-neck','binding-armhole']),
  entry('ribbing.acceptedReductionRatio','罗纹材料验证后缩率','ratio','指定负荷、回复和循环条件验证的缩率，区别于ribbingStretch设计值。','装接罗纹时','0≤值<1，必须匹配本批罗纹方向与实测伸长/残余率',['rib-cuff','rib-waistband']),
  entry('ribbing.foldTurnMm','罗纹折合容位','mm','由厚度与缝层确定折合线和两道长边装接后的层次差量。','双层罗纹时','有限数值且 ≥0；不得用于任意消除长度差',['rib-cuff','rib-waistband']),
  entry('zipper.finishedLengthMm','前拉链完成长度','mm','按帽前开口、衣身前开口和已选下摆构造求有效拉链段，区别于采购链带全长。','Huey前开襟','有限数值且 >0；端止、袋底共缝和罗纹端头需同一完成态校对',['hood-neck','pocket-placement','rib-waistband']),
];
