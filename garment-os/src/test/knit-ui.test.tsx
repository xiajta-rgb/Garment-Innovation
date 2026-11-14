import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { ConstructionPanel } from '@/features/piece-library/ConstructionPanel';
import { StandardGeneratorPanel } from '@/features/piece-library/StandardGeneratorPanel';
import { AssemblyPanel } from '@/features/piece-library/AssemblyPanel';
import { TemplateManager } from '@/features/template-library/components/TemplateManager';
import { PieceLibraryView } from '@/features/piece-library/PieceLibraryView';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
beforeEach(()=>{
  useDesignStore.getState().newDesign();useDesignStore.getState().applyPattern('hooded-zip-sweatshirt');usePieceLibraryStore.getState().clearTagFilter();
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('construction switches remove real ribbing/pocket shapes, measurements, placement lines and interfaces',()=>{
  const {container}=render(<ConstructionPanel/>);expect(screen.getByTestId('construction-summary')).toHaveTextContent('7 种裁片');
  fireEvent.change(screen.getByRole('spinbutton',{name:'罗纹设计缩率'}),{target:{value:'.2'}});fireEvent.blur(screen.getByRole('spinbutton',{name:'罗纹设计缩率'}));
  expect(useDesignStore.getState().construction!.options.ribbingStretch).toBe(.2);
  fireEvent.change(screen.getByRole('combobox',{name:'罗纹接条'}),{target:{value:'false'}});
  expect(screen.getByTestId('construction-summary')).toHaveTextContent('5 种裁片');expect(screen.queryByRole('spinbutton',{name:'罗纹设计缩率'})).toBeNull();
  expect(useDesignStore.getState().construction!.options).not.toHaveProperty('ribbingStretch');
  fireEvent.change(screen.getByRole('combobox',{name:'前贴袋'}),{target:{value:'false'}});
  expect(screen.getByTestId('construction-summary')).toHaveTextContent('4 种裁片');expect(screen.queryByRole('spinbutton',{name:'袋宽比例'})).toBeNull();
  expect(container.querySelector('[data-construction-operation="pocket-placement"]')).toBeNull();
  expect(useDesignStore.getState().draft.paths.some(p=>/pocket|cuff|waistband/.test(p.pieceId??''))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'恢复源构型'}));expect(screen.getByTestId('construction-summary')).toHaveTextContent('7 种裁片');
});
it('numeric options wait for commit and reject empty or invalid values without silently clamping',()=>{
  render(<ConstructionPanel/>);const original=useDesignStore.getState().draft;
  const input=screen.getByRole('spinbutton',{name:'帽高比例'});fireEvent.change(input,{target:{value:'.6'}});expect(useDesignStore.getState().draft).toBe(original);
  fireEvent.blur(input);expect(useDesignStore.getState().construction!.options.hoodHeight).toBe(.6);
  const before=useDesignStore.getState().draft;const next=screen.getByRole('spinbutton',{name:'帽高比例'});
  fireEvent.change(next,{target:{value:''}});fireEvent.blur(next);expect(screen.getByRole('alert')).toHaveTextContent('不能为空');expect(useDesignStore.getState().draft).toBe(before);
  fireEvent.change(next,{target:{value:'.9'}});fireEvent.blur(next);expect(screen.getByRole('alert')).toHaveTextContent('范围');expect(useDesignStore.getState().draft).toBe(before);
});
it('generator uses independent head circumference, hides missing-input geometry and filters to the two ribbing pieces',()=>{
  const {container}=render(<StandardGeneratorPanel/>);
  act(()=>usePieceLibraryStore.getState().setTagFilter(['material:ribbing']));
  expect([...container.querySelectorAll('[data-standard-piece]')].map(e=>e.getAttribute('data-standard-piece')).sort()).toEqual(['huey.cuff','huey.waistband']);
  act(()=>usePieceLibraryStore.getState().setTagFilter(['hood']));
  const before=container.querySelector('[data-source-path="huey.hood:seam"]')!.getAttribute('d');
  const head=useDesignStore.getState().measurements.headCirc!+25;
  fireEvent.change(screen.getByRole('spinbutton',{name:'头围'}),{target:{value:head}});
  expect(container.querySelector('[data-source-path="huey.hood:seam"]')!.getAttribute('d')).not.toBe(before);
  fireEvent.click(screen.getByTestId('standard-apply'));expect(useDesignStore.getState().measurements.headCirc).toBe(head);
  fireEvent.change(screen.getByRole('spinbutton',{name:'头围'}),{target:{value:''}});
  expect(screen.getByRole('alert')).toHaveTextContent('头围');expect(screen.getByTestId('standard-apply')).toBeDisabled();expect(screen.queryByTestId('standard-preview')).toBeNull();
});
it('binding source cut edges and exact fold guides are visible; the composition labels ribbing as its own main material',()=>{
  act(()=>useDesignStore.getState().applyPattern('bound-tank'));const {container}=render(<ConstructionPanel/>);
  expect(container.querySelectorAll('[data-construction-guide]')).toHaveLength(6);
  cleanup();render(<StandardGeneratorPanel/>);fireEvent.click(screen.getByRole('button',{name:/领口四折包条/}));expect(screen.getByText(/源展开裁边（不另加缝份）/)).toBeInTheDocument();
  cleanup();act(()=>useDesignStore.getState().applyPattern('hooded-zip-sweatshirt'));const composition=render(<AssemblyPanel/>);
  expect(composition.container.querySelector('[data-assembly-piece="huey.cuff"]')).toHaveTextContent('罗纹');expect(screen.getByText('主材料',{selector:'th'})).toBeInTheDocument();
});
it('new templates have real generation controls and explicitly pending remote registration',()=>{
  render(<TemplateManager/>);fireEvent.click(screen.getByRole('button',{name:'连帽卫衣'}));
  expect(screen.getByTestId('template-hooded-zip-sweatshirt')).not.toBeDisabled();expect(screen.getByRole('link',{name:/元素库待登记/})).toBeInTheDocument();
  expect(screen.getByText(/14 项已审查：9 项可生成参考稿/)).toBeInTheDocument();
});
it('piece library exposes only the two-dimensional review flow', async()=>{
  act(()=>useDesignStore.getState().applyPattern('bound-tank'));
  const {container}=render(<PieceLibraryView/>);
  expect(await screen.findByTestId('piece-library')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/3D|三维/})).toBeNull();
  expect(screen.getByRole('button',{name:'裁片生成器'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'裁片组成'})).toBeInTheDocument();
  expect(container.querySelector('[data-testid="pattern-3d-panel"]')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'裁片检验 (QC)'}));
  expect(screen.getByText(/裁片标准化库/)).toBeInTheDocument();
});

it('two-dimensional piece filters keep source material and structural tags usable',()=>{
  const {container}=render(<PieceLibraryView/>);
  act(()=>usePieceLibraryStore.getState().setTagFilter(['material:ribbing']));
  expect(container.querySelectorAll('[data-standard-piece]').length).toBeGreaterThan(0);
  expect(screen.queryByTestId('pattern-3d-panel')).toBeNull();
});

