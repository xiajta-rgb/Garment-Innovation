/**
 * Canvas 导出/导入操作
 * 从 CanvasMenu.tsx 拆分的纯逻辑
 */

import { downloadText,selectPatternFile } from '@/features/files/browser-files';
import { useDesignStore } from '@/store/useDesignStore';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { requireReviewedPattern } from '@/data/patternReview';
import { newCompanyStyle } from '@/lib/pattern/company-style';
import { exportCompanyStyleSvg } from '@/lib/pattern/company-style-drawing';
import { resolveReviewedImport } from '@/application/pattern-transfer';
import { createAssemblyRecord } from '@/application/assembly-record';
import {
  generatePatternSheet,
  generateSheetFilename,
} from '@/lib/svg-export/pattern-sheet-exporter';
import {
  serializePattern,
  generateFilename,
} from '@/lib/pattern/pattern-format';

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
export function exportSVG(canvasId: string): boolean {
  if(canvasId==='sketch-canvas'){
    const currentExport=document.querySelector<HTMLButtonElement>('[data-workbench-export]');
    if(currentExport){if(currentExport.disabled)return false;currentExport.click();return true;}
  }
  if(canvasId==='sketch-canvas'&&document.getElementById('company-design-board')){
    const d=useDesignStore.getState().companyDraft??newCompanyStyle();
    downloadText(exportCompanyStyleSvg(d),(d.styleCode||'公司母版')+'-设计草案.svg','image/svg+xml;charset=utf-8');return true;
  }
  const container = document.getElementById(canvasId);
  if (!container) return false;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return false;

  const svgData = new XMLSerializer().serializeToString(svgEl);
  downloadText(svgData,'garment-design.svg','image/svg+xml;charset=utf-8');
  return true;
}

/** 导出技术图 Pattern Sheet */
export function exportPatternSheet(): void {
  const state = useDesignStore.getState();
  const pattern = PATTERN_LIBRARY[state.activePatternId];
  if (!pattern) return;
  createAssemblyRecord(state.getConfiguration(),state.draft);
  const sheet = generatePatternSheet(pattern, state.draft.paths, {construction:state.construction});
  const filename = generateSheetFilename(pattern);
  downloadText(sheet,filename,'image/svg+xml;charset=utf-8');
}

/** 导出 Pattern JSON */
export function exportPatternJSON(): void {
  const state = useDesignStore.getState();
  const pattern = PATTERN_LIBRARY[state.activePatternId];
  if (!pattern) return;
  requireReviewedPattern(pattern.id);
  const json = serializePattern(pattern, { measurements: state.measurements, gender: state.gender, fit: state.fit, standardSize: state.standardSize, engineVersion: '4.10.2', construction: state.construction });
  resolveReviewedImport(JSON.parse(json));
  const filename = generateFilename(pattern);
  downloadText(json,filename,'application/json');
}

/** 导入 Pattern JSON */
export async function importPatternJSON(): Promise<{ msg: string; ok: boolean }> {
  try {
    const envelope = await selectPatternFile();
    const pattern = envelope.pattern;
    useDesignStore.getState().restorePatternInputs(envelope);
    return { msg: `已恢复模板和原始尺寸: ${pattern.name}`, ok: true };
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
