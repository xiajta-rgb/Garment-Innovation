import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {CompanyDesignBoard} from '@/features/company-design/CompanyDesignBoard';
import {CanvasArea} from '@/components/layout/CanvasArea';
import {useDesignStore} from '@/store/useDesignStore';
import {usePieceLibraryStore} from '@/store/pieceLibraryStore';
import {downloadText} from '@/features/files/browser-files';
import {exportSVG} from '@/features/canvas/components/canvas-export';
vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
beforeEach(()=>{useDesignStore.getState().newDesign();usePieceLibraryStore.getState().clearTagFilter();});afterEach(()=>{cleanup();vi.clearAllMocks();});

it('the default workspace starts pattern composition without silently changing CAD; company drafts remain available',async()=>{
  const draft=useDesignStore.getState().draft;
  render(<CanvasArea showSketch showPattern={false} onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#888888"/>);
  expect(await screen.findByTestId('piece-design-board')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'裁片组合设计'})).toHaveAttribute('aria-pressed','true');expect(useDesignStore.getState().draft).toBe(draft);
  fireEvent.click(screen.getByRole('button',{name:'参考资料'}));
  fireEvent.click(screen.getByRole('button',{name:'公司设计稿'}));
  expect(await screen.findByTestId('company-design-board')).toBeInTheDocument();expect(useDesignStore.getState().draft).toBe(draft);
});
it('switching the company master replaces the actual front/back figure and source reference and gates unavailable CAD',()=>{
  const onMapping=vi.fn(),{container}=render(<CompanyDesignBoard onMapping={onMapping}/>),before=useDesignStore.getState().draft;
  expect(container.querySelector('[data-company-master]')).toHaveAttribute('data-company-master','company-cot25m002');
  expect(screen.getByRole('button',{name:'使用此母版查看二维裁片'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:/微落肩套头连帽卫衣/}));
  expect(container.querySelector('[data-operation="hood"]')).not.toBeNull();expect(container.querySelector('[data-operation="pocket"]')).not.toBeNull();
  expect(screen.getByRole('button',{name:'使用此母版查看二维裁片'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'对照公司原稿'}));expect(screen.getByAltText('AT25M3288 公司原始设计稿')).toHaveAttribute('src','/company-reference/AT25M3288.webp');
  expect(screen.queryByTestId('company-design-sheet')).toBeNull();expect(useDesignStore.getState().draft).toBe(before);
  fireEvent.click(screen.getByRole('button',{name:/常规直身圆领长T/}));fireEvent.click(screen.getByRole('button',{name:'使用此母版查看二维裁片'}));
  expect(onMapping).toHaveBeenCalledOnce();expect(useDesignStore.getState().activePatternId).toBe('long-sleeve-tee');expect(useDesignStore.getState().companyDraft?.cadApplied).toBe(true);
});
it('color, finishes and draft identifiers change the real SVG and exports, and undo restores the artwork',()=>{
  const {container}=render(<CompanyDesignBoard onMapping={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('新款款号'),{target:{value:'COMP-002'}});fireEvent.change(screen.getByLabelText('公司款式颜色'),{target:{value:'#aabbcc'}});
  const field=screen.getByLabelText('罗纹领高 mm');fireEvent.change(field,{target:{value:'22'}});fireEvent.blur(field);
  expect(container.querySelector('[data-part="body"]')).toHaveAttribute('fill','#aabbcc');expect(screen.getByTestId('company-design-sheet')).toHaveTextContent('22mm 罗纹领');
  fireEvent.click(screen.getByRole('button',{name:'下载设计稿'}));expect(vi.mocked(downloadText).mock.calls.at(-1)?.[0]).toContain('COMP-002');
  exportSVG('sketch-canvas');expect(vi.mocked(downloadText).mock.calls.at(-1)?.[1]).toBe('COMP-002-设计草案.svg');
  fireEvent.click(screen.getByRole('button',{name:'下载关联数据'}));const json=JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![0]);expect(json.draft.finish.neckWidthMm).toBe(22);expect(json.source.recordId).toBe('reczz28Xjq3qifFs');expect(json.productionApproved).toBe(false);
  act(()=>useDesignStore.getState().undo());expect(screen.getByTestId('company-design-sheet')).toHaveTextContent('17.5mm 罗纹领');
});
it('a fabric change clears inherited composition/weight and invalid finishes cannot overwrite the saved setting',()=>{
  render(<CompanyDesignBoard onMapping={()=>{}}/>);
  fireEvent.change(screen.getByLabelText('公司款式面料'),{target:{value:'新面料'}});expect(screen.getByLabelText('公司款式成分')).toHaveValue('');expect(screen.getByLabelText('公司款式克重')).toHaveValue('');
  const before=useDesignStore.getState().companyDraft?.finish.neckWidthMm,field=screen.getByLabelText('罗纹领高 mm');fireEvent.change(field,{target:{value:'0'}});fireEvent.blur(field);
  expect(screen.getByRole('alert')).toBeInTheDocument();expect(useDesignStore.getState().companyDraft?.finish.neckWidthMm).toBe(before);
});
