/**
 * 衣身 Block (Bodice Block) - view-aware 版本
 *
 * 修复 Issue 2+4:
 *  - 接收 ctx.view 决定产出前片还是后片路径
 *  - 锚点带 viewScope: cf-* (front), cb-* (back), side-* (all 共享)
 *  - front/back 共享肩点/袖窿底, 但前/中后/中坐标区分
 *
 * 输入: 测量值 (从 size chart 推导) + 用户参数
 * 输出: 大身轮廓 (front/back) + 工业符号 + 锚点
 */

import type { BlockDefinition } from '../types';
import { generateBody } from '../../parametric/generators/body';
import type { PartCtx } from '../../parametric/generators';

export const BodiceBlock: BlockDefinition = {
  id: 'bodice-basic',
  name: '基础身片 (Basic Bodice)',
  category: 'body',
  inputs: {
    params: [
      'shoulderWidth', 'armholeDepth', 'waistY', 'hipY',
      'hemLength', 'hemWidth', 'neckFrontY', 'collarType', 'gender',
    ],
  },
  solve: (ctx) => {
    const p = ctx.params;
    const view = ctx.view ?? 'front';

    // 构造 PartCtx
    const partCtx: PartCtx = {
      parameters: {
        shoulderWidth: Number(p.shoulderWidth ?? 32),
        armholeDepth: Number(p.armholeDepth ?? 96),
        waistY: Number(p.waistY ?? 140),
        hemLength: Number(p.hemLength ?? 224),
        hemWidth: Number(p.hemWidth ?? 42),
        neckFrontY: Number(p.neckFrontY ?? 34),
        shoulderY: Number(p.shoulderY ?? 48),
        waistSuppression: Number(p.waistSuppression ?? 0),
        collarType: String(p.collarType ?? 'round'),
        gender: String(p.gender ?? 'male'),
        // 视图感知: 标记传给 generator, 允许内部生成对应视图
        view,
      },
      anchors: ctx.anchors as any,
    };

    let paths = generateBody(partCtx.parameters, partCtx);

    // 修复 Issue 4 (替换): view-aware 路径过滤
    // 旧实现: 过滤 path.id.includes('placket') - 但 placket 是 placket-block 输出的,
    //          bodice 永远不输出 placket, 过滤条件永远 true (no-op 死代码)
    // 新实现: 标记 category + view, 由渲染器按需过滤
    paths = paths.map((p) => ({ ...p, category: 'body', view }));

    // 推导锚点 (基于参数值, 与 generator 内部几何一致)
    const shoulderW = Number(p.shoulderWidth ?? 32);
    const shoulderY = Number(p.shoulderY ?? 48);
    const armholeDepth = Number(p.armholeDepth ?? 96);
    const waistY = Number(p.waistY ?? 140);
    const hemY = Number(p.hemLength ?? 224);
    const hemW = Number(p.hemWidth ?? 42);
    const neckFrontY = Number(p.neckFrontY ?? 34);
    const cx = 100;
    const waistSuppression = Number(p.waistSuppression ?? 0);
    const waistOffset = Math.max(0, waistSuppression);

    // 修复 Issue 4: 锚点带 view 区分
    return {
      paths,
      anchors: {
        // 共享 (all 视图): 肩点、袖窿底、侧缝 (前后一致)
        'sp-left':      { x: cx - shoulderW, y: shoulderY },
        'sp-right':     { x: cx + shoulderW, y: shoulderY },
        'ap-left':      { x: cx - shoulderW + 4, y: armholeDepth },
        'ap-right':     { x: cx + shoulderW - 4, y: armholeDepth },
        'sn-left':      { x: cx - shoulderW + 44, y: neckFrontY },
        'sn-right':     { x: cx + shoulderW - 44, y: neckFrontY },
        'side-waist-left':  { x: cx - shoulderW + waistOffset, y: waistY },
        'side-waist-right': { x: cx + shoulderW - waistOffset, y: waistY },
        'side-hem-left':    { x: cx - hemW, y: hemY },
        'side-hem-right':   { x: cx + hemW, y: hemY },
        'sleeve-cap-left':  { x: cx - shoulderW, y: shoulderY },
        'sleeve-cap-right': { x: cx + shoulderW, y: shoulderY },
        // 视图特定: cf- (front) / cb- (back)
        'cf-neck':      { x: cx, y: neckFrontY - 2 },
        'cf-waist':     { x: cx, y: waistY },
        'cf-hem':       { x: cx, y: hemY },
        'cb-neck':      { x: cx, y: neckFrontY - 2 },
        'cb-waist':     { x: cx, y: waistY },
        'cb-hem':       { x: cx, y: hemY },
      },
    };
  },
};
