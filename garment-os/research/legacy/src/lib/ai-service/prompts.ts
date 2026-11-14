/**
 * 服装设计 Prompt 模板
 *
 * 商业化场景: 用户输入文字描述 → AI 给出具体可应用的服装设计建议
 * - 推荐的 Block 组合 (映射到 patternLibrary 中的 Block ID)
 * - 推荐的颜色
 * - 推荐的面料
 * - 简短的设计说明
 *
 * 约束: AI 输出必须是严格 JSON, 方便 parseJsonFromContent 解析
 */

import type { ChatMessage } from './minimax-client';

export const DESIGN_SYSTEM_PROMPT = `你是 Garment-OS 服装设计平台的 AI 设计助理。你的职责是根据用户的自然语言需求, 推荐具体的服装设计方案。

你的输出必须是严格的 JSON, 不能包含其他文字, 不要用 markdown 包裹。

JSON 结构:
{
  "name": "简洁的服装名称 (例如: '夏日通勤衬衫')",
  "description": "一句话描述 (中文, 20字以内)",
  "category": "t-shirt" | "polo" | "shirt" | "jacket" | "dress" | "skirt" | "pants" 之一,
  "blocks": [
    { "blockId": "bodice-basic" | "sleeve-set-in" | "collar-mandarin" | "cuff-plain" | "placket-center" | "pocket-patch" | "pocket-none" 之一, "params": { ... 可选 ... } }
  ],
  "colorSuggestions": ["#FFFFFF", "#87CEEB", ...],  // 3-5 个 hex 颜色
  "fabricSuggestions": ["棉", "麻", "丝", "羊毛", ...],  // 2-3 种面料
  "rationale": "为什么这个设计适合用户的需求 (中文, 30-50 字)"
}

Block 选型指南:
- bodice-basic: 衣身, 任何上衣都需要
- sleeve-set-in: 袖子, 需要袖子时
- collar-mandarin: 立领 / 圆领 / V 领 (通过 collarType 区分)
- cuff-plain: 袖口, 长袖时
- placket-center: 门襟, 有扣子的衬衫
- pocket-patch: 贴袋, 需要口袋
- pocket-none: 无口袋

Block 顺序: 衣身 → 袖 → 领 → 袖口 → 门襟 → 袋

风格建议:
- 简约通勤: T-Shirt 或 Polo, 短袖, 圆领, 无门襟
- 商务正式: Button-Up Shirt, 长袖, 立领, 5 粒扣门襟
- 休闲周末: T-Shirt + 贴袋
- 优雅女性: Women's Blouse, 短袖, 圆领, 贴袋
`;

/** 构造用户消息 */
export function buildDesignPrompt(userInput: string): ChatMessage[] {
  return [
    { role: 'system', content: DESIGN_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `我的设计需求: ${userInput}

请按 JSON 结构给出推荐方案, 严格只输出 JSON, 不要其他说明文字。`,
    },
  ];
}

/** 设计建议类型 (与 system prompt 中的 JSON 结构对应) */
export interface DesignSuggestion {
  name: string;
  description: string;
  category: 't-shirt' | 'polo' | 'shirt' | 'jacket' | 'dress' | 'skirt' | 'pants';
  blocks: Array<{
    blockId: string;
    params?: Record<string, number | string | boolean>;
  }>;
  colorSuggestions: string[];
  fabricSuggestions: string[];
  rationale: string;
}
