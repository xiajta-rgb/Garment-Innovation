import type { KnitParameter } from '@/types/construction';
const source=(engine:string,file:string)=>`@freesewing/${engine}@4.10.2/src/${file}.mjs`;
const p=(key:KnitParameter['key'],label:string,defaultValue:number,min:number,max:number,meaning:string,engine:string,file:string,unit:'ratio'|'°'='ratio'):KnitParameter=>
  ({key,label,defaultValue,min,max,step:unit==='°'?0.1:0.01,meaning,source:source(engine,file),unit});
export const KNIT_PARAMETERS:Record<string,KnitParameter[]>={
  'bound-tank':[
    p('stretchFactor','衣身负松量比例',.05,0,.15,'横向坐标按1−本值缩减；这是设计假设，不能冒充面料实测伸长率。','aaron','front'),
    p('necklineDrop','前领口下降比例',.20,.10,.35,'前领口按HPS到后腰×本值下移；包条同步重算。','aaron','front'),
    p('shoulderStrapWidth','肩带宽度比例',.15,.10,.40,'源肩颈线段控制肩带半宽；肩带属于衣身的一部分。','aaron','front'),
    p('shoulderStrapPlacement','肩带位置比例',.40,.20,.80,'沿源肩颈线段定位肩带中心，不独立拖动轮廓。','aaron','front'),
    p('knitBindingWidth','包条展开宽倍率',6,3,8,'源展开宽＝10mm基准缝份×倍率；四折完成宽为展开宽/4；包条不另加普通缝份。','aaron','back'),
  ],
  'hooded-zip-sweatshirt':[
    {key:'ribbing',label:'罗纹接条',unit:'boolean',defaultValue:true,meaning:'开关同时决定袖片、衣身截短及两种罗纹裁片是否存在。',source:source('huey','back')},
    {key:'pocket',label:'前贴袋',unit:'boolean',defaultValue:true,meaning:'开关同步控制两片半袋及前身定位线。',source:source('huey','front')},
    p('ribbingHeight','罗纹成品高比例',.10,.05,.15,'成品高＝(HPS到后腰＋腰到臀)×本值；源展开高为成品高×2。','huey','back'),
    p('ribbingStretch','罗纹设计缩率',.15,0,.30,'罗纹条长＝对应装接净长×(1−本值)；需实测回弹确认。','huey','waistband'),
    p('hoodHeight','帽高比例',.59,.55,.65,'帽高由头围×本值控制；不能从颈围估算头围。','huey','hood'),
    p('hoodCutback','帽前口后退比例',.10,.05,.15,'源帽顶前口位置由头围×本值控制。','huey','hood'),
    p('hoodClosure','帽前闭合高度比例',.135,.10,.15,'帽前拉链延伸段由头围×本值控制。','huey','hood'),
    p('hoodDepth','帽后深度比例',.085,.05,.12,'帽后曲线控制位置由头围×本值控制。','huey','hood'),
    p('hoodAngle','装帽底边角度',5,2,8,'保留源帽底旋转；底边长度由前后领窝真实弧长驱动。','huey','hood','°'),
    p('pocketHeight','袋高位置比例',.30,.25,.35,'前领点到下摆段定位袋上口。','huey','front'),
    p('pocketWidth','袋宽比例',.60,.50,.70,'源前身摆宽×本值定位袋上口；两片袋与拉链前开口配合。','huey','front'),
    p('pocketOpening','袋口开度比例',.90,.60,.90,'控制弯曲袋口端点，不独立替换袋口SVG。','huey','front'),
  ],
};
