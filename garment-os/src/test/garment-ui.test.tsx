import { beforeAll,beforeEach,afterEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { Pattern3dPanel } from '@/features/piece-library/Pattern3dPanel';
import { useDesignStore } from '@/store/useDesignStore';
import { createPattern3d } from '@/application/pattern-3d';
import { runMeshJob } from '@/application/pattern-mesh-job';
import { runGarmentJob } from '@/application/garment-assembly-job';
import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import { createGarmentRenderer } from '@/features/piece-library/garment-renderer';
import { createGarmentSoftwareRenderer } from '@/features/piece-library/garment-software-renderer';
import { readGarmentTexture } from '@/features/piece-library/garment-material';
import { downloadText } from '@/features/files/browser-files';
import type { MeshJob } from '@/application/pattern-mesh-job';
import type { GarmentJob,GarmentReply } from '@/application/garment-assembly-job';
import type { GarmentAssembly3d } from '@/types/garment3d';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=';
vi.mock('@/features/piece-library/garment-renderer',()=>({createGarmentRenderer:vi.fn(()=>({update:vi.fn(),dispose:vi.fn()}))}));
vi.mock('@/features/piece-library/garment-software-renderer',()=>({createGarmentSoftwareRenderer:vi.fn(()=>({update:vi.fn(),dispose:vi.fn()}))}));
vi.mock('@/features/piece-library/physical-renderer',()=>({createPhysicalRenderer:vi.fn(()=>({mode:'WebGL2',update:vi.fn(),dispose:vi.fn()}))}));
vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
vi.mock('@/features/piece-library/garment-material',()=>({fabricTile:vi.fn(()=>({toDataURL:()=>png})),readGarmentTexture:vi.fn(async()=>png)}));
let sewn:GarmentAssembly3d;
class ControlledWorker{
  static all:ControlledWorker[]=[];job!:MeshJob|GarmentJob;onmessage:((event:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;terminated=false;
  constructor(){ControlledWorker.all.push(this);}postMessage(job:MeshJob|GarmentJob){this.job=job;}terminate(){this.terminated=true;}
  reply(){const job=this.job;this.onmessage?.({data:'configuration' in job?runMeshJob(job):{requestId:job.requestId,revision:job.revision,model:sewn,durationMs:10}});}
}
beforeAll(()=>{useDesignStore.getState().newDesign();useDesignStore.getState().applyPattern('brian-reference');sewn=assembleGarment(createPattern3d(useDesignStore.getState().getConfiguration()));});
beforeEach(()=>{useDesignStore.getState().newDesign();useDesignStore.getState().applyPattern('brian-reference');ControlledWorker.all=[];vi.stubGlobal('Worker',ControlledWorker);vi.stubGlobal('PointerEvent',MouseEvent);vi.stubGlobal('Image',class{onload:(()=>void)|null=null;set src(_value:string){queueMicrotask(()=>this.onload?.());}});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
async function ready(){render(<Pattern3dPanel/>);act(()=>ControlledWorker.all[0].reply());expect(ControlledWorker.all).toHaveLength(2);act(()=>ControlledWorker.all[1].reply());await screen.findByTestId('garment-canvas');await waitFor(()=>expect(screen.getByTestId('garment-render-mode')).toHaveTextContent('WebGL2'));}
const view=()=>vi.mocked(createGarmentRenderer).mock.results.at(-1)!.value.update.mock.calls.at(-1)![0];
it('3D defaults to connected clothing; orbit, fabric, scale and color do not rebuild source CAD',async()=>{
  await ready();expect(screen.getByRole('button',{name:'三维成衣'})).toHaveAttribute('aria-pressed','true');expect(screen.getByTestId('garment-assembly-summary')).toHaveTextContent('4 片组成 1 个连接体');expect(screen.getByTestId('capability-status')).toHaveTextContent('面料物理未接通');expect(screen.getByTestId('capability-status')).toHaveTextContent('生产未批准');
  const draft=useDesignStore.getState().draft,canvas=screen.getByTestId('garment-canvas'),yaw=view().camera.yawDeg;
  fireEvent.pointerDown(canvas,{button:0,clientX:100,clientY:100});fireEvent.pointerMove(canvas,{clientX:160,clientY:120});fireEvent.pointerUp(canvas,{clientX:160,clientY:120});expect(view().camera.yawDeg).toBe(yaw+24);
  fireEvent.change(screen.getByRole('combobox',{name:'成衣面料图案'}),{target:{value:'stripe'}});await waitFor(()=>expect(view().appearance.fabric).toBe('stripe'));
  const repeat=screen.getByRole('spinbutton',{name:'图案单元 mm'});fireEvent.change(repeat,{target:{value:45}});fireEvent.blur(repeat);expect(view().appearance.repeatMm).toBe(45);
  fireEvent.change(screen.getByLabelText('成衣底色'),{target:{value:'#123456'}});expect(useDesignStore.getState().garmentColor).toBe('#123456');expect(useDesignStore.getState().draft).toBe(draft);expect(ControlledWorker.all).toHaveLength(2);
  fireEvent.change(screen.getByRole('combobox',{name:'成衣曲面精细度'}),{target:{value:'2'}});expect(screen.getByTestId('garment-surface-summary')).toHaveTextContent('内外面与边缘侧壁');
  const thickness=screen.getByRole('spinbutton',{name:'成衣显示布厚 mm'});fireEvent.change(thickness,{target:{value:'1.2'}});fireEvent.blur(thickness);fireEvent.click(screen.getByRole('checkbox',{name:'成衣开口圆角'}));
  expect(view().appearance.surface).toEqual({subdivision:2,thicknessMm:1.2,roundedEdges:false});expect(useDesignStore.getState().draft).toBe(draft);expect(ControlledWorker.all).toHaveLength(2);
  await act(async()=>{});
},45000);
it('human model modes stay explicit on the same garment without changing source CAD',async()=>{
  await ready();
  expect(screen.getByTestId('toggle-mannequin')).toBeChecked();
  expect(screen.getByRole('combobox',{name:'人体模型模式'})).toHaveValue('real-human');
  expect(screen.getByTestId('mannequin-status')).toHaveTextContent('通用人体 GLB');
  fireEvent.change(screen.getByRole('combobox',{name:'人体模型模式'}),{target:{value:'parametric'}});
  await waitFor(()=>expect(view().mannequin).toMatchObject({enabled:true,mode:'parametric',gender:'male',standardSize:'M',clearanceMm:8}));
  expect(screen.getByTestId('mannequin-status')).toHaveTextContent('参数化人体');
  fireEvent.click(screen.getByTestId('toggle-mannequin'));
  await waitFor(()=>expect(view().mannequin).toBeUndefined());
  fireEvent.click(screen.getByTestId('toggle-mannequin'));
  await waitFor(()=>expect(view().mannequin).toMatchObject({enabled:true,mode:'real-human',gender:'male',standardSize:'M',clearanceMm:8}));
  expect(screen.getByTestId('mannequin-status')).toHaveTextContent('通用人体 GLB');
  expect(useDesignStore.getState().draft.status).toBe('reference');
},15000);
it('simulation preparation panel keeps solver settings explicit and gated by mannequin',async()=>{
  await ready();
  expect(screen.getByTestId('simulation-mode')).toHaveTextContent('XPBD 预览配置');
  expect(screen.getByTestId('simulation-boundary')).toHaveTextContent('尚未执行');
  expect(screen.getByRole('checkbox',{name:'启用人台碰撞'})).toBeEnabled();
  fireEvent.change(screen.getByRole('spinbutton',{name:'仿真颗粒间距 mm'}),{target:{value:'8'}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'仿真子步数'}),{target:{value:'6'}});
  fireEvent.click(screen.getByTestId('toggle-mannequin'));
  expect(screen.getByRole('checkbox',{name:'启用人台碰撞'})).toBeDisabled();
  fireEvent.click(screen.getByTestId('simulation-preview-toggle'));
  expect(screen.getByTestId('simulation-toolbar-state')).toHaveTextContent('仿真预览配置');
  expect(screen.getByTestId('simulation-preview-toggle')).toHaveTextContent('停止预览');
},15000);
it('local upload, front-only print and removal reach the material and embedded export',async()=>{
  await ready();fireEvent.change(screen.getByLabelText('上传成衣贴图'),{target:{files:[new File(['raster'],'print.png',{type:'image/png'})]}});
  await waitFor(()=>expect(view().image).not.toBeNull());expect(readGarmentTexture).toHaveBeenCalledOnce();expect(screen.getByAltText('当前成衣贴图')).toHaveAttribute('src',png);
  fireEvent.change(screen.getByRole('combobox',{name:'成衣贴图位置'}),{target:{value:'front'}});fireEvent.change(screen.getByRole('combobox',{name:'成衣贴图方式'}),{target:{value:'print'}});
  fireEvent.click(screen.getByRole('button',{name:'导出成衣与贴图'}));const gltf=JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![0]);expect(gltf.images).toHaveLength(2);expect(gltf.extras.stage).toBe('technical-illustration');expect(gltf.extras.productionApproved).toBe(false);
  expect(gltf.meshes.filter((m:{primitives:Array<{material:number}>})=>m.primitives[0].material===1)).toHaveLength(1);
  expect(gltf.extras.rendering.settings).toEqual({subdivision:1,thicknessMm:.8,roundedEdges:true});expect(gltf.nodes.some((n:{extras:{layer:string}})=>n.extras.layer==='rim')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'移除上传图案'}));await waitFor(()=>expect(view().image).toBeNull());expect(ControlledWorker.all).toHaveLength(2);
},15000);
it('finish dimensions, actual geometry toggle, technical cameras and source CAD remain linked',async()=>{
  await ready();const draft=useDesignStore.getState().draft,initial=view();
  fireEvent.click(screen.getByRole('button',{name:'联动背面三视图'}));expect(view().camera.yawDeg).toBe(180);
  fireEvent.click(screen.getByRole('button',{name:'联动侧面三视图'}));expect(view().camera.yawDeg).toBe(90);
  const width=screen.getByRole('spinbutton',{name:'罗纹领成品宽 mm'});fireEvent.change(width,{target:{value:24}});fireEvent.blur(width);
  expect(view().appearance.finish.neckWidthMm).toBe(24);expect(view().appearance.surface).toBe(initial.appearance.surface);
  fireEvent.click(screen.getByRole('button',{name:'放大前后款式稿'}));
  const sheet=await screen.findByTestId('garment-fashion-sheet');expect(sheet).toHaveTextContent('成品宽 24 mm');expect(sheet.querySelectorAll('[data-callout]')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button',{name:'下载前后款式稿'}));expect(vi.mocked(downloadText).mock.calls.at(-1)![0]).toContain('成品宽 24 mm');
  fireEvent.click(screen.getByRole('button',{name:'关闭款式稿'}));await waitFor(()=>expect(screen.queryByTestId('garment-fashion-sheet')).toBeNull());
  fireEvent.click(screen.getByRole('button',{name:'导出领条裁片草案'}));expect(vi.mocked(downloadText).mock.calls.at(-1)![0]).toContain('net loop');
  fireEvent.click(screen.getByRole('button',{name:'导出工艺与用料草案'}));const json=JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![0]);expect(json.plan.settings.neckWidthMm).toBe(24);expect(json.bomDraft[0].materialId).toBeNull();
  fireEvent.click(screen.getByRole('checkbox',{name:'显示成衣工艺'}));expect(view().appearance.finish.enabled).toBe(false);expect(screen.getByTestId('garment-finish-summary')).toHaveTextContent('0 项工艺');
  expect(useDesignStore.getState().draft).toBe(draft);expect(ControlledWorker.all).toHaveLength(2);
},15000);
it('compatibility uses a fresh canvas with depth rendering and keeps the model and source job',async()=>{
  await ready();const canvas=screen.getByTestId('garment-canvas');fireEvent.click(screen.getByRole('button',{name:'切换兼容显示'}));
  await waitFor(()=>expect(screen.getByTestId('garment-render-mode')).toHaveTextContent('Canvas2D'));expect(screen.getByTestId('garment-canvas')).not.toBe(canvas);expect(createGarmentSoftwareRenderer).toHaveBeenCalledOnce();
  expect(vi.mocked(createGarmentRenderer).mock.calls.at(-1)![1]).toBe(vi.mocked(createGarmentSoftwareRenderer).mock.calls.at(-1)![1]);
  fireEvent.click(screen.getByRole('button',{name:'重试硬件渲染'}));await waitFor(()=>expect(screen.getByTestId('garment-render-mode')).toHaveTextContent('WebGL2'));expect(ControlledWorker.all).toHaveLength(2);
},15000);
it('changing design cancels the garment job and rejects obsolete or mismatched replies',async()=>{
  render(<Pattern3dPanel/>);act(()=>ControlledWorker.all[0].reply());const old=ControlledWorker.all[1];
  act(()=>useDesignStore.getState().applyPattern('bound-tank'));expect(old.terminated).toBe(true);act(()=>old.reply());expect(screen.queryByTestId('garment-scene')).toBeNull();
  act(()=>ControlledWorker.all[2].reply());const current=ControlledWorker.all[3];act(()=>current.onmessage?.({data:{requestId:-1,revision:current.job.revision,model:sewn,durationMs:0} satisfies GarmentReply}));expect(screen.queryByTestId('garment-scene')).toBeNull();
  act(()=>current.onerror?.());expect(screen.getByRole('alert')).toHaveTextContent('成衣组装计算失败');expect(createGarmentRenderer).not.toHaveBeenCalled();
});
it('switching to source inspection cancels assembly without changing the design',async()=>{
  render(<Pattern3dPanel/>);act(()=>ControlledWorker.all[0].reply());const garment=ControlledWorker.all[1],draft=useDesignStore.getState().draft;
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'裁片检查'}));});expect(garment.terminated).toBe(true);expect(screen.getByTestId('mesh-summary')).toHaveTextContent('4 片实际数量');expect(useDesignStore.getState().draft).toBe(draft);
});
it('unsupported garments explicitly keep source inspection available',async()=>{
  useDesignStore.getState().applyPattern('hooded-zip-sweatshirt');render(<Pattern3dPanel/>);act(()=>ControlledWorker.all[0].reply());
  const worker=ControlledWorker.all[1];act(()=>worker.onmessage?.({data:runGarmentJob(worker.job as GarmentJob)}));expect(screen.getByRole('alert')).toHaveTextContent('尚未接通');expect(screen.queryByTestId('garment-scene')).toBeNull();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'裁片检查'}));});expect(screen.getByTestId('mesh-summary')).toHaveTextContent('14 片实际数量');
});
