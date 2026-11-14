import { expect,it,vi } from 'vitest';
import { MATERIAL_ASSETS,STRUCTURE_ASSETS,FINISH_ASSETS } from '@/data/reusableAssets';
import { COMPANY_STYLE_MASTERS } from '@/data/companyStyleMasters';
import { newCompanyStyle,readCompanyStyle } from '@/lib/pattern/company-style';
import { applyMaterialAsset,applyColorAsset,applyFinishAsset,materialComposition } from '@/lib/pattern/reusable-assets';
import { configureStructureAsset,exportAssetHandoff,previewStructureAsset } from '@/application/asset-library';
import { createDesignStore } from '@/store/designStore';
import { computeDraft } from '@/application/draft-service';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { exportCompanyStyleSvg } from '@/lib/pattern/company-style-drawing';
import { assetPiecePreviews } from '@/lib/pattern/asset-preview';
import type { DesignDocument,DesignRepository } from '@/types/design';

function editor(){const docs=new Map<string,DesignDocument>(),repo:DesignRepository={save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>structuredClone(docs.get(id)),list:async()=>[],delete:async id=>{docs.delete(id);}},solve=vi.fn(computeDraft);return {store:createDesignStore({repository:repo,draft:solve}),docs,solve};}
it('material facts retain company sources, missing physical properties and independent rib composition',()=>{
  for(const m of MATERIAL_ASSETS){
    expect(m.sourceMasterIds.every(id=>COMPANY_STYLE_MASTERS.some(s=>s.id===id))).toBe(true);
    expect(m.weightGsm).toBeNull();expect(m.widthMm).toBeNull();expect(m.stretchPercent).toBeNull();expect(m.shrinkagePercent).toBeNull();
    if(m.composition)expect(m.composition.reduce((sum,c)=>sum+c.percent,0)).toBe(100);
  }
  const fleece=MATERIAL_ASSETS.find(m=>m.id==='mat-company-fleece310')!,rib=MATERIAL_ASSETS.find(m=>m.id==='mat-company-rib2x2')!;
  expect(fleece.composition).not.toBeNull();expect(rib.composition).toBeNull();expect(rib.code).toBeNull();expect(rib.weightLabel).toContain('420g');
  const d=applyMaterialAsset(newCompanyStyle('company-at25m3295'),rib.id,'neck');expect(d.composition).toBe('66%涤纶 / 34%棉');expect(d.assets?.materials.neck?.id).toBe(rib.id);
});
it('invalid assignments, unsupported roles, invented revisions and stale saved asset facts fail closed',()=>{
  const d=newCompanyStyle(),main=applyMaterialAsset(d,'mat-fc304','main');expect(readCompanyStyle(main)).toEqual(main);
  expect(()=>applyMaterialAsset(d,'mat-company-rib2x2','main')).toThrow();
  expect(()=>applyMaterialAsset(d,'mat-fc00332','cuff')).toThrow();
  expect(()=>applyMaterialAsset(newCompanyStyle('company-at25m3288'),'mat-company-rib2x2','neck')).toThrow();
  expect(()=>readCompanyStyle({...main,composition:'100%棉'})).toThrow(/不一致/);
  for(const assets of [{materials:{main:{id:'mat-fc304',revision:99}}},{materials:{main:{id:'fake',revision:1}}},{materials:{lining:{id:'mat-fc304',revision:1}}},{materials:[],productionApproved:true}])expect(()=>readCompanyStyle({...d,assets})).toThrow();
  expect(()=>applyFinishAsset(d,FINISH_ASSETS[1].id)).toThrow(/不兼容/);
});
it('material, finish and palette selections save/reopen and undo atomically without redrafting CAD',async()=>{
  const {store,solve}=editor(),s=store.getState(),before=s.draft;
  let d=applyMaterialAsset(newCompanyStyle(),'mat-fc304','main');d=applyMaterialAsset(d,'mat-fc00332','neck');d=applyColorAsset(d,'color-808080');d=applyFinishAsset(d,FINISH_ASSETS[0].id);
  s.setCompanyDraft(d);expect(store.getState().draft).toBe(before);expect(solve).toHaveBeenCalledTimes(1);expect(store.getState().companyDraft?.cadApplied).toBe(false);
  const svg=exportCompanyStyleSvg(d);expect(svg).toContain('棉34%');expect(svg).toContain('mat-fc00332');expect(svg).toContain('#808080');
  const id=await s.saveDesign();s.newDesign();expect(await s.loadDesign(id)).toBe(true);expect(store.getState().companyDraft).toEqual(d);
  s.setCompanyDraft({...d,fabric:'另一面料'});expect(store.getState().companyDraft?.assets?.materials.main).toBeUndefined();expect(store.getState().companyDraft?.assets?.materials.neck?.id).toBe('mat-fc00332');
  s.undo();expect(store.getState().companyDraft).toEqual(d);s.redo();expect(store.getState().companyDraft?.fabric).toBe('另一面料');
});
it('manual color or finish edits detach only their stale recipe, including edits from the linked CAD screen',()=>{
  const {store}=editor(),s=store.getState();let d=applyFinishAsset(applyColorAsset(newCompanyStyle('company-lt26m1581'),'color-808080'),FINISH_ASSETS[1].id);
  d=applyMaterialAsset(d,'mat-fc304','main');s.applyCompanyDraft(d);s.setColor('#aabbcc');
  expect(store.getState().companyDraft?.assets?.color).toBeUndefined();expect(store.getState().companyDraft?.assets?.finish).toBeDefined();
  s.setCompanyDraft({...store.getState().companyDraft!,finish:{...d.finish,neckWidthMm:22}});
  expect(store.getState().companyDraft?.assets?.finish).toBeUndefined();expect(store.getState().companyDraft?.assets?.materials.main).toBeDefined();
  expect(store.getState().companyDraft?.cadApplied).toBe(true);
});
it.each(STRUCTURE_ASSETS)('$id generates real source pieces across two body profiles and three sizes',a=>{
  const {store}=editor(),base=store.getState().getConfiguration();
  for(const gender of ['male','female'] as const)for(const standardSize of ['S','M','XL'] as const){
    const {draft}=previewStructureAsset({...base,gender,standardSize,measurements:getReferenceMeasurements(gender,standardSize)},a.id);
    expect(draft.status,draft.error??'').toBe('reference');expect(draft.assembly?.integrityPass).toBe(true);
    expect(draft.paths.every(p=>p.referenceVersion==='4.10.2')).toBe(true);expect(draft.paths.map(p=>p.data).join('')).not.toMatch(/NaN|Infinity/);
    if(a.templateId==='button-up-shirt'){
      expect(draft.pieces).toHaveLength(a.selection.options.sleeveStyle==='short'?7:10);
      expect(draft.pieces.some(p=>p.key==='simon.cuff')).toBe(a.selection.options.sleeveStyle!=='short');
    }
    if(a.templateId==='hooded-zip-sweatshirt'){
      expect(draft.pieces.some(p=>p.key==='huey.cuff')).toBe(a.selection.options.ribbing);
      expect(draft.pieces.some(p=>p.key==='huey.pocket')).toBe(a.selection.options.pocket);
    }
  }
});
it('switching structure presets removes dormant cuff/pocket/neck fields and updates complete downstream geometry',()=>{
  const {store}=editor(),s=store.getState();s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),'shirt-long-rounded'));
  const long=store.getState().draft;expect(long.pieces).toHaveLength(10);
  s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),'shirt-short-baseball'));expect(store.getState().draft.pieces).toHaveLength(7);expect(s.getConfiguration().construction?.options.cuffStyle).toBeUndefined();
  s.undo();expect(store.getState().draft.paths).toEqual(long.paths);
  s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),'zip-hoodie-hem-plain'));expect(store.getState().draft.pieces).toHaveLength(4);
  s.applyReviewedConfiguration(configureStructureAsset(s.getConfiguration(),'tank-deep-neck'));expect(store.getState().draft.pieces).toHaveLength(4);expect(s.getConfiguration().construction?.options).not.toHaveProperty('pocket');
});
it('asset handoff exposes precise snapshot linkage and missing quantities; unrelated CAD and stale geometry cannot be claimed',()=>{
  const {store}=editor(),s=store.getState(),d=applyColorAsset(applyMaterialAsset(newCompanyStyle('company-lt26m1581'),'mat-fc304','main'),'color-ffffff');
  const unlinked=exportAssetHandoff(s.getConfiguration(),s.draft,d);expect(unlinked.cad.companyLinked).toBe(false);expect(unlinked.remoteSync).toBe('not-performed');expect(unlinked.productionApproved).toBe(false);
  s.applyCompanyDraft(d);const current=store.getState(),work=exportAssetHandoff(s.getConfiguration(),current.draft,current.companyDraft!);
  expect(work.cad.companyLinked).toBe(true);expect(work.cad.sourceCuts).toHaveLength(3);expect(work.cad.sourceCuts.every(p=>p.quantity!>0)).toBe(true);
  expect(work.materialAssignments[0].purchaseQuantity).toBeNull();expect(work.materialAssignments[0].asset.composition).toEqual(MATERIAL_ASSETS[0].composition);
  expect(work.existingSnapshotLinks.every(e=>e.feishuRecordId)).toBe(true);expect(work.elementLibraryTarget.status).toBe('candidate-only');
  expect(()=>exportAssetHandoff({...s.getConfiguration(),fit:'loose'},current.draft,current.companyDraft!)).toThrow(/不一致/);
  expect(materialComposition(MATERIAL_ASSETS[3])).toBe('');
});
it('piece previews retain every original source curve and quantity while using readable display line weights',()=>{
  const {store}=editor(),{draft}=previewStructureAsset(store.getState().getConfiguration(),'shirt-long-rounded'),before=structuredClone(draft.paths),previews=assetPiecePreviews(draft.paths);
  expect(previews).toHaveLength(10);expect(draft.paths).toEqual(before);
  for(const p of previews){
    expect(p.widthMm).toBeGreaterThan(0);expect(p.heightMm).toBeGreaterThan(0);expect(p.svg).toContain('non-scaling-stroke');expect(p.svg).not.toMatch(/NaN|Infinity/);
    for(const path of draft.paths.filter(path=>path.pieceId===p.id))expect(p.svg).toContain(`d="${path.data}"`);
    expect(p.quantity).toBe(draft.paths.find(path=>path.pieceId===p.id)?.cutQty);
  }
});
