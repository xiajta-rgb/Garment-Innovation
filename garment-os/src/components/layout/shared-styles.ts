import type { CSSProperties } from 'react';

/**
 * 共享 UI 样式
 * 顶部导航 / 视图切换等可复用样式
 */

/** 顶部导航按钮 (Save/Export 等) */
export const navBtnStyle: CSSProperties = {
  padding: '5px 14px',
  fontSize: 11,
  fontWeight: 500,
  borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  transition: 'all 0.15s',
};

/** 视图切换按钮 (Sketch/Pattern/Front/Back) */
export function viewToggleBtnStyle(isActive: boolean): CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  };
}
