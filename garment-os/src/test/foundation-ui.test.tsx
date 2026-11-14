import {useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {CategoryWorkbench} from '@/features/category-workbench/CategoryWorkbench';
import {ConstructionPanel} from '@/features/piece-library/ConstructionPanel';
import {StandardGeneratorPanel} from '@/features/piece-library/StandardGeneratorPanel';
import {AssetLibrary} from '@/features/asset-library/AssetLibrary';
import {TemplateManager} from '@/features/template-library/components/TemplateManager';
import {useDesignStore} from '@/store/useDesignStore';
import {usePieceLibraryStore} from '@/store/pieceLibraryStore';
import {FOUNDATION_MODULES} from '@/data/foundationModules';
import {foundationParameters,PANTS_MEASUREMENT_FIELDS} from '@/data/foundationMethods';
import {TEMPLATE_SOURCE_PIECES} from '@/data/templateCapabilities';
import {PIECE_ROLE_MAP} from '@/data/pieceTaxonomy';
const navigate=vi.fn();
function Workbench({initial='round-short-tee'}:{initial?:string}){const [id,setId]=useState(initial);return <CategoryWorkbench categoryId={id} onCategoryChange={setId} onNavigate={navigate}/>;}
beforeEach(()=>{useDesignStore.getState().newDesign();usePieceLibraryStore.getState().clearTagFilter();});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('T-shirt quick changes replace the actual sleeve while preserving body contours and route to its controls',()=>{
  render(<Workbench/>);fireEvent.click(screen.getByRole('button',{name:'选用此品类模板'}));
  const before=useDesignStore.getState().draft.paths;
  fireEvent.click(screen.getByRole('button',{name:'应用加长短袖'}));
  const s=useDesignStore.getState();expect(s.construction?.options.sleeveLength).toBe(.7);
  expect(s.draft.paths.find(p=>p.id==='teagan.sleeve:seam')?.data).not.toBe(before.find(p=>p.id==='teagan.sleeve:seam')?.data);
  for(const id of ['teagan.front:seam','teagan.back:seam'])expect(s.draft.paths.find(p=>p.id===id)?.data).toBe(before.find(p=>p.id===id)?.data);
  expect(navigate).toHaveBeenLastCalledWith({kind:'pieces',view:'construction'});
  fireEvent.click(screen.getByRole('button',{name:'应用收口短袖'}));expect(useDesignStore.getState().construction?.options.sleeveEase).toBe(.05);
  expect(screen.getByRole('table',{name:'基础款部件接口'})).toHaveTextContent('胸贴袋模块');
  expect(screen.getByText('已定义 / 待接通')).toBeInTheDocument();
});
it('pants require explicit template selection, generate three source pieces and keep garment assembly disabled',()=>{
  const {container}=render(<Workbench initial="joggers"/>);
  expect(screen.getByRole('button',{name:'应用基础直筒裤'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'选用此品类模板'}));
  expect(useDesignStore.getState().draft.pieces).toHaveLength(3);
  expect(screen.queryByRole('button',{name:'成衣曲面 / 贴图示意'})).toBeNull();
  expect(screen.queryByRole('button',{name:'三维裁片 / 毫米量尺 / 导出'})).toBeNull();
  const before=useDesignStore.getState().draft.paths.find(p=>p.id==='paco.front:seam')!.data;
  fireEvent.click(screen.getByRole('button',{name:'应用宽脚口变化'}));
  expect(useDesignStore.getState().draft.paths.find(p=>p.id==='paco.front:seam')!.data).not.toBe(before);
  expect(container.querySelector('[data-component-contract="pants.side-pocket"]')).toHaveTextContent('源裁法待核实');
});
it('T-shirt controls commit only valid values and expose requested and capped source dimensions',()=>{
  act(()=>useDesignStore.getState().applyPattern('t-shirt'));const {container}=render(<ConstructionPanel/>);
  const input=screen.getByRole('spinbutton',{name:'短袖延伸比例'}),before=useDesignStore.getState().draft;
  fireEvent.change(input,{target:{value:'.7'}});expect(useDesignStore.getState().draft).toBe(before);fireEvent.blur(input);
  expect(useDesignStore.getState().construction?.options.sleeveLength).toBe(.7);
  const current=useDesignStore.getState().draft,input2=screen.getByRole('spinbutton',{name:'短袖延伸比例'});
  fireEvent.change(input2,{target:{value:''}});fireEvent.blur(input2);expect(screen.getByRole('alert')).toHaveTextContent('不能为空');expect(useDesignStore.getState().draft).toBe(current);
  fireEvent.change(input2,{target:{value:'2'}});fireEvent.blur(input2);expect(screen.getByRole('alert')).toHaveTextContent('范围');expect(useDesignStore.getState().draft).toBe(current);
  expect(container.querySelector('[data-construction-operation="tee-sleeve-module"]')).toHaveTextContent('袖下口');
  fireEvent.click(screen.getByRole('button',{name:'恢复源构型'}));
  expect(screen.getByRole('spinbutton',{name:'短袖延伸比例'})).toHaveValue(.3);expect(screen.queryByRole('alert')).toBeNull();
});
it('pants generation exposes thirteen direct lower measurements and removes invalid previews until corrected',()=>{
  act(()=>useDesignStore.getState().applyPattern('elastic-waist-pants'));render(<StandardGeneratorPanel/>);
  for(const f of PANTS_MEASUREMENT_FIELDS)expect(screen.getByRole('spinbutton',{name:f.label})).toBeInTheDocument();
  expect(screen.queryByRole('spinbutton',{name:'胸围'})).toBeNull();
  const input=screen.getByRole('spinbutton',{name:'后臀弧长'}),value=(input as HTMLInputElement).value;
  fireEvent.change(input,{target:{value:''}});expect(screen.getByRole('alert')).toHaveTextContent('后臀');expect(screen.getByTestId('standard-apply')).toBeDisabled();expect(screen.queryByTestId('standard-preview')).toBeNull();
  fireEvent.change(input,{target:{value}});expect(screen.getByTestId('standard-apply')).toBeEnabled();
});
it('pants structure filtering shows only its three variants and previews real pants source paths',()=>{
  const {container}=render(<AssetLibrary initialTab="structure" categoryId="joggers" onCompany={()=>{}} onPattern={()=>{}}/>);
  const cards=[...container.querySelectorAll('article[data-asset-id]')];expect(cards).toHaveLength(3);
  fireEvent.click(within(cards.find(c=>c.getAttribute('data-asset-id')==='pants-wide-opening')! as HTMLElement).getByRole('button'));
  expect(screen.getByTestId('asset-cad-preview').querySelector('[data-piece="paco.front"][data-layer="seam-line"]')).not.toBeNull();
  expect(screen.getByRole('region',{name:'结构裁片预览'})).toHaveTextContent('前片外侧缝长');
});
it('the pants picker displays its own net contour instead of an upper-body fallback',()=>{
  const {container}=render(<TemplateManager/>);fireEvent.click(screen.getByRole('button',{name:'基础裤装'}));
  const card=container.querySelector('[data-testid="template-elastic-waist-pants"]')!;expect(card).not.toBeNull();expect(card.querySelector('svg path')).not.toBeNull();
});
it('component contracts have valid roles, source ownership and strict option bindings; unresolved attachments stay blocked',()=>{
  expect(new Set(FOUNDATION_MODULES.map(m=>m.id)).size).toBe(FOUNDATION_MODULES.length);
  for(const m of FOUNDATION_MODULES){
    for(const role of [...m.hostRoles,...m.componentRoles])expect(PIECE_ROLE_MAP[role]).toBeDefined();
    expect(m.requiredDimensions.length).toBeGreaterThan(0);expect(m.interfaces.length).toBeGreaterThan(0);
    for(const id of m.templateIds){expect(TEMPLATE_SOURCE_PIECES[id]).toBeDefined();for(const key of m.optionKeys)expect(foundationParameters(id)?.some(p=>p.key===key)).toBe(true);for(const source of m.sourceIds)expect(TEMPLATE_SOURCE_PIECES[id]).toContain(source);}
    if(m.stage!=='parameterized'){expect(m.blockingReasons.length).toBeGreaterThan(0);expect(m.optionKeys).toEqual([]);}
  }
});
