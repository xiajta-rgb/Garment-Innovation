/**
 * 袖子 Block (Sleeve Block) - view-aware + 真正消费锚点
 *
 * 修复 Issue 2: 真正使用 ctx.anchors 中的 sp-left/right, ap-left/right
 * 之前只是把锚点塞进 partCtx.parameters 但 generateSleeve 不读,
 * 现在改为: 锚点作为 partCtx.parameters 中的 _sp_*, _ap_* 前缀
 * 同时也直接给 generateSleeve 提供 sp_left_x/y 等具体坐标
 */

import type { BlockDefinition } from '../types';
import { generateSleeve } from '../../parametric/generators/sleeve';
import type { PartCtx } from '../../parametric/generators';

export const SleeveBlock: BlockDefinition = {
  id: 'sleeve-set-in',
  name: '装袖 (Set-in Sleeve)',
  category: 'sleeve',
  inputs: {
    anchors: ['sp-left', 'sp-right', 'ap-left', 'ap-right'],
    params: ['sleeveLength', 'cuffWidth', 'sleeveType'],
  },
  solve: (ctx) => {
    const p = ctx.params;
    const sp = ctx.anchors;

    // 修复 Issue 2: 真正消费锚点 (从 ctx.anchors 读取)
    const spR = sp['sp-right'] ?? { x: 132, y: 48 };
    const apR = sp['ap-right'] ?? { x: 128, y: 96 };
    const spL = sp['sp-left']  ?? { x: 68,  y: 48 };
    const apL = sp['ap-left']  ?? { x: 72,  y: 96 };

    const sleeveLength = Number(p.sleeveLength ?? 160);
    const cuffWidth = Number(p.cuffWidth ?? 12);

    // 修复 Issue 2: 锚点真实传入 generator (使用 sp_left_x/y, ap_left_x/y 等明确字段)
    // 袖子顶部位置 = 衣身肩点和袖窿底的中点
    // 袖子宽度 = 衣身袖窿宽度 (ap_left.x 到 ap_right.x)
    // 修复 Issue 3: 视图无关 (袖子前后镜像)
    const partCtx: PartCtx = {
      parameters: {
        sleeveType: String(p.sleeveType ?? 'long'),
        sleeveLength,
        cuffWidth,
        // 锚点真正驱动袖子位置
        sp_left_x: spL.x,  sp_left_y: spL.y,
        sp_right_x: spR.x, sp_right_y: spR.y,
        ap_left_x: apL.x,  ap_left_y: apL.y,
        ap_right_x: apR.x, ap_right_y: apR.y,
        // 派生: 袖子顶部 Y = min(sp, ap) - 1 (袖山高)
        // 袖子宽度 = 衣身 ap 宽度
        body_ap_width: apR.x - apL.x,
        body_sp_width: spR.x - spL.x,
        view: ctx.view ?? 'front',
      },
      anchors: ctx.anchors as any,
    };

    const paths = generateSleeve(partCtx.parameters, partCtx);

    // 推导袖口锚点
    const cuffY = spR.y + sleeveLength;
    return {
      paths,
      anchors: {
        // 袖口锚点 (cuff-block 通过 cuff-top-left/right 消费)
        'cuff-top-left':     { x: spL.x, y: spL.y + sleeveLength * 0.95 },
        'cuff-top-right':    { x: spR.x, y: spR.y + sleeveLength * 0.95 },
        'cuff-bottom-left':  { x: spL.x - cuffWidth * 0.3, y: cuffY },
        'cuff-bottom-right': { x: spR.x + cuffWidth * 0.3, y: cuffY },
      },
    };
  },
};
