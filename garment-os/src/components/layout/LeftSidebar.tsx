import { lazy, Suspense } from 'react';
import { PART_CATEGORIES } from '@/data/partCategories';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { PART_ICONS } from '@/components/icons/PartIcons';
import { SidebarSection } from '@/components/layout/SidebarSection';
import { REFERENCE_PIECE_INDEX } from '@/data/referencePieceIndex';
import illustrations from '@/data/referenceIllustrations.json';
import { MeasurementInput } from '@/features/measurements/MeasurementInput';
const DesignAssistant = lazy(() => import('@/features/ai/DesignAssistant').then(m => ({ default: m.DesignAssistant })));
import { GenderSwitcher } from '@/features/right-panel/components/GenderSwitcher';
import { DesignToolbar } from '@/features/design-sheet/DesignToolbar';
import { TemplateManager } from '@/features/template-library/components/TemplateManager';
const ElementLibraryPanel = lazy(() => import('@/features/element-library/ElementLibraryPanel').then(m => ({ default: m.ElementLibraryPanel })));

export function LeftSidebar() {
  const setActivePart = usePieceLibraryStore((s) => s.setActivePart);
  const tagFilter = usePieceLibraryStore((s) => s.tagFilter);
  const setTagFilter = usePieceLibraryStore((s) => s.setTagFilter);
  const openReferences = usePieceLibraryStore(s=>s.openReferenceCatalogue);
  const browse = usePieceLibraryStore(s=>s.referenceBrowse);
  const clearFilter = usePieceLibraryStore(s=>s.showCurrentPieces);

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

      {/* 服装元素素材库: 与洞察数据库飞书表映射的元素注册中心 */}
      <SidebarSection title="服装造型库" defaultExpanded={false}>
        <Suspense fallback={<p>加载造型库…</p>}><ElementLibraryPanel /></Suspense>
      </SidebarSection>

      <SidebarSection title="AI 设计助理" defaultExpanded={false}>
        <Suspense fallback={<p>加载设计助理…</p>}><DesignAssistant /></Suspense>
      </SidebarSection>

      <SidebarSection title="Size & Measurements" defaultExpanded={true}>
        <MeasurementInput />
      </SidebarSection>

      <SidebarSection title="裁片快捷筛选" defaultExpanded={true}>
        <p style={{fontSize:10,color:'var(--text-muted)',margin:'0 0 6px'}}>按部位查看参考库；当前款式裁片另可查看。</p>
        <button onClick={clearFilter} style={{fontSize:11,marginBottom:6}}>显示全部裁片</button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PART_CATEGORIES.map((cat) => (
            <button
              key={cat.type}
              data-sidebar-family={cat.type}
              aria-pressed={tagFilter.includes(cat.type)}
              title={`${REFERENCE_PIECE_INDEX.filter(e=>e.family===cat.type).length} 份源图纸 · ${illustrations.filter(e=>e.family===cat.type).length} 份图片参考`}
              onClick={() => {
                setActivePart(cat.type);
                if(browse?.family===cat.type){clearFilter();return;}
                setTagFilter([cat.type]);openReferences(cat.type);
              }}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                borderRadius: 4,
                border: '1px solid',
                borderColor: tagFilter.includes(cat.type) ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s',
                background: tagFilter.includes(cat.type) ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                color: tagFilter.includes(cat.type) ? 'var(--accent)' : 'var(--text-secondary)',
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

      <SidebarSection title="使用边界" defaultExpanded={false}>
        <p style={{ fontSize: 11, lineHeight: 1.7 }}>裁片由完整参考制图方法生成；尺寸在裁片生成器中调整。材料、排料和试坯尚未核验，当前不提供生产 BOM 与成本。</p>
      </SidebarSection>
    </aside>
  );
}
