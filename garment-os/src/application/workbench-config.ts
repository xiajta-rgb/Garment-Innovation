export type WorkbenchSectionId = 'design' | 'assets' | 'pieces' | 'references';

export interface WorkbenchNavItem {
  id: WorkbenchSectionId;
  label: string;
}

/** Single source of truth for the global workbench navigation. */
export const WORKBENCH_NAV_ITEMS: readonly WorkbenchNavItem[] = [
  { id: 'design', label: '设计台' },
  { id: 'assets', label: '资产库' },
  { id: 'pieces', label: '裁片库' },
  { id: 'references', label: '参考资料' },
] as const;

export const WORKBENCH_SECTION_LABELS: Readonly<Record<WorkbenchSectionId, string>> = Object.fromEntries(
  WORKBENCH_NAV_ITEMS.map((item) => [item.id, item.label]),
) as Record<WorkbenchSectionId, string>;

export function isWorkbenchSectionId(value: string | null): value is WorkbenchSectionId {
  return WORKBENCH_NAV_ITEMS.some((item) => item.id === value);
}
