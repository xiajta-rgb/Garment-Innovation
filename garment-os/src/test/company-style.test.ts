import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {COMPANY_STYLE_MASTERS} from '@/data/companyStyleMasters';
import {newCompanyStyle,readCompanyStyle,companyBodyWidth} from '@/lib/pattern/company-style';
import {exportCompanyStyleSvg} from '@/lib/pattern/company-style-drawing';
import {createDesignStore} from '@/store/designStore';
import {computeDraft} from '@/application/draft-service';
import {readDesignDocument} from '@/application/design-document';
import type {DesignDocument,DesignRepository} from '@/types/design';

function editor(){const docs=new Map<string,DesignDocument>(),repository:DesignRepository={save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>structuredClone(docs.get(id)),list:async()=>[],delete:async id=>{docs.delete(id);}},solve=vi.fn(computeDraft);return {store:createDesignStore({repository,draft:solve}),docs,solve};}

it.each(COMPANY_STYLE_MASTERS)('$id is linked to an unchanged real company source and finite traced drawing curves',m=>{
  const file=`research/rd-design-reference-20261111/images/${m.source.recordId}.jpg`;
  expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(m.source.sha256);
  expect(fs.existsSync(`public${m.source.image}`)).toBe(true);
  const draft=newCompanyStyle(m.id),svg=exportCompanyStyleSvg(draft);
  expect(readCompanyStyle(draft)).toEqual(draft);expect(svg).not.toMatch(/NaN|Infinity/);
  expect(svg).toContain(m.source.recordId);expect(svg).toContain('productionApproved');
  expect(svg).toContain('正面');expect(svg).toContain('反面');
  for(let y=0;y<=1;y+=.01)expect(companyBodyWidth(m,y)).toBeGreaterThan(0);
});
it('pullover hoodie and rib-hem sweatshirt stay unconnected rather than mapping to a zip hoodie or long tee',()=>{
  const {store}=editor();const before=store.getState().draft;
  for(const id of ['company-at25m3295','company-at25m3288']){
    const d=newCompanyStyle(id);expect(()=>store.getState().applyCompanyDraft(d)).toThrow(/尚未接通/);
    expect(store.getState().draft).toBe(before);expect(()=>readCompanyStyle({...d,cadApplied:true})).toThrow(/关联无效/);
  }
});
it('bad master revisions, invalid finishes and unsafe strings cannot become valid drafts or SVG markup',()=>{
  const d=newCompanyStyle();
  for(const patch of [{masterId:'invented'},{masterRevision:99},{color:'red'},{finish:{...d.finish,neckWidthMm:NaN}},{name:''}])expect(()=>readCompanyStyle({...d,...patch})).toThrow();
  const svg=exportCompanyStyleSvg({...d,name:'<script>attack</script>',notes:'<img onload="x"/>'});expect(svg).not.toContain('<script>');expect(svg).not.toContain('<img');expect(svg).toContain('&lt;script&gt;');
});
it('drawing edits do not solve or replace CAD; application is explicit and one undo restores the prior geometry',()=>{
  const {store,solve}=editor(),s=store.getState(),before=s.draft,measurements=s.measurements;
  s.setCompanyDraft({...newCompanyStyle('company-lt26m1581'),color:'#abcdef'});
  expect(store.getState().draft).toBe(before);expect(solve).toHaveBeenCalledTimes(1);expect(store.getState().companyDraft?.cadApplied).toBe(false);
  s.applyCompanyDraft(store.getState().companyDraft!);expect(store.getState().activePatternId).toBe('long-sleeve-tee');expect(store.getState().companyDraft?.cadApplied).toBe(true);expect(store.getState().measurements).toBe(measurements);
  s.undo();expect(store.getState().activePatternId).toBe('brian-reference');expect(store.getState().companyDraft?.cadApplied).toBe(false);
  s.redo();expect(store.getState().companyDraft?.cadApplied).toBe(true);
  s.setColor('#123456');expect(store.getState().companyDraft?.color).toBe('#123456');
  s.applyPattern('bound-tank');expect(store.getState().companyDraft?.cadApplied).toBe(false);
});
it('save/reopen restores master revision, custom materials, finish settings and explicit CAD binding',async()=>{
  const {store,docs}=editor(),s=store.getState(),d={...newCompanyStyle('company-lt26m1581'),styleCode:'COMP-001',fabric:'自选面料',composition:'待测',weight:'',finish:{...newCompanyStyle('company-lt26m1581').finish,neckWidthMm:20},notes:'改款说明'};
  s.applyCompanyDraft(d);const id=await s.saveDesign(),saved=docs.get(id)!;
  expect(saved.presentation.companyDraft).toEqual({...d,cadApplied:true});
  s.newDesign();expect(store.getState().companyDraft?.cadApplied).toBe(false);expect(await s.loadDesign(id)).toBe(true);
  expect(store.getState().companyDraft).toEqual(saved.presentation.companyDraft);
  const old={...saved,presentation:{view:'back' as const,viewMode:'clean' as const}};docs.set('old',{...old,id:'old'});
  expect(await s.loadDesign('old')).toBe(true);expect(store.getState().companyDraft).toBeUndefined();
  expect(()=>readDesignDocument({...saved,configuration:{...saved.configuration,activePatternId:'bound-tank'}})).toThrow(/构型不一致/);
});
it('invalidates the old dropped-shoulder to set-in association without losing the saved artwork or user edits',()=>{
  const {store}=editor(),d={...newCompanyStyle('company-cot25m002'),name:'保留我的款名',notes:'原稿修改说明',cadApplied:true};
  expect(readCompanyStyle(d)).toEqual({...d,cadApplied:false});
  expect(()=>store.getState().applyCompanyDraft(readCompanyStyle(d))).toThrow(/尚未接通/);
  expect(d.cadApplied).toBe(true);
});
