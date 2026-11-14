import {afterAll,afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {mkdirSync,writeFileSync} from 'node:fs';
import {configureStructureAsset} from '@/application/asset-library';
import {configureStyle,createStyleWorkflow} from '@/application/style-workflow';
import {readConfiguration} from '@/application/design-document';
import {computeDraft} from '@/application/draft-service';
import {getReferenceMeasurements} from '@/data/referenceMeasurements';
import {PANTS_MEASUREMENT_FIELDS} from '@/data/foundationMethods';
import {StyleWorkflow} from '@/features/style-workflow/StyleWorkflow';
import {AssetLibrary} from '@/features/asset-library/AssetLibrary';
import {useDesignStore} from '@/store/useDesignStore';
import {createDesignStore} from '@/store/designStore';
import {downloadText} from '@/features/files/browser-files';
import type {DesignDocument,DesignRepository} from '@/types/design';
vi.mock('@/features/files/browser-files',()=>({downloadText:vi.fn()}));
const records:unknown[]=[];
beforeEach(()=>useDesignStore.getState().newDesign());
afterEach(()=>{cleanup();vi.clearAllMocks();});
const click=(name:string|RegExp)=>fireEvent.click(screen.getByRole('button',{name: name==='企划设计稿'?/企划设计稿/:name}));
for(const templateId of ['t-shirt','womens-basic-tee']as const)for(const sleeve of ['basic','extended','tapered'])it(`${templateId}: applying ${sleeve} sleeve preserves the edited neck and actual body paths`,()=>{
  const base=configureStyle(useDesignStore.getState().getConfiguration(),{templateId,options:{necklineDepth:.32,necklineWidth:.28}}),before=structuredClone(base),body=computeDraft(base);
  const changed=configureStructureAsset(base,`${templateId}-${sleeve}-sleeve`),after=computeDraft(changed);
  expect(changed.construction?.options).toMatchObject({necklineDepth:.32,necklineWidth:.28});expect(base).toEqual(before);expect(after.status).toBe('reference');
  for(const id of ['teagan.front:seam','teagan.back:seam'])expect(after.paths.find(p=>p.id===id)?.data).toBe(body.paths.find(p=>p.id===id)?.data);
  records.push({scenario:`${templateId}/${sleeve}/preserve-neck`,options:changed.construction!.options,actualBodyUnchanged:true,passed:true});
});
it('pants width and length changes compose in either order without resetting seat ease or waistband',()=>{
  const base=configureStyle(useDesignStore.getState().getConfiguration(),{templateId:'elastic-waist-pants',options:{seatEase:.08,waistbandWidth:.04}});
  const widthFirst=configureStructureAsset(configureStructureAsset(base,'pants-wide-opening'),'pants-shorter-leg');
  const lengthFirst=configureStructureAsset(configureStructureAsset(base,'pants-shorter-leg'),'pants-wide-opening');
  expect(widthFirst).toEqual(lengthFirst);expect(widthFirst.construction?.options).toEqual({seatEase:.08,waistbandWidth:.04,heelEase:.3,lengthBonus:-.1});
  const a=computeDraft(widthFirst),b=computeDraft(lengthFirst);expect(a.status).toBe('reference');expect(a.paths).toEqual(b.paths);
  expect(configureStructureAsset(widthFirst,'pants-plain-base').construction?.options).toEqual({seatEase:.08,waistbandWidth:.04,heelEase:.05,lengthBonus:0});
  records.push({scenario:'pants/compose-width-length',options:widthFirst.construction!.options,bothOrdersEqual:true,passed:true});
});
it('a cross-method component never carries T-shirt neckline parameters into pants',()=>{
  const tee=configureStyle(useDesignStore.getState().getConfiguration(),{templateId:'t-shirt',options:{necklineDepth:.32}}),pants=configureStructureAsset(tee,'pants-wide-opening');
  expect(pants.construction?.options).toEqual({heelEase:.3});expect(computeDraft(pants).status).toBe('reference');
});
for(const templateId of ['t-shirt','womens-basic-tee','elastic-waist-pants']as const)it(`${templateId}: the real workflow retains the current method through CAD, BOM and export`,()=>{
  const options=templateId==='elastic-waist-pants'?{seatEase:.08,waistbandWidth:.04,heelEase:.3,lengthBonus:-.1}:{necklineDepth:.32,necklineWidth:.28,sleeveLength:.7,sleeveEase:.05};
  const config=configureStyle(useDesignStore.getState().getConfiguration(),{templateId,options});act(()=>useDesignStore.getState().applyReviewedConfiguration(config));
  const {container}=render(<StyleWorkflow/>);expect(screen.getByLabelText('结构模板')).toHaveValue(templateId);click('确认设计并生成裁片');
  expect(useDesignStore.getState().getConfiguration()).toEqual(config);expect(container.querySelectorAll('[data-workflow-piece]')).toHaveLength(3);
  const expected=templateId==='elastic-waist-pants'?5:4;expect(screen.getByTestId('workflow-summary')).toHaveTextContent(`3 种源裁片 / ${expected} 片`);
  click('查看 BOM 草案');expect(container.querySelectorAll('[data-workflow-bom]')).toHaveLength(3);click('查看技术与工艺稿');click('导出联动草案 JSON');
  const exported=JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![0]);expect(exported.configuration).toEqual(config);expect(exported.bom.lines.reduce((n,line)=>n+line.cutQuantity,0)).toBe(expected);
  expect(exported.productionApproved).toBe(false);expect(exported.technical.pending.join(' ')).not.toContain('包条端头工艺');
  records.push({scenario:`${templateId}/workflow`,configuration:exported.configuration,bom:exported.bom,revisionId:exported.revisionId,productionApproved:false,passed:true});
});
it('invalid foundation form values cannot confirm an older hidden value or keep a stale BOM visible',()=>{
  act(()=>useDesignStore.getState().applyPattern('t-shirt'));render(<StyleWorkflow/>);click('确认设计并生成裁片');click('企划设计稿');
  const before=useDesignStore.getState().getConfiguration();fireEvent.change(screen.getByLabelText('短袖延伸比例'),{target:{value:''}});click('确认设计并生成裁片');
  expect(screen.getByRole('alert')).toHaveTextContent('短袖延伸比例');expect(useDesignStore.getState().getConfiguration()).toEqual(before);expect(screen.queryByTestId('workflow-summary')).toBeNull();
  fireEvent.change(screen.getByLabelText('短袖延伸比例'),{target:{value:'2'}});click('确认设计并生成裁片');expect(screen.getByRole('alert')).toHaveTextContent('超出');
  click('从当前裁片同步结构');expect(screen.getByLabelText('短袖延伸比例')).toHaveValue(.3);click('确认设计并生成裁片');expect(screen.getByTestId('workflow-summary')).toBeInTheDocument();
});
it('pants-only inputs complete their workflow; switching to a tee names the missing measurements without fabricating them',()=>{
  const m=getReferenceMeasurements('male','M'),config=readConfiguration({...useDesignStore.getState().getConfiguration(),activePatternId:'elastic-waist-pants',measurements:Object.fromEntries(PANTS_MEASUREMENT_FIELDS.map(f=>[f.id,m[f.id]]))});
  act(()=>useDesignStore.getState().applyReviewedConfiguration(config));render(<StyleWorkflow/>);click('确认设计并生成裁片');expect(screen.getByTestId('workflow-summary')).toHaveTextContent('5 片');click('企划设计稿');
  fireEvent.change(screen.getByLabelText('结构模板'),{target:{value:'t-shirt'}});click('确认设计并生成裁片');expect(screen.getByRole('alert')).toHaveTextContent('胸围');expect(screen.getByRole('alert')).toHaveTextContent('肩端到腕');
  expect(useDesignStore.getState().activePatternId).toBe('elastic-waist-pants');expect(useDesignStore.getState().measurements).not.toHaveProperty('bust');
});
it('asset preview and application retain a custom neckline rather than quietly restoring the source default',()=>{
  act(()=>useDesignStore.getState().applyReviewedConfiguration(configureStyle(useDesignStore.getState().getConfiguration(),{templateId:'t-shirt',options:{necklineDepth:.32,necklineWidth:.28}})));
  const before=useDesignStore.getState().draft.paths.find(p=>p.id==='teagan.front:seam')!.data;
  const {container}=render(<AssetLibrary initialTab="structure" categoryId="round-short-tee" onCompany={()=>{}} onPattern={()=>{}}/>);
  fireEvent.click(within(container.querySelector('[data-asset-id="t-shirt-extended-sleeve"]')! as HTMLElement).getByRole('button'));
  expect(screen.getByTestId('asset-cad-preview').querySelector('[data-source-path="teagan.front:seam"]')??screen.getByTestId('asset-cad-preview').querySelector('[data-piece="teagan.front"][data-layer="seam-line"]')).toHaveAttribute('d',before);
  click('应用预览结构到当前裁片');expect(useDesignStore.getState().construction?.options).toMatchObject({necklineDepth:.32,necklineWidth:.28,sleeveLength:.7});
});
it('composed pants changes survive undo, save and reopen with the same generated BOM revision',async()=>{
  const docs=new Map<string,DesignDocument>(),repository:DesignRepository={save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>structuredClone(docs.get(id)),list:async()=>[],delete:async()=>{}};
  const store=createDesignStore({repository}),s=store.getState(),base=configureStyle(s.getConfiguration(),{templateId:'elastic-waist-pants',options:{seatEase:.08,waistbandWidth:.04}});
  s.applyReviewedConfiguration(base);s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),'pants-wide-opening'));const wide=s.getConfiguration();
  s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),'pants-shorter-leg'));const composed=s.getConfiguration(),before=createStyleWorkflow(composed,store.getState().draft);
  s.undo();expect(s.getConfiguration()).toEqual(wide);s.redo();expect(s.getConfiguration()).toEqual(composed);
  const id=await s.saveDesign();s.newDesign();expect(await s.loadDesign(id)).toBe(true);const after=createStyleWorkflow(s.getConfiguration(),store.getState().draft);
  expect(after.revisionId).toBe(before.revisionId);expect(after.bom).toEqual(before.bom);expect(after.primaryCutQuantity).toBe(5);
  records.push({scenario:'pants/composed-save-reopen',revisionId:after.revisionId,options:after.configuration.construction!.options,primaryCutQuantity:after.primaryCutQuantity,passed:true});
});
afterAll(()=>{const out='doc/evidence/foundation-business-20261111';mkdirSync(out,{recursive:true});writeFileSync(`${out}/business-scenarios.json`,JSON.stringify({kind:'application-and-component-business-regressions',scenarios:records,actualBrowserChecked:false,productionApproved:false},null,2));});
