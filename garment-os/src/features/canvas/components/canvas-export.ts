/**
 * Canvas 导出/导入操作
 * 从 CanvasMenu.tsx 拆分的纯逻辑
 */

import { useParametricStore } from '@/store/parametricStore';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import {
  generatePatternSheet,
  downloadPatternSheet,
  generateSheetFilename,
} from '@/lib/svg-export/pattern-sheet-exporter';
import {
  serializePattern,
  downloadPatternJSON,
  selectPatternFile,
  generateFilename,
} from '@/lib/pattern/pattern-io';

/** 导出 PNG (2x 高清) */
export function exportPNG(canvasId: string): void {
  const container = document.getElementById(canvasId);
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'garment-design.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.src = url;
}

/** 导出 SVG */
export function exportSVG(canvasId: string): void {
  const container = document.getElementById(canvasId);
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const svgData = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'garment-design.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 导出技术图 Pattern Sheet */
export function exportPatternSheet(): void {
  const state = useParametricStore.getState();
  const pattern = PATTERN_LIBRARY[state.activePatternId];
  if (!pattern) return;
  const sheet = generatePatternSheet(pattern, state.patternPaths);
  const filename = generateSheetFilename(pattern);
  downloadPatternSheet(sheet, filename);
}

/** 导出 Pattern JSON */
export function exportPatternJSON(): void {
  const state = useParametricStore.getState();
  const pattern = PATTERN_LIBRARY[state.activePatternId];
  if (!pattern) return;
  const json = serializePattern(pattern);
  const filename = generateFilename(pattern);
  downloadPatternJSON(json, filename);
}

/** 导入 Pattern JSON */
export async function importPatternJSON(): Promise<{ msg: string; ok: boolean }> {
  try {
    const envelope = await selectPatternFile();
    const pattern = envelope.pattern;
    PATTERN_LIBRARY[pattern.id] = pattern;
    useParametricStore.getState().applyPattern(pattern.id);
    return { msg: `已导入: ${pattern.name}`, ok: true };
  } catch (err) {
    return {
      msg: `导入失败: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    };
  }
}

/** 复制 SVG 到剪贴板 */
export async function copySVGToClipboard(canvasId: string): Promise<void> {
  const container = document.getElementById(canvasId);
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;
  const svgData = new XMLSerializer().serializeToString(svgEl);
  try {
    await navigator.clipboard.writeText(svgData);
  } catch {
    // fallback: 静默失败
  }
}
