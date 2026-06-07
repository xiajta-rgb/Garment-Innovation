/**
 * Block Library (版片库)
 *
 * 所有可用的 Block 在此集中注册
 * 新增 Block 只需: 1) 实现 BlockDefinition 2) 在此注册
 */

import type { BlockDefinition } from './types';
import { BodiceBlock } from './blocks/body-block';
import { SleeveBlock } from './blocks/sleeve-block';
import { CollarBlock } from './blocks/collar-block';
import { CuffBlock } from './blocks/cuff-block';
import { PlacketBlock } from './blocks/placket-block';
import { PocketBlock, NoPocketBlock } from './blocks/pocket-block';

/** 全部 Block 索引 (按 ID) */
export const BLOCK_LIBRARY: Record<string, BlockDefinition> = {
  [BodiceBlock.id]:   BodiceBlock,
  [SleeveBlock.id]:   SleeveBlock,
  [CollarBlock.id]:   CollarBlock,
  [CuffBlock.id]:     CuffBlock,
  [PlacketBlock.id]:  PlacketBlock,
  [PocketBlock.id]:   PocketBlock,
  [NoPocketBlock.id]: NoPocketBlock,
};

/** 列出所有 Block (UI 调试用) */
export function listBlocks(): BlockDefinition[] {
  return Object.values(BLOCK_LIBRARY);
}
