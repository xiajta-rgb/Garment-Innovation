import type { AssemblyDefinition, BoundaryDefinition, BoundaryRole, BoundaryUse, JoinDefinition, PieceDefinition } from '@/types/assembly';
import type { ConstructionSelection } from '@/types/construction';

const b=(id:string,label:string,role:BoundaryRole,from:string,to:string,disposition:BoundaryDefinition['disposition']='join',stations?:[string,string]):BoundaryDefinition=>({id,label,role,from,to,disposition,stations});
const boundaryUse=(piece:string,boundary:string,runs=1,layers=1,reverse=false):BoundaryUse=>({piece,boundary,runs,layers,reverse});
const join=(id:string,label:string,a:BoundaryUse[],c:BoundaryUse[],roles:JoinDefinition['roles'],reason?:string,toleranceMm=.01):JoinDefinition=>({id,label,a,b:c,roles,
  rule:reason?{kind:'pending',reason}:{kind:'equal',toleranceMm,basis:toleranceMm===2?'源袖山迭代停止值2mm；非工厂公差':'源共享结构边一致性限值0.01mm；非工厂公差'}});
const piece=(engine:string,id:string,quantity:number,onFold:boolean,boundaries:BoundaryDefinition[],primaryMaterial?:'ribbing'):PieceDefinition=>
  ({id:`${engine}.${id}`,quantity,onFold,boundaries,source:`@freesewing/${engine}@4.10.2/src/${id==='armBinding'?'arm-binding':id==='neckBinding'?'neck-binding':id}.mjs`,...(primaryMaterial?{primaryMaterial}:{})});

export function tankAssembly():AssemblyDefinition{
  const f='aaron.front',r='aaron.back',n='aaron.neckBinding',a='aaron.armBinding';
  const body=(back:boolean)=>piece('aaron',back?'back':'front',1,true,[
    b('fold','中心对折边','fold',back?'cbNeck':'cfNeck','cbHem','fold'),b('hem','下摆折边','hem','cbHem','hem','hem'),
    b('side','侧缝','side','hem','armhole','join',['hem','underarm']),b('armhole','袖窿包边基线','binding-insertion','armhole','strapRight','pending'),
    b('shoulder','肩带肩缝','shoulder','strapRight','strapLeft','join',['armhole-top','neck']),
    b('neck','领口包边基线','binding-insertion','strapLeft',back?'cbNeck':'cfNeck','pending'),
  ]);
  const strip=(id:string,qty:number)=>piece('aaron',id,qty,false,[
    b('attach','源展开长边','binding-insertion','topLeft','bottomLeft','pending'),b('end-bottom','下端待闭合','perimeter','bottomLeft','bottomRight','finish'),
    b('outer','另一长边待四折','perimeter','bottomRight','topRight','finish'),b('end-top','上端待闭合','perimeter','topRight','topLeft','finish'),
  ]);
  return {id:'bound-tank',engine:'aaron',version:'4.10.2',revision:'knit-assembly/v1',pieces:[body(false),body(true),strip('armBinding',2),strip('neckBinding',1)],
    joins:[join('shoulders','左右肩带肩缝',[boundaryUse(f,'shoulder',2)],[boundaryUse(r,'shoulder',2)],['shoulder','shoulder']),
      join('sides','左右侧缝',[boundaryUse(f,'side',2)],[boundaryUse(r,'side',2)],['side','side']),
      join('neck-binding','领口接四折包条',[boundaryUse(f,'neck',2),boundaryUse(r,'neck',2)],[boundaryUse(n,'attach')],['binding-insertion','binding-insertion'],'源包条为领口净长的95%；端头闭合损耗、四折完成态和实际材料回弹待核验。'),
      join('arm-binding','两袖窿接四折包条',[boundaryUse(f,'armhole',2),boundaryUse(r,'armhole',2)],[boundaryUse(a,'attach',2)],['binding-insertion','binding-insertion'],'源包条为单袖窿净长的95%；不能把原始长边直接当作闭合后的装接边。')],
    unresolved:['源四折包条无普通缝份与独立布纹声明；保留原始裁切轮廓，不补画。','95%是源设计假设，布料实测伸长/回弹、端头连接方式与完成态配缝尚待核验。']};
}

export function hoodieAssembly(selection?:ConstructionSelection):AssemblyDefinition{
  const ribbing=selection?.options.ribbing!==false,pocket=selection?.options.pocket!==false;
  const f='huey.front',r='huey.back',s='huey.sleeve',h='huey.hood',p='huey.pocket',c='huey.cuff',w='huey.waistband';
  const body=(back:boolean)=>{
    const boundaries=[b('side','侧缝','side','hem','armhole','join',['hem','underarm']),
      b('armhole','袖窿','armhole','armhole','s3ArmholeSplit','join',[back?'underarm-back':'underarm-front','shoulder']),
      b('shoulder','肩缝','shoulder','s3ArmholeSplit','s3CollarSplit','join',['armhole-top','neck']),
      b('neck','装帽领窝','neckline','s3CollarSplit',back?'cbNeck':'cfNeck','join',['shoulder-neck',back?'center-back':'front-neck']),
      b('center',back?'后中心对折':'前拉链开口',back?'fold':'front-opening',back?'cbNeck':'cfNeck',back?'cbHem':'cfHem',back?'fold':'finish'),
      b('hem',ribbing?'装罗纹下摆':'下摆折边',ribbing?'cuff-insertion':'hem',back?'cbHem':'cfHem','hem',ribbing?'pending':'hem')];
    if(!back&&pocket)for(const [id,from,to]of [['pocket-side','pocketHem','pocketTip'],['pocket-top','pocketTopRight','pocketCfTop']]){
      boundaries.push({...b(id,id==='pocket-side'?'袋侧源定位线':'袋顶源定位线','pocket-attachment',from,to,'pending'),sourcePath:'pocket',sourcePathKind:'placement'});
    }
    return piece('huey',back?'back':'front',back?1:2,back,boundaries);
  };
  const pieces:PieceDefinition[]=[body(false),body(true),piece('huey','sleeve',2,false,[
    b('underarm-right','袖底右边','underarm','wristRight','bicepsRight','join',['cuff','underarm']),
    b('cap','完整袖山','sleevecap','bicepsRight','bicepsLeft','join',['underarm-front','underarm-back']),
    b('underarm-left','袖底左边','underarm','bicepsLeft','wristLeft','join',['underarm','cuff']),
    b('hem',ribbing?'装罗纹袖下口':'袖下口折边',ribbing?'cuff-insertion':'hem','wristLeft','wristRight',ribbing?'pending':'hem'),
  ]),piece('huey','hood',4,false,[
    b('neck','装帽底边','neckline','cfBottom','cbBottom','join',['front-neck','center-back']),
    b('back','帽后中缝','perimeter','cbBottom','frontTop','join',['center-back','hood-crown']),
    b('face','帽口双层合缝','perimeter','frontTop','cfTop','join',['hood-crown','hood-zip-top']),
    b('zip','帽前拉链段','front-opening','cfTop','cfBottom','finish'),
  ])];
  const joins:JoinDefinition[]=[
    join('shoulders','左右肩缝',[boundaryUse(f,'shoulder',2)],[boundaryUse(r,'shoulder',2)],['shoulder','shoulder']),
    join('sides','左右侧缝',[boundaryUse(f,'side',2)],[boundaryUse(r,'side',2)],['side','side']),
    join('underarms','两袖袖底缝',[boundaryUse(s,'underarm-left',2)],[boundaryUse(s,'underarm-right',2,1,true)],['underarm','underarm']),
    ...['left','right'].map(side=>join(`sleevecap-${side}`,`${side==='left'?'左':'右'}袖山接袖窿`,[boundaryUse(s,'cap')],[boundaryUse(f,'armhole'),boundaryUse(r,'armhole',1,1,true)],['sleevecap','armhole'],undefined,2)),
    join('hood-neck','双层帽接完整领窝',[boundaryUse(h,'neck',2,2)],[boundaryUse(f,'neck',2,1,true),boundaryUse(r,'neck',2)],['neckline','neckline']),
    join('hood-back','两层帽分别合后中缝',[boundaryUse(h,'back',1,2)],[boundaryUse(h,'back',1,2)],['perimeter','perimeter']),
    join('hood-face','帽口双层合缝',[boundaryUse(h,'face',1,2)],[boundaryUse(h,'face',1,2)],['perimeter','perimeter']),
  ];
  if(pocket){
    pieces.push(piece('huey','pocket',2,false,[b('bottom','袋底共缝区','cuff-insertion','cfHem','pocketHem','pending'),
      b('side','袋侧固定边','pocket-attachment','pocketHem','pocketTip','pending'),b('opening','弯曲袋口','perimeter','pocketTip','pocketTopRight','finish'),
      b('top','袋顶固定边','pocket-attachment','pocketTopRight','pocketCfTop','pending'),b('center','袋前开口共缝区','front-opening','pocketCfTop','cfHem','pending')]));
    for(const id of ['side','top'])joins.push(join(`pocket-${id}`,id==='side'?'两片袋侧定位':'两片袋顶定位',[boundaryUse(p,id,2)],[boundaryUse(f,`pocket-${id}`,2)],['pocket-attachment','pocket-attachment'],'源定位线与袋边对应；翻折、压线及拉链/下摆共缝区未完成工艺几何。'));
  }
  if(ribbing){
    const rib=(id:string,qty:number)=>piece('huey',id,qty,false,[
      b('attach','罗纹第一长边','cuff-insertion','bottomRight','topRight','pending'),
      b('top-end','罗纹端头A','perimeter','topRight','topLeft',id==='cuff'?'join':'finish',['fold-out','fold-in']),
      b('other','罗纹第二长边待折合','cuff-insertion','topLeft','bottomLeft','pending'),
      b('bottom-end','罗纹端头B','perimeter','bottomLeft','bottomRight',id==='cuff'?'join':'finish',['fold-in','fold-out']),
    ],'ribbing');
    pieces.push(rib('cuff',2),rib('waistband',1));
    joins.push(join('rib-cuff-end','两袖口各自合环端头',[boundaryUse(c,'top-end',2)],[boundaryUse(c,'bottom-end',2,1,true)],['perimeter','perimeter']),
      join('rib-cuff','袖下口接罗纹',[boundaryUse(s,'hem',2)],[boundaryUse(c,'attach',2)],['cuff-insertion','cuff-insertion'],'罗纹按源缩率计算，需材料回弹与对折完成态；原始长边不直接按等长放行。'),
      join('rib-hem','衣身下摆接罗纹',[boundaryUse(f,'hem',2),boundaryUse(r,'hem',2)],[boundaryUse(w,'attach')],['cuff-insertion','cuff-insertion'],'下摆罗纹与前拉链、袋底存在共缝区；源设计缩率不等于材料已验证。'));
  }
  return {id:'hooded-zip-sweatshirt',engine:'huey',version:'4.10.2',revision:'knit-assembly/v1',pieces,joins,
    unresolved:['帽裁4片为同面料双层构型，未独立建立异材帽里差量。','源帽片/罗纹布纹缺项保持未知；罗纹回弹、拉链长度及袋口翻折的完成态仍待验证。']};
}
