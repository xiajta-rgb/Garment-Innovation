import type {AssemblyReport} from '@/types/assembly';
import type {BodyMeasurements} from '@/types/measurements';
import type {ConstructionReport,ConstructionSelection,ConstructionMetric} from '@/types/construction';
import type {StandardPiece} from '../reference/standard';

const metric=(label:string,value:number,formula:string,unit:'mm'|'count'='mm'):ConstructionMetric=>({label,value,formula,unit});
/** Dimensional equalities are checked against source points, separately from pending sewing completion. */
export function auditSkirtConstruction(m:BodyMeasurements,options:Record<string,number|boolean|string>,pieces:StandardPiece[],assembly:AssemblyReport,selection?:ConstructionSelection,absoluteOptions?:Record<string,number>):ConstructionReport{
  const skirt=pieces.find(p=>p.id==='sandy.skirt')!,band=pieces.find(p=>p.id==='sandy.waistband')!;
  const n=(key:string)=>{const v=options[key];if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`裙装源参数无效：${key}`);return v;};
  const dist=(p:StandardPiece,a:string,b:string)=>Math.hypot(p.points[a].x-p.points[b].x,p.points[a].y-p.points[b].y);
  const width=absoluteOptions?.waistbandWidth,requestedWidth=m.waistToFloor!*n('waistbandWidth'),overlap=m.waist*n('waistbandOverlap');
  if(typeof width!=='number'||!Number.isFinite(width)||width<=0)throw new Error('源未提供腰头吸附后的绝对高度');
  if(m.skirtLength!<=width+20)throw new Error('裙身净长须大于20mm，不能被源实际腰头成品高占满');
  const radius=m.waist*(1+n('gathering'))/(2*Math.PI*n('circleRatio'));
  const assert=(name:string,a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-6)throw new Error(`裙装源尺寸约束失败：${name}，${a} / ${b}`);};
  assert('内腰弧半径',dist(skirt,'center','in2'),radius);
  assert('裙长包含腰头',dist(skirt,'in2','ex2')+width,m.skirtLength!);
  assert('腰头展开高',dist(band,'topLeft','bottomLeft'),width*2);
  assert('含搭量腰头长',dist(band,'bottomLeft','bottomRight'),m.waist+overlap);
  assert('折腰中线高度',dist(band,'topLeft','centerLeft'),width);
  if(skirt.qty!==n('panels')||!skirt.onFold||band.qty!==1||band.onFold)throw new Error('裙装裁剪数量或裁法与源构型不一致');
  const waistArc=assembly.boundaries.find(b=>b.piece===skirt.id&&b.id==='waist')!.lengthMm*2*n('panels');
  const target=m.waist*(1+n('gathering'));
  // Circular arcs are authored upstream as cubic Beziers, not mathematical circles.
  // 0.03% is the separate analytic-vs-cubic reference bound; it is not a sewing/manufacturing tolerance.
  if(Math.abs(waistArc-target)>target*.0003)throw new Error('源三次曲线腰弧与解析圆弧差超过0.03%参考上限');
  const source='@freesewing/sandy@4.10.2/src/';
  return {schema:'garment-os/construction-report/v1',method:'Sandy 分幅圆裙 / 连裁折腰',revision:'sandy-construction/v1',selection:selection??null,resolvedOptions:{...options},
    readyForAssembly:false,productionApproved:false,operations:[
      {id:'skirt-shape',label:'裙幅尺寸与单轴对折',pieces:[skirt.id],source:source+'skirt.mjs',status:'dimensioned',
        rule:'源内半径=腰围×(1+褶量比例)/(2π×圆度)；净裙身长=成品裙长−源实际腰头成品高。腰头高度按源常用规格吸附，报告保留请求与实际值。',
        metrics:[metric('成品裙长（设计输入）',m.skirtLength!,'腰头顶至裙摆'),metric('净裙身长',dist(skirt,'in2','ex2'),'源 in2→ex2'),metric('内弧半径',radius,'解析半径；已核对源点'),metric('实际裁剪裙幅数',n('panels'),'源裁剪指令','count')],
        steps:['每幅沿源标识单轴对折裁剪。','保留圆弧、布纹与下摆整理裁边。'],requirements:['幅片物理实例及缝止点另行分配。'],guides:[]},
      {id:'skirt-waistband',label:'腰头折返与装裙净长',pieces:[skirt.id,band.id],source:source+'straight-waistband.mjs',status:'needs-geometry',
        rule:'一片腰头展开高为成品高×2，展开长为腰围+搭量；内层是同片折返，不重复下料。',
        metrics:[metric('请求腰头高度',requestedWidth,'腰到地×waistbandWidth（吸附前）'),metric('源实际腰头成品高',width,'源absoluteOptions：按常用规格吸附后的实际mm'),metric('高度吸附差',width-requestedWidth,'源实际−请求；明确展示，不静默忽略'),metric('含搭量展开长',m.waist+overlap,'腰围×(1+搭量比例)'),metric('搭量',overlap,'腰围×waistbandOverlap'),metric('装裙完成目标',m.waist,'自然腰位，剔除搭量'),metric('全部展开源腰弧',waistArc,'源半片腰弧×2×幅数'),metric('三次腰弧与解析值差',waistArc-target,'源Bezier弧与解析圆弧差；非生产误差')],
        steps:['标明搭量及抽褶量。','按源fold线折腰，核对剔除搭量后的装接长。'],requirements:['腰头翻折、内侧固定与抽褶后的完成态尚未求解。'],guides:[{piece:band.id,label:'源腰头对折线',pathD:band.sourcePaths.fold.data}]},
      {id:'skirt-opening',label:'裙幅侧缝与拉链开口',pieces:[skirt.id,band.id],source:source+'skirt.mjs',status:'needs-input',rule:'源幅片侧边等长；成衣必须另外指定开口位置、长度和闭合方式。',metrics:[],
        steps:['指定哪两幅相接及左右方向。','录入拉链开口、缝止点与腰头扣合位置。'],requirements:['尚无开口实测值及完整闭合实例，保持装配待验证。'],guides:[]},
    ],requiredInputs:[
      {code:'skirt.zipperOpeningMm',label:'拉链开口长度',dataType:'number',unit:'mm',group:'hem',scope:'garment',meaning:'实际裙缝上预留的穿脱开口净长。',requiredWhen:'非弹力固定腰围、使用拉链闭合时',validation:'大于0，位于指定裙幅侧缝并小于裙身净长。',evidence:'款式工艺设定与开口试验',operations:['skirt-opening'],value:null},
      {code:'skirt.fabricShrinkage',label:'面料缩水率',dataType:'number',unit:'ratio',group:'material',scope:'each-material',meaning:'各材料经纬缩水实测；不从屏幕纹理推断。',requiredWhen:'制造交付前',validation:'经纬方向分别记录、注明测试条件；未录入保持未知。',evidence:'面料测试',operations:['skirt-shape','skirt-waistband'],value:null},
    ]};
}
