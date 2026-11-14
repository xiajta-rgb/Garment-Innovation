import { afterEach, beforeEach, expect, it } from 'vitest';
import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { PieceLibraryView } from '@/features/piece-library/PieceLibraryView';
import { PieceTaxonomyPanel } from '@/features/piece-library/PieceTaxonomyPanel';
import ReferencePatternBoard from '@/features/canvas/components/ReferencePatternBoard';
import { GarmentSketch } from '@/features/canvas/components/GarmentSketch';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { PIECE_ROLES } from '@/data/pieceTaxonomy';
import { LeftSidebar } from '@/components/layout/LeftSidebar';

beforeEach(()=>{useDesignStore.getState().newDesign();useDesignStore.getState().applyPattern('button-up-shirt');usePieceLibraryStore.getState().clearTagFilter();});
afterEach(cleanup);
const setup=()=>render(<><PieceLibraryView/><ReferencePatternBoard/><GarmentSketch view="front" garmentColor="#abcdef"/></>);
const row=(container:HTMLElement,id:string)=>within(container.querySelector(`[data-taxonomy-role="${id}"]`)! as HTMLElement);

it('the searchable full catalogue separates definitions, bound sources and current geometry',()=>{
  const {container}=render(<PieceTaxonomyPanel onInspect={()=>{}}/>);
  expect(container.querySelectorAll('[data-taxonomy-role]')).toHaveLength(PIECE_ROLES.length);
  expect(screen.getByTestId('taxonomy-summary')).toHaveTextContent('35 种源身份 / 20 个角色 / 13 大类');
  fireEvent.change(screen.getByRole('combobox',{name:'分类大类'}),{target:{value:'hood'}});
  expect([...container.querySelectorAll('[data-taxonomy-role]')].every(e=>e.getAttribute('data-taxonomy-role')!.startsWith('hood.'))).toBe(true);
  expect(row(container,'hood.center').getByText('仅分类定义 · 待建设')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'分类建设状态'}),{target:{value:'reference-bound'}});
  expect([...container.querySelectorAll('[data-taxonomy-role]')].map(e=>e.getAttribute('data-taxonomy-role'))).toEqual(['hood.side']);
  fireEvent.click(screen.getByRole('button',{name:'重置目录筛选'}));
  fireEvent.change(screen.getByRole('textbox',{name:'搜索裁片分类'}),{target:{value:'袖衩'}});
  expect([...container.querySelectorAll('[data-taxonomy-role]')].map(e=>e.getAttribute('data-taxonomy-role'))).toEqual(['placket.sleeve-overlap','placket.sleeve-underlap']);
  fireEvent.click(screen.getByRole('button',{name:'重置目录筛选'}));
  fireEvent.change(screen.getByRole('combobox',{name:'适用服装场景'}),{target:{value:'hats'}});
  expect([...container.querySelectorAll('[data-taxonomy-role]')].every(e=>e.getAttribute('data-taxonomy-role')!.startsWith('headwear.'))).toBe(true);
});

it.each([
  ['collar.stand','simon.collarStand'],['collar.unsplit-pair','simon.collar'],['yoke.back','simon.yoke'],
  ['placket.sleeve-overlap','simon.sleevePlacketOverlap'],['placket.sleeve-underlap','simon.sleevePlacketUnderlap'],
])('%s selects only its actual source across QC, overview, generator and assembly',(role,id)=>{
  const {container}=setup(),before=useDesignStore.getState().draft;
  fireEvent.click(screen.getByRole('button',{name:'分类总览'}));
  fireEvent.click(row(container,role).getByRole('button',{name:'查看当前裁片'}));
  expect(usePieceLibraryStore.getState().tagFilter).toEqual([role.split('.')[0],`role:${role}`]);
  expect(container.querySelector('[data-piece-key]')).toHaveAttribute('data-piece-key',id);
  expect([...container.querySelectorAll('[data-board-piece]')].map(p=>p.getAttribute('data-board-piece'))).toEqual([id]);
  // The yoke is intentionally back-view only.
  const canvasIds=new Set([...container.querySelectorAll('#garment-sketch path[data-piece-id]')].map(p=>p.getAttribute('data-piece-id')));
  expect(canvasIds).toEqual(new Set(id==='simon.yoke'?[]:[id]));
  fireEvent.click(screen.getByRole('button',{name:'裁片生成器'}));
  expect([...container.querySelectorAll('[data-standard-piece]')].map(p=>p.getAttribute('data-standard-piece'))).toEqual([id]);
  fireEvent.click(screen.getByRole('button',{name:'裁片组成'}));
  expect([...container.querySelectorAll('[data-assembly-piece]')].map(p=>p.getAttribute('data-assembly-piece'))).toEqual([id]);
  expect(useDesignStore.getState().draft).toBe(before);
});

it('a definition without geometry withdraws every prior preview instead of leaving a stale collar',()=>{
  const {container}=setup();fireEvent.click(screen.getByRole('button',{name:'分类总览'}));
  fireEvent.click(row(container,'collar.under').getByRole('button',{name:'查看当前裁片'}));
  expect(container.querySelector('[data-piece-key]')).toBeNull();expect(container.querySelector('[data-board-piece]')).toBeNull();
  expect(container.querySelector('#garment-sketch path[data-piece-id]')).toBeNull();
  expect(screen.getByText('当前筛选没有裁片。')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'裁片生成器'}));
  expect(screen.getByTestId('standard-empty')).toBeInTheDocument();expect(container.querySelector('[data-testid="standard-preview"]')).toBeNull();
});

it('short sleeves update current coverage while retaining source binding history',()=>{
  const {container}=render(<PieceTaxonomyPanel onInspect={()=>{}}/>);
  expect(row(container,'cuff.barrel').getByText('当前 1 种 / 预览检查通过 1 种')).toBeInTheDocument();
  act(()=>useDesignStore.getState().setConstruction({schema:'garment-os/construction/v1',options:{sleeveStyle:'short'}}));
  expect(row(container,'cuff.barrel').getByText('当前 0 种 / 预览检查通过 0 种')).toBeInTheDocument();
  expect(row(container,'cuff.barrel').getByText('参考源已绑定')).toBeInTheDocument();
});

it('sidebar family buttons now filter actual geometry and clear to the full current template',()=>{
  const {container}=render(<><LeftSidebar/><ReferencePatternBoard/></>);
  fireEvent.click(container.querySelector('[data-sidebar-family="yoke"]')!);
  expect([...container.querySelectorAll('[data-board-piece]')].map(e=>e.getAttribute('data-board-piece'))).toEqual(['simon.yoke']);
  fireEvent.click(container.querySelector('[data-sidebar-family="trouser"]')!);
  expect(container.querySelector('[data-board-piece]')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'显示全部裁片'}));
  expect(container.querySelectorAll('[data-board-piece]')).toHaveLength(10);
});
