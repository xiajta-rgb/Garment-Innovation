import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { StrictMode } from 'react';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { Pattern3dPanel } from '@/features/piece-library/Pattern3dPanel';
import { createPhysicalRenderer } from '@/features/piece-library/physical-renderer';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { runMeshJob } from '@/application/pattern-mesh-job';
import { mapSurfaceAnchor,projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import type { MeshJob,MeshReply } from '@/application/pattern-mesh-job';
import type { RenderView } from '@/features/piece-library/physical-renderer';

vi.mock('@/features/piece-library/physical-renderer',()=>({createPhysicalRenderer:vi.fn(()=>({mode:'WebGL2',update:vi.fn(),dispose:vi.fn()}))}));
class ControlledWorker {
  static all:ControlledWorker[]=[];
  onmessage:((event:{data:MeshReply})=>void)|null=null;onerror:(()=>void)|null=null;job!:MeshJob;terminated=false;
  constructor(){ControlledWorker.all.push(this);}
  postMessage(job:MeshJob){this.job=job;}
  terminate(){this.terminated=true;}
  reply(){this.onmessage?.({data:runMeshJob(this.job)});}
}
beforeEach(()=>{ControlledWorker.all=[];vi.stubGlobal('Worker',ControlledWorker);vi.stubGlobal('PointerEvent',MouseEvent);useDesignStore.getState().newDesign();useDesignStore.getState().applyPattern('bound-tank');usePieceLibraryStore.getState().clearTagFilter();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
function renderPieces(){const result=render(<Pattern3dPanel/>);fireEvent.click(screen.getByRole('button',{name:'裁片检查'}));return result;}
async function ready(mode='WebGL2'){const result=renderPieces();act(()=>ControlledWorker.all[0].reply());await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent(mode));if(mode==='WebGL2')await waitFor(()=>expect(view().size.height).toBe(420));return result;}
const renderer=()=>vi.mocked(createPhysicalRenderer).mock.results.at(-1)!.value;
const view=()=>renderer().update.mock.calls.at(-1)![0] as RenderView;
it('cancelled, wrong-ID and previous-revision worker replies cannot revive outdated geometry',async()=>{
  renderPieces();const old=ControlledWorker.all[0];
  act(()=>useDesignStore.getState().applyPattern('hooded-zip-sweatshirt'));const current=ControlledWorker.all[1];expect(old.terminated).toBe(true);
  act(()=>old.reply());expect(screen.queryByTestId('mesh-preview')).toBeNull();
  act(()=>current.onmessage?.({data:{requestId:-1,revision:current.job.revision,error:'wrong'}}));expect(screen.queryByRole('alert')).toBeNull();
  act(()=>current.reply());await waitFor(()=>expect(screen.getByTestId('mesh-summary')).toHaveTextContent('14 片实际数量'));
  act(()=>useDesignStore.getState().updateMeasurements({headCirc:undefined}));expect(screen.queryByTestId('mesh-preview')).toBeNull();expect(current.terminated).toBe(true);expect(screen.getByRole('alert')).toHaveTextContent('头围');
  act(()=>current.reply());expect(screen.queryByTestId('mesh-preview')).toBeNull();
});
it('geometry generation is independent of camera, appearance, filters and viewport resize; resources dispose',async()=>{
  const result=await ready(),initial=view(),instance=renderer();
  fireEvent.click(screen.getByRole('button',{name:'放大'}));fireEvent.change(screen.getByRole('slider',{name:'三维水平旋转'}),{target:{value:72}});
  act(()=>{useDesignStore.getState().setColor('#123456');useDesignStore.getState().setFabric('solid');});
  act(()=>usePieceLibraryStore.getState().setTagFilter(['binding']));fireEvent(window,new Event('resize'));
  expect(view().camera.pixelsPerMm).toBe(initial.camera.pixelsPerMm*1.25);expect(view().visible).toHaveLength(3);expect(ControlledWorker.all).toHaveLength(1);expect(createPhysicalRenderer).toHaveBeenCalledTimes(1);
  expect(vi.mocked(createPhysicalRenderer).mock.calls[0][1].panels).toHaveLength(5);result.unmount();expect(instance.dispose).toHaveBeenCalledTimes(1);expect(ControlledWorker.all[0].terminated).toBe(true);
});
it('surface clicks display true source coordinates and same-panel length; table rows stay bounded',async()=>{
  await ready();const model=vi.mocked(createPhysicalRenderer).mock.calls[0][1],panel=model.panels[0];
  fireEvent.click(screen.getByRole('button',{name:'量尺工具'}));
  fireEvent.click(screen.getByRole('button',{name:'当前片正视'}));const current=view();
  const a=mapSurfaceAnchor(model,panel.id,0,[.2,.3,.5]),b=mapSurfaceAnchor(model,panel.id,1,[.2,.3,.5]);
  const p=projectPhysicalPoint(a.worldMm,current.camera,current.size),q=projectPhysicalPoint(b.worldMm,current.camera,current.size),canvas=screen.getByTestId('mesh-preview');
  fireEvent.pointerUp(canvas,{clientX:p[0],clientY:p[1]});fireEvent.pointerUp(canvas,{clientX:q[0],clientY:q[1]});
  expect(screen.getAllByTestId('surface-anchor')).toHaveLength(2);expect(screen.getByTestId('surface-measure')).toHaveTextContent('同片平面直线');
  expect(screen.getByTestId('surface-measure')).toHaveTextContent(Math.hypot(a.localMm[0]-b.localMm[0],a.localMm[1]-b.localMm[1]).toFixed(3));
  const table=screen.getByRole('table',{name:'三维顶点来源'});expect(table.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(50);
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));expect(table.querySelector('tbody tr td')).toHaveTextContent('50');
  const curve=panel.sourceEdges.find(e=>e.kind==='curve')!;fireEvent.change(screen.getByRole('combobox',{name:'源轮廓边'}),{target:{value:curve.id}});expect(screen.getByTestId('source-edge-length')).toHaveTextContent(curve.lengthMm.toFixed(3));
});
it('1:1 needs physical ruler and a front-facing panel; DPR change invalidates calibration without changing CAD scale',async()=>{
  await ready();const actual=screen.getByRole('button',{name:'按实体 1:1 显示当前片'});expect(actual).toBeDisabled();
  fireEvent.change(screen.getByRole('spinbutton',{name:'实体尺读数 mm'}),{target:{value:55}});fireEvent.click(screen.getByRole('button',{name:'保存本屏校准'}));expect(actual).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'当前片正视'}));expect(actual).not.toBeDisabled();fireEvent.click(actual);expect(view().camera.pixelsPerMm).toBe(4);
  expect(screen.getByTestId('screen-calibration')).toHaveTextContent('1.000:1');
  vi.stubGlobal('devicePixelRatio',2);fireEvent(window,new Event('resize'));expect(screen.getByTestId('screen-calibration')).toHaveTextContent('校准失效');expect(actual).toBeDisabled();expect(view().camera.pixelsPerMm).toBe(4);
  vi.stubGlobal('devicePixelRatio',1);fireEvent(window,new Event('resize'));expect(screen.getByTestId('screen-calibration')).toHaveTextContent('校准失效');expect(actual).toBeDisabled();
});
it('worker failures show unavailable and never run synchronous generation as a hidden fallback',async()=>{
  renderPieces();act(()=>ControlledWorker.all[0].onerror?.());expect(screen.getByRole('alert')).toHaveTextContent('后台网格计算不可用');expect(createPhysicalRenderer).not.toHaveBeenCalled();
});
it('context loss switches to real projected paths, preserves measurements and retries on a new canvas (GPU mocked)',async()=>{
  const {container}=await ready();const canvas=screen.getByTestId('mesh-preview'),instance=renderer();
  const model=vi.mocked(createPhysicalRenderer).mock.calls[0][1],panel=model.panels[0];
  fireEvent.click(screen.getByRole('button',{name:'当前片正视'}));const before=view();
  fireEvent.click(screen.getByRole('button',{name:'量尺工具'}));
  const a=mapSurfaceAnchor(model,panel.id,0,[.2,.3,.5]),b=mapSurfaceAnchor(model,panel.id,1,[.2,.3,.5]);
  const p=projectPhysicalPoint(a.worldMm,before.camera,before.size),q=projectPhysicalPoint(b.worldMm,before.camera,before.size);
  fireEvent.pointerUp(canvas,{clientX:p[0],clientY:p[1]});
  fireEvent(canvas,new Event('webglcontextlost',{cancelable:true}));
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('SVG'));
  const compatible=screen.getByTestId('mesh-preview');expect(compatible.tagName.toLowerCase()).toBe('svg');
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(5);expect(instance.dispose).toHaveBeenCalledOnce();
  fireEvent.pointerUp(compatible,{clientX:q[0],clientY:q[1]});
  const measure=screen.getByTestId('surface-measure').textContent;
  expect(measure).toContain(Math.hypot(a.localMm[0]-b.localMm[0],a.localMm[1]-b.localMm[1]).toFixed(3));
  const path=container.querySelector('[data-projected-panel]')!.getAttribute('d');
  fireEvent.change(screen.getByRole('slider',{name:'三维水平旋转'}),{target:{value:65}});
  expect(container.querySelector('[data-projected-panel]')!.getAttribute('d')).not.toBe(path);
  expect(screen.getByTestId('surface-measure')).toHaveTextContent(measure!);
  fireEvent(canvas,new Event('webglcontextrestored'));expect(screen.getByTestId('render-mode')).toHaveTextContent('SVG');
  fireEvent.click(screen.getByRole('button',{name:'重试硬件渲染'}));
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('WebGL2'));
  expect(screen.getByTestId('mesh-preview')).not.toBe(canvas);
  expect(view().camera.pixelsPerMm).toBe(before.camera.pixelsPerMm);expect(view().camera.yawDeg).toBe(65);
  expect(screen.getByTestId('surface-measure')).toHaveTextContent(measure!);expect(ControlledWorker.all).toHaveLength(1);
});

it('unavailable or throwing canvas initialization falls back to SVG without requiring either graphics context',async()=>{
  vi.mocked(createPhysicalRenderer).mockReturnValueOnce({mode:'unavailable',update:vi.fn(),dispose:vi.fn()});
  const {container}=await ready('SVG');
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('SVG'));
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(5);
  vi.mocked(createPhysicalRenderer).mockImplementationOnce(()=>{throw new Error('canvas initialization failed');});
  fireEvent.click(screen.getByRole('button',{name:'重试硬件渲染'}));
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('SVG'));
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(5);
  expect(ControlledWorker.all).toHaveLength(1);
});

it('manual compatible mode uses exact physical projection, filters paths and keeps interaction controls active',async()=>{
  const {container}=await ready(),state=view(),model=vi.mocked(createPhysicalRenderer).mock.calls[0][1],panel=model.panels[0];
  const [x,y]=projectPhysicalPoint(panel.positionsMm[0],state.camera,state.size);
  fireEvent.click(screen.getByRole('button',{name:'切换兼容显示'}));
  expect(container.querySelector(`[data-projected-panel="${panel.id}"]`)!.getAttribute('d')!.startsWith(`M${x} ${y} L`)).toBe(true);
  fireEvent.click(screen.getByRole('checkbox',{name:'显示三角网格'}));
  expect(container.querySelectorAll('[data-projected-wire]')).toHaveLength(5);
  fireEvent.click(screen.getByRole('checkbox',{name:'显示未缝合对应线'}));
  expect(container.querySelectorAll('[data-projected-seam]').length).toBeGreaterThan(0);
  act(()=>usePieceLibraryStore.getState().setTagFilter(['binding']));
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(3);expect(container.querySelectorAll('[data-projected-wire]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-projected-seam]')).toHaveLength(0);expect(ControlledWorker.all).toHaveLength(1);
});

it('a render failure callback switches to compatible display without regenerating CAD',async()=>{
  const {container}=await ready();
  const failure=vi.mocked(createPhysicalRenderer).mock.calls[0][3]!;
  act(()=>failure());
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('SVG'));
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(5);expect(ControlledWorker.all).toHaveLength(1);
});

it('StrictMode releases the first renderer and keeps the remounted surface usable',async()=>{
  const {container}=render(<StrictMode><Pattern3dPanel/></StrictMode>);fireEvent.click(screen.getByRole('button',{name:'裁片检查'}));
  act(()=>ControlledWorker.all.at(-1)!.reply());
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('WebGL2'));
  expect(createPhysicalRenderer).toHaveBeenCalledTimes(2);
  expect(vi.mocked(createPhysicalRenderer).mock.results[0].value.dispose).toHaveBeenCalledOnce();
  expect(renderer().dispose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'切换兼容显示'}));
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(5);
});

it('a view-update exception recovers to projected geometry instead of crashing the page',async()=>{
  const {container}=await ready();
  renderer().update.mockImplementationOnce(()=>{throw new Error('view upload failed');});
  fireEvent.click(screen.getByRole('button',{name:'放大'}));
  await waitFor(()=>expect(screen.getByTestId('render-mode')).toHaveTextContent('SVG'));
  expect(container.querySelectorAll('[data-projected-panel]')).toHaveLength(5);expect(ControlledWorker.all).toHaveLength(1);
});

it('viewport drag orbits, Shift drag pans and the wheel zooms without touching CAD or measuring',async()=>{
  await ready();const canvas=screen.getByTestId('mesh-preview'),before=view(),source=useDesignStore.getState().draft;
  fireEvent.pointerDown(canvas,{button:0,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{clientX:150,clientY:120});fireEvent.pointerUp(canvas,{clientX:150,clientY:120});
  expect(view().camera.yawDeg).toBe(before.camera.yawDeg+20);expect(view().camera.tiltDeg).toBe(before.camera.tiltDeg+8);
  const rotated=view();fireEvent.pointerDown(canvas,{button:1,shiftKey:true,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{clientX:125,clientY:115});fireEvent.pointerUp(canvas,{clientX:125,clientY:115});
  expect(view().camera.panCss).toEqual([25,15]);expect(view().camera.yawDeg).toBe(rotated.camera.yawDeg);
  fireEvent.wheel(canvas,{deltaY:-120});expect(view().camera.pixelsPerMm).toBeGreaterThan(before.camera.pixelsPerMm);
  expect(screen.queryByTestId('surface-anchor')).toBeNull();expect(useDesignStore.getState().draft).toBe(source);expect(ControlledWorker.all).toHaveLength(1);
});

it('frame selected, isolation, hidden objects and restore all change real visibility without rebuilding the mesh',async()=>{
  await ready();const before=view();
  fireEvent.click(screen.getByRole('button',{name:'聚焦当前片'}));expect(view().camera.pixelsPerMm).toBeGreaterThan(before.camera.pixelsPerMm);
  fireEvent.click(screen.getByRole('button',{name:'隔离当前片'}));expect(view().visible).toEqual([before.selected]);
  fireEvent.click(screen.getByRole('button',{name:'退出隔离'}));expect(view().visible).toHaveLength(5);
  fireEvent.click(screen.getByRole('button',{name:`隐藏 ${before.selected}`}));expect(view().visible).not.toContain(before.selected);expect(view().visible).toHaveLength(4);
  fireEvent.click(screen.getByRole('button',{name:'全部显示'}));expect(view().visible).toHaveLength(5);expect(ControlledWorker.all).toHaveLength(1);
});

it('axis presets and keyboard framing are functional, and editing an input does not trigger viewport shortcuts',async()=>{
  await ready();fireEvent.click(screen.getByRole('button',{name:'前视图'}));expect(view().camera.yawDeg).toBe(0);expect(view().camera.tiltDeg).toBe(0);
  fireEvent.click(screen.getByRole('button',{name:'Y 轴视图'}));expect(view().camera.tiltDeg).toBe(90);
  const stage=screen.getByLabelText('三维视口工作区');fireEvent.keyDown(stage,{key:'3'});expect(view().camera.yawDeg).toBe(90);expect(view().camera.tiltDeg).toBe(0);
  fireEvent.keyDown(stage,{key:'f'});const focused=view().camera.pixelsPerMm;fireEvent.keyDown(stage,{key:'Home'});expect(view().camera.pixelsPerMm).toBeLessThan(focused);
  fireEvent.keyDown(screen.getByLabelText('三维水平旋转'),{key:'7'});expect(view().camera.tiltDeg).toBe(0);expect(ControlledWorker.all).toHaveLength(1);
});

it('compatibility navigation and the grid toggle use the same scene state as the hardware viewport',async()=>{
  const {container}=await ready();fireEvent.click(screen.getByRole('checkbox',{name:'网格'}));expect(view().grid).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'切换兼容显示'}));expect(screen.queryByTestId('projected-floor-grid')).toBeNull();
  const canvas=screen.getByTestId('mesh-preview'),path=container.querySelector('[data-projected-panel]')!.getAttribute('d');
  fireEvent.pointerDown(canvas,{button:1,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{clientX:160,clientY:130});fireEvent.pointerUp(canvas,{clientX:160,clientY:130});
  expect(container.querySelector('[data-projected-panel]')!.getAttribute('d')).not.toBe(path);
  fireEvent.click(screen.getByRole('checkbox',{name:'网格'}));expect(screen.getByTestId('projected-floor-grid')).toBeInTheDocument();expect(ControlledWorker.all).toHaveLength(1);
});
