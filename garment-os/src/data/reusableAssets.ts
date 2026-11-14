import type { FinishAsset,MaterialAsset,StructureAsset } from '@/types/reusable-assets';
import { COMPANY_STYLE_MASTERS } from './companyStyleMasters';
import { FABRIC_COLORS } from './fabrics';
import { requireReviewedPattern } from './patternReview';

const tee=['short-tee','long-tee'] as const,sweat=['crew-sweatshirt','pullover-hoodie'] as const;
/** Extracted from the original company drawings, not material laboratory results. */
export const MATERIAL_ASSETS:readonly MaterialAsset[]=[
  {id:'mat-fc304',revision:1,name:'FC304 棉盖丝平纹',code:'FC304',structure:'平纹针织',composition:[{fiber:'棉',percent:34},{fiber:'粘胶',percent:34},{fiber:'涤纶',percent:32}],weightLabel:'180g（原稿标注）',weightGsm:null,widthMm:null,stretchPercent:null,shrinkagePercent:null,slots:['main'],kinds:[...tee],sourceMasterIds:['company-cot25m002','company-lt26m1581'],notes:['原稿使用C/R/P成分缩写。','门幅、单位面积克重、伸缩及缩水测试待确认。']},
  {id:'mat-fc00332',revision:1,name:'FC-00332 配套罗纹',code:'FC-00332',structure:'罗纹针织',composition:[{fiber:'棉',percent:64},{fiber:'涤纶',percent:36}],weightLabel:null,weightGsm:null,widthMm:null,stretchPercent:null,shrinkagePercent:null,slots:['neck'],kinds:[...tee],sourceMasterIds:['company-lt26m1581'],notes:['长T原稿有此货号；跨款选用属于设计候选，不能当作短T原始用料。','罗纹组织、克重与回弹待确认。']},
  {id:'mat-company-fleece310',revision:1,name:'棉盖涤拉毛摇粒卫衣布',code:null,structure:'拉毛摇粒卫衣布',composition:[{fiber:'涤纶',percent:66},{fiber:'棉',percent:34}],weightLabel:'310g（原稿标注）',weightGsm:null,widthMm:null,stretchPercent:null,shrinkagePercent:null,slots:['main'],kinds:[...sweat],sourceMasterIds:['company-at25m3295','company-at25m3288'],notes:['原稿没有明确面料货号；资产ID只用于内部引用。']},
  {id:'mat-company-rib2x2',revision:1,name:'2×2 配套罗纹',code:null,structure:'2×2罗纹',composition:null,weightLabel:'420g（原稿标注）',weightGsm:null,widthMm:null,stretchPercent:null,shrinkagePercent:null,slots:['neck','cuff','hem'],kinds:[...sweat],sourceMasterIds:['company-at25m3295','company-at25m3288'],notes:['成分未知，不能继承衣身的66%涤纶 / 34%棉。','帽衫无独立罗纹领，领口用料位不可用。']},
];
export const FINISH_ASSETS:readonly FinishAsset[]=COMPANY_STYLE_MASTERS.filter(m=>m.kind==='short-tee'||m.kind==='long-tee').map(m=>({
  id:`finish-${m.source.styleCode.toLowerCase()}`,revision:1,name:`${m.source.styleCode} 罗纹领 / 双针折边`,masterIds:[m.id],settings:{...m.finish},
  sourcedFields:m.kind==='short-tee'?['neckWidthMm','bodyHemMm','sleeveHemMm']:['neckWidthMm','bodyHemMm','sleeveHemMm','needleGaugeMm'],
  assumptions:['领条设计比例、缝份与针距需按材料和设备核验。',...(m.kind==='short-tee'?['4mm双针间距为设计值，原稿未标注。']:[])],
}));
const structure=(id:string,name:string,templateId:string,tags:string[],options:StructureAsset['selection']['options'],description:string,componentId?:string):StructureAsset=>({
  id,revision:1,name,templateId,tags,description,selection:{schema:'garment-os/construction/v1',options},
  source:`@freesewing/${requireReviewedPattern(templateId).engine}@4.10.2/src`,...(componentId?{componentId}:{}),
  ...(templateId==='button-up-shirt'?{lengthBonus:.25}:{}),
});
/** Presets call the existing complete source method; no independent decorative cut shapes. */
export const STRUCTURE_ASSETS:readonly StructureAsset[]=[
  ...(['t-shirt','womens-basic-tee'] as const).flatMap(id=>[
    structure(`${id}-basic-sleeve`,'基础短袖',id,['T恤','装袖','基础短袖'],{sleeveLength:.3,sleeveEase:.15},'恢复源短袖比例，保留已设置的领宽和领深。','tee.setin-sleeve'),
    structure(`${id}-extended-sleeve`,'加长短袖',id,['T恤','装袖','加长短袖'],{sleeveLength:.7,sleeveEase:.15},'同源延长短袖，保留领口设置并复查袖山；不是移植其他方法的袖片。','tee.setin-sleeve'),
    structure(`${id}-tapered-sleeve`,'收口短袖',id,['T恤','装袖','收口短袖'],{sleeveLength:.45,sleeveEase:.05},'减小源袖口增量并适当延长短袖，保留领口设置；仍须核验实际宽度与通过条件。','tee.setin-sleeve'),
  ]),
  structure('pants-plain-base','基础直筒裤','elastic-waist-pants',['基础裤装','松紧腰','直筒'],{heelEase:.05,lengthBonus:0},'恢复基础裤长与脚口，保留臀部松量和腰头设置。','pants.leg-opening'),
  structure('pants-wide-opening','宽脚口变化','elastic-waist-pants',['基础裤装','松紧腰','宽脚口'],{heelEase:.3},'只改脚口，同源重算前后腿；保留已改裤长、臀部松量和腰头。','pants.leg-opening'),
  structure('pants-shorter-leg','裤腿缩短变化','elastic-waist-pants',['基础裤装','松紧腰','裤长变化'],{lengthBonus:-.1},'裤长变化比例−10%，保留脚口、臀部松量和腰头；实际侧缝长度见生成结果。','pants.leg-opening'),
  structure('skirt-half-2','两幅半圆裙 / 无腰褶','panel-circle-skirt',['裙装','半圆','两幅'],{circleRatio:.5,panels:2,gathering:0},'腰弧半径、幅片角度与直腰头由Sandy同源重算；成品裙长沿用明确的当前设计输入。'),
  structure('skirt-full-2','两幅整圆裙 / 无腰褶','panel-circle-skirt',['裙装','整圆','两幅'],{circleRatio:1,panels:2,gathering:0},'每幅单轴对折，保留独立腰头及其源折线；不使用双轴对折。'),
  structure('skirt-gather-4','四幅圆裙 / 腰褶增加50%','panel-circle-skirt',['裙装','四幅','抽褶'],{circleRatio:1,panels:4,gathering:.5},'增加的腰节展开量单独列出；抽褶完成态和开口仍待验证，不能将源原始边直接等长放行。'),
  structure('shirt-long-angled','长袖 / 斜角袖口 / 平下摆','button-up-shirt',['衬衫','长袖','斜角袖口','平下摆'],{sleeveStyle:'long',cuffStyle:'angledBarrelCuff',hemStyle:'straight'},'保留袖衩和单翻袖口，前后身按同一方法生成。'),
  structure('shirt-long-rounded','长袖 / 圆角袖口 / 圆弧摆','button-up-shirt',['衬衫','长袖','圆角袖口','圆弧摆'],{sleeveStyle:'long',cuffStyle:'roundedBarrelCuff',hemStyle:'baseball'},'袖口曲线及前后下摆由Simon重算。'),
  structure('shirt-long-straight','长袖 / 直角袖口 / 侧开衩','button-up-shirt',['衬衫','长袖','直角袖口','侧开衩'],{sleeveStyle:'long',cuffStyle:'straightBarrelCuff',hemStyle:'slashed'},'直角单翻袖口，侧缝保留同源开衩结构。'),
  ...(['straight','baseball','slashed'] as const).map((hemStyle,i)=>structure(`shirt-short-${hemStyle}`,`短袖折边 / ${['平下摆','圆弧摆','侧开衩'][i]}`,'button-up-shirt',['衬衫','短袖',['平下摆','圆弧摆','侧开衩'][i]],{sleeveStyle:'short',hemStyle,sleeveLengthShort:.4,sleeveHemShort:.04},'短袖移除袖口与两种袖衩；保留源折返线。')),
  ...[true,false].flatMap(ribbing=>[true,false].map(pocket=>structure(`zip-hoodie-${ribbing?'rib':'hem'}-${pocket?'pocket':'plain'}`,`开襟帽衫 / ${ribbing?'罗纹接条':'折边'} / ${pocket?'前贴袋':'无袋'}`,'hooded-zip-sweatshirt',['开襟帽衫',ribbing?'罗纹':'折边',pocket?'贴袋':'无袋'],{ribbing,pocket},'完整Huey开襟构型；切换同步改变衣身、袖长、罗纹及袋片。不能替代公司套头帽衫。'))),
  structure('tank-standard','背心 / 基准领深 / 四折包条','bound-tank',['背心','包条'],{necklineDrop:.2,shoulderStrapWidth:.15,knitBindingWidth:6},'Aaron领口、袖窿包条随衣身弧长联动。'),
  structure('tank-high-neck','背心 / 较高领口 / 宽肩带','bound-tank',['背心','包条','宽肩带'],{necklineDrop:.15,shoulderStrapWidth:.22,knitBindingWidth:6},'调整源领口下降及肩带宽度比例，同步重算包条。'),
  structure('tank-deep-neck','背心 / 较深领口 / 四折包条','bound-tank',['背心','包条','深领口'],{necklineDrop:.3,shoulderStrapWidth:.15,knitBindingWidth:6},'领口下降由体型测量驱动；负松量仍需材料测试。'),
];
export const COLOR_ASSETS=FABRIC_COLORS.map(c=>({...c,id:`color-${c.hex.slice(1).toLowerCase()}`,revision:1 as const}));
export const MATERIAL_SLOT_LABELS={main:'衣身主料',neck:'领口配料',cuff:'袖口配料',hem:'下摆配料'};
