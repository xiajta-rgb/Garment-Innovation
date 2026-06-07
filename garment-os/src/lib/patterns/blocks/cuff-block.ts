/**
 * 袖口 Block (Cuff Block)
 */

import type { BlockDefinition } from '../types';
import { generateCuff } from '../../parametric/generators/cuff';
import type { PartCtx } from '../../parametric/generators';

export const CuffBlock: BlockDefinition = {
  id: 'cuff-plain',
  name: '普通袖口 (Plain Cuff)',
  category: 'cuff',
  inputs: {
    params: ['cuffType', 'cuffHeight'],
  },
  solve: (ctx) => {
    const p = ctx.params;
    const partCtx: PartCtx = {
      parameters: {
        cuffType: String(p.cuffType ?? 'plain'),
        cuffHeight: Number(p.cuffHeight ?? 14),
        cuffWidth: Number(p.cuffWidth ?? 12),
      },
      anchors: ctx.anchors as any,
    };
    const paths = generateCuff(partCtx.parameters, partCtx);
    return { paths, anchors: {} };
  },
};
