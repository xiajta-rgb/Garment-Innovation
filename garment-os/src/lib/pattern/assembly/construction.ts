import type { AssemblyReport, AssemblyPoint } from '@/types/assembly';
import type { BodyMeasurements } from '@/types/measurements';
import type { ConstructionMetric, ConstructionOperation, ConstructionReport, ConstructionSelection } from '@/types/construction';
import { CONSTRUCTION_REVISION } from '@/data/constructionMethods';
import { CONSTRUCTION_INPUTS } from '@/data/constructionInputs';

interface SourcePiece {
  id: string; points: Record<string, AssemblyPoint>;
  sourcePaths: Record<string, { data: string; hidden: boolean }>;
}
const metric = (label: string, value: number | null, formula: string, unit: 'mm' | 'count' = 'mm'): ConstructionMetric => ({ label, value, formula, unit });

/** Construction obligations are independent from contour integrity. A defined rule can still fail.
 * No inverse trimming to match a result and no invented textile properties or sewing tolerances. */
export function auditConstruction(id: string, m: BodyMeasurements, options: Record<string, number | boolean | string>, pieces: SourcePiece[], assembly: AssemblyReport, selection?: ConstructionSelection): ConstructionReport {
  if (id !== assembly.templateId) throw new Error('构造规则与当前模板身份不一致');
  const operations: ConstructionOperation[] = [];
  const source = (file: string) => `@freesewing/${assembly.engine}@4.10.2/src/${file}.mjs`;
  const n = (key: string) => {
    const value = options[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`构造规则缺少有效源参数：${key}`);
    return value;
  };
  const assertDimension = (label:string,actual:number,expected:number) => {
    if(!Number.isFinite(actual)||!Number.isFinite(expected)||Math.abs(actual-expected)>1e-6) throw new Error(`构造源尺寸不一致：${label}，实际 ${actual}，目标 ${expected}`);
  };
  const p = (piece: string, point: string) => {
    const value = pieces.find(p => p.id === piece)?.points[point];
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) throw new Error(`构造规则缺少源点：${piece}/${point}`);
    return value;
  };
  const distance = (piece: string, a: string, b: string) => { const x = p(piece, a), y = p(piece, b); return Math.hypot(x.x-y.x, x.y-y.y); };
  const length = (piece: string, boundary: string) => {
    const edge = assembly.boundaries.find(b => b.piece === piece && b.id === boundary);
    if (!edge) throw new Error(`构造规则缺少源接口：${piece}/${boundary}`);
    return edge.lengthMm;
  };
  const guide = (piece: string, label: string, from: string, to: string) => {
    const a = p(piece, from), b = p(piece, to);
    return { piece, label, pathD: `M${a.x} ${a.y}L${b.x} ${b.y}` };
  };
  const pathGuide = (piece: string, name: string, label: string) => {
    const path = pieces.find(p => p.id === piece)?.sourcePaths[name];
    if (!path?.data) throw new Error(`构造规则缺少源路径：${piece}/${name}`);
    return { piece, label, pathD: path.data };
  };
  const add = (op: ConstructionOperation) => operations.push(op);
  if(assembly.engine==='teagan'){
    const sleeve='teagan.sleeve',half=p(sleeve,'bicepsRight').x;
    const requested=m.bicep*(1+n('bicepsEase'))*(1+n('sleeveEase'));
    const actual=distance(sleeve,'hemLeft','hemRight');
    assertDimension('Teagan袖下口净宽',actual,Math.min(requested,half*2));
    assertDimension('Teagan袖延伸高度',p(sleeve,'hemRight').y,half*n('sleeveLength'));
    add({id:'tee-sleeve-module',label:'同源短袖变化',pieces:[sleeve],source:source('sleeve'),status:'dimensioned',rule:'袖山继续配对当前衣身袖窿；源半上臂宽×比例决定袖下口延伸。袖下口宽按源上限限制，列出请求和实际。',metrics:[metric('袖下口延伸高度',p(sleeve,'hemRight').y,'源bicepsRight.x×sleeveLength'),metric('源袖山顶至下口高度',p(sleeve,'hemRight').y-p(sleeve,'top').y,'源top→hemRight的纵向差'),metric('请求袖下口宽',requested,'人体上臂围×(1+bicepsEase)×(1+sleeveEase)'),metric('实际袖下口宽',actual,'源hemLeft→hemRight'),metric('宽度限制差',actual-requested,'实际−请求；达到源上限时明确显示')],steps:['选择短袖延伸和下口宽度。','重算同源袖片并复查两袖袖山与前后袖窿。'],requirements:['此模块为装袖短袖变化；插肩、落肩和泡泡袖须另有衣身及袖窿重制合同。'],guides:[]});
  }
  if (assembly.engine === 'simon') {
    const sleeve = 'simon.sleeve', collar = 'simon.collar', stand = 'simon.collarStand';
    const collarTarget = m.neckCirc * (1+n('collarEase')-n('collarGap'));
    const standTarget = m.neckCirc * (1+n('collarEase'));
    const standTop = length(stand, 'top'), collarActual = length(collar, 'insert-left')+length(collar, 'insert-right');
    add({ id: 'collar-insertion', label: '领面与领座的装领区间', pieces: [collar, stand], source: source('collar'), status: 'needs-geometry',
      rule: '领面目标＝颈围×(1＋领围松量−端部留空比例)；两端总留空＝颈围×端部留空比例。领座上边需独立按弧长定位起止剪口，再走缝，禁止按领面实长反裁同长区间。',
      metrics: [metric('领面目标', collarTarget, 'neck × (1 + collarEase − collarGap)'), metric('领面实际装领边', collarActual, '两条源装领曲线积分'), metric('领面迭代残差', collarActual-collarTarget, '实际 − 目标'),
        metric('每端设计留空', m.neckCirc*n('collarGap')/2, 'neck × collarGap / 2'), metric('领座上边原长', standTop, 'rightTopCf → leftTopCf 源曲线积分'), metric('扣除留空后的长度差', collarActual-(standTop-m.neckCirc*n('collarGap')), '领面实长 − (领座上边实长 − 两端总留空)')],
      steps: ['领面后中对领座后中，左右端分别定位。', '领面夹在领座两层之间，源装领净边作为车缝基准。'],
      requirements: ['领座上边的弧长剪口和门襟完成态端点尚未生成；不得以目标收敛代替真实配缝。'],
      guides: [guide(collar, '领面后中宽', 'topMid', 'bottomMid'), guide(stand, '领座右CF端', 'rightTopCf', 'rightBottomCf'), guide(stand, '领座左CF端', 'leftTopCf', 'leftBottomCf')] });
    const neckActual = length('simon.frontLeft','neck')+length('simon.frontRight','neck')+length('simon.yoke','neck');
    const bottomActual = length(stand,'neck-left')+length(stand,'neck-right');
    add({ id: 'neck-stand', label: '领窝、门襟与领座下边', pieces: ['simon.frontLeft','simon.frontRight','simon.yoke',stand], source: source('collarstand'), status: 'needs-geometry',
      rule: '领座CF至CF目标＝颈围×(1＋领围松量)。门襟按源折线翻折后确定实际装领终点；搭门伸出段不能当作领窝吃势。',
      metrics: [metric('领座下边目标', standTarget, 'neck × (1 + collarEase)'), metric('领座下边实长', bottomActual, '两段源下边积分'), metric('原始衣身领窝实长',neckActual,'两前领窝＋完整过肩后领窝'), metric('未翻折领窝差',neckActual-bottomActual,'原始领窝 − 领座下边')],
      steps: ['先完成左右连身门襟翻折。', '后中、肩颈点和完成门襟端依次配接；双层过肩只算一次走缝长度。'], requirements: ['左右门襟折返后的领窝端点变换仍需实现；原始曲线差不能擅自设为允许吃势。'], guides: [] });
    add({ id: 'undercollar', label: '领面与独立领底', pieces: [collar], source: source('collar'), status: 'needs-geometry',
      rule: '源领底差异量＝领面后中宽×collarRoll；源 underCollar 仅为外周参考线，不是独立闭合裁片。领底必须独立闭合、缝份、布纹及用料身份。',
      metrics: [metric('领面后中宽',distance(collar,'topMid','bottomMid'),'源 topMid → bottomMid'), metric('源领底差异量',distance(collar,'topMid','bottomMid')*n('collarRoll'),'后中宽 × collarRoll')],
      steps: ['分别管理领面、领底和各自衬层。', '由源差异外周和装领边重建闭合领底后，逐段检查翻折与领面容位。'], requirements: ['未拆独立领底前，不可把源面料2片当作同形下料。'], guides: [pathGuide(collar,'underCollar','源领底外周参考线')] });
    if (options.sleeveStyle !== 'short') {
      const drape = n('cuffDrape') * m.sleeveLength, count = drape > 20 ? 2 : drape > 0 ? 1 : 0;
      const takeup = (count ? distance(sleeve,'cuffMid','cuffPleat1Edge') : 0)+(count === 2 ? distance(sleeve,'cuffRightCusp','cuffPleat2Edge') : 0);
      assertDimension('总褶口收量',takeup,drape);
      if(count){
        assertDimension('第一褶折线位于收量中点',distance(sleeve,'cuffMid','cuffPleat1Fold'),drape/count/2);
        assertDimension('第一褶纵向长度',distance(sleeve,'cuffPleat1Fold','cuffPleat1FoldTop'),m.sleeveLength*.15);
      }
      if(count===2) assertDimension('第二褶折线位于收量中点',distance(sleeve,'cuffRightCusp','cuffPleat2Fold'),drape/4);
      const raw = length(sleeve,'cuff'), cuff = length('simon.cuff','insert'), flat = raw-takeup;
      assertDimension('袖口源装袖边',cuff,m.wristCirc*(1+n('cuffEase'))*(1+n('cuffOverlap')));
      assertDimension('袖口源高度',distance('simon.cuff','topLeft','bottomLeft'),m.sleeveLength*n('cuffLength'));
      const residual = flat-cuff;
      add({ id: 'cuff-pleats', label: '单袖褶量与双层袖口', pieces: [sleeve,'simon.cuff'], source: source('sleeve'), status: Math.abs(residual) > .01 ? 'needs-redraft' : 'needs-geometry',
        rule: '按每只袖分别计算：平面去褶基准＝含褶袖下口实长−源褶口收量；再处理袖衩折返及袖口搭门。面料双层不使走缝长度加倍。0.01 mm只是数值一致性限值，非工厂公差。',
        metrics: [metric('单袖原始净边',raw,'源 cuffBase 积分'),metric('设计总褶量',drape,'shoulderToWrist × cuffDrape'),metric('褶数',count,'>20 mm 为2褶；正值为1褶；0为无褶','count'),metric('源褶口实收量',takeup,'cuffMid→cuffPleat1Edge ＋ 可选 cuffRightCusp→cuffPleat2Edge'),metric('去褶平面基准长',flat,'原始边长 − 源褶口实收量'),metric('单只袖口装袖边',cuff,'bottomLeft → bottomRight'),metric('去褶后尚余差值',residual,'平面基准长 − 袖口装袖边')],
        steps: ['源褶边折向源褶口，折线位于收量中间；先固定每只袖的褶。', '袖衩折返完成后分别检查左右装袖起止点，再夹入两层袖口。'],
        requirements: ['上游袖片宽用加法、袖口宽用乘法；此差异必须通过独立袖下口重制及袖衩完成态校验解决，不能扩大公差。', '腕围闭合尺寸还须核对纽扣/扣眼中心距，不能将袖口净宽当作完成腕围。'],
        guides: count ? [pathGuide(sleeve,'pleats','源褶边、褶口与折线')] : [] });
      const slit = n('sleevePlacketLength')*m.sleeveLength, width = n('sleevePlacketWidth')*m.wristCirc;
      for (const overlap of [true,false]) {
        const piece = overlap ? 'simon.sleevePlacketOverlap' : 'simon.sleevePlacketUnderlap';
        const actual = distance(piece,'midLeft',overlap ? 'midLen' : 'midRight');
        assertDimension('袖衩切口设计长度',length(sleeve,overlap?'placket-outer':'placket-inner'),slit);
        assertDimension('袖衩搭片长度基准',actual,slit);
        if(overlap){
          assertDimension('外搭塔尖纵向位置',p(piece,'boxTip').x,slit+width*1.5);
          assertDimension('外搭第三折线位置',p(piece,'fold3Left').y,width*1.5);
        } else {
          assertDimension('内搭折线控制宽',Math.abs(p(piece,'fold1Left').y),Math.min(width/2,10));
          assertDimension('内搭净外缘',Math.abs(p(piece,'topLeft').y),2*Math.min(width/2,10)-1.5);
        }
        add({ id: overlap ? 'placket-overlap' : 'placket-underlap', label: overlap ? '袖衩外搭片翻折' : '袖衩内搭片翻折', pieces: [sleeve,piece], source: source(overlap ? 'sleeveplacket-overlap':'sleeveplacket-underlap'),status: 'needs-geometry',
          rule: overlap ? '外搭片长基准与切口同长；外搭宽＝腕围×宽比例，塔尖沿长度方向位于 L＋1.5W。源第三折线 y＝1.5W；先折返再核对切口外侧。' : '内搭长与切口同长；折边宽 w＝min(W/2,10 mm)，两主折线位于 y＝±w，净外缘 y＝±(2w−1.5 mm)。配接切口内侧。',
          metrics: [metric('切口设计长度',slit,'shoulderToWrist × sleevePlacketLength'),metric('源切口实长',length(sleeve,overlap?'placket-outer':'placket-inner'),'cuffLeftCusp → placketEnd'),metric('搭片长度基准',actual,overlap?'midLeft → midLen':'midLeft → midRight'),metric('折边控制宽',overlap?width:Math.min(width/2,10),overlap?'wrist × sleevePlacketWidth':'min(外搭宽/2, 10 mm)')],
          steps: ['按源切口终点剪开，保留内外两面身份。', overlap ? '按源第三折线及塔尖轮廓折叠并固定外搭。' : '按两条源折线内折包住切口内侧。'],requirements: ['尚需实现切口端转角、缝线偏移与折返后装袖端点；平行投影长度相同不等于完成态已经匹配。', '上游没有布纹，需独立定义方向并验算。'],guides: [pathGuide(piece,'folds','源折线'),...(overlap?[pathGuide(piece,'outline','源塔尖完成外形')]:[])] });
      }
    } else {
      add({ id:'short-sleeve-hem',label:'短袖镜像折边',pieces:[sleeve],source:source('sleeve'),status:'dimensioned',rule:'折边深度＝肩端到腕×sleeveHemShort；源折边轮廓按两侧袖缝方向镜像，不能用矩形加宽替代。',
        metrics:[metric('折边深度',m.sleeveLength*n('sleeveHemShort'),'shoulderToWrist × sleeveHemShort')],steps:['沿源折线翻折；先核对两袖底端、再固定折边。'],requirements:['缝型、针距及厚度适配由材料工艺条件确定；尺寸已定义不代表制造通过。'],guides:[pathGuide(sleeve,'shortSleeveHemFold','短袖翻折线')] });
    }
  }
  add({ id:'body-hems',label:'下摆与开口收边',pieces:pieces.filter(p=>/front|back/.test(p.id)).map(p=>p.id),source:source('front'),status:'needs-input',
    rule:'净样边、裁剪缝份、成品折线和车缝线分别管理。单折需定义折深；双折需定义首折与次折；曲线下摆需处理翻折差量。源10 mm基础缝份不能自动当作任意折深。',
    metrics:assembly.engine==='simon'?[metric('臀线以下设计延伸',m.totalLength-(m.hpsToWaistBack!+m.hipDepth),'衣长 − (HPS至后腰＋腰臀长)')]:[],
    steps:['选定单折/双折/包边工艺。','按材料厚度生成各折线和完成边，再检查侧缝接点及曲线翻折差量。'],
    requirements:['缺少版本化的折边工艺选择、折深、缝线偏移、转角和材料厚度条件。',...(assembly.engine==='simon'&&options.hemStyle!=='straight'&&m.totalLength<=m.hpsToWaistBack!+m.hipDepth?['当前衣长未超出臀线，曲线下摆会退化；需明确臀线以下的衣长，不能把不同名称当作有效的轮廓差异。']:[])],guides:[] });
  if (assembly.engine !== 'simon') add({ id:'neck-finish',label:'针织领口收边与领条',pieces:pieces.filter(p=>/front|back/.test(p.id)).map(p=>p.id),source:source('front'),status:'needs-input',
    rule:'闭合领条净长＝完成领窝长×(1−设计缩率)；毛长另加两端接缝。毛宽＝2×成品宽＋两道装领缝份。设计缩率须满足该方向伸长与回复测试，不能由颜色、克重或罗纹名称推断。',
    metrics:[metric('展开领窝原始总长',assembly.boundaries.filter(b=>b.role==='neckline').reduce((s,b)=>s+b.lengthMm*(assembly.pieces.find(p=>p.id===b.piece)?.onFold?2:1),0),'前后领窝源曲线积分，中心对折展开×2')],steps:['选择领条或贴边工艺并录入材料方向及测试条件。','生成独立闭合领条/贴边、接缝与四等分剪口，检查闭合及拉伸方向。'],requirements:['领条成品宽、设计缩率、装领缝份、方向伸长和回复数据尚未指定；不自动使用15%缩率。'],guides:[] });
  if (assembly.engine !== 'simon') add({ id:'sleeve-hems',label:'基础袖下口折边',pieces:pieces.filter(p=>/sleeve/.test(p.id)).map(p=>p.id),source:assembly.engine==='brian'?'@freesewing/library@4.10.2/src/sleeve/index.mjs':source('sleeve'),status:'needs-input',
    rule:'先确定成品袖长与折深，再沿袖底缝方向镜像折返轮廓，保持缝合端点一致。基础净样与10 mm缝份并不包含任意工艺折边深度。',metrics:assembly.boundaries.filter(b=>b.role==='hem'&&/sleeve/.test(b.piece)).map(b=>metric('单袖源下口长',b.lengthMm,'源袖下口净边积分')),steps:['选择单折或双折，定义折深及成品袖长。','生成翻折后几何并走缝检查袖底端；薄厚材料分别验证。'],requirements:['折深、缝型、完成态折返和材料厚度尚未指定。'],guides:[] });
  add({ id:'material-process',label:'材料与工艺条件',pieces:pieces.map(p=>p.id),source:'GarmentOS 系统构造合同，非行业公差',status:'needs-input',
    rule:'面料、衬料、颜色是独立复用实体；结构兼容还依赖材料方向、伸长/回复、缩水、厚度和缝型。缺失值保持未知；BOM按独立裁片×层数×材料记录，排料用量另算。',metrics:[],steps:['为每个材料层关联稳定元素编码及版本。','材料测试、结构走缝与工艺完成态共同决定可装配性。'],requirements:['需材料ID及版本、经纬/弹性方向、厚度、缩水和伸长回复条件；当前外观纹理不是材料测试资料。'],guides:[] });
  return { schema:'garment-os/construction-report/v1',method:`${assembly.engine}@${assembly.version}`,revision:CONSTRUCTION_REVISION,selection:selection?structuredClone(selection):null,resolvedOptions:structuredClone(options),operations,
    requiredInputs:structuredClone(CONSTRUCTION_INPUTS.filter(f=>f.operations.some(id=>operations.some(op=>op.id===id)))),readyForAssembly:false,productionApproved:false };
}
