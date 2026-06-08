/**
 * 画布三点菜单
 *
 * 商业化基础功能:
 *  - Export PNG / SVG / Pattern Sheet / Pattern JSON
 *  - Import Pattern JSON
 *  - Copy SVG
 *
 * 导出逻辑已拆分至 canvas-export.ts
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  exportPNG,
  exportSVG,
  exportPatternSheet,
  exportPatternJSON,
  importPatternJSON,
  copySVGToClipboard,
} from './canvas-export';

interface CanvasMenuProps {
  canvasId: string;
  capabilities?: { svg?: boolean; png?: boolean; sheet?: boolean };
}

export function CanvasMenu({ canvasId, capabilities }: CanvasMenuProps) {
  const [open, setOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const caps = { svg: true, png: true, sheet: true, ...capabilities };

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

  const handleExportPNG = useCallback(() => {
    setOpen(false);
    exportPNG(canvasId);
  }, [canvasId]);

  const handleExportSVG = useCallback(() => {
    setOpen(false);
    exportSVG(canvasId);
  }, [canvasId]);

  const handleExportSheet = useCallback(() => {
    setOpen(false);
    exportPatternSheet();
  }, []);

  const handleExportJSON = useCallback(() => {
    setOpen(false);
    exportPatternJSON();
  }, []);

  const handleImportJSON = useCallback(async () => {
    setOpen(false);
    const result = await importPatternJSON();
    setImportStatus(result);
  }, []);

  const handleCopySVG = useCallback(async () => {
    setOpen(false);
    await copySVGToClipboard(canvasId);
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
            {caps.sheet && <MenuItem label="技术图 SVG (1:1 可打印)" onClick={handleExportSheet} />}
            <MenuItem label="Pattern JSON (模板分享)" onClick={handleExportJSON} />
            {(caps.svg || caps.png) && <MenuDivider />}
            {(caps.svg || caps.png) && (
              <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                Quick Export
              </div>
            )}
            {caps.png && <MenuItem label="Export PNG" onClick={handleExportPNG} />}
            {caps.svg && <MenuItem label="Export SVG" onClick={handleExportSVG} />}
            {caps.svg && <MenuItem label="Copy SVG" onClick={handleCopySVG} />}
            <MenuDivider />
            <div style={{ padding: '4px 12px', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Import
            </div>
            <MenuItem label="导入 Pattern JSON..." onClick={handleImportJSON} />
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
        color: 'var(--text-primary)',
        fontSize: 11,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
}
