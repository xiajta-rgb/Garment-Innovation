/**
 * 面料/颜色数据
 * 设计稿的颜色选择器和面料纹理选择器使用
 */

/** 标准面料颜色 (30色) */
export const FABRIC_COLORS: string[] = [
  '#FFFFFF', '#F5F5DC', '#FAEBD7', '#FFE4C4', '#FFDAB9',
  '#D2691E', '#8B4513', '#A0522D', '#2F4F4F', '#000000',
  '#FF0000', '#DC143C', '#FF4500', '#FF6347', '#FFA07A',
  '#FFD700', '#FFFF00', '#ADFF2F', '#32CD32', '#008000',
  '#00CED1', '#1E90FF', '#0000CD', '#4B0082', '#8B008B',
  '#FF1493', '#C71585', '#DDA0DD', '#BC8F8F', '#808080',
];

/** 面料纹理预设 */
export interface FabricPattern {
  id: string;
  name: string;
  /** CSS 背景样式 */
  bg: string;
}

export const FABRIC_PATTERNS: FabricPattern[] = [
  { id: 'solid', name: 'Solid', bg: '#87CEEB' },
  { id: 'stripe', name: 'Stripe', bg: 'repeating-linear-gradient(90deg, #87CEEB 0px, #87CEEB 4px, #fff 4px, #fff 8px)' },
  { id: 'plaid', name: 'Plaid', bg: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,0,0,0.2) 8px, rgba(255,0,0,0.2) 9px), repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,0,0,0.2) 8px, rgba(255,0,0,0.2) 9px), #87CEEB' },
  { id: 'dots', name: 'Dots', bg: 'radial-gradient(circle 2px, #333 100%, transparent 100%) 0 0 / 12px 12px, #87CEEB' },
  { id: 'floral', name: 'Floral', bg: 'radial-gradient(circle 3px at 30% 30%, #ff69b4 100%, transparent 100%), radial-gradient(circle 3px at 70% 70%, #ff69b4 100%, transparent 100%), #fff0f5' },
  { id: 'denim', name: 'Denim', bg: 'repeating-linear-gradient(45deg, #4169e1 0px, #4169e1 1px, #5b7fd6 1px, #5b7fd6 3px)' },
];
