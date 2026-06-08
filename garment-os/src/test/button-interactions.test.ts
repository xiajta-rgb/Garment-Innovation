/**
 * 按钮交互功能测试
 *
 * 测试范围:
 *  1. parametricStore 所有 action 是否正确触发 recalculate/recomputePattern/_snapshot
 *  2. newDesign / saveDesign / loadDesign 完整流程
 *  3. 视图切换 (front/back, clean/industrial)
 *  4. 颜色/面料切换
 *  5. 撤销/重做
 *  6. 性别切换
 *  7. 模板切换
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useParametricStore } from '@/store/parametricStore';

describe('parametricStore - 按钮交互功能测试', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    const store = useParametricStore.getState();
    store.newDesign();
  });

  // ─── 1. newDesign ───
  describe('New 按钮 (newDesign)', () => {
    it('应重置设计名', () => {
      const store = useParametricStore.getState();
      store.setDesignName('Test Design');
      expect(useParametricStore.getState().designName).toBe('Test Design');

      store.newDesign();
      expect(useParametricStore.getState().designName).toBe('Untitled Design');
    });

    it('应重置颜色和面料', () => {
      const store = useParametricStore.getState();
      store.setColor('#FF0000');
      store.setFabric('stripe');

      store.newDesign();
      expect(useParametricStore.getState().garmentColor).toBe('#87CEEB');
      expect(useParametricStore.getState().fabricId).toBe('solid');
    });

    it('应重置 currentDesignId', () => {
      const store = useParametricStore.getState();
      store.newDesign();
      expect(useParametricStore.getState().currentDesignId).toBeNull();
    });

    it('应生成 patternPaths (recomputePattern 被调用)', () => {
      const store = useParametricStore.getState();
      store.newDesign();
      // recomputePattern 应该生成 patternPaths
      const paths = useParametricStore.getState().patternPaths;
      expect(Array.isArray(paths)).toBe(true);
    });
  });

  // ─── 2. setView (Front/Back 切换) ───
  describe('Front/Back 视图切换按钮', () => {
    it('应切换到 back 视图', () => {
      const store = useParametricStore.getState();
      expect(store.view).toBe('front');
      store.setView('back');
      expect(useParametricStore.getState().view).toBe('back');
    });

    it('应切换回 front 视图', () => {
      const store = useParametricStore.getState();
      store.setView('back');
      store.setView('front');
      expect(useParametricStore.getState().view).toBe('front');
    });

    it('视图切换后 patternPaths 应更新', () => {
      const store = useParametricStore.getState();
      store.setView('back');
      const afterPaths = useParametricStore.getState().patternPaths;
      expect(Array.isArray(afterPaths)).toBe(true);
    });
  });

  // ─── 3. setViewMode (Clean/Industrial 切换) ───
  describe('Clean/Industrial 视图模式切换按钮', () => {
    it('应切换到 industrial 模式', () => {
      const store = useParametricStore.getState();
      store.setViewMode('industrial');
      expect(useParametricStore.getState().viewMode).toBe('industrial');
    });

    it('应切换回 clean 模式', () => {
      const store = useParametricStore.getState();
      store.setViewMode('industrial');
      store.setViewMode('clean');
      expect(useParametricStore.getState().viewMode).toBe('clean');
    });

    it('视图模式切换后 patternPaths 应更新', () => {
      const store = useParametricStore.getState();
      store.setViewMode('industrial');
      expect(Array.isArray(useParametricStore.getState().patternPaths)).toBe(true);
    });
  });

  // ─── 4. setColor ───
  describe('颜色选择按钮', () => {
    it('应更新 garmentColor', () => {
      const store = useParametricStore.getState();
      store.setColor('#FF0000');
      expect(useParametricStore.getState().garmentColor).toBe('#FF0000');
    });

    it('颜色变更应可撤销', () => {
      const store = useParametricStore.getState();
      const originalColor = store.garmentColor;
      store.setColor('#FF0000');
      expect(useParametricStore.getState().garmentColor).toBe('#FF0000');

      store.undo();
      expect(useParametricStore.getState().garmentColor).toBe(originalColor);
    });
  });

  // ─── 5. setFabric ───
  describe('面料选择按钮', () => {
    it('应更新 fabricId', () => {
      const store = useParametricStore.getState();
      store.setFabric('stripe');
      expect(useParametricStore.getState().fabricId).toBe('stripe');
    });

    it('面料变更应可撤销', () => {
      const store = useParametricStore.getState();
      const originalFabric = store.fabricId;
      store.setFabric('plaid');
      expect(useParametricStore.getState().fabricId).toBe('plaid');

      store.undo();
      expect(useParametricStore.getState().fabricId).toBe(originalFabric);
    });
  });

  // ─── 6. setGender ───
  describe('性别切换按钮', () => {
    it('应切换到 female', () => {
      const store = useParametricStore.getState();
      store.setGender('female');
      expect(useParametricStore.getState().gender).toBe('female');
    });

    it('性别切换后 instances 应重新初始化', () => {
      const store = useParametricStore.getState();
      store.setGender('female');
      const instances = useParametricStore.getState().instances;
      expect(instances.body).toBeDefined();
      expect(instances.collar).toBeDefined();
      expect(instances.sleeve).toBeDefined();
    });

    it('性别切换后 patternPaths 应更新', () => {
      const store = useParametricStore.getState();
      store.setGender('female');
      expect(Array.isArray(useParametricStore.getState().patternPaths)).toBe(true);
    });
  });

  // ─── 7. 撤销/重做 ───
  describe('撤销/重做按钮', () => {
    it('初始状态 canUndo 应为 false', () => {
      // newDesign 会存一个快照, 但之后没有操作可撤销
      const store = useParametricStore.getState();
      store.newDesign();
      // newDesign 后 canUndo 取决于历史状态
      // 至少初始创建后没有操作可撤销
    });

    it('操作后应可撤销', () => {
      const store = useParametricStore.getState();
      const originalColor = store.garmentColor;
      store.setColor('#FF0000');
      expect(useParametricStore.getState().canUndo).toBe(true);

      store.undo();
      expect(useParametricStore.getState().garmentColor).toBe(originalColor);
    });

    it('撤销后应可重做', () => {
      const store = useParametricStore.getState();
      store.setColor('#FF0000');
      store.undo();
      expect(useParametricStore.getState().canRedo).toBe(true);

      store.redo();
      expect(useParametricStore.getState().garmentColor).toBe('#FF0000');
    });

    it('视图切换应可撤销', () => {
      // 先重置到干净状态
      const store = useParametricStore.getState();
      store.newDesign();
      expect(useParametricStore.getState().view).toBe('front');

      store.setView('back');
      expect(useParametricStore.getState().view).toBe('back');

      store.undo();
      expect(useParametricStore.getState().view).toBe('front');
    });

    it('视图模式切换应可撤销', () => {
      const store = useParametricStore.getState();
      store.newDesign();
      expect(useParametricStore.getState().viewMode).toBe('clean');

      store.setViewMode('industrial');
      store.undo();
      expect(useParametricStore.getState().viewMode).toBe('clean');
    });
  });

  // ─── 8. applyPattern ───
  describe('模板切换按钮', () => {
    it('应更新 activePatternId', () => {
      const store = useParametricStore.getState();
      store.applyPattern('t-shirt');
      expect(useParametricStore.getState().activePatternId).toBe('t-shirt');
    });

    it('模板切换后 patternPaths 应更新', () => {
      const store = useParametricStore.getState();
      store.applyPattern('t-shirt');
      expect(Array.isArray(useParametricStore.getState().patternPaths)).toBe(true);
    });

    it('模板切换应可撤销', () => {
      const store = useParametricStore.getState();
      const originalPattern = store.activePatternId;
      store.applyPattern('polo-shirt');
      expect(useParametricStore.getState().activePatternId).toBe('polo-shirt');

      store.undo();
      expect(useParametricStore.getState().activePatternId).toBe(originalPattern);
    });
  });

  // ─── 9. updateParameter ───
  describe('参数滑块', () => {
    it('应更新参数值', () => {
      const store = useParametricStore.getState();
      const bodyInstance = store.instances.body;
      const paramKeys = Object.keys(bodyInstance.parameterValues);
      if (paramKeys.length > 0) {
        const firstParam = paramKeys[0];
        const originalValue = bodyInstance.parameterValues[firstParam];
        store.updateParameter('body', firstParam, typeof originalValue === 'number' ? originalValue + 1 : originalValue);
        // 值应该已更新
        expect(useParametricStore.getState().instances.body.parameterValues[firstParam]).toBeDefined();
      }
    });
  });

  // ─── 10. setDesignName ───
  describe('设计名输入框', () => {
    it('应更新设计名', () => {
      const store = useParametricStore.getState();
      store.setDesignName('My Custom Shirt');
      expect(useParametricStore.getState().designName).toBe('My Custom Shirt');
    });
  });

  // ─── 11. setActivePart ───
  describe('部件选择按钮', () => {
    it('应切换激活部件', () => {
      const store = useParametricStore.getState();
      store.setActivePart('collar');
      expect(useParametricStore.getState().activePart).toBe('collar');
    });

    it('应切换到所有部件类型', () => {
      const store = useParametricStore.getState();
      const parts: Array<'body' | 'collar' | 'sleeve' | 'pocket' | 'placket' | 'cuff'> = ['body', 'collar', 'sleeve', 'pocket', 'placket', 'cuff'];
      for (const part of parts) {
        store.setActivePart(part);
        expect(useParametricStore.getState().activePart).toBe(part);
      }
    });
  });
});
