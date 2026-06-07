import type { ReactNode } from 'react';

/**
 * 部件类型 SVG 图标
 * 用于部件选择/导航/菜单等场景
 */
export const PART_ICONS: Record<string, ReactNode> = {
  body: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8,2 L4,4 L3,10 L5,10 L5,20 L19,20 L19,10 L21,10 L20,4 L16,2 C16,2 15,5 12,5 C9,5 8,2 8,2 Z" />
    </svg>
  ),
  collar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4,4 L8,2 L12,6 L16,2 L20,4 L18,10 L12,8 L6,10 Z" />
      <line x1="12" y1="6" x2="12" y2="22" />
    </svg>
  ),
  sleeve: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,2 L2,4 L1,14 L5,14 L6,6 Z" />
      <path d="M18,2 L22,4 L23,14 L19,14 L18,6 Z" />
      <line x1="6" y1="6" x2="18" y2="6" />
    </svg>
  ),
  pocket: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="8" width="6" height="8" rx="1" />
      <rect x="13" y="8" width="6" height="8" rx="1" />
      <line x1="5" y1="10" x2="11" y2="10" />
      <line x1="13" y1="10" x2="19" y2="10" />
    </svg>
  ),
  placket: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="2" x2="9" y2="22" />
      <line x1="15" y1="2" x2="15" y2="22" />
      <circle cx="9" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="7" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="17" r="1" fill="currentColor" />
      <circle cx="15" cy="17" r="1" fill="currentColor" />
    </svg>
  ),
  cuff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="8" height="16" rx="2" />
      <rect x="14" y="4" width="8" height="16" rx="2" />
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
};
