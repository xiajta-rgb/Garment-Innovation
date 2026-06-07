/**
 * 领 Block (Collar Block)
 */

import type { BlockDefinition } from '../types';
import { generateCollar } from '../../parametric/generators/collar';
import type { PartCtx } from '../../parametric/generators';

export const CollarBlock: BlockDefinition = {
  id: 'collar-mandarin',
  name: '立领 (Mandarin Collar)',
  category: 'collar',
  inputs: {
    params: ['collarType', 'collarSpread', 'collarHeight'],
  },
  solve: (ctx) => {
    const p = ctx.params;
    const partCtx: PartCtx = {
      parameters: {
        collarType: String(p.collarType ?? 'round'),
        collarHeight: Number(p.collarHeight ?? 14),
        collarSpread: Number(p.collarSpread ?? 36),
        neckFrontY: Number(p.neckFrontY ?? 34),
      },
      anchors: ctx.anchors as any,
    };
    const paths = generateCollar(partCtx.parameters, partCtx);
    return { paths, anchors: {} };
  },
};
