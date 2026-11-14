import type { ReactNode } from 'react';
import { UiSection } from '@/design-system';

interface SidebarSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * 左侧面板折叠区块
 * 标题 + 可折叠内容区
 */
export function SidebarSection(props: SidebarSectionProps) {
  return <UiSection {...props} />;
}
