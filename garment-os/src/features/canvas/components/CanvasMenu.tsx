import { useState, useRef, useEffect, useCallback } from 'react';
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

interface CanvasMenuProps {
  /** 画布 DOM 容器 ID (用于查询内部 SVG 元素) */
  canvasId: string;
  /**
   * 画布能力 - 决定哪些导出选项显示
   *  - sketch-canvas: { svg: true, png: true, sheet: true } (有 SVG)
   *  - pattern-canvas: { sheet: true } (Konva 无 SVG)
   * 修复 #1+#7: pattern-canvas 不再静默失败, 菜单自动调整
   */
  capabilities?: { svg?: boolean; png?: boolean; sheet?: boolean };
}

/**
 * 画布三点菜单
 *
 * 商业化基础功能:
 *  - Export PNG (2x 高清导出)
 *  - Export SVG (矢量导出) - 单页 SVG
 *  - Export Pattern Sheet (技术图导出) - 含标题块/比例尺/纸样片编号
 *  - Export Pattern JSON (模板文件) - 可分享/导入
 *  - Import Pattern JSON (加载外部模板)
 *  - Copy SVG (复制到剪贴板)
 */
export function CanvasMenu({ canvasId, capabilities }: CanvasMenuProps) {
  const [open, setOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 默认所有能力开启
  const caps = { svg: true, png: true, sheet: true, ...capabilities };

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 3 秒后自动清除 import status
  useEffect(() => {
    if (!importStatus) return;
    const t = setTimeout(() => setImportStatus(null), 3000);
    return () => clearTimeout(t);
  }, [importStatus]);

  const exportPNG = useCallback(() => {
    setOpen(false);
    const container = document.getElementById(canvasId);
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);

    // 修复: 动态读取 SVG viewBox (而非硬编码 400x560), 避免 PNG 比例变形
    // SVG viewBox 格式: "minX minY width height"
    const viewBox = (svgEl.getAttribute('viewBox') || '0 0 400 560').split(/\s+/).map(Number);
    const [, , vbW = 400, vbH = 560] = viewBox;
    const scale = 2; // 2x 高清
    const canvas = document.createElement('canvas');
    canvas.width = vbW * scale;
    canvas.height = vbH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const link = document.createElement('a');
        link.download = `${canvasId}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        // 修复: taint 防护 - 如果 SVG 引用了外部资源, canvas 会变 "tainted",
        // toDataURL 抛 SecurityError, 这里降级为提示
        setImportStatus({
          msg: 'PNG 导出失败: SVG 含外部资源, 请用 SVG 导出',
          ok: false,
        });
      }
    };
    img.onerror = () => {
      setImportStatus({ msg: 'PNG 导出失败: SVG 解析错误', ok: false });
    };
    // 修复: 不嵌入 base64, 避免 btoa 字符范围问题; 直接 data URL
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  }, [canvasId]);

  const exportSVG = useCallback(() => {
    setOpen(false);
    const container = document.getElementById(canvasId);
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `${canvasId}-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [canvasId]);

  /** 生产级 Pattern Sheet 导出 (含标题块/比例尺/技术图符号) */
  const exportPatternSheet = useCallback(() => {
    setOpen(false);
    const state = useParametricStore.getState();
    const pattern = PATTERN_LIBRARY[state.activePatternId];
    if (!pattern || state.patternPaths.length === 0) {
      setImportStatus({ msg: '请先选择一个 Pattern', ok: false });
      return;
    }
    const svg = generatePatternSheet(pattern, state.patternPaths, {
      patternName: state.designName || pattern.name,
      designer: 'Anonymous',
      size: state.standardSize,
      gender: state.gender,
      paperSize: 'A4',
      scale: 1,
    });
    downloadPatternSheet(svg, generateSheetFilename(pattern, state.standardSize));
    setImportStatus({ msg: '技术图已导出', ok: true });
  }, []);

  /** 导出 Pattern JSON (模板文件) */
  const exportPatternJSON = useCallback(() => {
    setOpen(false);
    const state = useParametricStore.getState();
    const pattern = PATTERN_LIBRARY[state.activePatternId];
    if (!pattern) {
      setImportStatus({ msg: '请先选择一个 Pattern', ok: false });
      return;
    }
    const json = serializePattern(
      pattern,
      {
        gender: state.gender,
        fit: state.fit,
        measurements: state.measurements,
      },
      'Anonymous'
    );
    downloadPatternJSON(json, generateFilename(pattern, state.standardSize));
    setImportStatus({ msg: '模板已导出', ok: true });
  }, []);

  /** 导入 Pattern JSON (外部模板) */
  const importPatternJSON = useCallback(async () => {
    setOpen(false);
    try {
      const envelope = await selectPatternFile();
      const pattern = envelope.pattern;
      // 注册到运行时 library (注意: 不会持久化, 仅当前会话可用)
      PATTERN_LIBRARY[pattern.id] = pattern;
      // 应用
      useParametricStore.getState().applyPattern(pattern.id);
      setImportStatus({ msg: `已导入: ${pattern.name}`, ok: true });
    } catch (err) {
      setImportStatus({
        msg: `导入失败: ${err instanceof Error ? err.message : String(err)}`,
        ok: false,
      });
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    setOpen(false);
    const container = document.getElementById(canvasId);
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    try {
      await navigator.clipboard.writeText(svgData);
    } catch {
      // fallback
    }
  }, [canvasId]);

  return (
    <>
      {importStatus && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 44,
            zIndex: 21,
            background: importStatus.ok ? '#1a5e20' : '#b71c1c',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {importStatus.msg}
        </div>
      )}
      <div ref={menuRef} style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            border: 'none',
            background: open ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
            color: open ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.opacity = '0.7'; }}
          title="Export"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="3" r="1.2" />
            <circle cx="7" cy="7" r="1.2" />
            <circle cx="7" cy="11" r="1.2" />
          </svg>
        </button>

        {open && (
          <div style={{
            position: 'absolute',
            top: 32,
            right: 0,
            minWidth: 200,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 16px var(--shadow)',
            overflow: 'hidden',
            padding: '4px 0',
          }}>
            <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Export
            </div>
            {caps.sheet && <MenuItem label="技术图 SVG (1:1 可打印)" onClick={exportPatternSheet} />}
            <MenuItem label="Pattern JSON (模板分享)" onClick={exportPatternJSON} />
            {(caps.svg || caps.png) && <MenuDivider />}
            {(caps.svg || caps.png) && (
              <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Quick Export
              </div>
            )}
            {caps.png && <MenuItem label="Export PNG" onClick={exportPNG} />}
            {caps.svg && <MenuItem label="Export SVG" onClick={exportSVG} />}
            {caps.svg && <MenuItem label="Copy SVG" onClick={copyToClipboard} />}
            <MenuDivider />
            <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Import
            </div>
            <MenuItem label="导入 Pattern JSON..." onClick={importPatternJSON} />
          </div>
        )}
      </div>
    </>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 12px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-secondary)',
        fontSize: 11,
        cursor: 'pointer',
        transition: 'all 0.1s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent-dim)';
        e.currentTarget.style.color = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
}
