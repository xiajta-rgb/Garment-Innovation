import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { CanvasArea } from '@/components/layout/CanvasArea';
import { StyleWorkflow } from '@/features/style-workflow/StyleWorkflow';
import { useDesignStore } from '@/store/useDesignStore';
import { downloadText } from '@/features/files/browser-files';
import { configureStyle,createStyleWorkflow,readStyleObservation } from '@/application/style-workflow';
import { computeDraft } from '@/application/draft-service';

vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
beforeEach(()=>useDesignStore.getState().newDesign());
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
const click=(name:string|RegExp)=>fireEvent.click(screen.getByRole('button',{name}));
const byId=(root:HTMLElement,id:string)=>root.querySelector(`[data-workflow-piece="${id}"] [data-workflow-path="${id}:seam"]`)?.getAttribute('d');
const toTechnical=()=>click(/04技术与工艺稿|04 技术与工艺稿/);
const getDraft=()=>JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![0]);

it('workspace workflow generates the source Aaron front and binding, with a shared BOM and technical revision',async()=>{
  const {container}=render(<CanvasArea showSketch showPattern={false} onToggleSketch={()=>{}} onTogglePattern={()=>{}} sketchZoom={1} onSketchZoom={()=>{}} garmentColor="#87ceeb"/>);
  click('款式工作流');await screen.findByTestId('style-workflow');
  click('确认设计并生成裁片');
  const front=byId(container,'aaron.front'),binding=byId(container,'aaron.neckBinding');
  expect(front).toBeTruthy();expect(binding).toBeTruthy();expect(screen.getByTestId('workflow-summary')).toHaveTextContent('4 种源裁片 / 5 片');
  expect(front).toBe(useDesignStore.getState().draft.paths.find(p=>p.id==='aaron.front:seam')?.data);
  toTechnical();click('导出联动草案 JSON');const before=getDraft();
  click(/企划设计稿/);fireEvent.change(screen.getByLabelText('前领口下降比例（%）'),{target:{value:'30'}});click('确认设计并生成裁片');
  expect(byId(container,'aaron.front')).not.toBe(front);expect(byId(container,'aaron.neckBinding')).not.toBe(binding);
  expect(screen.getByTestId('workflow-summary')).toHaveTextContent('4 种源裁片 / 5 片');
  click('查看 BOM 草案');expect(container.querySelectorAll('[data-workflow-bom]')).toHaveLength(4);
  click('查看技术与工艺稿');click('导出联动草案 JSON');const after=getDraft();
  const length=(x:typeof before)=>x.technical.operations.find((o:{id:string})=>o.id==='binding-neck').metrics.find((m:{label:string})=>m.label==='实际展开条长').value;
  expect(length(after)).toBeGreaterThan(length(before));expect(after.revisionId).not.toBe(before.revisionId);
  expect(after.bom.lines.every((x:{purchaseQuantity:unknown})=>x.purchaseQuantity===null)).toBe(true);
  expect(after.productionApproved).toBe(false);expect(after.configuration.activePatternId).toBe('bound-tank');
  click('导出参考裁片图 SVG');const svg=vi.mocked(downloadText).mock.calls.at(-1)![0];expect(svg).toContain(after.revisionId);expect(svg).toContain('data-piece="aaron.neckBinding"');
  act(()=>useDesignStore.getState().undo());expect(screen.getByText('等待有效裁片')).toBeInTheDocument();
  expect(useDesignStore.getState().construction?.options.necklineDrop).toBe(.2);
});

it('external structure observations require explicit apply; disabling pocket and ribbing removes geometry and BOM lines',async()=>{
  const {container}=render(<StyleWorkflow/>);
  const candidate={schema:'garment-os/style-observation/v1',templateId:'hooded-zip-sweatshirt',pocket:false,ribbing:false};
  const file=new File([JSON.stringify(candidate)],'观察.json',{type:'application/json'});
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify(candidate)});
  fireEvent.change(screen.getByLabelText('导入结构观察'),{target:{files:[file]}});
  await screen.findByTestId('style-observation');
  expect(useDesignStore.getState().activePatternId).toBe('brian-reference');
  expect(screen.getByLabelText('结构模板')).toHaveValue('bound-tank');
  click('将观察填入结构选择');expect(useDesignStore.getState().activePatternId).toBe('brian-reference');
  click('确认设计并生成裁片');
  expect(screen.getByTestId('workflow-summary')).toHaveTextContent('4 种源裁片 / 9 片');
  expect([...container.querySelectorAll('[data-workflow-piece]')].map(x=>x.getAttribute('data-workflow-piece'))).toEqual(['huey.front','huey.back','huey.sleeve','huey.hood']);
  click('查看 BOM 草案');
  expect(container.querySelector('[data-workflow-bom*="ribbing"]')).toBeNull();
  expect(container.querySelector('[data-workflow-bom*="huey.pocket"]')).toBeNull();
  click('查看技术与工艺稿');click('导出联动草案 JSON');
  expect(getDraft().reference.observation).toEqual(candidate);
  expect(getDraft().technical.operations.map((op:{id:string})=>op.id)).toEqual(['hood-neck']);
  act(()=>useDesignStore.getState().newDesign());
  expect(screen.queryByTestId('style-observation')).toBeNull();expect(screen.queryByTestId('workflow-summary')).toBeNull();
});

it('missing measurements and invalid design options never apply or retain downstream output',()=>{
  render(<StyleWorkflow/>);
  click('确认设计并生成裁片');
  act(()=>useDesignStore.getState().updateMeasurements({headCirc:undefined}));
  expect(screen.queryByTestId('workflow-cad')).toBeNull();expect(screen.getByText('等待有效裁片')).toBeInTheDocument();
  click('返回企划设计稿');fireEvent.change(screen.getByLabelText('结构模板'),{target:{value:'hooded-zip-sweatshirt'}});
  click('确认设计并生成裁片');expect(screen.getByRole('alert')).toHaveTextContent('头围');
  expect(useDesignStore.getState().activePatternId).toBe('bound-tank');
  fireEvent.change(screen.getByLabelText('结构模板'),{target:{value:'bound-tank'}});
  fireEvent.change(screen.getByLabelText('前领口下降比例（%）'),{target:{value:'99'}});
  click('确认设计并生成裁片');expect(screen.getByRole('alert')).toHaveTextContent('超出');
  expect(screen.queryByTestId('workflow-cad')).toBeNull();
});

it('work product rejects stale geometry and observation contracts refuse injected millimetres or release flags',()=>{
  const base=useDesignStore.getState().getConfiguration();
  const old=configureStyle(base,{templateId:'bound-tank',necklineDrop:.2}),updated=configureStyle(base,{templateId:'bound-tank',necklineDrop:.3});
  const draft=computeDraft(old);
  expect(()=>createStyleWorkflow(updated,draft)).toThrow(/不一致/);
  expect(createStyleWorkflow(old,draft).revisionId).toBe(createStyleWorkflow(old,computeDraft(old)).revisionId);
  const common={schema:'garment-os/style-observation/v1',templateId:'bound-tank'};
  for(const injected of [{measurements:{headCirc:600}},{necklineDrop:.3},{productionApproved:true},{paths:['M0 0']}])expect(()=>readStyleObservation({...common,...injected})).toThrow();
  expect(()=>readStyleObservation({schema:common.schema,templateId:'hooded-zip-sweatshirt',pocket:false})).toThrow(/有或无/);
});

it('a generated reference and vision result require separate selection and confirmation before producing CAD',async()=>{
  const imageUrl='https://example.com/reference.png?temporary=signed', candidate={schema:'garment-os/style-observation/v1',templateId:'bound-tank'};
  const send=vi.fn<typeof fetch>().mockImplementation(async (_url,options)=>{
    const {action,id,model}=JSON.parse(String(options?.body));
    if(action==='generate')return Response.json({state:'done',reference:{provider:'senling-ais',id,model,providerJobId:'ais-test-job',imageUrl}});
    if(action==='observe')return Response.json({observation:candidate});
    throw new Error('unexpected request');
  });
  vi.stubGlobal('fetch',send);
  render(<StyleWorkflow/>);
  fireEvent.click(screen.getByText('森灵 / 图稿解析试验'));
  fireEvent.change(screen.getByLabelText('结构模板'),{target:{value:'hooded-zip-sweatshirt'}});
  click('填入背心示例');
  expect(screen.getByRole('button',{name:'生成参考稿'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('生图模型'),{target:{value:'nano-banana-pro'}});
  click('生成参考稿');
  expect(await screen.findByAltText('森灵生成预览')).toHaveAttribute('src',imageUrl);
  expect(screen.queryByLabelText('识图模型')).toBeNull();
  click('用作参考设计稿');
  expect(screen.getByAltText('森灵参考设计稿')).toHaveAttribute('src',imageUrl);
  fireEvent.change(screen.getByLabelText('识图模型'),{target:{value:'gemini-3-5-flash'}});
  click('提取结构候选');
  expect(await screen.findByTestId('style-observation')).toHaveTextContent('包边背心');
  expect(screen.getByLabelText('结构模板')).toHaveValue('hooded-zip-sweatshirt');
  expect(useDesignStore.getState().activePatternId).toBe('brian-reference');
  click('将观察填入结构选择');
  expect(screen.getByLabelText('结构模板')).toHaveValue('bound-tank');
  expect(useDesignStore.getState().activePatternId).toBe('brian-reference');
  click('确认设计并生成裁片');
  expect(useDesignStore.getState().activePatternId).toBe('bound-tank');
  expect(screen.getByTestId('workflow-summary')).toHaveTextContent('4 种源裁片 / 5 片');
  toTechnical();click('导出联动草案 JSON');
  const saved=getDraft();
  expect(saved.reference).toMatchObject({observation:candidate,senling:{provider:'senling-ais',model:'nano-banana-pro',providerJobId:'ais-test-job'},visionModel:'gemini-3-5-flash'});
  expect(JSON.stringify(saved)).not.toContain(imageUrl);
  expect(saved.cad.unit).toBe('mm');
  expect(saved.productionApproved).toBe(false);
});

it('discarding the image while vision is pending prevents a late result from replacing the current observation',async()=>{
  let finish!:(response:Response)=>void;
  vi.stubGlobal('fetch',vi.fn<typeof fetch>().mockImplementation(async (_url,options)=>{
    const {action,id,model}=JSON.parse(String(options?.body));
    if(action==='generate')return Response.json({state:'done',reference:{provider:'senling-ais',id,model,providerJobId:'ais-test-job',imageUrl:'https://example.com/reference.png'}});
    return new Promise<Response>(resolve=>{finish=resolve;});
  }));
  render(<StyleWorkflow/>);
  fireEvent.click(screen.getByText('森灵 / 图稿解析试验'));
  click('填入背心示例');
  fireEvent.change(screen.getByLabelText('生图模型'),{target:{value:'nano-banana-pro'}});
  click('生成参考稿');
  await screen.findByAltText('森灵生成预览');
  click('用作参考设计稿');
  fireEvent.change(screen.getByLabelText('识图模型'),{target:{value:'gemini-3-5-flash'}});
  click('提取结构候选');
  click('移除参考图');
  await act(async()=>finish(Response.json({observation:{schema:'garment-os/style-observation/v1',templateId:'bound-tank'}})));
  expect(screen.queryByTestId('style-observation')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('本次识图结果已忽略');
});
