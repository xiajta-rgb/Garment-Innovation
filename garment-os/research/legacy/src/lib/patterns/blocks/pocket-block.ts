/**
 * 口袋 Block (Pocket Block)
 */

import type { BlockDefinition } from '../types';
import { generatePocket } from '../../parametric/generators/pocket';
import type { PartCtx } from '../../parametric/generators';

export const PocketBlock: BlockDefinition = {
  id: 'pocket-patch',
  name: '贴袋 (Patch Pocket)',
  category: 'pocket',
  inputs: {
    params: ['pocketType', 'pocketWidth', 'pocketHeight', 'pocketY'],
  },
  solve: (ctx) => {
    const p = ctx.params;
    // 修复 #2+#4: BACK 视图不输出贴袋 (通常贴袋在前片, 后片无)
    if (ctx.view === 'back') {
      return { paths: [], anchors: {} };
    }
    const partCtx: PartCtx = {
      parameters: {
        pocketType: String(p.pocketType ?? 'none'),
        pocketWidth: Number(p.pocketWidth ?? 26),
        pocketHeight: Number(p.pocketHeight ?? 36),
        pocketY: Number(p.pocketY ?? 0),  // 0 表示使用默认位置 (腰线下方)
      },
      anchors: ctx.anchors as any,
    };
    const paths = generatePocket(partCtx.parameters, partCtx);
    return { paths, anchors: {} };
  },
};

/** 出口 ID (无口袋) - 空 Block 变体 */
export const NoPocketBlock: BlockDefinition = {
  ...PocketBlock,
  id: 'pocket-none',
  name: '无口袋 (No Pocket)',
  solve: () => ({ paths: [], anchors: {} }),
};
