import { isReferencePattern } from '@/data/patternReview';
import { PART_CATEGORIES } from '@/data/partCategories';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { useDesignStore } from '@/store/useDesignStore';
import { PART_ICONS } from '@/components/icons/PartIcons';
import { CanvasMenu } from '@/features/canvas/components/CanvasMenu';
import { PatternValidationBadge } from '@/features/canvas/components/PatternValidationBadge';
import { PieceLibraryView } from '@/features/piece-library/PieceLibraryView';
import { usePieceQC } from '@/features/piece-library/usePieceQC';
import { GarmentSketch } from '@/features/canvas/components/GarmentSketch';
import ReferencePatternBoard from '@/features/canvas/components/ReferencePatternBoard';
import { lazy, Suspense, useRef, useCallback, useState } from 'react';
import type { AssetLibraryTab,CategoryWorkspaceAction,PieceLibraryViewId } from '@/types/category-workbench';
import { ManagedMaterialSummary } from '@/features/asset-library/ManagedMaterialAssignments';
import { WORKBENCH_NAV_ITEMS } from '@/application/workbench-config';

const StyleWorkflow=lazy(()=>import('@/features/style-workflow/StyleWorkflow').then(m=>({default:m.StyleWorkflow})));
const ReferenceCatalogue=lazy(()=>import('@/features/piece-library/ReferenceCatalogue').then(m=>({default:m.ReferenceCatalogue})));
const CompanyDesignBoard=lazy(()=>import('@/features/company-design/CompanyDesignBoard').then(m=>({default:m.CompanyDesignBoard})));
const PieceDesignBoard=lazy(()=>import('@/features/piece-design/PieceDesignBoard').then(m=>({default:m.PieceDesignBoard})));
const AssetLibrary=lazy(()=>import('@/features/asset-library/AssetLibrary').then(m=>({default:m.AssetLibrary})));
const CategoryWorkbench=lazy(()=>import('@/features/category-workbench/CategoryWorkbench').then(m=>({default:m.CategoryWorkbench})));
const DesignDesk=lazy(()=>import('@/features/design-desk/DesignDesk').then(m=>({default:m.DesignDesk})));
const TemplateReviewStudio=lazy(()=>import('@/features/tee-matrix/TemplateReviewStudio').then(m=>({default:m.TemplateReviewStudio})));
const TeeFoundationStudio=lazy(()=>import('@/features/tee-matrix/TeeFoundationStudio').then(m=>({default:m.TeeFoundationStudio})));
const RedesignReferences=lazy(()=>import('@/features/piece-design/RedesignReferences').then(m=>({default:m.RedesignReferences})));
type WorkspaceView = 'redesign-reference' | 'matrix' | 'review' | 'foundation' | 'piece-design' | 'company' | 'categories' | 'assets' | 'canvas' | 'pieces' | 'workflow';

interface CanvasAreaProps {
  showSketch: boolean;
  showPattern: boolean;
  onToggleSketch: () => void;
  onTogglePattern: () => void;
  sketchZoom: number;
  onSketchZoom: (updater: (z: number) => number) => void;
  garmentColor: string;
  onToggleSidebar?: () => void;
}

export function CanvasArea({
  showSketch,
  showPattern,
  onToggleSketch,
  onTogglePattern,
  sketchZoom,
  onSketchZoom,
  garmentColor,
  onToggleSidebar,
}: CanvasAreaProps) {
  // 裁片 QC 门禁常驻 (换模板/改尺寸自动重检)
  usePieceQC();
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceView>(()=>{
    const requested = new URLSearchParams(window.location.search).get('workspace');
    if (['matrix', 'matrix-v1', 'design'].includes(requested ?? '')) return 'matrix';
    if (['redesign-reference','company','review','foundation','assets','pieces','categories','workflow'].includes(requested ?? '')) return requested as WorkspaceView;
    return 'piece-design';
  });
  const lastDesign = useRef<WorkspaceView>(['matrix','piece-design','canvas','workflow'].includes(selectedWorkspace) ? selectedWorkspace : 'piece-design');
  const setWorkspaceView = (next: WorkspaceView) => {
    if (['matrix','piece-design','canvas','workflow'].includes(next)) lastDesign.current = next;
    setSelectedWorkspace(next);
  };
  const [categoryId,setCategoryId]=useState('round-short-tee');
  const [assetContext,setAssetContext]=useState<{categoryId?:string;tab:AssetLibraryTab}>({tab:'material'});
  const [pieceInitialView,setPieceInitialView]=useState<PieceLibraryViewId>('generator');
  const currentPiecesView=usePieceLibraryStore(s=>s.currentPiecesView),workspaceView=currentPiecesView?'canvas':selectedWorkspace;
  const showPieces = workspaceView === 'pieces';
  const showWorkflow = workspaceView === 'workflow';
  const storeView = useDesignStore((s) => s.view);
  const setView = useDesignStore((s) => s.setView);
  const activePart = usePieceLibraryStore((s) => s.activePart);
  const activePatternId = useDesignStore(s => s.activePatternId);
  const referenceBrowse=usePieceLibraryStore(s=>s.referenceBrowse);
  const openReferences=usePieceLibraryStore(s=>s.openReferenceCatalogue);
  const section = referenceBrowse || ['redesign-reference','company','categories','review','foundation'].includes(workspaceView) ? 'references' : workspaceView==='assets' ? 'assets' : workspaceView==='pieces' ? 'pieces' : 'design';
  const closeReferences=usePieceLibraryStore(s=>s.closeReferenceCatalogue);
  const clearFilter=usePieceLibraryStore(s=>s.clearTagFilter);
  const setFilter=usePieceLibraryStore(s=>s.setTagFilter);
  const navigateCategory=(action:CategoryWorkspaceAction)=>{
    clearFilter();
    if(action.kind==='assets'){setCategoryId(action.categoryId);setAssetContext({categoryId:action.categoryId,tab:action.tab});setWorkspaceView('assets');}
    else if(action.kind==='pieces'){setPieceInitialView(action.view);setWorkspaceView('pieces');}
    else setWorkspaceView('company');
  };

  // 画布平移状态
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const [panning,setPanning] = useState(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 中键拖拽 或 Space+左键拖拽
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true; setPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false; setPanning(false);
  }, []);

  const handleResetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    onSketchZoom(() => 1);
  }, [onSketchZoom]);

  return (
    <main data-testid="workbench-canvas" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <nav className="workbench-primary-nav" aria-label="工作台主导航">
        {onToggleSidebar && <button className="workbench-sidebar-toggle" onClick={onToggleSidebar}>模板与尺寸</button>}
        {WORKBENCH_NAV_ITEMS.map(({ id, label }) => <button key={id} data-workbench-section={id} aria-pressed={section === id} onClick={() => { clearFilter(); setWorkspaceView(id === 'design' ? lastDesign.current : id === 'references' ? 'company' : id); }}>{label}</button>)}
        <div className="workbench-nav-status"><PatternValidationBadge/></div>
      </nav>
      <div className="workbench-secondary-nav" aria-label={section==='references'?'参考资料分类':section==='design'?'设计工具':'资源导航'}>
        {section==='design'&&<>
          <button className="view-toggle" aria-pressed={workspaceView==='piece-design'} onClick={()=>{closeReferences();setWorkspaceView('piece-design');}}>裁片组合设计</button>
          <button className="view-toggle" aria-pressed={workspaceView==='matrix'} onClick={()=>{clearFilter();setWorkspaceView('matrix');}}>定制矩阵</button>
          <button className="view-toggle" aria-pressed={showWorkflow} onClick={()=>{closeReferences();setWorkspaceView('workflow');}}>款式工作流</button>
          <details className="workbench-view-options"><summary>画布视图</summary><div>
            <button className="view-toggle" aria-pressed={showSketch&&workspaceView==='canvas'} onClick={()=>{setWorkspaceView('canvas');if(!showSketch)onToggleSketch();}}>Sketch</button>
            <button className="view-toggle" aria-pressed={showPattern&&workspaceView==='canvas'} onClick={()=>{setWorkspaceView('canvas');if(!showPattern)onTogglePattern();}}>Pattern</button>
            {workspaceView==='canvas'&&<><button onClick={()=>setView('front')}>Front</button><button onClick={()=>setView('back')}>Back</button></>}
          </div></details>
        </>}
        {section==='references'&&<>
          <button aria-pressed={workspaceView==='redesign-reference'&&!referenceBrowse} onClick={()=>{closeReferences();setWorkspaceView('redesign-reference');}}>改款文献</button>
          <button aria-pressed={workspaceView==='company'&&!referenceBrowse} onClick={()=>{closeReferences();setWorkspaceView('company');}}>公司设计稿</button>
          <button aria-pressed={!!referenceBrowse} onClick={()=>{clearFilter();openReferences();}}>参考裁片库</button>
          <button aria-pressed={workspaceView==='categories'&&!referenceBrowse} onClick={()=>{closeReferences();setWorkspaceView('categories');}}>品类与功能</button>
          <button aria-pressed={workspaceView==='review'&&!referenceBrowse} onClick={()=>{closeReferences();setWorkspaceView('review');}}>模板审查</button>
          <button aria-pressed={workspaceView==='foundation'&&!referenceBrowse} onClick={()=>{closeReferences();setWorkspaceView('foundation');}}>基础裁片核对</button>
        </>}
        {section==='assets'&&<><span>面料 · 工艺 · 结构 · 模板 · 配色</span><button onClick={()=>{setPieceInitialView('generator');setWorkspaceView('pieces');}}>查看当前裁片</button><button onClick={()=>setWorkspaceView('categories')}>品类与功能</button></>}
        {section==='pieces'&&<><span>源裁片 · 分类 · 配缝与检查</span><button onClick={()=>{openReferences();}}>查看参考资料</button></>}
      </div>

      <ManagedMaterialSummary onManage={()=>{clearFilter();setAssetContext({tab:'material'});setWorkspaceView('assets');}}/>
      {referenceBrowse&&<Suspense fallback={<p role="status">正在加载参考裁片库…</p>}>
        <ReferenceCatalogue key={`${referenceBrowse.family??''}/${referenceBrowse.role??''}`} initial={referenceBrowse}
          onScopeChange={({family,role})=>{
            setFilter(family?[family,...(role?[`role:${role}`]:[])]:[]);
            if(family)usePieceLibraryStore.getState().setActivePart(family);
            openReferences(family,role);
          }}
          onCurrent={(family,role)=>{
            if(!family){clearFilter();return;}
            setFilter([family,...(role?[`role:${role}`]:[])]);closeReferences();setWorkspaceView('pieces');
          }}/>
      </Suspense>}
      {!referenceBrowse&&showWorkflow&&<Suspense fallback={<p role="status">正在加载款式工作流…</p>}><StyleWorkflow/></Suspense>}
      {!referenceBrowse&&workspaceView==='matrix'&&<Suspense fallback={<p role="status">正在加载定制矩阵…</p>}><DesignDesk onReview={()=>setWorkspaceView('review')} onFoundation={()=>setWorkspaceView('foundation')}/></Suspense>}
      {!referenceBrowse&&workspaceView==='review'&&<div className="workbench-reference-module"><button className="workbench-back" onClick={()=>setWorkspaceView('matrix')}>返回定制矩阵</button><Suspense fallback={<p>正在加载模板审查…</p>}><TemplateReviewStudio onDesign={()=>setWorkspaceView('matrix')}/></Suspense></div>}
      {!referenceBrowse&&workspaceView==='foundation'&&<div className="workbench-reference-module"><button className="workbench-back" onClick={()=>setWorkspaceView('matrix')}>返回定制矩阵</button><Suspense fallback={<p>正在加载基础裁片…</p>}><TeeFoundationStudio/></Suspense></div>}
      {!referenceBrowse&&workspaceView==='piece-design'&&<Suspense fallback={<p role="status">正在加载裁片组合…</p>}><PieceDesignBoard onReferences={()=>{closeReferences();setWorkspaceView('redesign-reference');}}/></Suspense>}
      {!referenceBrowse&&workspaceView==='redesign-reference'&&<Suspense fallback={<p role="status">正在加载改款文献…</p>}><RedesignReferences onDesign={()=>setWorkspaceView('piece-design')}/></Suspense>}
      {!referenceBrowse&&workspaceView==='company'&&<Suspense fallback={<p role="status">正在加载公司母版…</p>}><CompanyDesignBoard onMapping={()=>{clearFilter();setPieceInitialView('generator');setWorkspaceView('pieces');}} onLibrary={()=>{setAssetContext({tab:'material'});setWorkspaceView('assets');}}/></Suspense>}
      {!referenceBrowse&&workspaceView==='categories'&&<Suspense fallback={<p role="status">正在加载品类映射…</p>}><CategoryWorkbench categoryId={categoryId} onCategoryChange={setCategoryId} onNavigate={navigateCategory}/></Suspense>}
      {!referenceBrowse&&workspaceView==='assets'&&<Suspense fallback={<p role="status">正在加载资产库…</p>}><AssetLibrary key={`${assetContext.categoryId??'all'}-${assetContext.tab}`} categoryId={assetContext.categoryId} initialTab={assetContext.tab} onDesign={()=>setWorkspaceView('piece-design')} onCategories={()=>setWorkspaceView('categories')} onCompany={()=>setWorkspaceView('company')} onPattern={()=>{clearFilter();setPieceInitialView('generator');setWorkspaceView('pieces');}}/></Suspense>}
      {/* 裁片标准化库视图 (全屏接管) */}
      {!referenceBrowse && !showWorkflow && showPieces && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <PieceLibraryView key={pieceInitialView} initialView={pieceInitialView}/>
        </div>
      )}

      {/* 双画布 */}
      {!referenceBrowse && workspaceView === 'canvas' && !isReferencePattern(activePatternId) && <div data-testid="legacy-pattern-quarantine" style={{ padding: '8px 16px', background: '#fff7e6', color: '#874d00', fontSize: 12 }}>
        历史模板待逐片核验，已停止映射。可在裁片库的检验页查看原始资料。
      </div>}
      {!referenceBrowse && workspaceView === 'canvas' && (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左：成衣线稿 */}
        {showSketch && (
          <div className="canvas-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            {/* 缩放工具栏 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
            }}>
              <button
                onClick={() => onSketchZoom(z => Math.max(0.3, z - 0.2))}
                style={{
                  width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500,
                }}
                title="Zoom Out"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="5" cy="5" r="3.5" /><line x1="8" y1="8" x2="11" y2="11" /><line x1="3" y1="5" x2="7" y2="5" />
                </svg>
              </button>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 36, textAlign: 'center', fontWeight: 500 }}>
                {Math.round(sketchZoom * 100)}%
              </span>
              <button
                onClick={() => onSketchZoom(z => Math.min(3, z + 0.2))}
                style={{
                  width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500,
                }}
                title="Zoom In"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="5" cy="5" r="3.5" /><line x1="8" y1="8" x2="11" y2="11" /><line x1="3" y1="5" x2="7" y2="5" /><line x1="5" y1="3" x2="5" y2="7" />
                </svg>
              </button>
              <button
                onClick={handleResetView}
                style={{
                  height: 24, padding: '0 8px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 9, fontWeight: 500,
                }}
                title="Reset Zoom & Pan"
              >
                Fit
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 8, color: 'var(--text-muted)', opacity: 0.5 }}>Scroll=Zoom  Alt+Drag=Pan</span>
            </div>

            {/* 可缩放/平移画布区域 */}
            <div
              style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: panning ? 'grabbing' : 'default' }}
              onWheel={(e) => {
                e.preventDefault();
                onSketchZoom(z => Math.min(3, Math.max(0.3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div id="sketch-canvas" style={{
                width: 300 * sketchZoom,
                maxWidth: 'none',
                aspectRatio: '5/7',
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 4px 24px var(--shadow)',
                transition: 'width 0.15s ease, height 0.15s ease',
                flexShrink: 0,
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}>
                <GarmentSketch view={storeView} garmentColor={garmentColor} />
                <div style={{
                  position: 'absolute',
                  top: 8,
                  left: 10,
                  fontSize: 9,
                  color: 'var(--accent)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  background: 'var(--accent-dim)',
                  padding: '2px 8px',
                  borderRadius: 3,
                }}>
                  {PART_ICONS[PART_CATEGORIES.find((c) => c.type === activePart)?.icon ?? 'body']}
                  {' '}{PART_CATEGORIES.find((c) => c.type === activePart)?.label}
                </div>
                <CanvasMenu canvasId="sketch-canvas" />
              </div>
            </div>
          </div>
        )}

        {/* 分隔线 */}
        {showSketch && showPattern && <div className="divider-v" />}

        {/* 右：裁剪画布 */}
        {showPattern && (
          <div id="pattern-canvas" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <CanvasMenu canvasId="pattern-canvas" capabilities={{ svg: false, png: false, sheet: true }} />
            <ReferencePatternBoard />
          </div>
        )}
      </div>
      )}
    </main>
  );
}
