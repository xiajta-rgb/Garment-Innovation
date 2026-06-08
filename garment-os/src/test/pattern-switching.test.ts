/**
 * 模式切换深度测试
 * 验证每个 pattern 切换后 patternPaths 真的有差异
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useParametricStore } from '@/store/parametricStore';
import { listPatterns, PATTERN_CATEGORIES } from '@/data/patternLibrary';

describe('模式切换深度测试', () => {
  beforeEach(() => {
    useParametricStore.getState().newDesign();
  });

  it('初始 patternPaths 不为空', () => {
    const paths = useParametricStore.getState().patternPaths;
    expect(paths.length).toBeGreaterThan(0);
  });

  it('每个分类都有对应 patterns', () => {
    const allPatterns = listPatterns();
    for (const cat of PATTERN_CATEGORIES) {
      const catPatterns = allPatterns.filter((p) => p.category === cat.id);
      expect(catPatterns.length, `分类 ${cat.id} 应至少有 1 个 pattern`).toBeGreaterThan(0);
    }
  });

  it('切换 t-shirt 分类后能看到 T-Shirt 和 V-Neck T-Shirt', () => {
    const allPatterns = listPatterns();
    const tShirtPatterns = allPatterns.filter((p) => p.category === 't-shirt');
    expect(tShirtPatterns.length).toBe(2);
    expect(tShirtPatterns.map((p) => p.id).sort()).toEqual(['t-shirt', 'v-neck-tee']);
  });

  it('切换每个 pattern 都能成功更新 store', () => {
    const allPatterns = listPatterns();
    for (const pattern of allPatterns) {
      useParametricStore.getState().applyPattern(pattern.id);
      const state = useParametricStore.getState();
      expect(state.activePatternId).toBe(pattern.id);
      expect(state.patternPaths.length, `pattern ${pattern.id} 应有 paths`).toBeGreaterThan(0);
    }
  });

  it('切换不同 pattern 后 patternPaths 应该有差异', () => {
    const allPatterns = listPatterns();
    if (allPatterns.length < 2) return;

    // 应用第一个 pattern
    useParametricStore.getState().applyPattern(allPatterns[0].id);
    const firstPaths = useParametricStore.getState().patternPaths;
    const firstOutline = firstPaths.find((p: any) => p.id === 'body-outline');

    // 应用第二个 pattern
    useParametricStore.getState().applyPattern(allPatterns[1].id);
    const secondPaths = useParametricStore.getState().patternPaths;
    const secondOutline = secondPaths.find((p: any) => p.id === 'body-outline');

    // 路径数量或内容应该不同
    const pathsDifferent = firstPaths.length !== secondPaths.length
      || firstOutline?.data !== secondOutline?.data;
    expect(pathsDifferent).toBe(true);
  });

  it('Polo 和 Button-Up 应比 T-Shirt 有更多路径 (立领/门襟/袖口)', () => {
    const allPatterns = listPatterns();
    const tshirt = allPatterns.find(p => p.id === 't-shirt')!;
    const polo = allPatterns.find(p => p.id === 'polo-shirt')!;
    const buttonUp = allPatterns.find(p => p.id === 'button-up-shirt')!;

    useParametricStore.getState().applyPattern(tshirt.id);
    const tshirtPaths = useParametricStore.getState().patternPaths.length;

    useParametricStore.getState().applyPattern(polo.id);
    const poloPaths = useParametricStore.getState().patternPaths.length;

    useParametricStore.getState().applyPattern(buttonUp.id);
    const buttonUpPaths = useParametricStore.getState().patternPaths.length;

    console.log(`T-Shirt: ${tshirtPaths} paths, Polo: ${poloPaths} paths, Button-Up: ${buttonUpPaths} paths`);

    // Polo 有立领 + 门襟, 应比 T-Shirt 多路径
    expect(poloPaths).toBeGreaterThan(tshirtPaths);
    // Button-Up 有立领 + 门襟 + 袖口 + 贴袋, 应比 Polo 更多
    expect(buttonUpPaths).toBeGreaterThan(poloPaths);
  });

  it('recomputePattern 不会抛错', () => {
    const allPatterns = listPatterns();
    for (const pattern of allPatterns) {
      useParametricStore.getState().applyPattern(pattern.id);
      expect(() => useParametricStore.getState().recomputePattern()).not.toThrow();
    }
  });

  it('连续切换 5 次后 store 状态一致', () => {
    const allPatterns = listPatterns();
    expect(allPatterns.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < 5; i++) {
      const pattern = allPatterns[i % allPatterns.length];
      useParametricStore.getState().applyPattern(pattern.id);
      expect(useParametricStore.getState().activePatternId).toBe(pattern.id);
    }
  });
});
