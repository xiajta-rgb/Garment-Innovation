/**
 * 门襟 Block (Placket Block)
 */

import type { BlockDefinition } from '../types';
import { generatePlacket } from '../../parametric/generators/placket';
import type { PartCtx } from '../../parametric/generators';

export const PlacketBlock: BlockDefinition = {
  id: 'placket-center',
  name: '中开襟 (Center Placket)',
  category: 'placket',
  inputs: {
    params: ['placketType', 'placketWidth', 'buttonCount'],
  },
  solve: (ctx) => {
    const p = ctx.params;
    // 修复 #2+#4: BACK 视图不输出 placket (门襟只在前片)
    if (ctx.view === 'back') {
      return { paths: [], anchors: {} };
    }
    const partCtx: PartCtx = {
      parameters: {
        placketType: String(p.placketType ?? 'center'),
        placketWidth: Number(p.placketWidth ?? 6),
        buttonCount: Number(p.buttonCount ?? 5),
        neckFrontY: Number(p.neckFrontY ?? 34),
        hemLength: Number(p.hemLength ?? 224),
      },
      anchors: ctx.anchors as any,
    };
    const paths = generatePlacket(partCtx.parameters, partCtx);
    return { paths, anchors: {} };
  },
};
