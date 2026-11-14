import type { CompanyStyleMaster } from '@/types/company-style';

const finish={enabled:true,neckWidthMm:18,neckRatio:.9,seamAllowanceMm:6,bodyHemMm:20,sleeveHemMm:20,needleGaugeMm:4,stitchPitchMm:3};
const src=(recordId:string,styleCode:string,hash:string,originPx:[number,number],bodyHeightPx:number)=>({recordId,styleCode,image:'/company-reference/'+styleCode+'.webp',url:'https://ls-prod-1320529356.cos.ap-guangzhou.myqcloud.com/public/'+hash+'.jpg',sha256:hash,drawingFrame:[1888,1334] as [number,number],originPx,bodyHeightPx});
/** Landmarks digitised in the indicated source drawing frame. Symmetric neutral
 * pose is explicit; no garment dimensions are deduced from image pixels. */
export const COMPANY_STYLE_MASTERS:readonly CompanyStyleMaster[]=[
  {id:'company-cot25m002',revision:1,name:'常规微落肩圆领短T',kind:'short-tee',
    source:src('reczz28Xjq3qifFs','COT25M002','d8f6b65316187ec5bd7265a753edf19d6e7517ccb695d53e7f9f1b018e9b4447',[325,382],601),
    cadTemplateId:null,color:'#364038',fabric:'FC304 棉盖丝平纹',composition:'34%C / 34%R / 32%P',weight:'180g（原稿标注）',
    shape:{neckHalf:90/601,frontDrop:77/601,backDrop:25/601,shoulder:[190/601,69/601],armhole:[[164/601,122/601],[157/601,195/601],[162/601,291/601]],hemHalf:175/601,cuffOuter:[282/601,233/601],cuffInner:[174/601,305/601]},
    finish:{...finish,neckWidthMm:17.5},knownFinishes:['领高17.5mm，1×1罗纹','袖口、下摆20mm坎车双压线','后领10mm本布包边，边车1mm','后领整圈压线2mm','后中尺码烫标'],
    pending:['微落肩原稿不能关联普通装袖Teagan；旧关联已撤销，需重建配套落肩裁片','原稿注明尺码尚未确认；没有原始毫米净样','后领包边与烫标尚未接入三维工艺','原稿未标双针间距；4mm为可编辑设计值','领条长度比例、缝份与针距是设计设定，需材料和工序验证']},
  {id:'company-lt26m1581',revision:1,name:'常规直身圆领长T',kind:'long-tee',
    source:src('reczz28Xjpv6y8Bg','LT26M1581','9271562bd8955292e6ce6c9b5c294778df87b36cc14ddc1aff00fefbc7c13d7f',[401,253],589),
    cadTemplateId:'long-sleeve-tee',color:'#bfae8b',fabric:'FC304 棉盖丝平纹；参考罗纹FC-00332',composition:'衣身34%C / 34%R / 32%P；罗纹64%C / 36%P',weight:'180g（原稿标注）',
    shape:{neckHalf:74/589,frontDrop:77/589,backDrop:18/589,shoulder:[172/589,41/589],armhole:[[144/589,104/589],[145/589,179/589],[174/589,222/589]],hemHalf:176/589,cuffOuter:[541/589,289/589],cuffInner:[501/589,351/589]},
    finish:{...finish,bodyHemMm:23,sleeveHemMm:23,needleGaugeMm:6},knownFinishes:['18mm顺色罗纹领','后领本布包边8mm，边压1mm','袖口与下摆23mm坎车，双线间距6mm'],
    pending:['原稿一袖弯折作排版；母版采用右侧伸展袖镜像的对称姿态','没有原始毫米净样；母版比例不代表成品尺寸','后领包边和衣印尚未接入三维工艺','领条长度比例、缝份与针距仍为设计设定']},
  {id:'company-at25m3295',revision:1,name:'微落肩圆领罗纹卫衣',kind:'crew-sweatshirt',
    source:src('reczz28Xjq6EZvym','AT25M3295','6dd68e2290d9b1d601eae20049030edf4868516f9e21dd185b52a071136ba731',[515,394],462),
    cadTemplateId:null,color:'#e1dfda',fabric:'棉盖涤拉毛摇粒卫衣布',composition:'66%涤纶 / 34%棉',weight:'衣身310g；罗纹420g（原稿标注）',
    shape:{neckHalf:70/462,frontDrop:60/462,backDrop:20/462,shoulder:[155/462,56/462],armhole:[[133/462,120/462],[132/462,220/462],[134/462,359/462]],hemHalf:123/462,cuffOuter:[255/462,454/462],cuffInner:[193/462,480/462]},
    finish:{...finish,neckWidthMm:20},knownFinishes:['20mm高2×2罗纹领','袖口、下摆55mm高2×2罗纹','前领圈6mm单线；后领10mm织带包缝','取消口袋；微落肩尺寸参考AT25M3288'],
    pending:['圆领卫衣完整裁片方法尚未接通；不得套用长袖T恤冒充','55mm罗纹袖口/下摆尚未接入完成态几何','图稿关系不等于已取得同款毫米纸样']},
  {id:'company-at25m3288',revision:1,name:'微落肩套头连帽卫衣',kind:'pullover-hoodie',
    source:src('reczz28Xjq6EXk7n','AT25M3288','cdad090c7b2027c3323105cfe4eae33a25569c3cc1e3d8dd4ec3dc1fd9406231',[528,370],446),
    cadTemplateId:null,color:'#d6d3cc',fabric:'棉盖涤拉毛摇粒卫衣布',composition:'66%涤纶 / 34%棉',weight:'衣身310g；罗纹420g（原稿标注）',
    shape:{neckHalf:67/446,frontDrop:34/446,backDrop:16/446,shoulder:[161/446,48/446],armhole:[[129/446,116/446],[130/446,240/446],[131/446,338/446]],hemHalf:129/446,cuffOuter:[256/446,432/446],cuffInner:[195/446,452/446]},
    finish:{...finish},knownFinishes:['套头；交叉帽襟；双层帽','帽口宽25mm，前领圈6mm单线','袖口和下摆55mm高2×2罗纹，不压线','袋鼠袋上口230mm、袋高230mm；原稿另有袋边工艺标注','后领10mm织带包缝；圆帽绳、鸡眼'],
    pending:['套头连帽构型尚未接通毫米裁片；现有Huey为开襟款，禁止替代','帽、绳、袋和罗纹的完成态装配仍待接入','缺原始毫米净样和完整放码资料']},
];
export function companyStyleMaster(id:string){const m=COMPANY_STYLE_MASTERS.find(m=>m.id===id);if(!m)throw Error('公司母版不存在：'+id);return m;}
