import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import sharp from 'sharp';

const run = 'mens-sweatshirt-redesign-correction-20261113';
const publicRoot = path.resolve('public/research-pilots', run);
const coreRoot = 'C:/Users/xmls/Documents/trae_projects/fashion-designer-core-skill';
const priorRoot = path.join(coreRoot, 'artifacts/mens-sweatshirt-innovation-20261113');
const materialData = JSON.parse(await fs.readFile(path.join(priorRoot, 'research.json'), 'utf8'));
const masterSource = JSON.parse(await fs.readFile(path.join(priorRoot, 'enterprise-baseline.json'), 'utf8'));

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const [{ newCompanyStyle, readCompanyStyle }, { exportCompanyStyleSvg, companyStyleFigure } , { companyStyleMaster }] = await Promise.all([
    vite.ssrLoadModule('/src/lib/pattern/company-style.ts'),
    vite.ssrLoadModule('/src/lib/pattern/company-style-drawing.ts'),
    vite.ssrLoadModule('/src/data/companyStyleMasters.ts'),
  ]);
  const master = companyStyleMaster('company-at25m3295');
  const base = newCompanyStyle('company-at25m3295');
  const findMaterial = code => materialData.materials.find(item => item.materialCode === code);
  const fc174 = findMaterial('FC174');
  const fc063 = findMaterial('FC063');
  if (!fc174 || !fc063) throw new Error('校正轮缺少 FC174 或 FC063 材料记录');

  const makeDraft = (id, name, material, notes) => readCompanyStyle({
    ...base,
    styleCode: `REDESIGN-${id}`,
    name,
    color: '#dedbd3',
    fabric: `${material.materialCode} ${material.materialName}`,
    composition: material.ingredients,
    weight: `${material.gramWeight}g/m²（材料库标称，待实测）`,
    notes,
    cadApplied: false,
  });

  const sourceNote = 'AT25M3295 基款硬锁：微落肩、圆领、长袖、净面无袋、55mm宽2×2罗纹袖口与下摆；原稿比例，不是毫米净样。';
  const candidates = [
    {
      id: 'S0', name: 'AT25M3295 原稿基线', role: '基款锁定', canApply: true,
      change: '保留我司原稿的微落肩、圆领、长袖、净面无袋与宽罗纹收口',
      question: '基款的版型比例和工艺识别是否被完整保留？',
      falsifier: '如果图稿仍表现成普通T恤窄收口或通用直肩，基款复核不通过。',
      evidenceIds: ['D1', 'D2', 'M1'],
      evidenceSummary: [
        { id: 'D1', finding: 'AT25M3295 原稿显示微落肩、圆领、长袖、净面无袋和宽罗纹收口。', boundary: '二维原稿能证明视觉与工艺标注来源，不能替代毫米净样。' },
        { id: 'D2', finding: 'AT25M3288 证明同系列共用微落肩、长袖和宽罗纹骨架。', boundary: '连帽的双层帽、帽襟和帽绳不能转成半拉链领部依据。' },
        { id: 'M1', finding: '本轮经验要求先锁外轮廓、肩袖连接、罗纹高度和前后比例，再做单变量改款。', boundary: '这是项目评审经验，不是企业通用版型标准。' },
      ],
      opportunityJudgment: '这是基准对照，不构成创新机会主张。它的价值是确认我司基款被正确继承，并为 S1/S2 的单变量归因提供对照。',
      opportunityStatus: 'baseline-only',
      opportunityBoundary: '没有新的需求、价格、成本或市场增量证据；不进入正式机会资格，也不代表生产批准。',
      designDecision: {
        keep: ['微落肩、圆领、长袖、净面无袋', '55mm 宽 2×2 罗纹袖口与下摆', '原稿正背比例和侧面袖体量'],
        change: [],
        prohibited: ['不得画成普通T恤窄收口', '不得用通用直肩替代我司微落肩'],
      },
      validationGate: {
        stage: '设计复核前置',
        evidenceNeeded: ['AT25M3295 原始设计稿/工艺单', '原始毫米净样或同款实物', '版师或设计责任人复核记录'],
        sequence: ['逐项对照正面、背面、侧面和宽罗纹表达', '记录领条、罗纹、缝份和针距等未闭合字段', '由授权责任人确认是否达到基款继承要求'],
        decisionRule: '任一锁定 DNA 未被继承则退回修正；原稿、净样或责任人未补齐时保持 baseline-only。',
      },
      nextAction: '先完成 AT25M3295 基款继承复核，形成带责任人的缺口清单；不把 S0 当成新款机会。',
      material: { code: fc174.materialCode, ingredients: fc174.ingredients, nominalGsm: fc174.gramWeight, source: 'E2', testStatus: 'not-tested' },
      draft: makeDraft('S0', 'AT25M3295 原稿基线', fc174, `${sourceNote} 本轮只用于基款复核，不代表生产批准。`),
      svg: 'S0-company-master.svg', image: 'S0-company-master.png', patternStatus: 'company-master-trace',
      needs: ['原始毫米净样、放码和同款实物未取得。', '55mm罗纹高度、领条长度、缝份和针距需按原稿/工艺单/样衣复核。'],
    },
    {
      id: 'S1', name: '轻材料同版型', role: '材料单项改款', canApply: true,
      change: '只替换主体材料为 FC063 260g 候选；全部基款轮廓、领、袖口、下摆和净面关系保持',
      question: '较轻材料能否改善日常层搭，同时保持基款外观与洗后稳定？',
      falsifier: '如果换料后收口波浪、领口失稳、表面起球/落毛或洗后形态退化，则否定材料分支。',
      evidenceIds: ['D1', 'E2', 'S3', 'M1'],
      evidenceSummary: [
        { id: 'D1', finding: 'AT25M3295 提供必须保持的版型、领部和罗纹基准。', boundary: '原稿比例不是成衣尺寸，不能单独证明换料后的版型表现。' },
        { id: 'E2', finding: 'FC063 是我司材料主数据中的 260g、68%棉/27%涤/5%氨纶候选。', boundary: '只有材料主数据，暂无本轮试样物性、洗后或成衣性能证明；260g 不等于轻盈、透气或耐久。' },
        { id: 'S3', finding: '评论样本出现不同颜色/材料体验、洗后变长、掉絮和起球等问题，也有不缩水不起球的正例。', boundary: '购买者历史自述有正反反例，不代表总体发生率，也不能替代我司样衣数据。' },
        { id: 'M1', finding: '本轮方法要求材料变化同步检查罗纹匹配、回弹、洗缩、表面和缝口平整。', boundary: '方法卡没有企业阈值，需由授权责任人指定测试条件。' },
      ],
      opportunityJudgment: '这是当前最值得做的材料单项机会候选：它把评论中的材料不一致、洗后保持和表面质量问题转成可验证假设，同时保留我司版型语法。证据支持“值得做对照”，尚不支持“较轻一定更舒适”或“市场机会已成立”。',
      opportunityStatus: 'candidate-opportunity',
      opportunityBoundary: '未取得 FC063 实物性能、同版型样衣、同体型试穿、洗后记录、成本和商品判断前，不提升为 adopted、正式机会或生产候选。',
      designDecision: {
        keep: ['AT25M3295 全部轮廓、圆领、肩袖、净面无袋和 55mm 罗纹关系'],
        change: ['只替换主体材料为 FC063 260g 候选'],
        prohibited: ['不叠加领型、口袋、拼片或图案变化', '不把克重直接写成透气、轻盈、耐穿结论'],
      },
      validationGate: {
        stage: '材料单项样衣前置',
        evidenceNeeded: ['FC063 与原款主体材料实物批次', '与主体材料匹配的罗纹批次', '版师、面料技术、质量和商品责任人', '洗前后尺寸、表面和穿着记录'],
        sequence: ['冻结 S0/S1 同版型、同尺码和同结构对照', '成对检查主体—罗纹伸长回弹、洗缩、缝口平整、起球和落毛', '做同体型日常层搭与办公场景对照试穿', '回写成本、可得性和商品判断'],
        decisionRule: '只有真实对照记录、授权测试条件、责任人结论和商品成本判断同时形成后，才可讨论保留；关键证据缺失则保持 candidate-opportunity。',
      },
      nextAction: '优先取得 FC063 和原款材料/罗纹对照批次，建立 S0/S1 单变量样衣与洗后记录；暂不扩大到结构改款。',
      material: { code: fc063.materialCode, ingredients: fc063.ingredients, nominalGsm: fc063.gramWeight, source: 'E2', testStatus: 'not-tested' },
      draft: makeDraft('S1', '轻材料同版型', fc063, `${sourceNote} 只改主体材料；克重不直接等于轻盈、透气或耐久。罗纹配套、洗缩、回弹、表面和成本待验证。`),
      svg: 'S1-company-master.svg', image: 'S1-company-master.png', patternStatus: 'company-master-trace',
      needs: ['FC063 与原 420g 罗纹的伸长、回弹、洗缩和缝口平整需成对测试。', '不能沿用原款罗纹规格而跳过材料联动。'],
    },
    {
      id: 'S2', name: '微对比罗纹同版型', role: '视觉单项改款', canApply: false,
      change: '只改变领、袖口和下摆的视觉对比关系；不改变基款轮廓、结构、口袋和主身材料',
      question: '在保留我司卫衣骨架的前提下，微弱收口对比是否足以形成可识别差异？',
      falsifier: '如果对比色抢过基款识别、色牢度/沾色不稳定或用户偏好无改善，则回退原款。',
      evidenceIds: ['D1', 'S3', 'M1'],
      evidenceSummary: [
        { id: 'D1', finding: 'AT25M3295 提供微落肩圆领、宽罗纹和净面关系，能约束视觉变化范围。', boundary: '原稿没有证明对比罗纹会带来市场偏好或溢价。' },
        { id: 'S3', finding: '评论中有办公或工作场景不便穿连帽、带图案服装的自述，支持保持净面和克制表达。', boundary: '这是少量历史购买者自述，不能外推为对比罗纹需求。' },
        { id: 'M1', finding: '本轮经验支持低风险单变量视觉探索，但要求保留基款结构识别。', boundary: '方法经验不提供色号、色牢度、起订量或价格结论。' },
      ],
      opportunityJudgment: '这是视觉差异假设，不是已被市场证实的机会。它可以检验“保留我司卫衣骨架、只改变收口对比”是否提高识别度或偏好，但当前没有直接需求结果证据。',
      opportunityStatus: 'visual-hypothesis-only',
      opportunityBoundary: '未有色号/供应链可得性、洗后沾色与色牢度、目标人群偏好和成本证据；不能计入正式机会或设计台可执行款。',
      designDecision: {
        keep: ['AT25M3295 轮廓、圆领、肩袖、净面无袋、主身材料和罗纹高度'],
        change: ['只提出领、袖口和下摆的微对比视觉关系'],
        prohibited: ['不得借对比色叠加新结构', '不得把办公场景自述写成普遍需求'],
      },
      validationGate: {
        stage: '视觉提案审查',
        evidenceNeeded: ['实际罗纹色号与供应链确认', '洗后沾色/色牢度条件与记录', '目标人群偏好或选款结果', '采购起订量与成本信息'],
        sequence: ['先以同版型视觉稿确认对比强度和基款识别', '补齐配套罗纹来源与色号', '再做小范围偏好/选款记录和洗后色彩检查', '根据责任人结论决定回退或进入下一轮'],
        decisionRule: '在视觉、供应链、色牢度和偏好证据没有同时闭合前，保持 visual-hypothesis-only，不送入当前设计台。',
      },
      nextAction: '保留为视觉讨论稿，先补对比罗纹色号、供应链和验证条件；不继续叠加图案、拼片或领型。',
      material: { code: fc174.materialCode, ingredients: fc174.ingredients, nominalGsm: fc174.gramWeight, source: 'E2', testStatus: 'not-tested' },
      draft: makeDraft('S2', '微对比罗纹同版型', fc174, `${sourceNote} 仅为视觉提案，当前设计台不能保留该罗纹配色状态，暂不允许送入设计台。`),
      svg: 'S2-contrast-rib-proposal.svg', image: 'S2-contrast-rib-proposal.png', patternStatus: 'visual-proposal-only',
      needs: ['领/袖口/下摆实际罗纹色号与供应链匹配待定。', '洗后沾色、色牢度和采购起订量待核。', '平台需要新增“基款配套部件对比色”字段后才可保留该设计状态。'],
    },
    {
      id: 'Q0', name: '半拉链方向（暂不落图）', role: '结构开发单', canApply: false,
      change: '市场假设仍保留为研究方向，但不在没有我司半拉链原稿/净样时生成伪三视图',
      question: '我司是否有可核验的半开襟领部结构、版型规格和真实穿着反馈？',
      falsifier: '没有原稿、净样、结构责任人和样衣验证时，不能把半拉链列入可执行改款。',
      evidenceIds: ['S1', 'S2', 'E1', 'D1', 'D2'],
      evidenceSummary: [
        { id: 'S1', finding: '半拉链相关词走势相互矛盾：quarter zip men、mens quarter zip 上升，但带 pullover 的近义词下降。', boundary: '逐词工具估算，不支持整个半拉链赛道爆发或白地结论。' },
        { id: 'S2', finding: '半拉链评论既有穿脱灵活的正面反馈，也有材料差异、腹围和拉链外观质量问题。', boundary: '购买者自述有正反反例，不能替代我司目标人群验证。' },
        { id: 'E1', finding: '我司商品表现记录包含 B23M2009 半开襟立领卫衣，近30日记录合计 2254 件。', boundary: '按款号查询未返回完整原稿，不等于我司不存在该构型；销量记录也不证明设计机会成立。' },
        { id: 'D1', finding: 'AT25M3295 可作为公司圆领基款来源。', boundary: '圆领原稿不能直接提供半拉链领面、领底、挡片和止点结构。' },
        { id: 'D2', finding: 'AT25M3288 可作为同系列宽罗纹与肩袖骨架参考。', boundary: '连帽裁片不能替代半拉链结构来源。' },
      ],
      opportunityJudgment: '半拉链仍是需要研究的市场方向，但当前不能认定为市场白地或公司新增机会。现有证据同时出现趋势反例、我司已有相关构型和结构来源缺口，因此先阻断落图，待补齐来源后再做结构对照。',
      opportunityStatus: 'blocked-pending-source-pattern',
      opportunityBoundary: '缺少我司半拉链原稿/净样、完整领部配套、版型规格、结构责任人和真实穿着数据；本轮不生成可执行三视图，也不计入设计台候选。',
      designDecision: {
        keep: ['保留半拉链作为待核研究问题', '保留 AT25M3295 作为未来对照基款'],
        change: ['待来源补齐后，单独建立领部结构轴和材料轴的分步对照'],
        prohibited: ['不得把关键词上涨写成机会成立', '不得把圆领母版加一条拉链当作完成的半拉链结构', '不得在来源未闭合时生成伪三视图'],
      },
      validationGate: {
        stage: '结构开发来源门禁',
        evidenceNeeded: ['B23M2009 完整原稿或同构型授权母版', '半拉链净样/裁片或工艺资料', '领面领底、领座/贴边、护颏、挡片、止点和末端加固信息', '版师、工艺和商品责任人'],
        sequence: ['先核实我司既有构型与具体版本', '建立领部裁片和配缝清单', '在公司版型骨架上做单结构对照', '再做样衣、试穿和拉链/洗后验证'],
        decisionRule: '来源结构、责任人和真实样衣未补齐前，保持 blocked-pending-source-pattern；市场趋势不能解除该阻断。',
      },
      nextAction: '补查 B23M2009 原稿、净样和责任人；在资料返回前只保留开发单，不再生成半拉链图稿。',
      material: { code: fc174.materialCode, ingredients: fc174.ingredients, nominalGsm: fc174.gramWeight, source: 'E2', testStatus: 'not-tested' },
      draft: makeDraft('Q0', '半拉链方向（暂不落图）', fc174, '阻断项：需要独立领面/领底、领座或贴边、前中开口、拉链完成长、挡片/护颏、止点和末端加固；本轮不生成结构图。'),
      svg: 'Q0-blocked-brief.svg', image: 'Q0-blocked-brief.png', patternStatus: 'blocked-source-pattern',
      needs: ['B23M2009 具体款号查询未返回，不能解释为公司不存在该款。', '需取得我司半拉链原稿、净样或可授权的同构型母版后再进入结构试验。'],
    },
  ];

  const figureScale = Math.min(465 / (2 * Math.max(master.shape.cuffOuter[0], master.shape.hemHalf)), 535 / Math.max(master.shape.cuffInner[1], 1));
  const top = 205;
  const p = point => point.map(value => value.toFixed(5)).join(' ');
  const contrastOverlay = (x, accent) => {
    const s = master.shape;
    const path = d => `<path d="${d}" fill="${accent}" fill-opacity=".78" stroke="none"/>`;
    const half = .095;
    const cuff = (left = false) => {
      const mirror = point => left ? [-point[0], point[1]] : point;
      const a = mirror(s.cuffOuter), b = mirror(s.cuffInner);
      const capA = mirror(s.shoulder), capB = mirror(s.armhole[2]);
      const interp = (u, v, t) => u.map((value, i) => value + (v[i] - value) * t);
      const center = interp(a, b, .5), axis = interp(capA, capB, .5);
      const length = Math.hypot(axis[0] - center[0], axis[1] - center[1]);
      const t = .1 / length;
      const ia = interp(a, capA, t), ib = interp(b, capB, t);
      return path(`M${p(a)}L${p(b)}L${p(ib)}L${p(ia)}Z`);
    };
    const hem = path(`M${-s.hemHalf} .89H${s.hemHalf}V1H${-s.hemHalf}Z`);
    const neck = path(`M${-s.neckHalf} .004Q0 ${2 * s.frontDrop} ${s.neckHalf} .004L${s.neckHalf - .032} .008Q0 ${2 * Math.max(.003, s.frontDrop - .032)} ${-s.neckHalf + .032} .008Z`);
    return `<g transform="translate(${x} ${top}) scale(${figureScale})" aria-label="基款配套部件对比色">${cuff(true)}${cuff(false)}${hem}${neck}</g>`;
  };

  const makeBlockedBrief = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1060" viewBox="0 0 1500 1060"><rect width="1500" height="1060" fill="#fff"/><rect x="20" y="20" width="1460" height="1020" rx="12" fill="none" stroke="#a8a8a8" stroke-width="5"/><rect x="20" y="20" width="1460" height="54" fill="#506c38"/><text x="50" y="58" font-size="31" fill="#fff" font-family="Microsoft YaHei">结构开发单 · 暂不落图</text><text x="70" y="170" font-size="34" fill="#a52d25" font-family="Microsoft YaHei">半拉链方向被阻断</text><text x="70" y="235" font-size="22" fill="#29352f" font-family="Microsoft YaHei">基款：AT25M3295 微落肩圆领罗纹卫衣</text><text x="70" y="300" font-size="22" fill="#29352f" font-family="Microsoft YaHei">缺少：我司半拉链原稿 / 净样 / 领部配套结构 / 责任人</text><text x="70" y="365" font-size="22" fill="#29352f" font-family="Microsoft YaHei">必须补齐：领面领底、贴边或领座、开口止点、挡片、护颏、末端加固</text><text x="70" y="430" font-size="22" fill="#29352f" font-family="Microsoft YaHei">当前动作：保持市场假设，暂停结构落图；不送入设计台，不计入生产候选</text><text x="70" y="560" font-size="20" fill="#80633e" font-family="Microsoft YaHei">这是研究边界和开发输入单，不是完成的款式图或纸样。</text><text x="70" y="920" font-size="18" fill="#65736a" font-family="Microsoft YaHei">来源：AT25M3295 原稿、AT25M3288 原稿、男士卫衣研究轮次 2026-11-13</text></svg>`;

  const evidence = [
    { id: 'S1', label: 'SellerSprite 词级历史序列', url: 'https://www.sellersprite.com/v3/keyword-miner/?q=mens%20sweatshirt&marketId=1&batch=0', window: '2025-09 vs 2026-09；2026-10-22采集', nature: '工具估算；逐词分析；含半拉链近义词反例' },
    { id: 'S2', label: 'Obla半拉链：材料、腹围与领型反馈', url: 'https://www.sellersprite.com/v3/ai-review-analysis/details?list=56225&asin=B0DG8HDXTX', window: '历史分星抽样170条；本轮复读已核验5条', nature: '购买者自述；含正反反馈' },
    { id: 'S3', label: 'Fruit of the Loom圆领：洗护、版型及工作场景', url: 'https://www.sellersprite.com/v3/ai-review-analysis/details?list=56241&asin=B0CJP9G1FG', window: '历史分星抽样500条；本轮复读已核验10条', nature: '购买者自述；不代表总体' },
    { id: 'E1', label: '我司US男士卫衣商品表现', url: 'https://mcp.lasensys.com/mcp', window: '2026-11-12授权接口快照', nature: '82条店铺/SPU/父体行；B23M2009记录用于存在性反例' },
    { id: 'E2', label: '我司启用卫衣面料', url: 'https://mcp.lasensys.com/mcp', window: '2026-11-12授权接口快照', nature: '材料主数据；无试样性能证明' },
    { id: 'D1', label: '我司AT25M3295原设计稿', url: '/company-reference/AT25M3295.webp', window: '原稿2024-11-04；本轮逐图复核', nature: '二维款式与标注参考；无毫米净样' },
    { id: 'D2', label: '我司AT25M3288原设计稿', url: '/company-reference/AT25M3288.webp', window: '原稿2024-10-22；本轮复核', nature: '同系列连帽结构参考；不替代半拉链结构来源' },
    { id: 'S01', label: '改款设计方法卡', url: `/research-pilots/${run}/experience-log.json`, window: '知识库当前版本', nature: '方法边界与反例' },
    { id: 'M1', label: '本轮经验卡', url: `/research-pilots/${run}/experience-log.json`, window: '2026-11-13', nature: '项目评审后的 candidate-only 经验' },
  ];

  const withoutDraft = item => {
    const { draft, ...rest } = item;
    return rest;
  };
  const matrixCandidates = candidates.map(withoutDraft);
  const matrixCell = value => Array.isArray(value) ? value.join('<br>') : String(value ?? '');
  const matrixMarkdown = [
    '# 男士卫衣 · 我司基款继承校正轮设计矩阵',
    '',
    `运行批次：\`${run}\`；证据状态：candidate-only；生产批准：false；真实样衣：未完成。`,
    '',
    '本矩阵把每款的证据、机会判断、设计动作、反例和验证闸门放在同一行。市场信号只用于提出可验证问题；未闭合的真实项目数据保持显式缺口。',
    '',
    '| 方案 | 基款保留与主变化 | 证据摘要 | 机会判断与状态 | 反例 / 边界 | 验证动作与进入条件 |',
    '|---|---|---|---|---|---|',
    ...matrixCandidates.map(item => `| **${item.id} · ${item.name}**<br>${item.role} | 保留：${matrixCell(item.designDecision.keep)}<br>变化：${matrixCell(item.designDecision.change)} | ${item.evidenceSummary.map(e => `**${e.id}** ${e.finding}<br>边界：${e.boundary}`).join('<br>')} | ${item.opportunityJudgment}<br>**状态：${item.opportunityStatus}** | ${item.falsifier}<br>${item.opportunityBoundary} | 阶段：${item.validationGate.stage}<br>${matrixCell(item.validationGate.sequence)}<br>判定：${item.validationGate.decisionRule}<br>下一步：${item.nextAction} |`),
    '',
    '## 当前顺序',
    '',
    '1. S0 只做基款继承复核，确认设计资产没有被通用轮廓替代。',
    '2. S1 作为唯一优先样衣方向，做主体材料单变量对照，并同步验证罗纹。',
    '3. S2 保留为视觉讨论稿，补齐色号、供应链、色牢度和偏好证据后再决定。',
    '4. Q0 保留为半拉链结构开发单，先补我司来源结构，不生成伪三视图。',
    '',
    '## 共同放行边界',
    '',
    '软件生成、关键词趋势、历史评论和材料主数据只能支持候选假设或验证路径。没有真实样衣、原始记录、授权测试条件和责任人结论，不提升为 adopted、正式机会、独立放行能力或生产批准。',
  ].join('\n');

  const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const wrap = (value, max) => {
    const text = String(value ?? '');
    const chars = [...text];
    const lines = [];
    for (let i = 0; i < chars.length; i += max) lines.push(chars.slice(i, i + max).join(''));
    return lines.length ? lines : [''];
  };
  const statusFill = { 'baseline-only': '#65736a', 'candidate-opportunity': '#506c38', 'visual-hypothesis-only': '#80633e', 'blocked-pending-source-pattern': '#a52d25' };
  const matrixRows = matrixCandidates.map(item => ({
    id: `${item.id} · ${item.name}`,
    change: `保留：${item.designDecision.keep.join('；')}。变化：${item.designDecision.change.length ? item.designDecision.change.join('；') : '无'}`,
    judgment: `${item.opportunityJudgment} 状态：${item.opportunityStatus}`,
    gate: `${item.validationGate.stage}。${item.validationGate.sequence.join(' → ')}。${item.validationGate.decisionRule}`,
    status: item.opportunityStatus,
  }));
  const matrixSvg = (() => {
    const width = 2500;
    const headerHeight = 160;
    const rowHeight = 355;
    const columns = [{ x: 40, w: 240 }, { x: 280, w: 510 }, { x: 790, w: 760 }, { x: 1550, w: 640 }, { x: 2190, w: 270 }];
    const textBlock = (x, y, value, max, size = 24, fill = '#29352f') => wrap(value, max).map((line, i) => `<text x="${x}" y="${y + i * (size + 9)}" font-size="${size}" fill="${fill}" font-family="Microsoft YaHei,Arial,sans-serif">${xml(line)}</text>`).join('');
    const header = `<rect x="0" y="0" width="${width}" height="${headerHeight}" fill="#506c38"/><text x="40" y="58" font-size="40" fill="#fff" font-weight="700" font-family="Microsoft YaHei,Arial,sans-serif">男士卫衣 · 基款继承校正轮设计矩阵</text><text x="40" y="108" font-size="24" fill="#e4eee5" font-family="Microsoft YaHei,Arial,sans-serif">AT25M3295 · 证据 → 机会判断 → 设计动作 → 验证闸门 · candidate-only</text>`;
    const headings = ['方案', '基款保留与主变化', '证据与机会判断', '验证闸门 / 边界', '状态'];
    const headingSvg = headings.map((heading, i) => `<text x="${columns[i].x + 18}" y="${headerHeight + 42}" font-size="24" font-weight="700" fill="#29352f" font-family="Microsoft YaHei,Arial,sans-serif">${xml(heading)}</text>`).join('');
    const rows = matrixRows.map((row, index) => {
      const y = headerHeight + index * rowHeight;
      const cells = [row.id, row.change, row.judgment, row.gate, row.status];
      const maxChars = [13, 25, 36, 30, 15];
      const body = cells.map((cell, i) => textBlock(columns[i].x + 18, y + 82, cell, maxChars[i], i === 0 ? 26 : 22, i === 4 ? (statusFill[row.status] ?? '#29352f') : '#29352f')).join('');
      return `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${index % 2 ? '#f7faf7' : '#fff'}" stroke="#d6dfd8"/><line x1="${columns[1].x}" y1="${y}" x2="${columns[1].x}" y2="${y + rowHeight}" stroke="#d6dfd8"/><line x1="${columns[2].x}" y1="${y}" x2="${columns[2].x}" y2="${y + rowHeight}" stroke="#d6dfd8"/><line x1="${columns[3].x}" y1="${y}" x2="${columns[3].x}" y2="${y + rowHeight}" stroke="#d6dfd8"/><line x1="${columns[4].x}" y1="${y}" x2="${columns[4].x}" y2="${y + rowHeight}" stroke="#d6dfd8"/>${body}`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${headerHeight + rowHeight * matrixRows.length + 20}" viewBox="0 0 ${width} ${headerHeight + rowHeight * matrixRows.length + 20}"><rect width="100%" height="100%" fill="#fff"/>${header}${headingSvg}${rows}</svg>`;
  })();

  await fs.mkdir(publicRoot, { recursive: true });
  await fs.copyFile(path.join('public/company-reference', 'AT25M3295.webp'), path.join(publicRoot, 'AT25M3295.webp'));
  for (const item of candidates) {
    let svg;
    if (item.id === 'Q0') svg = makeBlockedBrief();
    else if (item.id === 'S2') svg = exportCompanyStyleSvg(item.draft).replace('</svg>', `${contrastOverlay(270, '#7b8d66')}${contrastOverlay(810, '#7b8d66')}</svg>`);
    else svg = exportCompanyStyleSvg(item.draft);
    await fs.writeFile(path.join(publicRoot, item.svg), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(publicRoot, item.image));
    item.draft = item.draft;
  }

  await fs.writeFile(path.join(publicRoot, 'design-matrix.md'), matrixMarkdown);
  await fs.writeFile(path.join(publicRoot, 'design-matrix.svg'), matrixSvg);
  await sharp(Buffer.from(matrixSvg)).png().toFile(path.join(publicRoot, 'design-matrix.png'));

  const manifest = {
    schema: 'garment-os/research-design-pilot/v1',
    runId: run,
    title: '男士卫衣 · 我司基款继承校正轮',
    conclusion: '先锁定 AT25M3295 的微落肩、圆领、长袖、净面无袋和宽罗纹，再做材料或低风险视觉单项改款；半拉链结构暂不落图。',
    sourceSummary: '本轮复核我司 AT25M3295、AT25M3288 原稿与平台母版定义；上一轮六组半拉链图稿降级为历史失败尝试，不作为当前设计候选。',
    boundary: '图稿继承公司原稿版式与母版比例；仍不是毫米净样、生产纸样、真实面料效果或生产批准。',
    baseStyle: { styleCode: 'AT25M3295', masterId: master.id, sourceImage: '/company-reference/AT25M3295.webp', lockedDNA: ['微落肩', '圆领', '长袖', '净面无袋', '55mm宽2×2罗纹袖口与下摆', '前后比例与侧面袖体量'], sourcePatternStatus: 'unconnected', sourceNote },
    priorRound: { runId: 'mens-sweatshirt-innovation-20261113', status: 'superseded-for-design-practice', reason: '半拉链领部为平台示意，未继承完整公司结构语法；保留作方法失败和边界复盘。' },
    evidenceProvenance: 'historical-market-sources-plus-live-enterprise-read; candidate-only; no_real_sample; no_production_approval',
    matrix: { json: `/research-pilots/${run}/design-matrix.json`, markdown: `/research-pilots/${run}/design-matrix.md`, image: `/research-pilots/${run}/design-matrix.png` },
    candidateOrder: ['S0', 'S1', 'S2', 'Q0'],
    recommendation: '先复核 S0 的基款继承程度；再做 S1 材料单项样衣。S2 只能作为视觉讨论稿，Q0 保留为阻断的结构开发单。没有同款净样、样衣与责任人，不扩大结构矩阵。',
    comparisons: ['S0→S1：只改主体材料，检查版型外观、罗纹匹配与洗后保持。', 'S0→S2：只改收口视觉对比，检查基款识别、配色偏好与供应链。', 'Q0：半拉链方向只保留需求假设，待我司结构资料补齐后重新建模。'],
    experience: { card: `/research-pilots/${run}/experience-log.json`, matrix: `/research-pilots/${run}/design-matrix.json`, learned: ['引用母版编号不等于继承版型', '卫衣宽罗纹是识别结构而非装饰线', '领型变化必须带完整开合配套', '无来源结构不落图', '每款必须把证据摘要、机会判断、反例和验证闸门绑定到设计动作', '市场方向判断与公司结构准入必须分开'], discarded: ['通用轮廓直接叠加高领', '六组结构候选一次性展开', '把市场词趋势当成我司半拉链结构证据', '把软件通过当成版型成立'], feedback: '用户指出上一轮卫衣形态不正常，本轮将反馈写入经验卡并改变候选准入。' },
    candidates,
    evidence,
    productionApproved: false,
    physicalTestCompleted: false,
    formalQualified: false,
  };
  await fs.writeFile(path.join(publicRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(publicRoot, 'design-matrix.json'), JSON.stringify({ schema: 'garment-os/redesign-correction-matrix/v2', runId: run, evidence_provenance: manifest.evidenceProvenance, baseStyle: manifest.baseStyle, candidateOrder: manifest.candidateOrder, candidates: matrixCandidates, recommendation: manifest.recommendation, matrix: manifest.matrix, productionApproved: false, physicalTestCompleted: false, formalQualified: false }, null, 2));

  const experience = {
    schema: 'garment-os/redesign-experience/v1', runId: run, status: 'candidate-only', capturedAt: new Date().toISOString(),
    feedback: '上一轮卫衣形态不正常：图稿虽引用我司母版编号，但领部、罗纹收口、版型比例和画稿语法没有充分继承。',
    baseDNA: manifest.baseStyle.lockedDNA,
    learned: manifest.experience.learned,
    matrixRun: {
      candidateDisposition: Object.fromEntries(matrixCandidates.map(item => [item.id, item.opportunityStatus])),
      reviewRule: '每款先绑定证据和机会边界，再决定是否进入设计台；软件结果不替代版师、样衣、洗后、商品或生产责任人结论。',
      priority: 'S0 基款复核 → S1 材料单项样衣 → S2 视觉补证 → Q0 补齐半拉链来源结构',
    },
    discarded: ['通用轮廓直接叠加高领', '六组结构候选一次性展开', '把市场词趋势当成我司半拉链结构证据', '把软件通过当成版型成立'],
    nextGates: ['基款原稿复核', '单变量材料对照', '材料—罗纹配套', '版师/面料/工艺责任人', '真实样衣和洗后结果', '来源结构补齐后再做半拉链'],
    evidenceProvenance: 'assistant-project-review; no_real_sample; no_production_approval',
  };
  await fs.writeFile(path.join(publicRoot, 'experience-log.json'), JSON.stringify(experience, null, 2));

  const coreArtifact = path.join(coreRoot, 'artifacts', run);
  await fs.mkdir(coreArtifact, { recursive: true });
  await fs.writeFile(path.join(coreArtifact, 'experience-log.json'), JSON.stringify(experience, null, 2));
  await fs.writeFile(path.join(coreArtifact, 'design-matrix.json'), JSON.stringify({ schema: 'garment-os/redesign-correction-matrix/v2', runId: run, evidence_provenance: manifest.evidenceProvenance, baseStyle: manifest.baseStyle, candidateOrder: manifest.candidateOrder, candidates: matrixCandidates, recommendation: manifest.recommendation, matrix: manifest.matrix, productionApproved: false, physicalTestCompleted: false, formalQualified: false }, null, 2));
  await fs.writeFile(path.join(coreArtifact, 'design-matrix.md'), matrixMarkdown);
  await fs.writeFile(path.join(coreArtifact, 'design-matrix.svg'), matrixSvg);
  await sharp(Buffer.from(matrixSvg)).png().toFile(path.join(coreArtifact, 'design-matrix.png'));
  await fs.writeFile(path.join(coreArtifact, 'source-ledger.json'), JSON.stringify(manifest.evidence, null, 2));
  await fs.writeFile(path.join(coreArtifact, 'test-handoff.json'), JSON.stringify({ schema: 'garment-os/redesign-correction-handoff/v1', runId: run, stage: 'design-review-before-sample', evidence_provenance: 'assistant-proposed-test-plan', realProjectEvidence: false, productionApproved: false, inputs: ['AT25M3295 同款净样或实物', 'S0/S1 对照物料批次', '版师和面料技术确认', '洗前后尺寸与外观测量系统'], causalHypotheses: ['材料变化可能改变成衣垂坠、罗纹回弹和洗后外观'], sequence: ['基款复核', 'S0/S1 单变量样衣', '材料与罗纹测试', '同体型试穿', '结果回写经验卡'], decisionRule: '没有真实样衣、原始记录和责任人签字，不提升为采用、正式机会或生产批准。', openGaps: ['原始毫米净样', '半拉链公司结构来源', '材料性能', '成本与商品判断'] }, null, 2));
  await fs.writeFile(path.join(coreArtifact, 'manifest.json'), JSON.stringify({ runId: run, publicPath: `public/research-pilots/${run}`, manifest: 'manifest.json', previousRoundPreserved: true }, null, 2));

  console.log(JSON.stringify({ run, publicRoot, coreArtifact, candidates: candidates.map(item => ({ id: item.id, canApply: item.canApply, svg: item.svg })) }, null, 2));
} finally {
  await vite.close();
}
