/**
 * Block Library (版片库)
 *
 * 所有可用的 Block 在此集中注册
 * 新增 Block 只需: 1) 实现 BlockDefinition 2) 在此注册
 */

import type { BlockDefinition } from './types';
import { BrianBodiceBlock, BrianSleeveBlock } from './blocks/brian-blocks';
import { BodiceBlock } from './blocks/body-block';
import { SleeveBlock } from './blocks/sleeve-block';
import { CollarBlock } from './blocks/collar-block';
import { CuffBlock } from './blocks/cuff-block';
import { PlacketBlock } from './blocks/placket-block';
import { PocketBlock, NoPocketBlock } from './blocks/pocket-block';
import { BodiceAldrichBlock } from './blocks/bodice-aldrich-block';
import { SleeveAldrichBlock } from './blocks/sleeve-aldrich-block';
import { CollarAldrichBlock, PlacketAldrichBlock, CuffAldrichBlock, PocketAldrichBlock } from './blocks/parts-aldrich-blocks';

/** 全部 Block 索引 (按 ID) */
export const BLOCK_LIBRARY: Record<string, BlockDefinition> = {
  [BrianBodiceBlock.id]: BrianBodiceBlock,
  [BrianSleeveBlock.id]: BrianSleeveBlock,
  [BodiceBlock.id]:          BodiceBlock,
  [SleeveBlock.id]:          SleeveBlock,
  [CollarBlock.id]:          CollarBlock,
  [CuffBlock.id]:            CuffBlock,
  [PlacketBlock.id]:         PlacketBlock,
  [PocketBlock.id]:          PocketBlock,
  [NoPocketBlock.id]:        NoPocketBlock,
  [BodiceAldrichBlock.id]:   BodiceAldrichBlock,
  [SleeveAldrichBlock.id]:   SleeveAldrichBlock,
  [CollarAldrichBlock.id]:   CollarAldrichBlock,
  [PlacketAldrichBlock.id]:  PlacketAldrichBlock,
  [CuffAldrichBlock.id]:     CuffAldrichBlock,
  [PocketAldrichBlock.id]:   PocketAldrichBlock,
};

/** 列出所有 Block (UI 调试用) */
export function listBlocks(): BlockDefinition[] {
  return Object.values(BLOCK_LIBRARY);
}
