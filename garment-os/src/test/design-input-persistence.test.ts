import { describe, expect, it, vi } from 'vitest';
import { createDesignStore } from '@/store/designStore';
import { readDesignDocument } from '@/application/design-document';
import { computeDraft } from '@/application/draft-service';
import { DESIGN_SCHEMA, type DesignDocument, type DesignRepository } from '@/types/design';

function memory() {
  const records = new Map<string,unknown>();
  const repository: DesignRepository = {
    save: async doc => { records.set(doc.id,structuredClone(doc)); },
    get: async id => structuredClone(records.get(id)), list: async () => [], delete: async id => { records.delete(id); },
  };
  return { records, repository, editor:createDesignStore({ repository }) };
}
function deferred<T>() {
  let resolve!: (value:T) => void, reject!: (reason?:unknown) => void;
  const promise = new Promise<T>((yes,no) => { resolve=yes;reject=no; });
  return { promise,resolve,reject };
}

it('save and reopen reproduce exact inputs and source paths, storing no derived/simulated facts', async () => {
  const { editor,records } = memory(), s=editor.getState();
  s.applyPattern('button-up-shirt');s.updateMeasurements({neckCirc:395,wristCirc:190});s.setFit('slim');
  const expected=structuredClone(editor.getState().draft.paths), config=s.getConfiguration();
  const id=await s.saveDesign(), saved=records.get(id) as DesignDocument;
  expect(saved.schema).toBe(DESIGN_SCHEMA);expect(saved.configuration).toEqual(config);
  for(const key of ['instances','paths','draft','costParams','bomItems']) expect(saved).not.toHaveProperty(key);
  s.newDesign();s.setSize('XL');expect(await s.loadDesign(id)).toBe(true);
  expect(s.getConfiguration()).toEqual(config);expect(editor.getState().draft.paths).toEqual(expected);
});
it('skirt length, cut quantities, folds and options survive undo, redo, save and reopening a real input snapshot',async()=>{
  const {editor,records}=memory(),s=editor.getState();s.applyPattern('panel-circle-skirt');s.updateMeasurements({skirtLength:700,waistToFloor:1050});
  s.setConstruction({schema:'garment-os/construction/v1',options:{panels:4,circleRatio:.5,gathering:.5,waistbandWidth:.04}});
  const config=s.getConfiguration(),paths=structuredClone(editor.getState().draft.paths);
  s.updateMeasurements({skirtLength:800});s.undo();expect(s.getConfiguration()).toEqual(config);expect(editor.getState().draft.paths).toEqual(paths);
  s.redo();expect(editor.getState().measurements.skirtLength).toBe(800);s.undo();
  const id=await s.saveDesign();expect((records.get(id) as DesignDocument).configuration).toEqual(config);
  s.newDesign();expect(await s.loadDesign(id)).toBe(true);expect(s.getConfiguration()).toEqual(config);expect(editor.getState().draft.paths).toEqual(paths);
  expect(editor.getState().draft.paths.find(p=>p.id==='sandy.skirt:seam')).toMatchObject({cutQty:4,cutOnFold:true});
});
it('reads compatible historical input snapshots without running an old solver or rewriting records', async () => {
  const {editor,records}=memory(),s=editor.getState(),id=await s.saveDesign(),doc=records.get(id) as DesignDocument;
  const {activePatternId,garmentColor,fabricId,...draftInputs}=doc.configuration;
  const old={id:doc.id,name:doc.name,gender:doc.gender,createdAt:doc.createdAt,updatedAt:doc.updatedAt,activePatternId,garmentColor,fabricId,draftInputs,instances:{body:{fake:true}},costParams:{fake:99}};
  expect(readDesignDocument(old).configuration).toEqual(doc.configuration);
  records.set(id,old);expect(await s.loadDesign(id)).toBe(true);expect(records.get(id)).toEqual(old);
});
it('missing historical inputs reject loading and preserve the current design',async()=>{
  const {editor,records}=memory(),s=editor.getState();s.applyPattern('t-shirt');
  const config=s.getConfiguration(),paths=editor.getState().draft.paths;
  records.set('old',{id:'old',name:'legacy',gender:'male',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),instances:{}});
  expect(await s.loadDesign('old')).toBe(false);expect(s.getConfiguration()).toEqual(config);
  expect(editor.getState().draft.paths).toBe(paths);expect(editor.getState().lastError).toMatch(/缺少.*输入/);
});
it('solves exactly once per geometry change and reuses the result for appearance, view, name and their undo',()=>{
  const {repository}=memory(),solve=vi.fn(computeDraft),editor=createDesignStore({repository,draft:solve}),s=editor.getState();
  expect(solve).toHaveBeenCalledTimes(1);const draft=editor.getState().draft;
  s.setColor('#abcdef');s.setView('back');s.setFabric('solid');s.setDesignName('a');s.undo();s.redo();
  expect(solve).toHaveBeenCalledTimes(1);expect(editor.getState().draft).toBe(draft);
  s.updateMeasurements({neckCirc:395});expect(solve).toHaveBeenCalledTimes(2);
});
it('editor histories are independent; missing and NaN inputs remain explicit through undo/redo',()=>{
  const a=memory().editor,b=memory().editor,original=b.getState().measurements;
  a.getState().updateMeasurements({waistToArmpit:undefined});a.getState().updateMeasurements({bicep:NaN});
  expect(a.getState().draft.status).toBe('blocked');expect(b.getState().canUndo).toBe(false);expect(b.getState().measurements).toEqual(original);
  a.getState().undo();expect(a.getState().measurements.waistToArmpit).toBeUndefined();expect(Number.isNaN(a.getState().measurements.bicep)).toBe(false);
  a.getState().redo();expect(Number.isNaN(a.getState().measurements.bicep)).toBe(true);
  a.getState().undo();a.getState().undo();expect(a.getState().draft.status).toBe('reference');
});
describe('asynchronous persistence isolation',()=>{
  it('late load cannot overwrite later edits or a new editor session',async()=>{
    for(const change of ['edit','new'] as const) {
      const {repository,records}=memory(),editor=createDesignStore({repository}),s=editor.getState();
      const id=await s.saveDesign(),doc=records.get(id),pending=deferred<unknown>();
      repository.get=()=>pending.promise;const load=s.loadDesign(id);
      if(change==='edit')s.setDesignName('current edit');else s.newDesign();
      const session=editor.getState().sessionId,config=s.getConfiguration(),name=editor.getState().designName;
      pending.resolve(doc);expect(await load).toBe(false);expect(editor.getState().sessionId).toBe(session);
      expect(s.getConfiguration()).toEqual(config);expect(editor.getState().designName).toBe(name);
    }
  });
  it('late save completion cannot bind a new session to the previous document',async()=>{
    const {repository}=memory(),pending=deferred<void>();repository.save=()=>pending.promise;
    const editor=createDesignStore({repository}),s=editor.getState(),save=s.saveDesign();
    s.newDesign();pending.resolve();await save;
    expect(editor.getState().currentDesignId).toBeNull();expect(editor.getState().isSaving).toBe(false);
  });
  it('serializes repeated explicit saves and persists the latest changed snapshot to one document',async()=>{
    const {repository,records}=memory(),first=deferred<void>(),docs:DesignDocument[]=[];
    repository.save=async doc=>{docs.push(doc);if(docs.length===1)await first.promise;records.set(doc.id,structuredClone(doc));};
    const editor=createDesignStore({repository}),s=editor.getState();const one=s.saveDesign();
    s.updateMeasurements({neckCirc:395});const two=s.saveDesign();
    await Promise.resolve();expect(docs).toHaveLength(1);first.resolve();const ids=await Promise.all([one,two]);
    expect(ids[0]).toBe(ids[1]);expect(docs).toHaveLength(2);
    expect((records.get(ids[0]) as DesignDocument).configuration.measurements.neckCirc).toBe(395);
    expect(editor.getState().isSaving).toBe(false);
  });
  it('a failed save is visible and a later save can recover',async()=>{
    const {editor,repository}=memory(),original=repository.save;repository.save=async()=>{throw Error('disk full');};
    await expect(editor.getState().saveDesign()).rejects.toThrow('disk full');expect(editor.getState().lastError).toMatch(/保存失败/);
    expect(editor.getState().currentDesignId).toBeNull();repository.save=original;
    await editor.getState().saveDesign();expect(editor.getState().currentDesignId).toBeTruthy();expect(editor.getState().lastError).toBeNull();
  });
});

it('saving a reopened design preserves its user tags',async()=>{
  const {editor,records}=memory(),s=editor.getState(),id=await s.saveDesign(),doc=records.get(id) as DesignDocument;
  doc.tags=['male','样衣A','品牌B'];expect(await s.loadDesign(id)).toBe(true);await s.saveDesign();
  expect((records.get(id) as DesignDocument).tags).toEqual(['样衣A','品牌B','male']);
});
