import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { ReferenceCatalogue } from '@/features/piece-library/ReferenceCatalogue';
import { CanvasArea } from '@/components/layout/CanvasArea';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { downloadText } from '@/features/files/browser-files';
import snapshot from '@/data/referencePieceCatalogue.snapshot.json';
import { PIECE_FAMILIES } from '@/data/pieceTaxonomy';
vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
beforeEach(()=>{useDesignStore.getState().newDesign();usePieceLibraryStore.getState().clearTagFilter();});
afterEach(()=>{cleanup();vi.clearAllMocks();});

it.each(PIECE_FAMILIES)('$label renders only actual matching source paths or the paper-pattern photo',family=>{
  const {container}=render(<ReferenceCatalogue initial={{family:family.id}} onCurrent={()=>{}}/>);
  const entries=snapshot.entries.filter(e=>e.family===family.id);
  const cards=[...container.querySelectorAll('[data-catalogue-entry]')];
  expect(cards.length).toBe(Math.min(entries.length,12));
  expect(cards.every(e=>entries.some(s=>s.id===e.getAttribute('data-catalogue-entry')))).toBe(true);
  if(entries.length){
    const detail=screen.getByTestId('catalogue-detail');
    expect(detail).toHaveAttribute('data-reference-entry',entries[0].id);
    const net=detail.querySelector('[data-reference-layer="net"]');
    expect(net).toHaveAttribute('d',entries[0].paths[0].data);
  }else{
    expect(container.querySelector('[data-reference-photo]')).not.toBeNull();
    expect(screen.getByText('图片参考 · 尚无毫米 CAD 数据')).toBeInTheDocument();
  }
});

it('selecting a missing role removes old geometry, and changing page focuses a visible reference',()=>{
  const {container}=render(<ReferenceCatalogue onCurrent={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  const first=container.querySelector('[data-catalogue-entry]')!;
  expect(screen.getByTestId('catalogue-detail')).toHaveAttribute('data-reference-entry',first.getAttribute('data-catalogue-entry'));
  fireEvent.change(screen.getByLabelText('参考大类'),{target:{value:'collar'}});
  expect(screen.getByTestId('catalogue-detail')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('参考裁片角色'),{target:{value:'collar.flat'}});
  expect(screen.getByTestId('catalogue-reference-gap')).toHaveTextContent('平领');
  expect(screen.queryByTestId('catalogue-detail')).toBeNull();
  expect(container.querySelector('[data-reference-drawing]')).toBeNull();
});

it('the reported collar click opens the cross-template reference library without altering the tee or its measurements',async()=>{
  useDesignStore.getState().applyPattern('womens-basic-tee');
  const before=useDesignStore.getState().draft,measurements=useDesignStore.getState().measurements;
  const {container}=render(<><LeftSidebar/><CanvasArea showSketch showPattern={false} onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#cbd5e1"/></>);
  fireEvent.click(container.querySelector('[data-sidebar-family="collar"]')!);
  expect(await screen.findByTestId('reference-catalogue')).toHaveAttribute('data-catalogue-family','collar');
  expect(screen.getByTestId('catalogue-current-notice')).toHaveTextContent('当前款式有 0 种');
  expect(container.querySelectorAll('[data-catalogue-entry]').length).toBeGreaterThan(2);
  expect(container.querySelector('#garment-sketch')).toBeNull();
  expect(useDesignStore.getState().draft).toBe(before);
  expect(useDesignStore.getState().measurements).toBe(measurements);
  fireEvent.click(screen.getByRole('button',{name:'导出毫米参考 SVG'}));
  expect(vi.mocked(downloadText).mock.calls[0][0]).toContain('productionApproved=false');
  expect(vi.mocked(downloadText).mock.calls[0][2]).toBe('image/svg+xml');
  fireEvent.click(screen.getByRole('button',{name:'显示全部裁片'}));
  expect(screen.queryByTestId('reference-catalogue')).toBeNull();
  expect(container.querySelectorAll('#garment-sketch [data-layer="seam-line"] path[data-source-id]').length).toBeGreaterThan(0);
});

it('selecting a card updates the preview to that exact source, and reference data stays outside manufacturing exports',()=>{
  const before=useDesignStore.getState().draft;
  const {container}=render(<ReferenceCatalogue initial={{family:'cuff'}} onCurrent={()=>{}}/>);
  const cards=container.querySelectorAll('[data-catalogue-entry]');
  fireEvent.click(cards[cards.length-1]);
  const selected=snapshot.entries.find(e=>e.id===cards[cards.length-1].getAttribute('data-catalogue-entry'))!;
  expect(within(screen.getByTestId('catalogue-detail')).getByText(/双翻袖口/)).toBeInTheDocument();
  expect(screen.getByTestId('catalogue-detail').querySelector('[data-reference-layer="net"]')).toHaveAttribute('d',selected.paths[0].data);
  fireEvent.click(screen.getByRole('button',{name:'导出源数据'}));
  const exported=JSON.parse(vi.mocked(downloadText).mock.calls[0][0]);
  expect(exported.schema).toBe('garment-os/reference-piece/v1');
  expect(exported.piece.productionApproved).toBe(false);
  expect(useDesignStore.getState().draft).toBe(before);
});
