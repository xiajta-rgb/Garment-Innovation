import {useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {CategoryWorkbench} from '@/features/category-workbench/CategoryWorkbench';
import {StandardGeneratorPanel} from '@/features/piece-library/StandardGeneratorPanel';
import {ConstructionPanel} from '@/features/piece-library/ConstructionPanel';
import {MeasurementInput} from '@/features/measurements/MeasurementInput';
import {AssetLibrary} from '@/features/asset-library/AssetLibrary';
import {CanvasArea} from '@/components/layout/CanvasArea';
import {TemplateManager} from '@/features/template-library/components/TemplateManager';
import {useDesignStore} from '@/store/useDesignStore';
import {usePieceLibraryStore} from '@/store/pieceLibraryStore';
beforeEach(()=>{
  useDesignStore.getState().newDesign();useDesignStore.getState().setGender('female');useDesignStore.getState().applyPattern('panel-circle-skirt');usePieceLibraryStore.getState().clearTagFilter();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('the category connects to its actual two source identities, three presets and a pieces-only route',()=>{
  const nav=vi.fn();
  function Harness(){const [id,setId]=useState('gored-skirt');return <CategoryWorkbench categoryId={id} onCategoryChange={setId} onNavigate={nav}/>;}
  act(()=>useDesignStore.getState().applyPattern('brian-reference'));render(<Harness/>);
  fireEvent.change(screen.getByLabelText('服装品类分组'),{target:{value:'skirt'}});
  expect(screen.getByRole('button',{name:'尺寸与裁片生成'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'选用此品类模板'}));
  expect(useDesignStore.getState().activePatternId).toBe('panel-circle-skirt');expect(useDesignStore.getState().draft.pieces).toHaveLength(2);
  expect(screen.getByRole('button',{name:'尺寸与裁片生成'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'尺寸与裁片生成'}));expect(nav).toHaveBeenLastCalledWith({kind:'pieces',view:'generator'});
  expect(screen.getByTestId('category-detail')).toHaveTextContent('1 种源身份 / 2 片');
  expect(screen.getByTestId('category-detail')).toHaveTextContent('1 种源身份 / 1 片');
});
it('the generator edits a separate finished skirt length, preserves the waistband and blocks missing values',()=>{
  const {container}=render(<StandardGeneratorPanel/>);
  expect(screen.getAllByRole('spinbutton')).toHaveLength(5);expect(screen.queryByTestId('standard-input-totalLength')).toBeNull();expect(screen.queryByTestId('standard-input-bust')).toBeNull();
  const before=useDesignStore.getState().draft.paths.find(p=>p.id==='sandy.waistband:seam')!.data;
  const skirt=container.querySelector('[data-source-path="sandy.skirt:seam"]')!.getAttribute('d');
  fireEvent.change(screen.getByTestId('standard-input-skirtLength'),{target:{value:'700'}});
  expect(container.querySelector('[data-source-path="sandy.skirt:seam"]')!.getAttribute('d')).not.toBe(skirt);
  fireEvent.click(screen.getByTestId('standard-apply'));
  expect(useDesignStore.getState().measurements.skirtLength).toBe(700);
  expect(useDesignStore.getState().draft.paths.find(p=>p.id==='sandy.waistband:seam')!.data).toBe(before);
  expect(screen.getByTestId('standard-checks')).not.toHaveTextContent('迭代阈值');
  fireEvent.change(screen.getByTestId('standard-input-waistToFloor'),{target:{value:''}});
  expect(screen.getByTestId('standard-apply')).toBeDisabled();expect(screen.queryByTestId('standard-preview')).toBeNull();
});
it('panel quantity controls the actual cutlist and mesh instances; fractional quantities cannot change geometry',()=>{
  render(<ConstructionPanel/>);
  const input=screen.getByRole('spinbutton',{name:'实际裙幅片数'}),before=useDesignStore.getState().draft;
  fireEvent.change(input,{target:{value:'4'}});expect(useDesignStore.getState().draft).toBe(before);fireEvent.blur(input);
  expect(useDesignStore.getState().draft.paths.find(p=>p.id==='sandy.skirt:seam')?.cutQty).toBe(4);
  expect(useDesignStore.getState().draft.paths.filter(p=>p.pieceRole==='skirt.gore').length).toBeGreaterThan(0);
  const valid=useDesignStore.getState().draft,next=screen.getByRole('spinbutton',{name:'实际裙幅片数'});
  fireEvent.change(next,{target:{value:'2.5'}});fireEvent.blur(next);expect(screen.getByRole('alert')).toHaveTextContent('范围');expect(useDesignStore.getState().draft).toBe(valid);
});
it('the construction report shows requested height, native snapped height and the difference',()=>{
  act(()=>useDesignStore.getState().updateMeasurements({waistToFloor:1050,skirtLength:600}));render(<ConstructionPanel/>);
  const table=screen.getByRole('table',{name:'腰头折返与装裙净长尺寸'});
  expect(within(table).getByRole('row',{name:/请求腰头高度/})).toHaveTextContent('42.000 mm');
  expect(within(table).getByRole('row',{name:/源实际腰头成品高/})).toHaveTextContent('40.000 mm');
  expect(within(table).getByRole('row',{name:/高度吸附差/})).toHaveTextContent('-2.000 mm');
  expect(screen.getByTestId('construction-summary')).toHaveTextContent('未获装配放行');
});
it('the sidebar uses lower-body inputs and keeps unknown measurements visible',()=>{
  act(()=>useDesignStore.getState().updateMeasurements({waistToFloor:undefined}));render(<MeasurementInput/>);
  expect(screen.queryByText('版型 (放松量)')).toBeNull();expect(screen.getByText('待输入')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/测量值/}));
  expect(screen.getAllByRole('spinbutton')).toHaveLength(5);expect(screen.getByRole('spinbutton',{name:'腰到地长度'})).toHaveValue(null);
  expect(screen.queryByRole('spinbutton',{name:'胸围'})).toBeNull();
});
it('skirt presets filter real previews and display skirt length instead of HPS garment length',()=>{
  const {container}=render(<AssetLibrary initialTab="structure" categoryId="gored-skirt" onCompany={()=>{}} onPattern={()=>{}}/>);
  expect(container.querySelectorAll('[data-asset-id]')).toHaveLength(3);
  fireEvent.click(within(container.querySelector('[data-asset-id="skirt-gather-4"]') as HTMLElement).getByRole('button',{name:'预览此结构'}));
  const preview=screen.getByRole('region',{name:'结构裁片预览'});
  expect(preview).toHaveTextContent('方案成品裙长（含腰头）');expect(preview).not.toHaveTextContent('方案衣长');
  expect(preview.querySelectorAll('figure')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'应用预览结构到当前裁片'}));
  expect(useDesignStore.getState().construction?.options.panels).toBe(4);expect(useDesignStore.getState().construction?.options.gathering).toBe(.5);
});
it('the template picker shows the actual source skirt contour and an explicitly pending element registration',()=>{
  render(<TemplateManager/>);fireEvent.click(screen.getByRole('button',{name:'裙装'}));
  const card=screen.getByTestId('template-panel-circle-skirt');expect(card.querySelector('svg path')).not.toBeNull();expect(card.querySelector('svg')).toHaveAttribute('aria-label','M 参考样本裙幅净样');
  expect(screen.getByRole('link',{name:/元素库待登记/})).toBeInTheDocument();
});
it('the main workbench keeps skirt design in the two-dimensional piece flow',async()=>{
  const {container}=render(<CanvasArea showSketch showPattern onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#cbd5e1"/>);
  expect(screen.queryByRole('button',{name:/3D|三维/})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'裁片库'}));
  expect(await screen.findByTestId('piece-library')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'裁片生成器'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'部件组合'})).toBeInTheDocument();
  expect(container.querySelector('[data-testid="pattern-3d-panel"]')).toBeNull();
});



