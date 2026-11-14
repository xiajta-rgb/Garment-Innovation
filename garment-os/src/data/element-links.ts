/**
 * ─────────────────────────────────────────────────────────────
 *  元素标准化映射层 (Element Linkage)
 * ─────────────────────────────────────────────────────────────
 *
 *  约定: 任何模板/部件/面料/廓形都不是"随意画的形状",
 *  必须有注册表条目 (sourceId) 并映射到洞察库飞书记录:
 *
 *    patternId  → garment-os://pattern/<id>
 *    blockId    → garment-os://block/<id>
 *    fit        → garment-os://fit/<fit>
 *    fabricId   → garment-os://fabric/<id>
 *
 *  设计沉淀的裁片 → garment-os://cutpiece/<designId>/<pieceId>
 */

import { ELEMENT_TABLE_COORDS, getElementFeishuRecordId } from './elementRegistry';

export const patternElementSourceId = (patternId: string) => `garment-os://pattern/${patternId}`;
export const blockElementSourceId = (blockId: string) => `garment-os://block/${blockId}`;
export const fitElementSourceId = (fit: string) => `garment-os://fit/${fit}`;
export const fabricElementSourceId = (fabricId: string) => `garment-os://fabric/${fabricId}`;
export const cutpieceElementSourceId = (designId: string, pieceId: string) =>
  `garment-os://cutpiece/${designId}/${pieceId}`;

/** 模板是否已在洞察库注册 */
export function isPatternRegistered(patternId: string): boolean {
  return !!getElementFeishuRecordId(patternElementSourceId(patternId));
}

/** 模板的飞书记录深链 (未注册返回表链接) */
export function patternFeishuUrl(patternId: string): string {
  return ELEMENT_TABLE_COORDS.recordUrl(patternElementSourceId(patternId));
}

/** 部件是否已注册 */
export function isBlockRegistered(blockId: string): boolean {
  return !!getElementFeishuRecordId(blockElementSourceId(blockId));
}
