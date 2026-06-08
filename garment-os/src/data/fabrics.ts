/**
 * 面料/颜色数据
 * 设计稿的颜色选择器和面料纹理选择器使用
 */

/** 颜色条目 (含中文名 + 色系分组) */
export interface FabricColor {
  hex: string;
  name: string;
  group: 'white' | 'beige' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray' | 'black';
}

/** 标准面料颜色 (30色, 含中文名) */
export const FABRIC_COLORS: FabricColor[] = [
  { hex: '#FFFFFF', name: '纯白', group: 'white' },
  { hex: '#F5F5DC', name: '米色', group: 'beige' },
  { hex: '#FAEBD7', name: '古白', group: 'beige' },
  { hex: '#FFE4C4', name: '麦色', group: 'beige' },
  { hex: '#FFDAB9', name: '桃色', group: 'beige' },
  { hex: '#D2691E', name: '巧克力', group: 'brown' },
  { hex: '#8B4513', name: '鞍棕', group: 'brown' },
  { hex: '#A0522D', name: '赭石', group: 'brown' },
  { hex: '#2F4F4F', name: '暗灰绿', group: 'gray' },
  { hex: '#000000', name: '纯黑', group: 'black' },
  { hex: '#FF0000', name: '大红', group: 'red' },
  { hex: '#DC143C', name: '猩红', group: 'red' },
  { hex: '#FF4500', name: '橘红', group: 'orange' },
  { hex: '#FF6347', name: '番茄红', group: 'red' },
  { hex: '#FFA07A', name: '浅鲑', group: 'orange' },
  { hex: '#FFD700', name: '金色', group: 'yellow' },
  { hex: '#FFFF00', name: '明黄', group: 'yellow' },
  { hex: '#ADFF2F', name: '黄绿', group: 'green' },
  { hex: '#32CD32', name: '酸橙绿', group: 'green' },
  { hex: '#008000', name: '深绿', group: 'green' },
  { hex: '#00CED1', name: '暗松石', group: 'blue' },
  { hex: '#1E90FF', name: '道奇蓝', group: 'blue' },
  { hex: '#0000CD', name: '中蓝', group: 'blue' },
  { hex: '#4B0082', name: '靛蓝', group: 'purple' },
  { hex: '#8B008B', name: '暗洋红', group: 'purple' },
  { hex: '#FF1493', name: '深粉', group: 'pink' },
  { hex: '#C71585', name: '中紫红', group: 'pink' },
  { hex: '#DDA0DD', name: '梅色', group: 'pink' },
  { hex: '#BC8F8F', name: '玫瑰棕', group: 'brown' },
  { hex: '#808080', name: '中灰', group: 'gray' },
];

/** 向后兼容: 纯 hex 数组 */
export const FABRIC_COLOR_HEXES: string[] = FABRIC_COLORS.map((c) => c.hex);

/** 面料纹理预设 */
export interface FabricPattern {
  id: string;
  name: string;
  /** CSS 背景样式 */
  bg: string;
  /** SVG pattern 定义 (用于成衣渲染) */
  svgPattern: string;
}

export const FABRIC_PATTERNS: FabricPattern[] = [
  {
    id: 'solid',
    name: 'Solid',
    bg: '#87CEEB',
    svgPattern: '',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    bg: 'repeating-linear-gradient(90deg, #87CEEB 0px, #87CEEB 4px, #fff 4px, #fff 8px)',
    svgPattern: '<pattern id="fabric-stripe" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="8" fill="currentColor"/><rect x="4" width="4" height="8" fill="rgba(255,255,255,0.5)"/></pattern>',
  },
  {
    id: 'plaid',
    name: 'Plaid',
    bg: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,0,0,0.2) 8px, rgba(255,0,0,0.2) 9px), repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,0,0,0.2) 8px, rgba(255,0,0,0.2) 9px), #87CEEB',
    svgPattern: '<pattern id="fabric-plaid" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="currentColor"/><rect width="8" height="16" fill="rgba(255,255,255,0.15)"/><rect width="16" height="8" fill="rgba(255,255,255,0.15)"/><line x1="8" y1="0" x2="8" y2="16" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/><line x1="0" y1="8" x2="16" y2="8" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/></pattern>',
  },
  {
    id: 'dots',
    name: 'Dots',
    bg: 'radial-gradient(circle 2px, #333 100%, transparent 100%) 0 0 / 12px 12px, #87CEEB',
    svgPattern: '<pattern id="fabric-dots" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="currentColor"/><circle cx="6" cy="6" r="2" fill="rgba(0,0,0,0.2)"/></pattern>',
  },
  {
    id: 'floral',
    name: 'Floral',
    bg: 'radial-gradient(circle 3px at 30% 30%, #ff69b4 100%, transparent 100%), radial-gradient(circle 3px at 70% 70%, #ff69b4 100%, transparent 100%), #fff0f5',
    svgPattern: '<pattern id="fabric-floral" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="currentColor"/><circle cx="6" cy="6" r="2.5" fill="rgba(255,105,180,0.3)"/><circle cx="16" cy="16" r="2.5" fill="rgba(255,105,180,0.3)"/><circle cx="16" cy="6" r="1.5" fill="rgba(255,105,180,0.2)"/></pattern>',
  },
  {
    id: 'denim',
    name: 'Denim',
    bg: 'repeating-linear-gradient(45deg, #4169e1 0px, #4169e1 1px, #5b7fd6 1px, #5b7fd6 3px)',
    svgPattern: '<pattern id="fabric-denim" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="currentColor"/><rect x="2" width="2" height="4" fill="rgba(255,255,255,0.15)"/></pattern>',
  },
];

/** 根据 fabricId 获取 SVG pattern 定义 */
export function getFabricSvgPattern(fabricId: string): string {
  const pattern = FABRIC_PATTERNS.find((p) => p.id === fabricId);
  return pattern?.svgPattern ?? '';
}

/** 根据 hex 获取颜色名称 */
export function getColorName(hex: string): string {
  const color = FABRIC_COLORS.find((c) => c.hex === hex);
  return color?.name ?? hex;
}
