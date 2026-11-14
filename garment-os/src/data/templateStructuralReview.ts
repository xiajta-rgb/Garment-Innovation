/** Source/construction review, separate from software execution and manufacturing acceptance. */
export interface StructuralReviewRecord { scope: string; findings: string[]; sourceFiles: string[] }
const basic = (scope: string, engine: string): StructuralReviewRecord => ({ scope, findings: [
  '前后身与配套袖片可按源版核对，独立领条/贴边及其闭合装接未形成完整方法。',
  '前后袖山剪口、肩部对位与吃势分配须核对，整体袖山等长不能代替局部对位。',
  '折边、缝份转角、材料伸缩和目标人体的前后平衡尚未完成验证。',
], sourceFiles: [`@freesewing/${engine}@4.10.2/src/${engine === 'sven' ? 'frontback' : 'front'}.mjs`, `@freesewing/${engine}@4.10.2/src/sleeve.mjs`, 'src/data/assemblyPlans.ts'] });
export const TEMPLATE_STRUCTURAL_REVIEWS: Readonly<Record<string, StructuralReviewRecord>> = {
  'brian-reference': { ...basic('男装上身参考基型，不是已完成成衣模板', 'brian'), sourceFiles: ['@freesewing/brian@4.10.2/src/front.mjs', '@freesewing/brian@4.10.2/src/back.mjs', '@freesewing/library@4.10.2/src/sleeve/index.mjs', 'src/lib/pattern/reference/brian.ts'] },
  't-shirt': basic('装袖圆领短T主体', 'teagan'),
  'womens-basic-tee': { ...basic('收腰针织T，不适用于梭织女装合体', 'teagan'), findings: [...basic('', 'teagan').findings, '未建立高胸围、胸点和全胸调整；不能仅凭女体尺寸认定胸部平衡正确。'] },
  'long-sleeve-tee': basic('Sven无罗纹配置的装袖长袖上衣', 'sven'),
  'button-up-shirt': { scope: 'Simon长袖/短袖、三种单翻袖口及三种下摆的参考子集', findings: [
    '领面与领底共用一份源片；underCollar只是差异外周线，缺少独立闭合领底。',
    '领座剪口、门襟翻折后的领窝端点、领面与领座装接区未完成。',
    '长袖去褶后的装袖口边仍有差值，不能扩大公差抵消；袖衩折返及袖口搭门需完成态几何。',
    '袖口及两种袖衩缺源布纹；双层过肩、领座、袖口及衬层需逐层核对。',
    '曲线下摆的翻折差量及侧开衩完成态尚未生成。',
  ], sourceFiles: ['@freesewing/simon@4.10.2/src/collar.mjs', '@freesewing/simon@4.10.2/src/collarstand.mjs', '@freesewing/simon@4.10.2/src/sleeve.mjs', 'src/lib/pattern/assembly/construction.ts'] },
  'bound-tank': { scope: 'Aaron前后身与四折领口/袖窿包条', findings: [
    '95%条长为源设计假设；端头接缝损耗、四折后的有效装接边未定义。',
    '包条布纹、材料伸长回弹及净条长与裁切长的适用条件待核对。',
    '衣身负松量不能视为面料实测弹性；不支持按纹理推定材料性能。',
  ], sourceFiles: ['@freesewing/aaron@4.10.2/src/back.mjs', '@freesewing/aaron@4.10.2/src/neck-binding.mjs', '@freesewing/aaron@4.10.2/src/arm-binding.mjs', 'src/data/knitAssemblyPlans.ts'] },
  'hooded-zip-sweatshirt': { scope: 'Huey开襟连帽卫衣，袋与罗纹开关需成套核对', findings: [
    '帽裁4片为同面料内外双层；异材帽里差量与帽布纹未定义。',
    '袖口/下摆罗纹须完成折合装接及材料回弹校验；原始矩形长边不能直接放行。',
    '前拉链长度、帽前开口、袋底与下摆共缝及袋口翻折尚未联动完成。',
  ], sourceFiles: ['@freesewing/huey@4.10.2/src/hood.mjs', '@freesewing/huey@4.10.2/src/pocket.mjs', '@freesewing/huey@4.10.2/src/cuff.mjs', 'src/data/knitAssemblyPlans.ts'] },
  'panel-circle-skirt': { scope: 'Sandy自然腰位、直腰头、2至4幅单轴对折子集', findings: [
    '裙幅物理实例、拉链开口与缝止点未分配，现有同源等长侧边不代表闭合完成。',
    '腰头含搭量，抽褶需按完成态处理；必须剔除搭量并核对闭合腰围。',
    '曲线下摆整理量与翻折差量、材料及试样未完成。',
  ], sourceFiles: ['@freesewing/sandy@4.10.2/src/skirt.mjs', '@freesewing/sandy@4.10.2/src/straight-waistband.mjs', 'src/data/skirtAssemblyPlan.ts'] },
  'elastic-waist-pants': { scope: 'Paco无袋、无脚口接条的松紧腰直筒长裤', findings: [
    '腰头闭合接头、松紧长度、折返和臀围穿脱能力未完成；腰口总长相等不代表可穿脱。',
    '前后裆和左右裤腿实例、裆部活动量及目标人体平衡需验证。',
    '前袋源对折图示与裁剪清单冲突；前后袋及脚口接条保持禁用。',
  ], sourceFiles: ['@freesewing/paco@4.10.2/src/front.mjs', '@freesewing/paco@4.10.2/src/back.mjs', '@freesewing/paco@4.10.2/src/waistband.mjs', 'src/data/pantsAssemblyPlan.ts'] },
  't-shirt-pro': { scope: '已合并至基础短T，旧几何停用', findings: ['重复模板无独立方法依据，保留停用，不得恢复旧几何。'], sourceFiles: ['src/data/patternReview.ts'] },
  'v-neck-tee': { scope: '待重建的V领短T', findings: ['缺少V形领窝、尖角拼接、领条/贴边及前后肩领联动，禁止用圆领加深替代。'], sourceFiles: ['src/data/patternReview.ts'] },
  'polo-shirt': { scope: '待重建的短袖Polo', findings: ['缺少翻领/领座、半开襟切口、转角、门襟搭量和装配关系。'], sourceFiles: ['src/data/patternReview.ts'] },
  'long-sleeve-polo': { scope: '待重建的长袖Polo', findings: ['缺少Polo领襟完整结构，长袖下口、褶量及袖口/袖衩也未配套。'], sourceFiles: ['src/data/patternReview.ts'] },
  'womens-blouse': { scope: '待重建的女装梭织衬衫', findings: ['缺少胸省、胸点、高胸围、前腰节和前后平衡方法；换人体尺寸不能代替女装结构。'], sourceFiles: ['src/data/patternReview.ts'] },
};

/** The user's hold applies to every matrix entry point, including legacy links and export calls. */
export const DESIGN_MATRIX_REVIEW_HOLD = Object.freeze({ active: true, reason: '全部模板结构审查尚有未完成项，设计矩阵暂停；先完成配套裁片与工艺核对。' });
export function requireDesignMatrixReady() {
  if (DESIGN_MATRIX_REVIEW_HOLD.active) throw Error(DESIGN_MATRIX_REVIEW_HOLD.reason);
}
