import type { PieceFamilyId } from '@/types/piece-taxonomy';

/** Coverage examples, not an assembly recipe: optional roles depend on the construction. */
export const PIECE_SCENARIOS: Array<{id:string;label:string;families:PieceFamilyId[];examples:string[];note:string}> = [
  {id:'knit',label:'针织上衣 / 卫衣',families:['body','sleeve','binding','cuff','hem-band'],examples:['body.front','body.back','sleeve.main','binding.neck','cuff.rib','hem-band.rib'],note:'领条、罗纹或折边按构型选择；整织领不虚构裁片。'},
  {id:'shirt',label:'衬衫 / Polo',families:['body','yoke','sleeve','collar','cuff','placket','pocket'],examples:['collar.top','collar.under','collar.stand','placket.half-opening','placket.sleeve-overlap','placket.sleeve-underlap'],note:'全开襟和半开襟、领座和立领、袖衩内外搭分别核对。'},
  {id:'tailoring',label:'夹克 / 西装 / 大衣',families:['body','yoke','sleeve','collar','facing','pocket','reinforcement','placket'],examples:['body.side-front','sleeve.upper','sleeve.under','facing.front','pocket.welt','reinforcement.chest','reinforcement.sleeve-head'],note:'里片用相同结构角色加里料身份；不能直接复用面片轮廓冒充里片。'},
  {id:'hooded',label:'连帽服装',families:['hood','facing','binding','strap'],examples:['hood.side','hood.center','hood.one-piece','hood.visor','facing.hood','binding.casing'],note:'两片帽和三片帽是不同构型；帽口、头部容积与装领边需联动。'},
  {id:'trousers',label:'裤装 / 短裤 / 工装',families:['trouser','yoke','waistband','placket','pocket','gusset','strap','facing','hem-band'],examples:['trouser.front','trouser.back','yoke.lower','placket.fly-facing','placket.fly-shield','waistband.outer','waistband.inner','strap.loop'],note:'门襟连身部分不重复下料；直/弯腰头、贴边腰和松紧腰分构型。'},
  {id:'skirt',label:'裙装',families:['skirt','waistband','facing','drape'],examples:['skirt.front','skirt.back','skirt.gore','skirt.godet','skirt.tier','skirt.wrap','facing.waist'],note:'裙幅、插片、层裙及裹裙可按实际分割组合；褶量保留在片内。'},
  {id:'dress',label:'连衣裙 / 礼服',families:['body','skirt','facing','strap','drape','foundation'],examples:['body.dress-front','body.dress-back','facing.combined','strap.shoulder','drape.flounce','foundation.corset-panel'],note:'腰节是否切开决定使用连衣片还是衣身加裙片，不能重复统计。'},
  {id:'onepiece',label:'连体衣 / 连体工装',families:['body','trouser','gusset','strap'],examples:['body.onepiece-front','body.onepiece-back','body.bib','gusset.crotch'],note:'连体主体与分割上身/裤身互为构型选择。'},
  {id:'underwear',label:'内衣 / 泳装 / 塑形',families:['foundation','gusset','strap','binding','body'],examples:['foundation.cup-upper','foundation.cup-lower','foundation.cup-side','foundation.cup-whole','foundation.bridge','foundation.cradle','foundation.wing','foundation.brief-front','foundation.brief-back'],note:'软杯、模杯、钢圈及弹性材料需专用约束；买入模杯/钢圈属于BOM。'},
  {id:'functional',label:'运动 / 防护 / 户外',families:['gusset','reinforcement','placket','binding','strap','drape'],examples:['gusset.underarm','reinforcement.knee','placket.zip-guard','drape.storm-shield'],note:'活动插片、补强和防雨覆片需实际独立裁切；不表示满足防护认证。'},
  {id:'hats',label:'独立帽饰',families:['headwear'],examples:['headwear.crown','headwear.band','headwear.brim-top','headwear.brim-under','headwear.earflap'],note:'帽檐面/底独立管理；与装到衣领的连帽区别。'},
  {id:'gloves-socks',label:'裁切手套 / 袜套',families:['hand-foot'],examples:['hand-foot.palm','hand-foot.back','hand-foot.thumb','hand-foot.fourchette','hand-foot.sock-body','hand-foot.sole'],note:'仅覆盖裁切缝制产品；整织袜、鞋楦与鞋底制造另域。'},
  {id:'accessories',label:'围护 / 领带 / 领结',families:['accessory','strap'],examples:['accessory.tie','accessory.tie-tip','accessory.bow','accessory.bow-band','accessory.bib','accessory.scarf','accessory.veil'],note:'覆盖裁切服饰配件；包袋和鞋靴不属于当前版型库范围。'},
];

export const PIECE_CLASSIFICATION_RULES = [
  '同属单片袖不代表兼容：装袖、插肩、落肩需各自配套前后衣身、袖片与接口规则；禁止用颜色、斜向装饰线或总长相等代替结构配套。',
  '一片由稳定角色、实例身份、材料层与源版本共同确定。左右、前后、内外层及多片重复实例须明确，不能只依赖中文名称。',
  '领型、袖型、端角、长短和分割方案是构型选项；真正分开裁切时才新增裁片实例。',
  '面料、里料、衬料、垫衬、保温填充、衬垫、罗纹是材料轴，不新增结构类别；不同材料不保证同形。',
  '数量、对折、镜像、经纬/斜裁互不替代；不能由数量2推断镜像，也不能按部位猜对折。',
  '省道、褶量、连身驳领、连身门襟和折边是母片特征；剪口、钻孔、布纹和缝线是图纸层，不是额外裁片。',
  '买入纽扣、拉链、织带、松紧带、模杯、钢圈、成品肩垫及标签归BOM；只有实际裁切的形状才进入裁片库。',
  '大类和角色字典是内部管理标准；分类定义不等于已有几何、装配合格或生产验收。',
  '新增角色先登记尺寸口径和接口，再接入有版本的制图源、精确绑定与回归案例；未知分类、未知筛选和元数据冲突必须阻断。',
];
