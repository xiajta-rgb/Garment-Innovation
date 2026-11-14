import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import sharp from 'sharp';

const run = 'mens-sweatshirt-three-view-matrix-20261113';
const coreRoot = 'C:/Users/xmls/Documents/trae_projects/fashion-designer-core-skill';
const coreArtifact = path.join(coreRoot, 'artifacts', run);
const publicRoot = path.resolve('public/research-pilots', run);

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const [{ newCompanyStyle, readCompanyStyle }, { exportStyleThreeViewSvg }, { companyStyleMaster }] = await Promise.all([
    vite.ssrLoadModule('/src/lib/pattern/company-style.ts'),
    vite.ssrLoadModule('/src/lib/pattern/style-variation-drawing.ts'),
    vite.ssrLoadModule('/src/data/companyStyleMasters.ts'),
  ]);

  const baseNote = 'AT25M3295 硬锁：微落肩、圆领、长袖、净面无袋、55mm宽2×2罗纹、前后比例与侧面袖体量。';
  const variation = (patch = {}) => ({
    neckline: 'source', sleeve: 'source', fit: 'source', length: 'source', pocket: 'source', hem: 'source',
    blocking: 'none', graphic: 'none', accentColor: '#7b8d66', ...patch,
  });
  const draft = (id, name, masterId = 'company-at25m3295', color = '#dedbd3', design, material = 'FC174', composition = '66%Polyester34%Cotton', weight = '310g/m²（材料库标称，待实测）') => {
    const m = companyStyleMaster(masterId);
    return readCompanyStyle({
      ...newCompanyStyle(masterId), styleCode: `LAB-${id}`, name, color,
      fabric: material === 'FC063' ? 'FC063 32支棉盖丝拉架卫衣260g' : m.fabric,
      composition, weight, notes: baseNote, cadApplied: false, ...(design ? { design } : {}),
    });
  };

  // A6 is drawn as a company-style technical sheet. It deliberately keeps
  // the AT25M3295 body volume and rib language, while rebuilding the raglan
  // seam as a front/back body-to-sleeve construction line.
  let raglanSourceData = '', hoodRaglanSourceData = '';
  const raglanThreeViewSvg = (clean = false) => {
    const ink = '#242b27', seam = '#68736d', body = '#dcd9d1', sleeve = '#cbd8cc', rib = '#839783', red = '#bd3a2e';
    const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ribLines = (x1, y1, x2, y2, count = 13) => Array.from({ length: count }, (_, i) => {
      const t = (i + 1) / (count + 1), x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      return `<path d="M${x - 3} ${y - 5}L${x + 3} ${y + 5}" stroke="#516453" stroke-width="1.3"/>`;
    }).join('');
    const frontBack = (back = false) => {
      const neck = back ? 'M-43 76 Q0 64 43 76' : 'M-43 76 Q0 51 43 76';
      const bodyPath = `M-43 76 ${neck.replace(/^M-43 76 /, '')} C83 105 122 166 145 246 L153 514 Q0 544 -153 514 L-145 246 C-122 166 -83 105 -43 76 Z`;
      const sleeveRight = 'M43 76 C87 97 126 159 163 246 L260 493 L218 518 L128 280 C108 173 72 103 43 76 Z';
      const sleeveLeft = 'M-43 76 C-87 97 -126 159 -163 246 L-260 493 L-218 518 L-128 280 C-108 173 -72 103 -43 76 Z';
      const cuffRight = 'M218 518 L260 493 L275 531 L232 557 Z';
      const cuffLeft = 'M-218 518 L-260 493 L-275 531 L-232 557 Z';
      const raglanRight = 'M43 76 C87 97 126 159 163 246';
      const raglanLeft = 'M-43 76 C-87 97 -126 159 -163 246';
      const hem = 'M-153 514 Q0 544 153 514 L153 573 Q0 603 -153 573 Z';
      return `<g stroke="${ink}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="${sleeveLeft}" fill="${sleeve}"/><path d="${sleeveRight}" fill="${sleeve}"/><path d="${bodyPath}" fill="${body}"/><path d="${cuffLeft}" fill="${rib}"/><path d="${cuffRight}" fill="${rib}"/><path d="${hem}" fill="${rib}"/><path d="${raglanLeft}" fill="none" stroke="${seam}" stroke-width="3"/><path d="${raglanRight}" fill="none" stroke="${seam}" stroke-width="3"/><path d="M-43 76 Q0 ${back ? 88 : 101} 43 76" fill="${rib}" stroke="${seam}" stroke-width="2"/><path d="M-153 540 Q0 570 153 540" fill="none" stroke="#526054" stroke-width="1.3" stroke-dasharray="7 5"/><path d="M-232 535 L-269 513 M232 535 L269 513" fill="none" stroke="#526054" stroke-width="1.3" stroke-dasharray="7 5"/>${ribLines(-143, 537, 143, 537, 17)}<path d="M-163 246 L-128 280 M163 246 L128 280" fill="none" stroke="${seam}" stroke-width="2"/></g>`;
    };
    const side = `<g stroke="${ink}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M-43 77 Q12 62 57 86 C82 123 104 169 113 246 L124 514 Q44 548 -32 522 L-38 250 Q-36 136 -43 77 Z" fill="${body}"/><path d="M15 82 C66 92 104 160 124 241 L236 484 L198 514 L112 286 C96 190 61 111 15 82 Z" fill="${sleeve}"/><path d="M198 514 L236 484 L250 523 L212 550 Z" fill="${rib}"/><path d="M-32 522 Q45 548 124 514 L124 573 Q44 604 -32 581 Z" fill="${rib}"/><path d="M15 82 C66 92 104 160 124 241" fill="none" stroke="${seam}" stroke-width="3"/><path d="M-43 77 Q12 63 57 86" fill="none" stroke="${rib}" stroke-width="10"/><path d="M-20 540 Q45 562 112 540" fill="none" stroke="#526054" stroke-width="1.3" stroke-dasharray="7 5"/>${ribLines(202, 516, 232, 493, 6)}</g>`;
    const view = kind => kind === 'front' ? frontBack(false) : kind === 'back' ? frontBack(true) : side;
    const labels = ['正面 / FRONT', '背面 / BACK', '右侧 / RIGHT SIDE'];
    const meta = { schema: 'garment-os/raglan-sweatshirt-technical-sheet/v2', baseStyle: 'AT25M3295', sourceStudy: ['AT25M3275', 'AT24M3248'], constructionStatus: 'structural-hypothesis-only', productionApproved: false, evidence_provenance: 'company-reference-plus-LAB-method-application; candidate-only' };
    const cleanViews = ['front', 'back', 'side'].map((kind, i) => `<g transform="translate(${280 + i * 540} ${clean ? 120 : 315})">${view(kind)}<text x="0" y="${clean ? 660 : 660}" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="20" fill="${ink}">${labels[i]}</text></g>`).join('');
    if (clean) return `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="900" viewBox="0 0 1680 900"><metadata>${esc(JSON.stringify(meta))}</metadata><rect width="1680" height="900" fill="#fff"/><g font-family="Microsoft YaHei,sans-serif" fill="${ink}"><text x="48" y="48" font-size="25" font-weight="600">A6 · 插肩袖运动延展 · 技术三视图</text>${cleanViews}<path d="M48 770H1632" stroke="#d9dfda"/><text x="48" y="810" font-size="16">圆领 · AT25M3295微落肩体量 · 55mm 2×2罗纹 · 前后插肩缝连续至领圈 / 腋下</text><text x="48" y="850" fill="#768279" font-size="13">结构开发提案，需重建配套前身、后身、左右袖片和领圈分段；不是毫米裁剪图。</text></g></svg>`;
    const note = (x, y, tx, ty, text) => `<path d="M${x} ${y} L${tx} ${ty}" stroke="${red}" stroke-width="1.8" fill="none"/><text x="${x}" y="${y - 6}" font-family="Microsoft YaHei,sans-serif" font-size="18" fill="${red}">${esc(text)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1900" height="1250" viewBox="0 0 1900 1250"><metadata>${esc(JSON.stringify(meta))}</metadata><rect x="14" y="14" width="1872" height="1222" rx="8" fill="#fff" stroke="#a8a8a8" stroke-width="6"/><rect x="28" y="28" width="1844" height="72" rx="12" fill="#4e7139"/><text x="120" y="80" font-family="Microsoft YaHei,sans-serif" font-size="40" font-weight="700" fill="#fff">设计稿</text><text x="50" y="145" font-family="Microsoft YaHei,sans-serif" font-size="32" font-weight="700" fill="${red}">A6 插肩袖圆领卫衣 · 结构开发提案</text><text x="50" y="178" font-family="Microsoft YaHei,sans-serif" font-size="17" fill="#68766e">基款：AT25M3295　结构来源：AT25M3275 / AT24M3248　状态：structural-hypothesis-only</text><rect x="1490" y="116" width="350" height="106" fill="#f4f4f1" stroke="#aaa"/><text x="1510" y="150" font-family="Microsoft YaHei,sans-serif" font-size="18">款号：LAB-A6-RAGLAN</text><text x="1510" y="180" font-family="Microsoft YaHei,sans-serif" font-size="18">品名：男士插肩圆领卫衣</text><text x="1510" y="210" font-family="Microsoft YaHei,sans-serif" font-size="18">版型：AT25M3295体量延展</text><g transform="translate(310 315)">${view('front')}<text x="0" y="660" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="22">正面</text></g><g transform="translate(900 315)">${view('back')}<text x="0" y="660" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="22">背面</text></g><g transform="translate(1305 315) scale(.78)">${view('side')}<text x="0" y="660" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="22">右侧</text></g>${note(60, 275, 310, 390, '前插肩缝：领圈侧点连续至腋下')}${note(60, 930, 310, 810, '55mm 2×2罗纹下摆；保留卫衣收口识别')}${note(945, 250, 900, 390, '后插肩缝：与前身分开配缝')}${note(1430, 915, 1510, 735, '袖底合缝 / 腋下接口需重建')}${note(60, 1020, 310, 865, '圆领20mm 2×2罗纹；前后领弧分别核对')}${raglanSourceData ? `<image href="${raglanSourceData}" x="1510" y="950" width="160" height="112" preserveAspectRatio="xMidYMid slice"/><text x="1510" y="1080" font-family="Microsoft YaHei,sans-serif" font-size="13" fill="#68766e">AT25M3275 结构参考</text>` : ''}${hoodRaglanSourceData ? `<image href="${hoodRaglanSourceData}" x="1690" y="950" width="160" height="112" preserveAspectRatio="xMidYMid slice"/><text x="1690" y="1080" font-family="Microsoft YaHei,sans-serif" font-size="13" fill="#68766e">AT24M3248 结构参考</text>` : ''}<path d="M50 1150H1840" stroke="#aaa"/><text x="50" y="1180" font-family="Microsoft YaHei,sans-serif" font-size="15" fill="#68766e">说明：插肩不是在普通装袖图上画斜线；本提案要求前后衣身、配套袖片、袖底、腋下和领圈分段重新制版与配缝。图稿不代表毫米净样、试穿通过或生产批准。</text></svg>`;
  };

  const competitors = [
    {
      id: 'C1', name: 'BELLA+CANVAS 3901', brand: 'BELLA+CANVAS', kind: 'raglan',
      url: 'https://www.bellacanvas.com/product/3901/unisex-sponge-fleece-raglan-sweatshirt.html',
      image: 'https://www.bellacanvas.com/bella/product/hires/39010311_1.jpg',
      fact: '官方产品页直接写明：crew neck、raglan sleeves、ribbed cuffs and waistband；并标注日常穿着和叠穿场景。',
      insight: '证明插肩圆领本身可以成为基础款差异点；A6可优先走“圆领 + 插肩 + 宽罗纹”，避免一上来叠加半拉链。',
      limit: '公开页面不能证明我司版型适体、销量或工艺可直接复用。'
    },
    {
      id: 'C2', name: 'Royal Apparel Organic Raglan Crew', brand: 'Royal Apparel', kind: 'raglan',
      url: 'https://royalapparel.com/organic-raglan-crew-neck-sweatshirt.html',
      image: '',
      fact: '公开检索结果中的产品标题和摘要将产品定义为 classic crew neck、raglan sleeves、unisex fleece sweatshirt；本轮未能重新读取其产品页正文。',
      insight: '说明插肩结构可承载经典、日常和中性运动休闲语法；我司可以把差异放在微落肩体量、罗纹比例和袖体线条。',
      limit: '当前只作为公开检索线索；未取得其纸样、尺码表或实物验证，不能据此推断人体工学和成本。'
    },
    {
      id: 'C3', name: 'Carhartt Paxton 1/4 Zip', brand: 'Carhartt', kind: 'zip',
      url: 'https://www.carhartt.com/product/100617/paxton-14-zip-sweatshirt',
      image: '',
      fact: '品牌站公开产品页作为 1/4 zip sweatshirt 先例留存；它提供的是开口方向对标，不是插肩版型来源。',
      insight: '半拉链可以作为另一条结构轴单独研究；A6不应因为竞品存在就把拉链叠到插肩上。',
      limit: '公开评论和页面不能替代我司B23M2009/AT25M3275完整领部来源、净样和责任人。'
    }
  ];
  const competitorThumb = item => item.kind === 'raglan'
    ? `<g stroke="#506c38" stroke-width="4" fill="none"><path d="M-28 -80Q0 -96 28 -80L55 -20L70 100Q0 125 -70 100L-55 -20Z" fill="#dce5dc"/><path d="M-28 -80Q-55 -45 -72 10L-100 83L-82 95L-45 23Q-37 -36 -28 -80Z" fill="#c4d6c4"/><path d="M28 -80Q55 -45 72 10L100 83L82 95L45 23Q37 -36 28 -80Z" fill="#c4d6c4"/><path d="M-28 -80Q0 -65 28 -80"/><path d="M-28 -80Q-45 -40 -55 -20 M28 -80Q45 -40 55 -20" stroke="#65736a"/></g>`
    : `<g stroke="#506c38" stroke-width="4" fill="none"><path d="M-32 -80Q0 -94 32 -80L58 -10L70 100Q0 125 -70 100L-58 -10Z" fill="#dce5dc"/><path d="M-32 -80Q-57 -45 -70 18L-92 92L-75 101L-42 28Q-36 -42 -32 -80Z" fill="#c4d6c4"/><path d="M32 -80Q57 -45 70 18L92 92L75 101L42 28Q36 -42 32 -80Z" fill="#c4d6c4"/><path d="M-25 -78V-15H25V-78" stroke="#65736a"/></g>`;

  const candidates = [
    {
      id: 'A0', name: '基款锁定', method: '廓形限定', master: 'AT25M3295',
      evidence: 'D1 / D2 / M1', status: 'baseline-only', statusLabel: '基准对照', statusColor: '#65736a',
      why: '先把我司卫衣识别点锁住，给所有延展提供同尺度、同视角对照。',
      keep: '微落肩、圆领、净面无袋、宽罗纹、原稿比例', change: '无；仅做基款继承复核',
      verify: '对照原稿、工艺单、同款实物和版师记录，确认领弧、肩袖、罗纹高度与侧面体量。',
      gate: '不构成创新机会；不代表毫米净样或生产批准。',
      draft: draft('A0', '基款锁定'),
    },
    {
      id: 'A1', name: '轻层搭材料', method: '组合更换', master: 'AT25M3295',
      evidence: 'D1 / E2 / S3 / M1', status: 'candidate-opportunity', statusLabel: '机会候选', statusColor: '#506c38',
      why: '把评论中的材料不一致、洗后变长、掉絮和起球问题转成单变量材料验证。',
      keep: 'AT25M3295 全部形态、领部和罗纹关系', change: '主体材料替换为 FC063 260g；不改结构',
      verify: 'S0/S1 同版型同尺码样衣；主体—罗纹伸长回弹、洗缩、起球/落毛、缝口平整和同体型试穿。',
      gate: '260g 不等于轻盈、透气或耐久；没有真实样衣与授权记录不提升为采用。',
      draft: draft('A1', '轻层搭材料', 'company-at25m3295', '#d8ded5', undefined, 'FC063', '68%Cotton,27%Polyester5%Spandex', '260g/m²（材料库标称，待实测）'),
    },
    {
      id: 'A2', name: '领缘微对比罗纹', method: '细节延伸', master: 'AT25M3295',
      evidence: 'D1 / S3 / M1', status: 'visual-hypothesis-only', statusLabel: '视觉假设', statusColor: '#80633e',
      why: '先用领缘的同色系对比建立小差异，保留办公和净面场景的克制感；袖口和下摆只作为配套开发意向。',
      keep: '我司微落肩、圆领、净面无袋和宽罗纹结构', change: '只改变领部配套部件的低对比色表达；袖口/下摆不在本图中冒充已完成配套',
      verify: '确认实际罗纹色号、供应链、洗后沾色/色牢度与小范围偏好；图稿不替代配色打样。',
      gate: '没有直接需求证据，不能写成市场机会或溢价依据。',
      draft: draft('A2', '领缘微对比罗纹', 'company-at25m3295', '#dedbd3', variation({ neckline: 'crew', blocking: 'collar', accentColor: '#7b8d66' })),
    },
    {
      id: 'A3', name: '侧向安全置物', method: '增加部位', master: 'AT25M3295',
      evidence: 'D1 / M1 / research-only', status: 'functional-hypothesis-only', statusLabel: '功能假设', statusColor: '#4d6b86',
      why: '把“需要置物”的产品问题拆成口袋位置、开口方向和拉链耐用性，而不是直接宣称功能收益。',
      keep: '原款衣身比例、圆领、肩袖、宽罗纹', change: '增加两侧斜向拉链袋；不叠加图案或拼片',
      verify: '确认袋布、袋口加固、拉链规格、手机载荷、坐姿压迫、洗后波浪和拉链外观；当前没有直接VOC。',
      gate: '这是结构试验假设；软件图示不能证明安全置物、舒适性或耐久。',
      draft: draft('A3', '侧向安全置物', 'company-at25m3295', '#dedbd3', variation({ neckline: 'crew', pocket: 'zip-side', hem: 'rib', sleeve: 'long' })),
    },
    {
      id: 'A4', name: '袖体逆向撞色', method: '逆向改款', master: 'AT25M3295',
      evidence: 'D1 / S01 / M1', status: 'visual-hypothesis-only', statusLabel: '视觉假设', statusColor: '#80633e',
      why: '只交换主体与袖体的明暗关系，让肩袖成为识别重点；保持领、下摆和主体比例不变。',
      keep: '微落肩肩袖连接、圆领、宽罗纹和净面', change: '仅袖体使用低饱和辅色；不增加拼片线',
      verify: '检查前后侧色块连续、袖口与主体色牢度、采购可得性和目标人群偏好。',
      gate: '颜色关系不等于市场机会；真实色号与批次未闭合前保持视觉假设。',
      draft: draft('A4', '袖体逆向撞色', 'company-at25m3295', '#dedbd3', variation({ neckline: 'crew', blocking: 'sleeves', accentColor: '#687783', hem: 'rib', sleeve: 'long' })),
    },
    {
      id: 'A5', name: '同系列连帽延展', method: '款式组合', master: 'AT25M3288',
      evidence: 'D2 / M1 / company-series', status: 'series-extension-only', statusLabel: '系列延展', statusColor: '#6c5a86',
      why: '使用我司同系列 AT25M3288 的连帽、袋鼠袋和宽罗纹语言，测试系列扩展，而非把圆领母版硬改成无来源半拉链。',
      keep: '我司系列的微落肩、长袖、宽罗纹与运动休闲语法', change: '采用 AT25M3288 的帽体与袋鼠袋组合；独立做构型复核',
      verify: '取得 AT25M3288 净样/完整帽袋裁片，复核帽口、帽绳、袋口、肩袖和洗后结构；不直接复用圆领净样。',
      gate: '这是有公司来源的系列延展，不代表 AT25M3295 的直接版型复用或市场机会成立。',
      draft: draft('A5', '同系列连帽延展', 'company-at25m3288', '#d6d3cc', variation({ neckline: 'hood', pocket: 'kangaroo', sleeve: 'long', fit: 'relaxed', hem: 'rib', blocking: 'none' })),
    },
    {
      id: 'A6', name: '插肩袖运动延展', method: '结构替换 / 廓形限定', master: 'AT25M3295 → AT25M3275 / AT24M3248 结构来源',
      evidence: 'D1 / D3 / D4 / S01 / M1', status: 'structural-hypothesis-only', statusLabel: '结构假设', statusColor: '#4d6b86',
      why: '把我司微落肩圆领卫衣的运动休闲语法，迁移到公司已有插肩结构经验上，形成真正的结构延展，而不是在装袖图上补一条斜线。',
      keep: 'AT25M3295 的圆领、长袖、微落肩体量、55mm宽2×2罗纹和净面克制感', change: '前后衣身重建插肩边；袖片同时形成前插肩边、后插肩边、袖底合缝；袖片上端参与领圈分段；腋下重新对位',
      verify: '取得AT25M3275/AT24M3248相关净样与工艺单；重建前身、后身、左右配套袖片和领圈分段；核对前后插肩配缝、袖底合缝、腋下活动量、领圈净长、洗后扭斜与试穿抬臂。',
      gate: '插肩结构图只支持结构开发假设；未完成短卫衣配套纸样、样衣和专业版型审核前，不进入生产候选。',
      draft: null,
    },
  ];

  const evidence = [
    { id: 'D1', label: '我司 AT25M3295 原设计稿', nature: '二维款式与工艺标注；无毫米净样' },
    { id: 'D2', label: '我司 AT25M3288 原设计稿', nature: '同系列连帽与宽罗纹参考；不替代半拉链来源' },
    { id: 'D3', label: '我司 AT25M3275 原设计稿', nature: '立领、插肩、1/4拉链结构稿；用于插肩接口和工艺先例，不替代A6净样' },
    { id: 'D4', label: '我司 AT24M3248 原设计稿', nature: '三片帽、插肩、短拉链结构稿；用于前后插肩及帽领接口先例，不替代A6净样' },
    { id: 'E2', label: '我司启用卫衣面料', nature: '材料主数据；无试样性能证明' },
    { id: 'S3', label: '消费者评论样本', nature: '历史购买者自述；含正反反例，不代表总体' },
    { id: 'S01', label: 'LAB 改款方法卡', nature: '方法来源与应用推导，不是企业生产标准' },
    { id: 'M1', label: '男卫衣校正经验卡', nature: '项目评审后的 candidate-only 经验' },
    ...competitors.map(item => ({ id: item.id, label: `${item.name} 外部公开产品页`, nature: '公开产品页；结构观察与设计启发，不是我司版型来源' })),
  ];

  const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const wrap = (value, max) => {
    const chars = [...String(value ?? '')];
    const lines = [];
    for (let i = 0; i < chars.length; i += max) lines.push(chars.slice(i, i + max).join(''));
    return lines.length ? lines : [''];
  };
  const textBlock = (x, y, value, max, size = 21, fill = '#29352f', lineGap = size + 8) => wrap(value, max).map((line, i) => `<text x="${x}" y="${y + i * lineGap}" font-size="${size}" fill="${fill}" font-family="Microsoft YaHei,Arial,sans-serif">${xml(line)}</text>`).join('');
  const sourceImage = await fs.readFile(path.resolve('public/company-reference/AT25M3295.webp'));
  const sourcePng = await sharp(sourceImage).png().toBuffer();
  const sourceData = `data:image/png;base64,${sourcePng.toString('base64')}`;
  const raglanSourceImage = await fs.readFile(path.resolve('public/company-reference/craft-AT25M3275.webp'));
  raglanSourceData = `data:image/webp;base64,${raglanSourceImage.toString('base64')}`;
  const hoodRaglanSourceImage = await fs.readFile(path.resolve('public/company-reference/craft-AT24M3248.webp'));
  hoodRaglanSourceData = `data:image/webp;base64,${hoodRaglanSourceImage.toString('base64')}`;
  const statusById = Object.fromEntries(candidates.map(item => [item.id, item.status]));

  await fs.mkdir(publicRoot, { recursive: true });
  for (const item of candidates) {
    const svg = item.id === 'A6' ? raglanThreeViewSvg(false) : exportStyleThreeViewSvg(item.draft, false);
    await fs.writeFile(path.join(publicRoot, `${item.id}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(publicRoot, `${item.id}.png`));
  }

  const cardWidth = 1120;
  const cardHeight = 830;
  const gap = 34;
  const margin = 50;
  const headerHeight = 300;
  const cols = 3;
  const rows = Math.ceil(candidates.length / cols);
  const width = margin * 2 + cols * cardWidth + (cols - 1) * gap;
  const height = headerHeight + rows * cardHeight + (rows - 1) * gap + 300;
  const statusLegend = candidates.map((item, index) => `<rect x="${margin + index * 420}" y="232" width="20" height="20" rx="4" fill="${item.statusColor}"/><text x="${margin + 30 + index * 420}" y="250" font-size="20" fill="#29352f" font-family="Microsoft YaHei,Arial,sans-serif">${xml(item.id)} ${xml(item.statusLabel)}</text>`).join('');
  const cards = candidates.map((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = margin + col * (cardWidth + gap);
    const y = headerHeight + row * (cardHeight + gap);
    const svg = item.id === 'A6' ? raglanThreeViewSvg(true).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '') : exportStyleThreeViewSvg(item.draft, true).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const summary = `${item.id} · ${item.name}`;
    return `<g><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="${row % 2 ? '#f8faf8' : '#fff'}" stroke="#b8c9bd" stroke-width="3"/><rect x="${x}" y="${y}" width="${cardWidth}" height="76" rx="18" fill="#eef4ef"/><rect x="${x}" y="${y + 56}" width="${cardWidth}" height="20" fill="#eef4ef"/><text x="${x + 26}" y="${y + 47}" font-size="31" font-weight="700" fill="#29352f" font-family="Microsoft YaHei,Arial,sans-serif">${xml(summary)}</text><rect x="${x + cardWidth - 230}" y="${y + 22}" width="204" height="33" rx="16" fill="${item.statusColor}"/><text x="${x + cardWidth - 128}" y="${y + 45}" text-anchor="middle" font-size="18" fill="#fff" font-family="Microsoft YaHei,Arial,sans-serif">${xml(item.statusLabel)}</text><svg x="${x + 28}" y="${y + 88}" width="${cardWidth - 56}" height="350" viewBox="0 0 1680 900" preserveAspectRatio="xMidYMid meet">${svg}</svg><line x1="${x + 26}" y1="${y + 456}" x2="${x + cardWidth - 26}" y2="${y + 456}" stroke="#d6dfd8"/><text x="${x + 26}" y="${y + 493}" font-size="19" font-weight="700" fill="#506c38" font-family="Microsoft YaHei,Arial,sans-serif">LAB：${xml(item.method)} · 母版：${xml(item.master)}</text>${textBlock(x + 26, y + 530, `为什么改：${item.why}`, 52, 18)}${textBlock(x + 26, y + 584, `保留：${item.keep}`, 52, 18)}${textBlock(x + 26, y + 638, `变化：${item.change}`, 52, 18)}${textBlock(x + 26, y + 692, `验证：${item.verify}`, 52, 17, '#506c38', 24)}</g>`;
  }).join('');
  const blockedY = headerHeight + rows * cardHeight + (rows - 1) * gap + 36;
  const blocked = `<g><rect x="${margin}" y="${blockedY}" width="${width - margin * 2}" height="205" rx="16" fill="#fff7f5" stroke="#d98c82" stroke-width="3"/><rect x="${margin}" y="${blockedY}" width="230" height="205" rx="16" fill="#a52d25"/><text x="${margin + 115}" y="${blockedY + 63}" text-anchor="middle" font-size="32" font-weight="700" fill="#fff" font-family="Microsoft YaHei,Arial,sans-serif">Q0</text><text x="${margin + 115}" y="${blockedY + 108}" text-anchor="middle" font-size="23" fill="#fff" font-family="Microsoft YaHei,Arial,sans-serif">半拉链方向</text><text x="${margin + 115}" y="${blockedY + 148}" text-anchor="middle" font-size="20" fill="#ffe3de" font-family="Microsoft YaHei,Arial,sans-serif">来源阻断</text><text x="${margin + 260}" y="${blockedY + 43}" font-size="23" font-weight="700" fill="#a52d25" font-family="Microsoft YaHei,Arial,sans-serif">不生成伪三视图</text>${textBlock(margin + 260, blockedY + 80, '关键词走势相互矛盾；我司已有B23M2009相关构型；缺少完整原稿、净样、领面/领底、挡片、护颏、止点和责任人。', 86, 19)}${textBlock(margin + 260, blockedY + 155, '解除条件：先补公司来源结构，再做单结构对照、样衣、试穿和拉链/洗后验证。', 86, 19, '#a52d25')}</g>`;
  const competitorY = blockedY + 245;
  const competitorCards = competitors.map((item, index) => {
    const x = margin + index * ((width - margin * 2 + gap) / 3);
    const w = (width - margin * 2 - gap * 2) / 3;
    // Keep the exported PNG self-contained. The product page and product image
    // remain clickable in the companion benchmark markdown; this thumbnail is
    // an observation sketch, never a fabricated product photograph.
    const thumb = `<a href="${item.url}"><g transform="translate(${x + 120} ${competitorY + 160}) scale(.8)">${competitorThumb(item)}</g></a>`;
    return `<g><rect x="${x}" y="${competitorY}" width="${w}" height="360" rx="16" fill="#fff" stroke="#b8c9bd" stroke-width="3"/><text x="${x + 22}" y="${competitorY + 40}" font-size="22" font-weight="700" fill="#29352f" font-family="Microsoft YaHei,Arial,sans-serif">${xml(item.id)} · ${xml(item.name)}</text><text x="${x + 22}" y="${competitorY + 65}" font-size="16" fill="#68766e" font-family="Microsoft YaHei,Arial,sans-serif">${xml(item.brand)} · <a href="${item.url}">打开来源页</a></text>${thumb}<text x="${x + 235}" y="${competitorY + 104}" font-size="17" font-weight="700" fill="#506c38" font-family="Microsoft YaHei,Arial,sans-serif">观察事实</text>${textBlock(x + 235, competitorY + 130, item.fact, 27, 15, '#29352f', 22)}<text x="${x + 22}" y="${competitorY + 275}" font-size="17" font-weight="700" fill="#506c38" font-family="Microsoft YaHei,Arial,sans-serif">设计启发</text>${textBlock(x + 22, competitorY + 300, item.insight, 54, 15, '#29352f', 21)}<text x="${x + 22}" y="${competitorY + 345}" font-size="14" fill="#a52d25" font-family="Microsoft YaHei,Arial,sans-serif">边界：${xml(item.limit)}</text></g>`;
  }).join('');
  const matrixSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 620}" viewBox="0 0 ${width} ${height + 620}"><rect width="100%" height="100%" fill="#f4f7f4"/><rect x="0" y="0" width="${width}" height="${headerHeight}" fill="#506c38"/><text x="${margin}" y="66" font-size="45" font-weight="700" fill="#fff" font-family="Microsoft YaHei,Arial,sans-serif">男士卫衣 · 三视图改款延展矩阵</text><text x="${margin}" y="114" font-size="25" fill="#e4eee5" font-family="Microsoft YaHei,Arial,sans-serif">AT25M3295 基款骨架 × LAB 改款方法 · 七款我司延展 + 竞品结构对标 · 2026-11-13</text><text x="${margin}" y="163" font-size="20" fill="#e4eee5" font-family="Microsoft YaHei,Arial,sans-serif">每款先写“为什么改、保留什么、具体改什么、牵动什么、如何验证”；图稿是设计表达，不是毫米净样或生产批准。</text><image href="${sourceData}" x="${width - margin - 185}" y="28" width="150" height="185" preserveAspectRatio="xMidYMid slice" opacity="0.92"/><rect x="${width - margin - 192}" y="21" width="164" height="200" rx="8" fill="none" stroke="#e4eee5" stroke-width="2"/><text x="${margin}" y="250" font-size="20" fill="#e4eee5" font-family="Microsoft YaHei,Arial,sans-serif">状态图例：</text>${statusLegend}${cards}${blocked}<text x="${margin}" y="${competitorY - 25}" font-size="30" font-weight="700" fill="#506c38" font-family="Microsoft YaHei,Arial,sans-serif">竞品对标：结构事实 → 设计启发 → 证据边界</text>${competitorCards}<text x="${margin}" y="${height + 580}" font-size="18" fill="#65736a" font-family="Microsoft YaHei,Arial,sans-serif">证据：D1-D4 我司原稿；E2 材料主数据；S3 历史评论；S01 LAB 方法；M1 校正经验；C1-C3 外部公开产品页。所有方案 evidence_provenance=candidate-only；productionApproved=false。</text></svg>`;

  const matrixJson = {
    schema: 'garment-os/three-view-redesign-matrix/v1', runId: run, baseStyle: 'AT25M3295',
    evidence_provenance: 'company-reference-plus-historical-market-sources-plus-LAB-method-application; candidate-only',
    methods: ['廓形限定', '组合更换', '细节延伸', '增加部位', '逆向改款', '款式组合', '结构替换'],
    candidates: candidates.map(({ draft: _draft, ...item }) => ({ ...item, change: item.change, visualAsset: `${item.id}.svg` })),
    blockedDirection: { id: 'Q0', status: 'blocked-pending-source-pattern', reason: '半拉链公司来源结构未闭合；不生成伪三视图。' },
    productionApproved: false, physicalTestCompleted: false, formalQualified: false,
    outputs: { matrixSvg: 'three-view-matrix.svg', matrixPng: 'three-view-matrix.png', candidateFolder: '.' },
    competitors,
    evidence,
  };
  const matrixMarkdown = [
    '# 男士卫衣三视图改款延展矩阵', '',
    `运行批次：\`${run}\`；基款：AT25M3295；证据状态：candidate-only。`, '',
    '本轮采用 LAB 的廓形限定、组合更换、细节延伸、增加部位、逆向改款和款式组合。所有三视图固定正面、背面、侧面，变化与母版来源分开记录。', '',
    '| 方案 | LAB手法 | 保留 / 变化 | 证据与机会状态 | 验证门槛 |', '|---|---|---|---|---|',
    ...candidates.map(item => `| ${item.id} ${item.name} | ${item.method} | 保留：${item.keep}<br>变化：${item.change} | ${item.evidence}<br>${item.statusLabel}：${item.why} | ${item.verify}<br>${item.gate} |`),
    '', '## 结构阻断', '', 'Q0 半拉链不落图：趋势方向与公司结构来源均未闭合。需要先取得 B23M2009 原稿、净样、完整领部配套和责任人。', '',
    '## A6 插肩结构开发单', '', 'A6不是在AT25M3295装袖图上补斜线。依据我司AT25M3275、AT24M3248的插肩先例，需重建前身插肩边、后身插肩边、配套袖片前后边、袖底合缝、腋下对位和袖片参与领圈的分段关系。当前状态：structural-hypothesis-only；仅支持纸样开发与样衣验证排程。', '',
    '## 竞品对标', '',
    '| 编号 | 产品 / 品牌 | 来源 | 观察事实 | 设计启发 | 边界 |', '|---|---|---|---|---|---|',
    ...competitors.map(item => `| ${item.id} ${item.name} | [来源页](${item.url}) | 观察事实：${item.fact} | 设计启发：${item.insight} | 边界：${item.limit} |`),
    '',
    '竞品对标是外部结构证据，不是我司纸样来源；图片或产品页只能支持可观察结构，不能证明适体、耐久、销量、成本或生产放行。', '',
    '## 共同边界', '', '软件图形、历史评论、材料主数据和 LAB 方法只能支持设计假设与验证路径。不得将视觉通过、关键词变化或单次案例写成适体、耐久、成本、销量或生产放行结论。',
  ].join('\n');

  await fs.writeFile(path.join(publicRoot, 'three-view-matrix.svg'), matrixSvg);
  await sharp(Buffer.from(matrixSvg)).png().toFile(path.join(publicRoot, 'three-view-matrix.png'));
  await fs.writeFile(path.join(publicRoot, 'matrix.json'), JSON.stringify(matrixJson, null, 2));
  await fs.writeFile(path.join(publicRoot, 'matrix.md'), matrixMarkdown);
  const competitorMarkdown = ['# 男士卫衣竞品结构对标', '', '对标用途：支持结构观察和设计启发，不替代我司母版、净样、版师审核或真实市场验证。', '', '| 编号 | 产品 / 品牌 | 来源 | 观察事实 | 设计启发 | 证据边界 |', '|---|---|---|---|---|---|', ...competitors.map(item => `| ${item.id} | ${item.name} / ${item.brand} | [公开产品页](${item.url})${item.image ? `；[产品图](${item.image})` : ''} | ${item.fact} | ${item.insight} | ${item.limit} |`), '', '我司对应来源：A6使用AT25M3295作为形态和语法母版，使用AT25M3275、AT24M3248作为插肩接口先例；竞品不计入我司版型来源。'].join('\n');
  await fs.writeFile(path.join(publicRoot, 'competitor-benchmark.md'), competitorMarkdown);
  await fs.writeFile(path.join(publicRoot, 'competitor-benchmark.json'), JSON.stringify({ schema: 'garment-os/competitor-benchmark/v1', evidence_provenance: 'public-product-pages; observation-only', competitors }, null, 2));
  await fs.mkdir(coreArtifact, { recursive: true });
  await fs.writeFile(path.join(coreArtifact, 'three-view-matrix.svg'), matrixSvg);
  await sharp(Buffer.from(matrixSvg)).png().toFile(path.join(coreArtifact, 'three-view-matrix.png'));
  await fs.writeFile(path.join(coreArtifact, 'matrix.json'), JSON.stringify(matrixJson, null, 2));
  await fs.writeFile(path.join(coreArtifact, 'matrix.md'), matrixMarkdown);
  await fs.writeFile(path.join(coreArtifact, 'competitor-benchmark.md'), competitorMarkdown);
  await fs.writeFile(path.join(coreArtifact, 'competitor-benchmark.json'), JSON.stringify({ schema: 'garment-os/competitor-benchmark/v1', evidence_provenance: 'public-product-pages; observation-only', competitors }, null, 2));
  await fs.writeFile(path.join(coreArtifact, 'manifest.json'), JSON.stringify({ runId: run, publicPath: `public/research-pilots/${run}`, matrix: 'three-view-matrix.png', candidates: candidates.map(item => item.id), blockedDirection: 'Q0' }, null, 2));

  console.log(JSON.stringify({ run, coreArtifact, publicRoot, matrix: path.join(coreArtifact, 'three-view-matrix.png'), candidates: candidates.map(item => ({ id: item.id, status: item.status })) }, null, 2));
} finally {
  await vite.close();
}
