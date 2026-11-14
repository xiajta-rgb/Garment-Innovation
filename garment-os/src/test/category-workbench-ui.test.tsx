import { useState } from 'react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { CategoryWorkbench } from '@/features/category-workbench/CategoryWorkbench';
import { AssetLibrary } from '@/features/asset-library/AssetLibrary';
import { CanvasArea } from '@/components/layout/CanvasArea';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { downloadText } from '@/features/files/browser-files';
import { exportCategoryCoverage } from '@/application/category-coverage';
vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
const navigate=vi.fn();
function Harness(){const [id,setId]=useState('round-short-tee');return <CategoryWorkbench categoryId={id} onCategoryChange={setId} onNavigate={navigate}/>;}
const click=(name:string)=>{if(name==='品类与功能'&&!screen.queryByRole('button',{name}))fireEvent.click(screen.getByRole('button',{name:'参考资料'}));fireEvent.click(screen.getByRole('button',{name}));};
const select=(label:string,value:string)=>fireEvent.change(screen.getByLabelText(label),{target:{value}});
beforeEach(()=>{useDesignStore.getState().newDesign();usePieceLibraryStore.getState().clearTagFilter();});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
it('category filters drive the actual list and details without modifying CAD or the company draft',()=>{
  const before=useDesignStore.getState().getConfiguration();
  const {container}=render(<Harness/>);
  select('服装品类分组','pants');
  const rows=[...container.querySelectorAll('nav button[data-category-id]')];expect(rows).toHaveLength(6);
  expect(screen.getByTestId('category-detail')).toHaveAttribute('data-category-id','straight-pants');
  fireEvent.click(container.querySelector('nav button[data-category-id="leggings"]')!);
  expect(screen.getByTestId('category-detail')).toHaveAttribute('data-category-id','leggings');
  expect(screen.getByRole('button',{name:'尺寸与裁片生成'})).toBeDisabled();
  expect(useDesignStore.getState().getConfiguration()).toEqual(before);
  fireEvent.change(screen.getByLabelText('搜索服装构型'),{target:{value:'衬衫'}});
  expect(container.querySelectorAll('nav button[data-category-id]')).toHaveLength(0);expect(screen.queryByTestId('category-detail')).toBeNull();
});
it('exact template selection enables the correct workflow and sends an explicit pieces-mode route',()=>{
  render(<Harness/>);select('服装品类分组','shirt');
  expect(screen.getByRole('button',{name:'尺寸与裁片生成'})).toBeDisabled();
  click('选用此品类模板');expect(useDesignStore.getState().activePatternId).toBe('button-up-shirt');
  click('配缝方向与裁片 BOM');expect(navigate).toHaveBeenLastCalledWith({kind:'pieces',view:'assembly'});
  click('尺寸与裁片生成');expect(navigate).toHaveBeenLastCalledWith({kind:'pieces',view:'generator'});
  click('本品类面料');expect(navigate).toHaveBeenLastCalledWith({kind:'assets',categoryId:'shirt',tab:'material'});
});
it('company-only pullover cannot silently execute the zip-hoodie template',()=>{
  render(<Harness/>);select('品类接通程度','company-drawing');
  fireEvent.change(screen.getByLabelText('搜索服装构型'),{target:{value:'套头'}});
  expect(screen.getByTestId('category-detail')).toHaveAttribute('data-category-id','pullover-hoodie');
  expect(screen.getByRole('button',{name:'尺寸与裁片生成'})).toBeDisabled();
  const before=useDesignStore.getState().activePatternId;click('打开公司原稿母版');
  expect(useDesignStore.getState().companyDraft?.masterId).toBe('company-at25m3288');expect(useDesignStore.getState().activePatternId).toBe(before);
  expect(navigate).toHaveBeenLastCalledWith({kind:'company'});
});
it('role references preserve exact role/family and export includes every actual gap',()=>{
  render(<Harness/>);
  const row=screen.getByText('binding.neck').closest('tr')!;
  fireEvent.click(within(row).getByRole('button',{name:'该角色参考'}));
  expect(usePieceLibraryStore.getState().referenceBrowse).toEqual({family:'binding',role:'binding.neck'});
  click('导出品类审查表');expect(JSON.parse(vi.mocked(downloadText).mock.calls[0][0])).toEqual(exportCategoryCoverage());
});
it('the asset library filters reusable assets by category and keeps company artwork in references',()=>{
  const {container}=render(<AssetLibrary initialTab="template" categoryId="pullover-hoodie" onCompany={()=>{}} onPattern={()=>{}}/>);
  const ids=()=>[...container.querySelectorAll('article[data-asset-id]')].map(e=>e.getAttribute('data-asset-id'));
  expect(ids()).toEqual([]);expect(screen.queryByRole('button',{name:'公司母版'})).toBeNull();
  click('结构组合');expect(ids()).toEqual([]);
  select('资产所属服装品类','zip-hoodie');expect(ids().sort()).toEqual(['zip-hoodie-hem-plain','zip-hoodie-hem-pocket','zip-hoodie-rib-plain','zip-hoodie-rib-pocket']);
  click('裁片模板');expect(ids()).toEqual(['hooded-zip-sweatshirt']);
  select('资产所属服装品类','straight-pants');click('面料库');click('原稿面料');expect(ids()).toEqual([]);
  select('资产所属服装品类','long-tee');expect(ids()).toEqual(['mat-fc304','mat-fc00332']);
});
it('workspace navigation opens the actual assembly page and retains category filtering when opening assets',async()=>{
  render(<CanvasArea showSketch showPattern onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#888888"/>);
  click('品类与功能');await screen.findByTestId('category-workbench');click('选用此品类模板');
  click('配缝方向与裁片 BOM');expect(await screen.findByTestId('assembly-panel')).toBeInTheDocument();
  click('品类与功能');await screen.findByTestId('category-workbench');click('本品类面料');
  await screen.findByTestId('asset-library');click('原稿面料');expect(screen.getByLabelText('资产所属服装品类')).toHaveValue('round-short-tee');
  click('返回品类与功能');expect(await screen.findByTestId('category-workbench')).toBeInTheDocument();
});
it('the category workflow opens the 2D piece generator after template selection',async()=>{
  render(<CanvasArea showSketch showPattern onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#888888"/>);
  click('品类与功能');await screen.findByTestId('category-workbench');select('服装品类分组','shirt');click('选用此品类模板');
  click('尺寸与裁片生成');expect(await screen.findByTestId('piece-library')).toBeInTheDocument();
});
