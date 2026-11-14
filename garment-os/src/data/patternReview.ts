/** Every shipped template has an explicit disposition. No unknown template is executable. */
export type ReferenceEngine = 'brian' | 'teagan' | 'sven' | 'simon' | 'aaron' | 'huey' | 'sandy' | 'paco';
export interface PatternReview {
  id: string; disposition: 'reference' | 'rebuilt' | 'retired' | 'rebuild-required';
  engine?: ReferenceEngine; reason: string; limitations: string; replacementId?: string;
  options?: Record<string, number | boolean | string>;
}
export const PATTERN_REVIEWS: Record<string, PatternReview> = Object.fromEntries(([
  { id: 'brian-reference', disposition: 'reference', engine: 'brian', reason: '保留完整 Brian 男装基型；逐点与上游对照。', limitations: '男装基型参考；试坯、材料与制造交付未验收。' },
  { id: 't-shirt', disposition: 'rebuilt', engine: 'teagan', reason: '旧衣身/短袖近似式删除，改用完整 Teagan 前身、后身及配套短袖。', limitations: '针织基础参考；领口收边方式与材料条件待补。', options: { fitWaist: false } },
  { id: 't-shirt-pro', disposition: 'retired', replacementId: 't-shirt', reason: '与基础 T 恤重复，旧“专业”称号无验收依据，合并至重建后的圆领 T 恤。', limitations: '旧几何禁止生成与导出。' },
  { id: 'long-sleeve-tee', disposition: 'rebuilt', engine: 'sven', reason: '改用 Sven 无罗纹配置的完整长袖针织上衣；袖口和衣身按同一方法解算。', limitations: '宽松长袖针织参考，不等同于贴体打底衫；材料和领口收边待核验。', options: { ribbing: false } },
  { id: 'womens-basic-tee', disposition: 'rebuilt', engine: 'teagan', reason: '改用 Teagan 收腰基础针织 T 恤，腰臀围直接驱动真实侧缝。', limitations: '基础针织参考，不提供梭织胸省、全胸调整或女装合体保证。', options: { fitWaist: true } },
  { id: 'button-up-shirt', disposition: 'rebuilt', engine: 'simon', reason: '改用完整 Simon：左右前身、后身、过肩、袖、领面、领座、袖口及两种袖衩。', limitations: '男装衬衫参考；领底差异未拆成独立生产裁片；袖口和两种袖衩缺上游布纹；衬料、逐层用量和试坯待核验。' },
  { id: 'v-neck-tee', disposition: 'rebuild-required', reason: '旧 V 领仅加深领窝，缺少尖角、肩领关系及 V 领收边构型。', limitations: '需建立 V 领具体构型、领条/贴边、材料伸缩条件与缝合配对；禁止用圆领改名替代。' },
  { id: 'polo-shirt', disposition: 'rebuild-required', reason: '旧立领条与矩形门襟独立拼接，未定义翻领/领座、半开襟切口及装配。', limitations: '需 Polo 翻领/领座和半开襟的完整制图、材料及接口依据；Simon 全开襟不能冒充。' },
  { id: 'long-sleeve-polo', disposition: 'rebuild-required', reason: '除 Polo 领襟缺口外，旧袖口是腕围加常数，未与袖下口和褶量配合。', limitations: '需完成 Polo 领襟与长袖下口、袖口/袖衩具体构型及走缝约束。' },
  { id: 'womens-blouse', disposition: 'rebuild-required', reason: '旧实现仅切换女性尺码加贴袋，缺少胸部立体量、省道和前后平衡控制。', limitations: '需胸围/高胸围、胸点与前腰节协议、胸省/省道方法及合体试坯。' },
] satisfies PatternReview[]).map(review => [review.id, review]));
PATTERN_REVIEWS['bound-tank']={id:'bound-tank',disposition:'reference',engine:'aaron',reason:'采用完整Aaron前后身及同源领口、袖窿四折包条。',limitations:'95%包条比例是源设计假设；条端闭合、材料伸缩与布纹待验证。领口弯曲锁定源默认值1，未开放未经独立走缝确认的其他弯曲。'};
PATTERN_REVIEWS['hooded-zip-sweatshirt']={id:'hooded-zip-sweatshirt',disposition:'reference',engine:'huey',reason:'采用完整Huey开襟连帽卫衣，含帽侧片、前袋、罗纹袖口和罗纹下摆。',limitations:'帽裁4片是同面料双层源构型；罗纹设计缩率需实测回弹，折叠完成态、拉链与材料未验收。'};
PATTERN_REVIEWS['panel-circle-skirt']={id:'panel-circle-skirt',disposition:'reference',engine:'sandy',reason:'采用Sandy同源圆弧裙幅与连裁折腰；保留源腰弧、下摆裁边、折线及明确裁剪数量。',limitations:'仅开放自然腰位、直腰头、2至4幅单轴对折构型；抽褶、腰头翻折与搭量闭合、拉链开口、材料及成衣完成态待验收。',options:{waistbandPosition:0,waistbandShape:'straight',seamlessFullCircle:false}};

PATTERN_REVIEWS['elastic-waist-pants']={id:'elastic-waist-pants',disposition:'reference',engine:'paco',reason:'Paco前后裤片与同源连裁松紧腰头，先建立无袋直筒基础款。',limitations:'当前仅无袋、无脚口接条的直筒长裤；松紧回弹、腰头完成态和成衣完成态待验证。前袋源对折标识与裁剪清单冲突，暂不启用。',options:{frontPockets:false,backPockets:false,elasticatedCuff:false}};

export function isReferencePattern(id: string): boolean {
  return !!PATTERN_REVIEWS[id]?.engine;
}
export function requireReviewedPattern(id: string): PatternReview & { engine: ReferenceEngine } {
  const review = PATTERN_REVIEWS[id];
  if (!review?.engine) throw new Error(`模板尚未重建或已停用：${id}。${review?.reason ?? '没有逐项审查记录'}`);
  return review as PatternReview & { engine: ReferenceEngine };
}


