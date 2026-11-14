import {pantsAssembly} from './pantsAssemblyPlan';
import type { AssemblyDefinition, BoundaryDefinition, BoundaryRole, BoundaryUse, JoinDefinition, PieceDefinition, PointReference } from '@/types/assembly';
import type { ConstructionSelection } from '@/types/construction';
import { tankAssembly, hoodieAssembly } from './knitAssemblyPlans';
import { circleSkirtAssembly } from './skirtAssemblyPlan';

const boundary = (id: string, label: string, role: BoundaryRole, from: PointReference, to: PointReference,
  disposition: BoundaryDefinition['disposition'] = 'join', sourcePath?: string): BoundaryDefinition => ({ id, label, role, from, to, disposition, sourcePath });
const port = (piece: string, boundary: string, runs = 1, layers = 1, reverse = false): BoundaryUse => ({ piece, boundary, runs, layers, reverse });
const equal = (id: string, label: string, a: BoundaryUse[], b: BoundaryUse[], roles: JoinDefinition['roles'], toleranceMm = .01): JoinDefinition => ({
  id, label, a, b, roles, rule: { kind: 'equal', toleranceMm, basis: toleranceMm === 2 ? 'FreeSewing library/sleeve 迭代停止值 2 mm；当前参考方案袖山吃势 0；非工厂公差'
    : toleranceMm === 1 ? '系统验收范例设定：独立塑形的前后侧缝差不超过 1 mm，超限阻断；非上游承诺或工厂公差；不自动修改曲线'
      : '同源共享结构边的数值一致性限值 0.01 mm；非工厂公差' },
});
const pending = (id: string, label: string, a: BoundaryUse[], b: BoundaryUse[], roles: JoinDefinition['roles'], reason: string): JoinDefinition => ({ id, label, a, b, roles, rule: { kind: 'pending', reason } });
const piece = (id: string, quantity: number, onFold: boolean, source: string, boundaries: BoundaryDefinition[]): PieceDefinition => ({ id, quantity, onFold, source, boundaries });
const reflected = (point: string): PointReference => ({ point, reflectX: true });
function declareStations(pieces: PieceDefinition[], table: Record<string, Record<string, [string, string]>>) {
  for (const [id, entries] of Object.entries(table)) for (const [name, stations] of Object.entries(entries)) {
    const b = pieces.find(p => p.id === id)?.boundaries.find(b => b.id === name);
    if (!b) throw new Error(`装配端点声明引用不存在的边界：${id}/${name}`);
    b.stations = stations;
  }
}

function basic(id: string, engine: 'brian' | 'teagan' | 'sven'): AssemblyDefinition {
  const f = `${engine}.front`, b = `${engine}.back`, s = engine === 'brian' ? 'library.sleeve' : `${engine}.sleeve`;
  const shoulder = engine === 'teagan' ? 'shoulder' : 's3ArmholeSplit', neck = engine === 'teagan' ? 'neck' : 's3CollarSplit';
  const body = (part: string, back: boolean): PieceDefinition => piece(part, 1, true, `@freesewing/${engine}@4.10.2/src/${back ? 'back' : 'front'}.mjs`, [
    boundary('hem', '下摆折边', 'hem', back ? 'cbHem' : 'cfHem', 'hem', 'hem'),
    boundary('side', '侧缝', 'side', 'hem', 'armhole'),
    boundary('armhole', '袖窿', 'armhole', 'armhole', shoulder),
    boundary('shoulder', '肩缝', 'shoulder', shoulder, neck),
    boundary('neck', '领口收边', 'neckline', neck, back ? 'cbNeck' : 'cfNeck', 'pending'),
    boundary('fold', '中心对折边', 'fold', back ? 'cbNeck' : 'cfNeck', back ? 'cbHem' : 'cfHem', 'fold'),
  ]);
  const left = engine === 'teagan' ? 'hemLeft' : 'wristLeft', right = engine === 'teagan' ? 'hemRight' : 'wristRight';
  const pieces = [body(f, false), body(b, true), piece(s, 2, false, `@freesewing/${engine === 'brian' ? 'library' : engine}@4.10.2/src/${engine === 'brian' ? 'sleeve/index' : 'sleeve'}.mjs`, [
      boundary('hem', '袖下口折边', 'hem', left, right, 'hem'),
      boundary('underarm-right', '袖底右边', 'underarm', right, 'bicepsRight'),
      boundary('cap', '完整袖山', 'sleevecap', 'bicepsRight', 'bicepsLeft'),
      boundary('underarm-left', '袖底左边', 'underarm', 'bicepsLeft', left),
    ])];
  declareStations(pieces, {
    [f]: { shoulder: ['armhole-top', 'neck'], side: ['hem', 'underarm'], armhole: ['underarm-front', 'shoulder'] },
    [b]: { shoulder: ['armhole-top', 'neck'], side: ['hem', 'underarm'], armhole: ['underarm-back', 'shoulder'] },
    [s]: { 'underarm-left': ['underarm', 'cuff'], 'underarm-right': ['cuff', 'underarm'], cap: ['underarm-front', 'underarm-back'] },
  });
  return { id, engine, version: '4.10.2', revision: 'assembly-v2-sleeve-topology', pieces,
    sleeveTopology: { family: 'set-in', front: f, back: b, sleeve: s },
    joins: [equal('shoulders', '左右肩缝', [port(f, 'shoulder', 2)], [port(b, 'shoulder', 2)], ['shoulder', 'shoulder']),
      equal('sides', '左右侧缝', [port(f, 'side', 2)], [port(b, 'side', 2)], ['side', 'side']),
      equal('underarms', '两袖袖底缝', [port(s, 'underarm-left', 2)], [port(s, 'underarm-right', 2, 1, true)], ['underarm', 'underarm']),
      // Check each sleeve individually; never let left/right deltas cancel by summing two sleeves.
      ...['left', 'right'].map(side => equal(`sleevecap-${side}`, `${side === 'left' ? '左' : '右'}袖山与前后袖窿`, [port(s, 'cap')], [port(f, 'armhole'), port(b, 'armhole', 1, 1, true)], ['sleevecap', 'armhole'], 2))],
    unresolved: ['领口缺少独立领条或贴边构型及收边长度规则；不能按领口总长直接假定领条长度。', '折边已标识，缝份厚度、翻折及缝型属于后续工艺规则。'] };
}

function shirt(selection?: ConstructionSelection): AssemblyDefinition {
  // At curved hems, the old construction corner `hem` is no longer on the net perimeter.
  // Slashed hems stay open up to hips; baseball hems meet the side at bballEnd.
  const hemSidePoint=selection?.options.hemStyle==='baseball'?'bballEnd':selection?.options.hemStyle==='slashed'?'hips':'hem';
  const short = selection?.options.sleeveStyle === 'short';
  const cuffFile = { roundedBarrelCuff: 'cuff-barrel-rounded', straightBarrelCuff: 'cuff-barrel-straight', angledBarrelCuff: 'cuff-barrel-angled' }[selection?.options.cuffStyle ?? 'angledBarrelCuff'];
  const fL = 'simon.frontLeft', fR = 'simon.frontRight', b = 'simon.back', y = 'simon.yoke', s = 'simon.sleeve', c = 'simon.collar', st = 'simon.collarStand', cf = 'simon.cuff', po = 'simon.sleevePlacketOverlap', pu = 'simon.sleevePlacketUnderlap';
  const source = (file: string) => `@freesewing/simon@4.10.2/src/${file}.mjs`;
  const fronts = [fL, fR].map(id => piece(id, 1, false, source(id === fL ? 'frontleft' : 'frontright'), [
    boundary('hem', '前下摆', 'hem', 'cfHem', hemSidePoint, 'hem'), boundary('side', '前侧缝', 'side', hemSidePoint, 'armhole'),
    boundary('armhole', '前袖窿', 'armhole', 'armhole', 's3ArmholeSplit'), boundary('shoulder', '前肩缝', 'shoulder', 's3ArmholeSplit', 's3CollarSplit'),
    boundary('neck', '前领窝', 'neckline', 's3CollarSplit', 'cfNeck', 'pending'),
    boundary('placket', '连身门襟折返轮廓', 'front-opening', 'cfNeck', 'cfHem', 'finish'),
  ]));
  const pieces = [...fronts, piece(b, 1, true, source('back'), [
    boundary('hem', '后下摆', 'hem', 'cbHem', hemSidePoint, 'hem'), boundary('side', '后侧缝', 'side', hemSidePoint, 'armhole'),
    boundary('armhole', '后身袖窿', 'armhole', 'armhole', 'armholeYokeSplit'), boundary('top', '后身接过肩', 'back-yoke', 'armholeYokeSplit', 'cbYoke'),
    boundary('fold', '后中心对折边', 'fold', 'cbYoke', 'cbHem', 'fold'),
  ]), piece(y, 2, false, source('yoke'), [
    boundary('bottom-right', '过肩右下边', 'back-yoke', 'cbYoke', 'armholeYokeSplitPreBoxpleat'),
    boundary('armhole-right', '过肩右袖窿', 'armhole', 'armholeYokeSplitPreBoxpleat', 's3ArmholeSplit'),
    boundary('shoulder-right', '过肩右肩缝', 'shoulder', 's3ArmholeSplit', 's3CollarSplit'),
    boundary('neck', '完整后领窝', 'neckline', 's3CollarSplit', reflected('s3CollarSplit'), 'pending'),
    boundary('shoulder-left', '过肩左肩缝', 'shoulder', reflected('s3CollarSplit'), reflected('s3ArmholeSplit')),
    boundary('armhole-left', '过肩左袖窿', 'armhole', reflected('s3ArmholeSplit'), reflected('armholeYokeSplitPreBoxpleat')),
    boundary('bottom-left', '过肩左下边', 'back-yoke', reflected('armholeYokeSplitPreBoxpleat'), 'cbYoke'),
  ]), piece(s, 2, false, source('sleeve'), [
    boundary('underarm-right', '袖底右边', 'underarm', 'wristRight', 'bicepsRight'), boundary('cap', '完整袖山', 'sleevecap', 'bicepsRight', 'bicepsLeft'),
    boundary('underarm-left', '袖底左边', 'underarm', 'bicepsLeft', 'wristLeft'),
    boundary('cuff', '含褶量袖下口', 'cuff-insertion', 'wristLeft', 'wristRight', 'pending'),
    { ...boundary('placket-outer', '源袖衩切口外侧', 'placket-opening', 'cuffLeftCusp', 'placketEnd', 'pending', 'placketCut'), sourceFace: 'left' },
    { ...boundary('placket-inner', '源袖衩切口内侧', 'placket-opening', 'cuffLeftCusp', 'placketEnd', 'pending', 'placketCut'), sourceFace: 'right' },
  ]), piece(c, 2, false, source('collar'), [
    boundary('insert-right', '领面右装领边', 'collar-insertion', 'bottomMid', 'rightBottomEdge', 'pending'),
    boundary('perimeter', '领面外周与领底差异', 'perimeter', 'rightBottomEdge', 'leftBottomEdge', 'pending'),
    boundary('insert-left', '领面左装领边', 'collar-insertion', 'leftBottomEdge', 'bottomMid', 'pending'),
  ]), piece(st, 2, false, source('collarstand'), [
    boundary('neck-right', '领座右下装领边', 'neckline', 'bottomMid', 'rightBottomCf', 'pending'),
    boundary('end-right', '领座右端搭门', 'perimeter', 'rightBottomCf', 'rightTopCf', 'finish'),
    boundary('top', '领座上边', 'collar-insertion', 'rightTopCf', 'leftTopCf', 'pending'),
    boundary('end-left', '领座左端搭门', 'perimeter', 'leftTopCf', 'leftBottomCf', 'finish'),
    boundary('neck-left', '领座左下装领边', 'neckline', 'leftBottomCf', 'bottomMid', 'pending'),
  ]), piece(cf, 4, false, source(cuffFile), [
    boundary('perimeter', '袖口外周', 'perimeter', 'bottomRight', 'bottomLeft', 'finish'),
    boundary('insert', '袖口装袖边', 'cuff-insertion', 'bottomLeft', 'bottomRight', 'pending'),
  ]), piece(po, 2, false, source('sleeveplacket-overlap'), [
    boundary('length', '外搭片长度基准边', 'placket-opening', 'cutBottom', 'bottomLeft', 'pending'),
    boundary('perimeter', '外搭片折返轮廓', 'perimeter', 'bottomLeft', 'cutBottom', 'finish'),
  ]), piece(pu, 2, false, source('sleeveplacket-underlap'), [
    boundary('length', '内搭片长度基准边', 'placket-opening', 'topLeft', 'topRight', 'pending'),
    boundary('perimeter', '内搭片折返轮廓', 'perimeter', 'topRight', 'topLeft', 'finish'),
  ])];
  if (short) {
    pieces.splice(pieces.findIndex(p => p.id === cf), 3);
    const sleeve = pieces.find(p => p.id === s)!;
    sleeve.boundaries = sleeve.boundaries.filter(b => !['cuff', 'placket-outer', 'placket-inner'].includes(b.id));
    // Upstream short sleeve includes reflected turnback points in the net contour.
    sleeve.boundaries.push(boundary('short-hem', '短袖镜像折边轮廓', 'hem', 'wristLeft', 'wristRight', 'hem'));
  }
  declareStations(pieces, {
    [fL]: { shoulder: ['armhole-top', 'neck'], side: ['hem', 'underarm'], armhole: ['underarm-front', 'shoulder'] },
    [fR]: { shoulder: ['armhole-top', 'neck'], side: ['hem', 'underarm'], armhole: ['underarm-front', 'shoulder'] },
    [b]: { side: ['hem', 'underarm'], top: ['yoke-armhole', 'center-back'], armhole: ['underarm-back', 'yoke-junction'] },
    [y]: { 'shoulder-left': ['neck', 'armhole-top'], 'shoulder-right': ['armhole-top', 'neck'],
      'bottom-left': ['yoke-armhole', 'center-back'], 'bottom-right': ['center-back', 'yoke-armhole'],
      'armhole-left': ['shoulder', 'yoke-junction'], 'armhole-right': ['yoke-junction', 'shoulder'] },
    [s]: { 'underarm-left': ['underarm', 'cuff'], 'underarm-right': ['cuff', 'underarm'], cap: ['underarm-front', 'underarm-back'] },
  });
  const joins: JoinDefinition[] = [equal('underarms', '两袖袖底缝', [port(s, 'underarm-left', 2)], [port(s, 'underarm-right', 2, 1, true)], ['underarm', 'underarm'])];
  for (const [side, f] of [['left', fL], ['right', fR]]) {
    joins.push(equal(`shoulder-${side}`, `${side === 'left' ? '左' : '右'}前身接双层过肩`, [port(f, 'shoulder')], [port(y, `shoulder-${side}`, 1, 2, side === 'left')], ['shoulder', 'shoulder']),
      equal(`side-${side}`, `${side === 'left' ? '左' : '右'}侧缝`, [port(f, 'side')], [port(b, 'side')], ['side', 'side'], 1),
      equal(`yoke-${side}`, `${side === 'left' ? '左' : '右'}后身接双层过肩`, [port(b, 'top')], [port(y, `bottom-${side}`, 1, 2, side === 'right')], ['back-yoke', 'back-yoke']),
      equal(`sleevecap-${side}`, `${side === 'left' ? '左' : '右'}袖接前身、后身及过肩`, [port(s, 'cap')], [port(f, 'armhole'), port(y, `armhole-${side}`, 1, 2, side === 'right'), port(b, 'armhole', 1, 1, true)], ['sleevecap', 'armhole'], 2));
  }
  joins.push(pending('neck-stand', '衣身领窝接领座', [port(fL, 'neck'), port(fR, 'neck'), port(y, 'neck', 1, 2)], [port(st, 'neck-right', 1, 2), port(st, 'neck-left', 1, 2)], ['neckline', 'neckline'], '需确定门襟折返后的领窝终点及领座搭门；当前显示原始净边差，不作为装领通过。'),
    pending('collar-stand', '领面与领座上边', [port(c, 'insert-right', 1, 2), port(c, 'insert-left', 1, 2)], [port(st, 'top', 1, 2)], ['collar-insertion', 'collar-insertion'], '需将 collarGap 映射到领座实际起止剪口，并拆出差异领底；不能把全长差直接当吃势。'),
    pending('cuffs', '两只双层袖口接含褶袖下口', [port(s, 'cuff', 2)], [port(cf, 'insert', 2, 2)], ['cuff-insertion', 'cuff-insertion'], '需按褶线折叠及袖衩折返变换计算完成走缝长，原始袖下口长度不能直接配对袖口。'),
    pending('placket-overlap', '袖衩切口与外搭片', [port(s, 'placket-outer', 2)], [port(po, 'length', 2)], ['placket-opening', 'placket-opening'], '长度基准相等只证明来源一致；外搭片翻折、剪口转角及车缝路径尚未建立。'),
    pending('placket-underlap', '袖衩切口与内搭片', [port(s, 'placket-inner', 2)], [port(pu, 'length', 2)], ['placket-opening', 'placket-opening'], '切口内侧接内搭片；外侧另接外搭片。折返装配仍待定义。'));
  if (short) joins.splice(joins.findIndex(j => j.id === 'cuffs'), 3);
  return { id: 'button-up-shirt', engine: 'simon', version: '4.10.2', revision: 'assembly-v2-curved-hem', pieces, joins,
    unresolved: short ? ['领底需拆为独立差异裁片；领窝与门襟折返端点需完成态几何。', '短袖镜像折边尺寸来自源规则；下摆、材料和缝型条件仍需补齐。']
      : ['领底需拆为独立差异裁片；袖口及两种袖衩尚缺源布纹。', '褶量及袖衩尺寸规则见部件组合报告；袖口仍有去褶后差值，门襟与翻折完成态尚需实现。'] };
}

/** Every executable template uses one complete, versioned structural method. */
export function getAssemblyDefinition(id: string, selection?: ConstructionSelection): AssemblyDefinition {
  if(id==='elastic-waist-pants')return pantsAssembly();
  if(id==='panel-circle-skirt')return circleSkirtAssembly(selection);
  if(id==='bound-tank')return tankAssembly();
  if(id==='hooded-zip-sweatshirt')return hoodieAssembly(selection);
  if (id === 'button-up-shirt') return shirt(selection);
  const engines = { 'brian-reference': 'brian', 't-shirt': 'teagan', 'womens-basic-tee': 'teagan', 'long-sleeve-tee': 'sven' } as const;
  if (!(id in engines)) throw new Error(`模板没有装配定义：${id}`);
  return basic(id, engines[id as keyof typeof engines]);
}
