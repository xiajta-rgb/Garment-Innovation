import { expect,it } from 'vitest';
import { createPieceDesign,exportPieceDesignCad,pieceDesignImagePrompt } from '@/application/piece-design';
import { createDesignStore } from '@/store/designStore';
import { defaultPieceDesign } from '@/lib/pattern/piece-design-spec';
import { readConfiguration } from '@/application/design-document';
import type { DesignDocument } from '@/types/design';
const docs=new Map<string,DesignDocument>();
const editor=()=>createDesignStore({repository:{save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>docs.get(id),list:async()=>[],delete:async()=>{}}});
const config=()=>({...editor().getState().getConfiguration(),activePatternId:'t-shirt',pieceDesign:defaultPieceDesign()});

it('uses real source pieces and joins for one colored three-view composition with independent pocket and derived neckband',()=>{
  const c=config(),original=JSON.stringify(c),result=createPieceDesign(c);
  expect(JSON.stringify(c)).toBe(original);
  expect(result.pieces.map(p=>p.id)).toEqual(expect.arrayContaining(['teagan.front','teagan.back','teagan.sleeve','design.patch-pocket']));
  expect(result.metadata.joins.filter(j=>j.status==='failed')).toHaveLength(0);
  expect(result.metrics.bandNetMm).toBeCloseTo(result.metrics.necklineMm*.9,5);
  expect(result.metrics.bandCutWidthMm).toBe(48);
  const doc=new DOMParser().parseFromString(result.threeViewSvg,'image/svg+xml');
  expect(doc.querySelectorAll('[data-piece-design-view]')).toHaveLength(3);
  expect(doc.querySelector('[data-piece-design-view="front"] [data-source-piece="design.patch-pocket"]')?.getAttribute('d')).toBeTruthy();
  expect(doc.querySelector('[data-piece-design-view="front"] [data-source-piece="design.patch-pocket"]')!.getAttribute('d')!.match(/M/g)).toHaveLength(1);
  expect(doc.querySelector('[data-piece-design-view="back"] [data-source-piece="design.patch-pocket"]')?.getAttribute('d')).toBe('');
  expect(result.metadata.coordinateSpace).toBe('source-cad-mm');
  const pocketPath=doc.querySelector('[data-piece-design-view="front"] [data-source-piece="design.patch-pocket"]')!.getAttribute('d')!;
  expect(pocketPath.match(/L/g)).toHaveLength(5); // Five real CAD sides, without mesh-induced edge bends.
  expect(result.metadata.linework.sourceCadModified).toBe(false);
  expect(result.metadata.productionApproved).toBe(false);
  const cad=new DOMParser().parseFromString(exportPieceDesignCad(result),'image/svg+xml');
  expect(cad.documentElement.getAttribute('width')).toMatch(/mm$/);
  expect(cad.querySelectorAll('[data-cad-piece]')).toHaveLength(result.pieces.length);
  expect(cad.querySelector('[data-cad-piece="teagan.front"] path:nth-of-type(2)')?.getAttribute('d')).toBe(result.pieces.find(p=>p.id==='teagan.front')!.netPath);
  for(const effect of ['product','model'] as const){const prompt=pieceDesignImagePrompt(result,effect);expect(prompt.length).toBeLessThanOrEqual(1600);expect(prompt).toContain('ONE');expect(prompt).toContain('patch pocket');}
},20000);

it('invalid pocket placements fail closed; sleeve/neck changes regenerate compatible millimetre pieces',()=>{
  const c=config(),base=createPieceDesign(c);
  const bad={...c,pieceDesign:{...c.pieceDesign,pocket:{...c.pieceDesign.pocket,xMm:220,widthMm:180}}};
  expect(()=>createPieceDesign(bad)).toThrow(/贴袋/);
  const altered=createPieceDesign({...c,construction:{schema:'garment-os/construction/v1',options:{sleeveLength:.65,necklineWidth:.35}}});
  expect(altered.pieces.find(p=>p.id==='teagan.sleeve')!.netPath).not.toBe(base.pieces.find(p=>p.id==='teagan.sleeve')!.netPath);
  expect(altered.metrics.necklineMm).not.toBe(base.metrics.necklineMm);
  expect(altered.metadata.joins.every(j=>j.status!=='failed')).toBe(true);
  const removed=createPieceDesign({...c,pieceDesign:{...c.pieceDesign,pocket:{...c.pieceDesign.pocket,kind:'none'}}});
  expect(removed.pieces.some(p=>p.id==='design.patch-pocket')).toBe(false);
  expect(removed.threeViewSvg).not.toContain('data-source-piece="design.patch-pocket"');
},30000);

it('persists combination changes through undo/save/reopen and clears incompatible template data',async()=>{
  const store=editor();store.getState().applyReviewedConfiguration(config());
  store.getState().setPieceDesign({...store.getState().pieceDesign!,pocket:{...store.getState().pieceDesign!.pocket,widthMm:125}});
  expect(store.getState().pieceDesign!.pocket.widthMm).toBe(125);
  store.getState().undo();expect(store.getState().pieceDesign!.pocket.widthMm).toBe(115);
  store.getState().redo();const id=await store.getState().saveDesign();
  store.getState().newDesign();expect(store.getState().pieceDesign).toBeUndefined();
  expect(await store.getState().loadDesign(id)).toBe(true);expect(store.getState().pieceDesign!.pocket.widthMm).toBe(125);
  store.getState().applyPattern('long-sleeve-tee');expect(store.getState().pieceDesign).toBeUndefined();
  expect(()=>readConfiguration({...config(),activePatternId:'button-up-shirt'})).toThrow(/不能跨方法/);
});
