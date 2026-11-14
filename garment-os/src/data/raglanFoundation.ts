import type { AssemblyDefinition, BoundaryDefinition, BoundaryUse, JoinDefinition } from '@/types/assembly';
const edge = (id: string, label: string, role: BoundaryDefinition['role'], from: string, to: string, disposition: BoundaryDefinition['disposition'], stations?: [string, string]): BoundaryDefinition => ({ id, label, role, from, to, disposition, stations });
const port = (piece: string, boundary: string, reverse = false, runs = 1): BoundaryUse => ({ piece, boundary, reverse, runs, layers: 1 });
const f = 'hugo.front', b = 'hugo.back', s = 'hugo.sleeve';
/** Hugo is a long-sleeve hoodie source study. This is NOT a short-T drafting method. */
export function raglanFoundationDefinition(): AssemblyDefinition {
  const body = (back: boolean) => ({ id: back ? b : f, quantity: 1, onFold: true, source: `@freesewing/hugo@4.10.2/src/${back ? 'back' : 'front'}.mjs`, boundaries: [
    edge('hem', '原版接腰罗纹边', 'hem', back ? 'cbRibbing' : 'cfRibbing', 'ribbing', 'pending'),
    edge('side', '侧缝', 'side', 'ribbing', 'armhole', 'join', ['hem', 'underarm']),
    edge('raglan', back ? '后插肩缝' : '前插肩缝', back ? 'raglan-back' : 'raglan-front', 'armhole', back ? 'raglanTipBack' : 'raglanTipFront', 'join', ['underarm', back ? 'neck-back' : 'neck-front']),
    edge('neck', '衣身剩余领窝', 'neckline', back ? 'raglanTipBack' : 'raglanTipFront', back ? 'cbNeck' : 'cfNeck', 'pending'),
    edge('fold', '中心对折', 'fold', back ? 'cbNeck' : 'cfNeck', back ? 'cbRibbing' : 'cfRibbing', 'fold'),
  ] });
  const match = (id: string, label: string, a: BoundaryUse[], c: BoundaryUse[], role: JoinDefinition['roles'][0], toleranceMm: number): JoinDefinition => ({ id, label, a, b: c, roles: [role, role], rule: { kind: 'equal', toleranceMm: toleranceMm * a[0].runs, basis: `单条缝研究核对阈值${toleranceMm}mm，报告按${a[0].runs}条同版缝合计；非源版承诺或工厂公差；超差不修改源曲线、不放行短T` } });
  return { id: 'raglan-source-study', engine: 'hugo', version: '4.10.2', revision: 'raglan-study/v1', sleeveTopology: { family: 'raglan', front: f, back: b, sleeve: s }, pieces: [body(false), body(true),
    { id: s, quantity: 2, onFold: false, source: '@freesewing/hugo@4.10.2/src/sleeve.mjs', boundaries: [
      edge('neck', '袖片参与领圈的上端弧线', 'neckline', 'raglanTipBack', 'raglanTipFront', 'pending'),
      edge('raglan-front', '袖片前插肩边', 'raglan-front', 'raglanTipFront', 'bicepsLeft', 'join', ['neck-front', 'underarm']),
      edge('underarm-left', '袖底前边', 'underarm', 'bicepsLeft', 'wristLeft', 'join', ['underarm', 'cuff']),
      edge('hem', '原版接袖口罗纹边', 'hem', 'wristLeft', 'wristRight', 'pending'),
      edge('underarm-right', '袖底后边', 'underarm', 'wristRight', 'bicepsRight', 'join', ['cuff', 'underarm']),
      edge('raglan-back', '袖片后插肩边', 'raglan-back', 'bicepsRight', 'raglanTipBack', 'join', ['underarm', 'neck-back']),
    ] }], joins: [
      match('raglan-front', '两袖前插肩配缝', [port(f, 'raglan', false, 2)], [port(s, 'raglan-front', true, 2)], 'raglan-front', 2),
      match('raglan-back', '两袖后插肩配缝', [port(b, 'raglan', false, 2)], [port(s, 'raglan-back', false, 2)], 'raglan-back', 2),
      match('sides', '左右侧缝', [port(f, 'side', false, 2)], [port(b, 'side', false, 2)], 'side', .01),
      match('underarms', '两袖袖底合缝', [port(s, 'underarm-left', false, 2)], [port(s, 'underarm-right', true, 2)], 'underarm', .01),
    ], unresolved: ['仅研究前身、后身和长袖三种主体裁片，未包含原版帽、口袋及罗纹；不是完整服装组合。', '原版为连帽长袖，短袖长度、袖口折边及圆领领条需独立改版依据，禁止直接进入短T矩阵。'] };
}
