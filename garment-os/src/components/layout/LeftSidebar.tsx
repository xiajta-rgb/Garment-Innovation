import { PART_CATEGORIES, type PartType } from '@/data/garmentParts';
import { useParametricStore } from '@/store/parametricStore';
import { PART_ICONS } from '@/components/icons/PartIcons';
import { SidebarSection } from '@/components/layout/SidebarSection';
import { MeasurementInput } from '@/features/measurements/MeasurementInput';
import { DesignAssistant } from '@/features/ai/DesignAssistant';
import { ParamSliders } from '@/features/right-panel/components/ParamSliders';
import { BomCostPanel } from '@/features/right-panel/components/BomCostPanel';
import { GenderSwitcher } from '@/features/right-panel/components/GenderSwitcher';
import { DesignToolbar } from '@/features/design-sheet/DesignToolbar';
import { TemplateManager } from '@/features/template-library/components/TemplateManager';

interface LeftSidebarProps {
  activeVariants: Partial<Record<PartType, string>>;
  onSelectVariant: (partType: PartType, variantId: string) => void;
  onApplyColor: (color: string) => void;
  onApplyFabric: (fabricId: string) => void;
}

export function LeftSidebar(_props: LeftSidebarProps) {
  const activePart = useParametricStore((s) => s.activePart);
  const setActivePart = useParametricStore((s) => s.setActivePart);

  return (
    <aside className="left-panel" style={{ width: 220, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <DesignToolbar />

      <SidebarSection title="Gender" defaultExpanded={true}>
        <GenderSwitcher />
      </SidebarSection>

      {/* 模板管理库: 整合了模板/颜色/面料/部件切换 */}
      <SidebarSection title="模板管理库" defaultExpanded={true}>
        <TemplateManager />
      </SidebarSection>

      <SidebarSection title="AI 设计助理" defaultExpanded={false}>
        <DesignAssistant />
      </SidebarSection>

      <SidebarSection title="Size & Measurements" defaultExpanded={true}>
        <MeasurementInput />
      </SidebarSection>

      {/* 部件选择: 快速切换激活部件 (参数面板联动) */}
      <SidebarSection title="Parts" defaultExpanded={true}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PART_CATEGORIES.map((cat) => (
            <button
              key={cat.type}
              onClick={() => setActivePart(cat.type)}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                borderRadius: 4,
                border: '1px solid',
                borderColor: activePart === cat.type ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s',
                background: activePart === cat.type ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                color: activePart === cat.type ? 'var(--accent)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{PART_ICONS[cat.icon]}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="Parameters" defaultExpanded={true}>
        <ParamSliders />
      </SidebarSection>

      <SidebarSection title="BOM / Cost" defaultExpanded={false}>
        <BomCostPanel />
      </SidebarSection>
    </aside>
  );
}
