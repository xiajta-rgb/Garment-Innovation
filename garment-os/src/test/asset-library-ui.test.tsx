import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { AssetLibrary } from '@/features/asset-library/AssetLibrary';
import { CanvasArea } from '@/components/layout/CanvasArea';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { downloadText } from '@/features/files/browser-files';
import { CompanyDesignBoard } from '@/features/company-design/CompanyDesignBoard';
vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
beforeEach(()=>{useDesignStore.getState().newDesign();usePieceLibraryStore.getState().clearTagFilter();});
afterEach(()=>{cleanup();vi.clearAllMocks();});
const click=(name:string)=>fireEvent.click(screen.getByRole('button',{name}));
const panel=()=>{const result=render(<AssetLibrary onCompany={()=>{}} onPattern={()=>{}}/>);click('原稿面料');return result;};
const cards=(container:HTMLElement)=>[...container.querySelectorAll('article[data-asset-id]')];
it('material search, role classification and compatibility filters control actual cards and prevent invalid use',()=>{
  const {container}=panel();expect(cards(container)).toHaveLength(4);
  fireEvent.click(screen.getByLabelText('仅显示当前可用'));expect(cards(container)).toHaveLength(1);expect(cards(container)[0]).toHaveAttribute('data-asset-id','mat-fc304');
  fireEvent.change(screen.getByLabelText('选用面料部位'),{target:{value:'neck'}});expect(cards(container)).toHaveLength(1);expect(cards(container)[0]).toHaveAttribute('data-asset-id','mat-fc00332');
  click('选用为领口配料');expect(useDesignStore.getState().companyDraft?.assets?.materials.neck?.id).toBe('mat-fc00332');
  fireEvent.click(screen.getByLabelText('仅显示当前可用'));fireEvent.change(screen.getByLabelText('资产细分类'),{target:{value:'cuff'}});
  expect(cards(container)).toHaveLength(1);expect(within(cards(container)[0] as HTMLElement).getByRole('button')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('搜索资产'),{target:{value:'does-not-exist'}});expect(cards(container)).toHaveLength(0);expect(screen.getByText('没有符合筛选条件的资产。')).toBeInTheDocument();
});
it('palette, material and finish actions affect the actual company SVG, with undo and individual material removal',()=>{
  const {container:library,unmount}=panel();fireEvent.click(within(library.querySelector('[data-asset-id="mat-fc304"]')! as HTMLElement).getByRole('button'));expect(useDesignStore.getState().companyDraft?.fabric).toBe('FC304 棉盖丝平纹');
  click('配色库');fireEvent.change(screen.getByLabelText('搜索资产'),{target:{value:'#808080'}});click('选用配色');
  fireEvent.change(screen.getByLabelText('搜索资产'),{target:{value:''}});click('工艺方案');const buttons=screen.getAllByRole('button',{name:'选用工艺方案'});expect(buttons.filter(b=>!b.hasAttribute('disabled'))).toHaveLength(1);fireEvent.click(buttons[0]);
  unmount();const {container}=render(<CompanyDesignBoard onMapping={()=>{}}/>);expect(container.querySelector('[data-part="body"]')).toHaveAttribute('fill','#808080');
  expect(screen.getByLabelText('公司款式成分')).toHaveValue('棉34% / 粘胶34% / 涤纶32%');
  click('解除衣身主料关联');expect(useDesignStore.getState().companyDraft?.assets?.materials.main).toBeUndefined();expect(screen.getByLabelText('公司款式面料')).toHaveValue('FC304 棉盖丝平纹');
  act(()=>useDesignStore.getState().undo());expect(useDesignStore.getState().companyDraft?.assets?.materials.main?.id).toBe('mat-fc304');
});
it('structure filters render only the requested family; preview and apply change actual source paths and remove old pieces',()=>{
  const {container}=panel(),original=useDesignStore.getState().draft;click('结构组合');expect(cards(container)).toHaveLength(25);
  fireEvent.change(screen.getByLabelText('资产细分类'),{target:{value:'button-up-shirt'}});expect(cards(container)).toHaveLength(6);
  const short=container.querySelector('[data-asset-id="shirt-short-baseball"]')!;fireEvent.click(within(short as HTMLElement).getByRole('button'));
  const preview=screen.getByTestId('asset-cad-preview');expect(preview.querySelector('[data-piece="simon.sleeve"]')).not.toBeNull();expect(preview.querySelector('[data-piece="simon.cuff"]')).toBeNull();expect(useDesignStore.getState().draft).toBe(original);
  const path=preview.querySelector('[data-piece="simon.sleeve"][data-layer="seam-line"]')!.getAttribute('d');click('应用预览结构到当前裁片');expect(useDesignStore.getState().draft.paths.find(p=>p.id==='simon.sleeve:seam')?.data).toBe(path);expect(useDesignStore.getState().draft.pieces).toHaveLength(7);
  fireEvent.change(screen.getByLabelText('搜索资产'),{target:{value:'不存在'}});expect(cards(container)).toHaveLength(0);expect(screen.queryByTestId('asset-cad-preview')).toBeNull();
});
it('templates expose blocked entries accurately and candidate export keeps unlinked company CAD explicit',()=>{
  const {container}=panel();click('裁片模板');expect(cards(container)).toHaveLength(14);
  fireEvent.change(screen.getByLabelText('资产细分类'),{target:{value:'blocked'}});expect(cards(container)).toHaveLength(5);expect(cards(container).every(c=>(c.querySelector('button') as HTMLButtonElement).disabled)).toBe(true);
  click('导出资产关联候选');const data=JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![0]);expect(data.cad.companyLinked).toBe(false);expect(data.productionApproved).toBe(false);expect(data.remoteSync).toBe('not-performed');
});
it('the workspace entry and company shortcut open the library and return to the company sheet without changing CAD',async()=>{
  const before=useDesignStore.getState().draft;
  render(<CanvasArea showSketch showPattern={false} onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#888888"/>);
  await screen.findByTestId('piece-design-board');click('参考资料');click('公司设计稿');await screen.findByTestId('company-design-board');click('从资产库选用面料 / 工艺');await screen.findByTestId('asset-library');
  expect(screen.getByRole('button',{name:'资产库'})).toHaveAttribute('aria-pressed','true');click('原稿面料');fireEvent.click(screen.getByText(/应用范围 ·/));click('查看参考资料');await screen.findByTestId('company-design-board');expect(useDesignStore.getState().draft).toBe(before);
});
