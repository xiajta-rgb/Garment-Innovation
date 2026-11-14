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
import { useDesignStore } from '@/store/useDesignStore';

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if(e.defaultPrevented||e.isComposing)return;
      const target = e.target as HTMLElement;
      if(document.querySelector('dialog[open],[aria-modal="true"]'))return;
      const ctrl = e.ctrlKey || e.metaKey;
      // Save also works while a field is focused; blur first commits its draft.
      if(ctrl&&e.key.toLowerCase()==='s'){
        e.preventDefault();target.blur?.();
        void useDesignStore.getState().saveDesign().catch(()=>{});return;
      }
      // 在输入框中不拦截
      if (target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="dialog"],[role="alertdialog"]') || target.isContentEditable || document.querySelector('dialog[open],[aria-modal="true"]')) return;

      // Ctrl+Z: 撤销
      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useDesignStore.getState().undo();
        return;
      }

      // Ctrl+Shift+Z / Ctrl+Y: 重做
      if ((ctrl && e.shiftKey && e.key === 'Z') || (ctrl && e.key === 'y')) {
        e.preventDefault();
        useDesignStore.getState().redo();
        return;
      }

      // F: 切换前/后视图
      if (e.key === 'f' && !ctrl) {
        const { view, setView } = useDesignStore.getState();
        setView(view === 'front' ? 'back' : 'front');
        return;
      }

      // 1: Clean 视图
      if (e.key === '1' && !ctrl) {
        useDesignStore.getState().setViewMode('clean');
        return;
      }

      // 2: Industrial 视图
      if (e.key === '2' && !ctrl) {
        useDesignStore.getState().setViewMode('industrial');
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
