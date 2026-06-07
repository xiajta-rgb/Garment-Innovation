/**
 * 模式纸样技术图导出 (Pattern Sheet Exporter)
 *
 * 商业化关键功能 - 产出可生产使用的 SVG 技术图:
 *  - 1:1 比例打印
 *  - 标题块 (Pattern 名/设计师/日期/尺码/比例/物料)
 *  - 比例尺 (scale bar)
 *  - 工业符号 (grain line/notch/dart/grain-line)
 *  - 净样线 (cutting line) vs 缝份线 (seam line) 区分
 *  - 图框 (A4/A3/Letter)
 *  - 部件编号 (1/5, 2/5 等)
 *
 * 参考: ASTM / AAMA 服装纸样技术图标准
 */

import type { GenePathData } from '@/types/gene';
import type { PatternDefinition } from '@/lib/patterns/types';

export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type ExportScale = 1 | 0.5 | 0.25;

export interface SheetExportOptions {
  /** 纸样名称 (默认 pattern.name) */
  patternName?: string;
  /** 设计师 (空 = 未署名) */
  designer?: string;
  /** 尺码 (S/M/L/XL) */
  size?: string;
  /** 性别 (male/female/unisex) */
  gender?: string;
  /** 纸张 */
  paperSize?: PaperSize;
  /** 比例 (1=1:1, 0.5=1:2, 0.25=1:4) */
  scale?: ExportScale;
  /** 面料估算 (米) - 用于标题块 */
  fabricEstimate?: number;
  /** 备注 */
  notes?: string;
}

/** 纸张尺寸 (mm) */
const PAPER_SIZES: Record<PaperSize, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A3:     { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
  Legal:  { w: 215.9, h: 355.6 },
};

/** 标题块尺寸 (mm) */
const TITLE_BLOCK = { w: 80, h: 50 };
/** 边框内边距 (mm) */
const MARGIN = 10;

/**
 * 生成生产级 SVG 技术图字符串
 */
export function generatePatternSheet(
  pattern: PatternDefinition,
  paths: GenePathData[],
  options: SheetExportOptions = {}
): string {
  const paper = PAPER_SIZES[options.paperSize ?? 'A4'];
  const scale = options.scale ?? 1;
  const margin = MARGIN;
  const tbW = TITLE_BLOCK.w;
  const tbH = TITLE_BLOCK.h;
  const now = new Date();

  // 视图框 (mm) - 含边框 + 标题块
  const viewW = paper.w;
  const viewH = paper.h;

  // ── 按 layer 分组路径 (用于层级渲染) ──
  const byLayer: Record<string, GenePathData[]> = {
    'cutting-line': [],
    'seam-line': [],
    'grain-line': [],
    'fold-line': [],
    'notch': [],
    'dart': [],
    'drill-hole': [],
    'stitch': [],
    'detail': [],
    'outline': [],
    'annotation': [],
  };
  for (const p of paths) {
    const layer = p.layer ?? 'outline';
    if (byLayer[layer]) byLayer[layer].push(p);
  }

  // ── 构造 SVG 内容 ──
  const pathElements: string[] = [];
  const LAYER_ORDER: Array<keyof typeof byLayer> = [
    'cutting-line', 'seam-line', 'grain-line', 'fold-line',
    'notch', 'dart', 'drill-hole', 'stitch', 'detail', 'outline', 'annotation',
  ];

  for (const layer of LAYER_ORDER) {
    const layerPaths = byLayer[layer];
    if (layerPaths.length === 0) continue;
    for (const p of layerPaths) {
      const stroke = p.stroke || '#000000';
      const sw = (p.strokeWidth ?? 0.8) * (layer === 'cutting-line' ? 1.5 : 1);
      const dash = p.strokeDasharray ? ` stroke-dasharray="${p.strokeDasharray}"` : '';
      const lc = p.strokeLinecap ? ` stroke-linecap="${p.strokeLinecap}"` : '';
      const fill = p.fill && p.fill !== 'none' ? p.fill : 'none';
      const tf = p.transform ? ` transform="${p.transform}"` : '';
      pathElements.push(
        `<path d="${p.data}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}${lc}${tf}/>`
      );
    }
  }

  // ── 标题块内容 ──
  const titleBlockX = paper.w - margin - tbW;
  const titleBlockY = paper.h - margin - tbH;

  // ── 图框 (绘制) ──
  const frameX = margin;
  const frameY = margin;
  const frameW = paper.w - margin * 2;
  const frameH = paper.h - margin * 2;

  // ── 比例尺 (左下角) ──
  const scaleBarX = margin + 5;
  const scaleBarY = paper.h - margin - 8;
  const scaleBarLen = 20; // 20mm 实际长, 表示 20mm
  const scaleBarLabel = `0  ${scaleBarLen}mm  ${scaleBarLen * 2}mm`;

  // ── 部件编号 + 计数 (右下角图例) ──
  const categories = new Set<string>();
  for (const p of paths) {
    if (p.category) categories.add(p.category);
  }
  const catLabels = Array.from(categories).join(' · ');

  // ── 整体 SVG ──
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${viewW} ${viewH}"
     width="${viewW}mm" height="${viewH}mm"
     version="1.1">
  <defs>
    <style>
      .title-text { font-family: 'Helvetica Neue', 'Arial', sans-serif; font-size: 3mm; fill: #000; }
      .title-bold { font-weight: 600; }
      .title-small { font-size: 2.2mm; fill: #444; }
      .scale-tick { stroke: #000; stroke-width: 0.3; }
      .scale-text { font-family: 'Helvetica Neue', sans-serif; font-size: 2mm; fill: #000; }
    </style>
  </defs>

  <!-- 纸面背景 (白色) -->
  <rect x="0" y="0" width="${viewW}" height="${viewH}" fill="#ffffff"/>

  <!-- 图框 (实线) -->
  <rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}"
        fill="none" stroke="#000" stroke-width="0.5"/>

  <!-- 内边框 (虚线, 距外框 5mm) -->
  <rect x="${frameX + 5}" y="${frameY + 5}" width="${frameW - 10}" height="${frameH - 10}"
        fill="none" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>

  <!-- 模式中心 (左上) -->
  <text x="${frameX + 5}" y="${frameY + 8}" class="title-text title-bold">${escapeXml(options.patternName ?? pattern.name)}</text>
  <text x="${frameX + 5}" y="${frameY + 13}" class="title-small">${escapeXml(pattern.description)}</text>

  <!-- 部件信息 (左上, 标题下方) -->
  <text x="${frameX + 5}" y="${frameY + 18}" class="title-small">
    Pattern ID: ${pattern.id} | Blocks: ${pattern.blocks.length} | Pieces: ${paths.length} | Categories: ${catLabels || '-'}
  </text>

  <!-- 路径内容 (平移 + 缩放, 让模型居中) -->
  <g transform="translate(${frameX + 30}, ${frameY + 30}) scale(${scale})">
    ${pathElements.join('\n    ')}
  </g>

  <!-- 比例尺 (左下) -->
  <g>
    <line x1="${scaleBarX}" y1="${scaleBarY}" x2="${scaleBarX + scaleBarLen * 2}" y2="${scaleBarY}" class="scale-tick"/>
    <line x1="${scaleBarX}" y1="${scaleBarY - 1.5}" x2="${scaleBarX}" y2="${scaleBarY + 1.5}" class="scale-tick"/>
    <line x1="${scaleBarX + scaleBarLen}" y1="${scaleBarY - 1.5}" x2="${scaleBarX + scaleBarLen}" y2="${scaleBarY + 1.5}" class="scale-tick"/>
    <line x1="${scaleBarX + scaleBarLen * 2}" y1="${scaleBarY - 1.5}" x2="${scaleBarX + scaleBarLen * 2}" y2="${scaleBarY + 1.5}" class="scale-tick"/>
    <text x="${scaleBarX + scaleBarLen}" y="${scaleBarY + 3.5}" text-anchor="middle" class="scale-text">${escapeXml(scaleBarLabel)}</text>
    <text x="${scaleBarX}" y="${scaleBarY - 2.5}" class="scale-small">SCALE 1:1</text>
  </g>

  <!-- 标题块 (右下) -->
  <g>
    <rect x="${titleBlockX}" y="${titleBlockY}" width="${tbW}" height="${tbH}"
          fill="#ffffff" stroke="#000" stroke-width="0.5"/>
    <!-- 内部网格 -->
    <line x1="${titleBlockX}" y1="${titleBlockY + 12}" x2="${titleBlockX + tbW}" y2="${titleBlockY + 12}" stroke="#000" stroke-width="0.3"/>
    <line x1="${titleBlockX}" y1="${titleBlockY + 24}" x2="${titleBlockX + tbW}" y2="${titleBlockY + 24}" stroke="#000" stroke-width="0.3"/>
    <line x1="${titleBlockX}" y1="${titleBlockY + 36}" x2="${titleBlockX + tbW}" y2="${titleBlockY + 36}" stroke="#000" stroke-width="0.3"/>
    <line x1="${titleBlockX + 30}" y1="${titleBlockY + 12}" x2="${titleBlockX + 30}" y2="${titleBlockY + tbH}" stroke="#000" stroke-width="0.3"/>
    <line x1="${titleBlockX + 55}" y1="${titleBlockY + 12}" x2="${titleBlockX + 55}" y2="${titleBlockY + tbH}" stroke="#000" stroke-width="0.3"/>

    <text x="${titleBlockX + 2}" y="${titleBlockY + 5}" class="title-text title-bold">PATTERN TITLE BLOCK</text>
    <text x="${titleBlockX + 32}" y="${titleBlockY + 9}" class="title-small">DATE</text>
    <text x="${titleBlockX + 57}" y="${titleBlockY + 9}" class="title-small">REV</text>

    <text x="${titleBlockX + 2}" y="${titleBlockY + 18}" class="title-small">NAME</text>
    <text x="${titleBlockX + 2}" y="${titleBlockY + 21}" class="title-text">${escapeXml(options.patternName ?? pattern.name)}</text>

    <text x="${titleBlockX + 32}" y="${titleBlockY + 18}" class="title-small">DATE</text>
    <text x="${titleBlockX + 32}" y="${titleBlockY + 21}" class="title-text">${now.toISOString().slice(0, 10)}</text>
    <text x="${titleBlockX + 57}" y="${titleBlockY + 18}" class="title-small">SIZE</text>
    <text x="${titleBlockX + 57}" y="${titleBlockY + 21}" class="title-text">${escapeXml(options.size ?? 'M')}</text>

    <text x="${titleBlockX + 2}" y="${titleBlockY + 30}" class="title-small">DESIGNER</text>
    <text x="${titleBlockX + 2}" y="${titleBlockY + 33}" class="title-text">${escapeXml(options.designer ?? 'Anonymous')}</text>
    <text x="${titleBlockX + 32}" y="${titleBlockY + 30}" class="title-small">SCALE</text>
    <text x="${titleBlockX + 32}" y="${titleBlockY + 33}" class="title-text">1:${Math.round(1 / scale)}</text>
    <text x="${titleBlockX + 57}" y="${titleBlockY + 30}" class="title-small">GENDER</text>
    <text x="${titleBlockX + 57}" y="${titleBlockY + 33}" class="title-text">${escapeXml(options.gender?.toUpperCase() ?? '-')}</text>

    <text x="${titleBlockX + 2}" y="${titleBlockY + 42}" class="title-small">FABRIC</text>
    <text x="${titleBlockX + 2}" y="${titleBlockY + 45}" class="title-text">${options.fabricEstimate ? `${options.fabricEstimate.toFixed(2)}m` : '-'}</text>
    <text x="${titleBlockX + 32}" y="${titleBlockY + 42}" class="title-small">NOTES</text>
    <text x="${titleBlockX + 32}" y="${titleBlockY + 45}" class="title-text">${escapeXml(options.notes ?? '-')}</text>
  </g>

  <!-- 版权 / 制作信息 (底部) -->
  <text x="${paper.w / 2}" y="${paper.h - 2}" text-anchor="middle" class="title-small">
    Generated by Garment-OS Pattern Studio | ${now.toISOString()}
  </text>
</svg>`;
}

/** 转义 XML 特殊字符 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 触发浏览器下载 SVG */
export function downloadPatternSheet(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 文件名生成: {pattern.id}-{size}-{date}.svg */
export function generateSheetFilename(pattern: PatternDefinition, size?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const sizePart = size ? `-${size}` : '';
  return `${pattern.id}${sizePart}-${date}.svg`;
}
