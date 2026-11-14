import { describe, expect, it } from 'vitest';
import { WORKBENCH_NAV_ITEMS, WORKBENCH_SECTION_LABELS, isWorkbenchSectionId } from '@/application/workbench-config';
import { designTokens } from '@/design-system';

describe('shared workbench contracts', () => {
  it('keeps global navigation unique and addressable', () => {
    const ids = WORKBENCH_NAV_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['design', 'assets', 'pieces', 'references']);
    expect(WORKBENCH_SECTION_LABELS.design).toBe('设计台');
    expect(isWorkbenchSectionId('assets')).toBe(true);
    expect(isWorkbenchSectionId('unknown')).toBe(false);
  });

  it('exposes semantic CSS variables instead of feature-owned color literals', () => {
    expect(designTokens.color.accent).toBe('var(--accent)');
    expect(designTokens.color.surface).toBe('var(--bg-secondary)');
    expect(designTokens.space.md).toBe('var(--space-md)');
    expect(designTokens.radius.md).toBe('var(--radius-md)');
  });
});
