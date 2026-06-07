import type { GenePathData } from '@/types/gene';

/**
 * 路径处理工具
 * 专供 GarmentSketch / VariantThumb 使用的 SVG 路径拆分函数
 */

/** 将包含多个 M 指令的 path 拆分为独立子路径 */
export function splitPaths(d: string): string[] {
  const paths: string[] = [];
  let current = '';
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!tokens) return [d];

  for (const token of tokens) {
    if (token.startsWith('M') && current) {
      paths.push(current.trim());
      current = token;
    } else {
      current += ' ' + token;
    }
  }
  if (current.trim()) paths.push(current.trim());
  return paths;
}

/**
 * 判断部件路径是否需要填充颜色
 * 修复 #6: 用显式字段判断 (pathData.category), 不再用字符串匹配
 * - 旧: pathData.id.includes('mandarin')  - 字符串硬编码, Block id 变了就失配
 * - 新: pathData.category === 'collar'  - 显式声明
 */
export function catDataHasFill(cat: string, pathData: GenePathData): boolean {
  // 优先用显式 category 字段, fallback 到 cat 字符串
  const pathCat = (pathData as any).category ?? cat;
  // 立领 (mandarin) 翻领 / 袖口 (turnback) 需要填充
  return pathCat === 'collar' || pathCat === 'cuff';
}
