import type { GarmentCategory } from '@/types/category-workbench';

export const CATEGORY_SCOPE={version:'garment-os/product-categories/v1',
  includes:'常见裁切缝制服装与服饰配件；每行是一种明确构型，不表示所有造型变体已经实现。',
  excludes:'鞋靴、包袋、整织袜、无缝整织服装及防护认证；特殊民族服饰与未登记构型须另行扩展。',
  governance:'分类、角色需求和接口为本系统设计契约；有参考图不等于有整款CAD，也不等于生产批准。'} as const;
export const CATEGORY_GROUPS=[
  ['base','制版基型'],['knit','针织上衣'],['shirt','衬衫 / Polo'],['sweat','卫衣 / 连帽'],
  ['outer','夹克 / 西装 / 大衣'],['pants','裤装'],['skirt','裙装'],['dress','连衣裙 / 连体'],
  ['underwear','内衣 / 泳装'],['functional','运动 / 户外'],['headwear','帽饰'],['hand-foot','手套 / 袜套'],['accessory','服饰配件'],
] as const;
type Group=typeof CATEGORY_GROUPS[number][0];
const contracts:Record<Group,{dimensions:string[];interfaces:string[]}>= {
  base:{dimensions:['胸围','肩宽/肩斜','前后腰节长','袖山高/袖窿长'],interfaces:['肩缝配对','侧缝配对','袖山与袖窿吃势']},
  knit:{dimensions:['胸腰臀围及松量','衣长','肩宽/肩斜','袖长/袖肥','领口净长与收边比例'],interfaces:['肩缝','侧缝','袖窿/袖山','袖底缝','领口收边','袖摆折边']},
  shirt:{dimensions:['胸腰臀围及松量','前后平衡','领围/领座高','袖长/袖口围','门襟搭量','过肩深'],interfaces:['领窝/领座/领面','袖山/袖窿','过肩/身片','袖衩/袖口','门襟折返']},
  sweat:{dimensions:['胸围及松量','衣袖长','袖窿长','领口/装帽净长','罗纹完成围长/收缩比例','帽深/帽口'],interfaces:['肩侧缝','袖山/袖窿','袖底缝','罗纹/接边','帽中缝/装帽边','口袋定位']},
  outer:{dimensions:['胸腰臀围及松量','前后平衡','肩宽/肩斜','领驳翻折线','袖山/肘围','里外层差'],interfaces:['分割身片','两片袖','领驳/挂面','里外层翻口','袋口','开衩']},
  pants:{dimensions:['腰臀围及松量','裆深/前后裆长','内外侧长','膝围/脚口围','腰头长高'],interfaces:['前后裆','内外侧缝','腰口/腰头','门襟闭合','袋口','脚口整理']},
  skirt:{dimensions:['腰臀围及松量','裙长','摆围','省量/褶量','腰头长高'],interfaces:['侧缝/幅间缝','腰节/腰头','开口闭合','摆口整理']},
  dress:{dimensions:['胸腰臀围及松量','胸点/胸距','前后腰节平衡','裙长/裤长','腰节/分割位置'],interfaces:['肩侧缝','省道/分割缝','腰节接缝或连体边','领袖口整理','开口闭合']},
  underwear:{dimensions:['胸/下胸/腰臀围','杯容/分割弧','裆长宽','材料双向伸缩/回弹','负松量'],interfaces:['杯片/下扒/侧比','裆部/裆里','弹力边/肩带','开口及闭合件']},
  functional:{dimensions:['活动围度/松量','插角边长链','开口/防风搭量','材料层厚/伸缩','补强定位'],interfaces:['活动插片','补强固定','防风/防雨覆片','拉链/挡片','层间连接']},
  headwear:{dimensions:['头围','帽深','檐宽/内外弧','里外层差'],interfaces:['帽顶/帽墙','檐面/檐底','里外层翻口']},
  'hand-foot':{dimensions:['手足围长','指长/拇指角度','指缝边长','负松量/伸缩方向'],interfaces:['掌背缝','指缝条','拇指接缝','袜身/足底']},
  accessory:{dimensions:['完成长宽','展开尺寸','折返量','闭合件定位'],interfaces:['配件内缝','翻口','系带/固定端']},
};
type Extras=Partial<Pick<GarmentCategory,'optionalRoles'|'templateIds'|'companyMasterIds'|'gaps'>>;
const c=(id:string,group:Group,label:string,construction:string,requiredRoles:string[],extra:Extras={}):GarmentCategory=>({
  id,group,label,construction,requiredRoles,optionalRoles:[],templateIds:[],companyMasterIds:[],gaps:[],...contracts[group],...extra,
});
const body=['body.front','body.back'],sleeved=[...body,'sleeve.main'];
const legs=['trouser.front','trouser.back'];
/** Requirements describe only the construction written on each row. Optional parts are never auto-counted as cuts. */
export const GARMENT_CATEGORIES:GarmentCategory[]=[
  c('bodice-block','base','上身制版基型','Brian 带袖男装基型',sleeved,{templateIds:['brian-reference'],gaps:['基型不等同成衣；收边与材料工艺须在款式中定义。']}),
  c('round-short-tee','knit','圆领短袖 T 恤','单片装袖、针织领口收边',[...sleeved,'binding.neck'],{templateIds:['t-shirt','t-shirt-pro'],companyMasterIds:['company-cot25m002'],gaps:['Teagan 源无独立领条；公司领口示意未成为同源领条净样。']}),
  c('waisted-tee','knit','收腰针织 T 恤','收腰侧缝、单片装袖',[...sleeved,'binding.neck'],{templateIds:['womens-basic-tee'],gaps:['源未生成独立领条；不保证胸部合体。']}),
  c('long-tee','knit','圆领长袖上衣','无罗纹袖摆、领口收边',[...sleeved,'binding.neck'],{templateIds:['long-sleeve-tee'],companyMasterIds:['company-lt26m1581'],gaps:['源无独立领条，折边与领口完成态待接通。']}),
  c('bound-tank','knit','包边背心','无袖、四折领口和袖窿包边',[...body,'binding.neck','binding.armhole'],{templateIds:['bound-tank'],gaps:['包条比例为源设计假设；材料回弹、条端闭合待确认。']}),
  c('v-neck-tee','knit','V 领 T 恤','尖角 V 领、独立领条',[...sleeved,'binding.neck'],{templateIds:['v-neck-tee'],gaps:['V 尖接缝、领条折返与领窝配长待建。']}),
  c('shirt','shirt','男装衬衫','全开襟、领座翻领、单翻袖口',[...sleeved,'yoke.back','collar.top','collar.under','collar.stand','cuff.barrel','placket.sleeve-overlap','placket.sleeve-underlap'],{templateIds:['button-up-shirt'],optionalRoles:['pocket.patch'],gaps:['Simon 合并领面/领底身份，尚无独立领底净样；袖口及袖衩布纹待补。']}),
  c('blouse','shirt','女装梭织衬衫','带胸省、领座翻领长袖',[...sleeved,'collar.top','collar.under','collar.stand','cuff.barrel'],{templateIds:['womens-blouse'],gaps:['胸点、胸省转移及前后平衡尚未实现。']}),
  c('short-polo','shirt','短袖 Polo','半开襟翻领',[...sleeved,'collar.top','placket.half-opening'],{templateIds:['polo-shirt'],gaps:['翻领及半开襟切口完整源未接入。']}),
  c('long-polo','shirt','长袖 Polo','半开襟翻领、罗纹袖口',[...sleeved,'collar.top','placket.half-opening','cuff.rib'],{templateIds:['long-sleeve-polo'],gaps:['领襟及袖口配长未接入。']}),
  c('crew-sweatshirt','sweat','圆领卫衣','罗纹领、袖口和下摆',[...sleeved,'binding.neck','cuff.rib','hem-band.rib'],{companyMasterIds:['company-at25m3295'],gaps:['公司二维母版可用；三处罗纹净样、身袖配缝与三维待建。']}),
  c('zip-hoodie','sweat','拉链连帽卫衣','Huey 两侧帽双层、拉链开襟', [...sleeved,'hood.side'],{templateIds:['hooded-zip-sweatshirt'],optionalRoles:['pocket.patch','cuff.rib','hem-band.rib'],gaps:['可选袋和罗纹按结构方案生成；完整装配接口待接通。']}),
  c('pullover-hoodie','sweat','套头交叉帽卫衣','双层交叉帽、袋鼠袋、罗纹袖摆',[...sleeved,'hood.side','pocket.patch','cuff.rib','hem-band.rib'],{companyMasterIds:['company-at25m3288'],gaps:['公司原稿母版可用；交叉帽与袋鼠袋净样、整体CAD及三维待建；不能用拉链帽衫替代。']}),
  c('jacket','outer','立领夹克','开襟、独立立领、单片袖',[...sleeved,'collar.standalone','facing.front'],{optionalRoles:['yoke.back','pocket.welt','pocket.bag','placket.zip-guard']}),
  c('blazer','outer','西装外套','领驳、两片袖、独立挂面',[...body,'body.side-front','sleeve.upper','sleeve.under','collar.top','collar.under','facing.front'],{optionalRoles:['reinforcement.chest','reinforcement.shoulder','reinforcement.sleeve-head','pocket.welt','pocket.bag']}),
  c('coat','outer','翻领大衣','长身、两片袖、翻领挂面',[...body,'sleeve.upper','sleeve.under','collar.top','collar.under','facing.front'],{optionalRoles:['facing.vent','strap.belt','pocket.welt','pocket.bag']}),
  c('padded-jacket','outer','保温夹克','面里层分离、填充层、单片袖',[...sleeved,'collar.standalone','facing.front'],{gaps:['材料层分别下料；里外层差、绗缝格与填充量未建。']}),
  c('straight-pants','pants','结构腰头长裤','前后裤片、拉链门襟、双层腰头',[...legs,'waistband.outer','waistband.inner','placket.fly-facing','placket.fly-shield'],{optionalRoles:['pocket.bag','pocket.facing','strap.loop']}),
  c('shorts','pants','松紧腰短裤','独立松紧腰头、前后裤片',[...legs,'waistband.casing'],{optionalRoles:['pocket.patch','pocket.bag','binding.casing']}),
  c('jeans','pants','牛仔裤','后育克、拉链门襟、双层腰头',[...legs,'yoke.lower','waistband.outer','waistband.inner','placket.fly-facing','placket.fly-shield','pocket.patch','pocket.bag','pocket.facing'],{optionalRoles:['pocket.coin','strap.loop']}),
  c('cargo','pants','工装裤','结构腰、侧立体袋',[...legs,'waistband.outer','waistband.inner','pocket.patch','pocket.bellows','pocket.flap'],{optionalRoles:['trouser.knee','reinforcement.knee','strap.tab','placket.fly-facing','placket.fly-shield']}),
  c('joggers','pants','松紧腰基础长裤','直筒前后裤片、连裁折腰；束脚为后续变化',[...legs,'waistband.casing'],{templateIds:['elastic-waist-pants'],optionalRoles:['hem-band.leg','gusset.crotch','pocket.bag'],gaps:['无袋直筒基础款已接同源CAD；侧袋、后袋、脚口接条及成衣完成态接口待验证。']}),
  c('leggings','pants','弹力紧身裤','前后裤片、松紧腰、裆插片',[...legs,'waistband.casing','gusset.crotch'],{gaps:['需双向伸缩/回弹与负松量专用约束。']}),
  c('straight-skirt','skirt','直身裙','前后裙片、腰口贴边',['skirt.front','skirt.back','facing.waist']),
  c('a-line-skirt','skirt','A 字裙','前后裙片、独立双层腰头',['skirt.front','skirt.back','waistband.outer','waistband.inner']),
  c('gored-skirt','skirt','分幅圆裙','Sandy圆弧裙幅、自然腰位、直腰头连裁折腰',['skirt.gore','waistband.outer'],{templateIds:['panel-circle-skirt'],gaps:['本行仅接通圆弧裙幅；任意直线拼幅、插片及曲腰另需制图方法。','腰里由同一腰头折返，不重复下料；拉链开口、折腰完成态、材料与成衣完成态仍待验证。']}),
  c('tiered-skirt','skirt','层褶裙','横向层片、松紧腰',['skirt.tier','waistband.casing'],{optionalRoles:['drape.ruffle']}),
  c('wrap-skirt','skirt','裹裙','裹合裙片、裁切系带',['skirt.wrap','strap.tie','facing.waist']),
  c('onepiece-dress','dress','连身连衣裙','无腰节横切、领袖窿连体贴边',['body.dress-front','body.dress-back','facing.combined'],{optionalRoles:['sleeve.main','drape.flounce']}),
  c('waist-seam-dress','dress','腰节分割连衣裙','衣身加裙片，不重复算连衣片',[...body,'skirt.front','skirt.back','facing.neck'],{optionalRoles:['sleeve.main','strap.shoulder','drape.peplum']}),
  c('jumpsuit','dress','连体服','无腰节横切的连体主体',['body.onepiece-front','body.onepiece-back','facing.neck'],{optionalRoles:['gusset.crotch','sleeve.main']}),
  c('dungarees','dress','背带裤','独立胸挡、裤片与裁切肩带',[...legs,'body.bib','strap.shoulder','waistband.outer','waistband.inner']),
  c('bra','underwear','分割杯文胸','软杯上下分割、下扒侧比',['foundation.cup-upper','foundation.cup-lower','foundation.bridge','foundation.cradle','foundation.wing','strap.shoulder'],{optionalRoles:['foundation.cup-side']}),
  c('briefs','underwear','内裤 / 泳裤','前后片、独立裆片',['foundation.brief-front','foundation.brief-back','gusset.crotch'],{optionalRoles:['foundation.brief-side','binding.edge']}),
  c('swimsuit','underwear','连体泳衣','连体前后片、裆插片与裁切包边',['body.onepiece-front','body.onepiece-back','gusset.crotch','binding.edge']),
  c('corset','underwear','束身衣','多分割片、独立裁切骨道',['foundation.corset-panel','binding.casing'],{optionalRoles:['foundation.cup-whole','strap.shoulder']}),
  c('shell-jacket','functional','户外连帽外壳','三片帽、腋插片、拉链挡片',[...sleeved,'hood.side','hood.center','gusset.underarm','placket.zip-guard'],{optionalRoles:['hood.visor','drape.storm-shield','reinforcement.local','strap.tab'],gaps:['防水压胶/防护性能属于额外验证，分类不等同认证。']}),
  c('brimmed-hat','headwear','有檐拼接帽','帽顶、帽墙、独立檐面底',['headwear.crown','headwear.band','headwear.brim-top','headwear.brim-under'],{optionalRoles:['headwear.earflap']}),
  c('gloves','hand-foot','分指裁切手套','掌背、独立拇指、指缝条',['hand-foot.palm','hand-foot.back','hand-foot.thumb','hand-foot.fourchette']),
  c('cut-socks','hand-foot','裁切袜套','袜身与独立足底',['hand-foot.sock-body','hand-foot.sole']),
  c('tie','accessory','领带','裁切主片、独立尖里',['accessory.tie','accessory.tie-tip']),
  c('bow-tie','accessory','领结','主体、中心结环、裁切系带',['accessory.bow','accessory.bow-band','strap.tie']),
  c('bib','accessory','围兜','围兜主体与裁切包边',['accessory.bib','binding.edge']),
  c('scarf','accessory','围巾 / 头巾','裁切单片、周边折边',['accessory.scarf']),
  c('veil','accessory','头纱','裁切纱片、边缘整理',['accessory.veil']),
];
export function garmentCategory(id:string):GarmentCategory {
  const value=GARMENT_CATEGORIES.find(c=>c.id===id);
  if(!value)throw new Error(`未登记的服装品类：${id}`);
  return value;
}

