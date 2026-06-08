/**
 * 全局快捷键 Hook
 *
 * 对标 CLO3D / Browzwear 专业平台快捷键:
 *  Ctrl+Z  撤销
 *  Ctrl+Shift+Z / Ctrl+Y  重做
 *  Ctrl+S  保存
 *  F       切换前/后视图
 *  1       Clean 视图
 *  2       Industrial 视图
 *  Esc     取消选中
 */

import { useEffect } from 'react';
import { useParametricStore } from '@/store/parametricStore';

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 在输入框中不拦截
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z: 撤销
      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useParametricStore.getState().undo();
        return;
      }

      // Ctrl+Shift+Z / Ctrl+Y: 重做
      if ((ctrl && e.shiftKey && e.key === 'Z') || (ctrl && e.key === 'y')) {
        e.preventDefault();
        useParametricStore.getState().redo();
        return;
      }

      // Ctrl+S: 保存
      if (ctrl && e.key === 's') {
        e.preventDefault();
        void useParametricStore.getState().saveDesign();
        return;
      }

      // F: 切换前/后视图
      if (e.key === 'f' && !ctrl) {
        const { view, setView } = useParametricStore.getState();
        setView(view === 'front' ? 'back' : 'front');
        return;
      }

      // 1: Clean 视图
      if (e.key === '1' && !ctrl) {
        useParametricStore.getState().setViewMode('clean');
        return;
      }

      // 2: Industrial 视图
      if (e.key === '2' && !ctrl) {
        useParametricStore.getState().setViewMode('industrial');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
