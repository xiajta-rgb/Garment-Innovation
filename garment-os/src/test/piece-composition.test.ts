import { expect,it } from 'vitest';
import { createDesignStore } from '@/store/designStore';
import { anchorCompositionPiece, compositionCatalogue, compositionMovable, compositionSlot, compositionSource, compositionTeeStarter, newCompositionPiece, normalizeComposition, pieceDisplaySize, replaceCompositionAsset, resolveCompositionPiece } from '@/application/composition-catalogue';
import { emptyPieceComposition,readPieceComposition } from '@/lib/pattern/piece-composition';
import type { DesignDocument } from '@/types/design';
import { listPatterns } from '@/data/patternLibrary';
import { isReferencePattern } from '@/data/patternReview';

const docs=new Map<string,DesignDocument>();
const editor=()=>createDesignStore({repository:{save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>docs.get(id),list:async()=>[],delete:async()=>{}}});
it('combines sourced artwork without modifying its source paths; per-piece dimensions propagate to display independently',()=>{
 const store=editor(),source=compositionSource(store.getState().getConfiguration(),'t-shirt'),cat=compositionCatalogue(source),before=JSON.stringify(cat);
 const pieces=compositionTeeStarter(source,()=>crypto.randomUUID());expect(pieces).toHaveLength(11);
 expect(pieces.filter(p=>p.view==='back')).toHaveLength(4);expect(pieces.filter(p=>p.view==='side')).toHaveLength(2);
 const front=pieces.find(p=>p.assetKey==='body-front')!,asset=resolveCompositionPiece(front),size=pieceDisplaySize(front,asset);
 const changed={...front,widthMm:front.widthMm*1.2,heightMm:front.heightMm*.9};
 expect(pieceDisplaySize(changed,asset).width).toBeCloseTo(size.width*1.2,8);
 expect(pieceDisplaySize(changed,asset).height).toBeCloseTo(size.height*.9,8);
 const sleeve=compositionCatalogue(compositionSource(store.getState().getConfiguration(),'long-sleeve-tee')).assets.find(a=>a.role==='sleeve.main')!;
 expect(sleeve.sourceId).toBe('sven.sleeve');expect(sleeve.netPath).not.toBe(asset.netPath);
 expect(JSON.stringify(cat)).toBe(before);
 const original=compositionCatalogue(source).assets.find(a=>a.key==='design.patch-pocket')!;
 expect(original.widthMm).toBe(115);expect(original.heightMm).toBe(135);
},20000);
it('preserves multi-template pieces and plan snapshots across template changes, undo, save and reopen',async()=>{
 const store=editor(),config=store.getState().getConfiguration(),source=compositionSource(config,'t-shirt'),cat=compositionCatalogue(source);
 const c=emptyPieceComposition('a'),front=newCompositionPiece(cat.assets.find(a=>a.key==='body-front')!,source,'front');
 c.plans[0].pieces=[front];store.getState().setPieceComposition(c);
 store.getState().applyPattern('button-up-shirt');expect(store.getState().pieceComposition).toEqual(c);
 const b={...structuredClone(c.plans[0]),id:'b',name:'改款'},changed={...front,widthMm:front.widthMm+30};b.pieces=[changed];
 store.getState().setPieceComposition({...c,activePlanId:'b',plans:[c.plans[0],b]});store.getState().undo();expect(store.getState().pieceComposition).toEqual(c);
 store.getState().redo();const final=structuredClone(store.getState().pieceComposition),id=await store.getState().saveDesign();
 store.getState().newDesign();expect(store.getState().pieceComposition).toBeUndefined();expect(await store.getState().loadDesign(id)).toBe(true);expect(store.getState().pieceComposition).toEqual(final);
 expect(store.getState().pieceComposition!.plans[0].pieces[0].widthMm).toBe(front.widthMm);
},20000);
it('rejects invalid dimensions, unavailable template identities and duplicate piece IDs at the persistence boundary',()=>{
 const store=editor(),source=compositionSource(store.getState().getConfiguration(),'t-shirt'),cat=compositionCatalogue(source),p=newCompositionPiece(cat.assets[0],source,'a'),c=emptyPieceComposition('a');c.plans[0].pieces=[p];
 expect(readPieceComposition(c)).toEqual(c);
 for(const n of [0,NaN,Infinity,3001])expect(()=>readPieceComposition({...c,plans:[{...c.plans[0],pieces:[{...p,widthMm:n}]}]})).toThrow();
 expect(()=>readPieceComposition({...c,plans:[{...c.plans[0],pieces:[p,p]}]})).toThrow(/重复/);
 expect(()=>readPieceComposition({...c,plans:[{...c.plans[0],pieces:[{...p,assetKey:'simon.collar'}]}]})).toThrow(/来源模板/);
 expect(()=>readPieceComposition({...c,plans:[{...c.plans[0],pieces:[{...p,source:{...source,measurements:{}}}]}]})).toThrow(/测量/);
 expect(()=>compositionCatalogue({...source,templateId:'v-neck-tee'})).toThrow(/停用/);
});
it('loads source geometry for every reviewed template, including shifted fold axes and the womens tee finishing identity',()=>{
 const config=editor().getState().getConfiguration();
 for(const pattern of listPatterns().filter(p=>isReferencePattern(p.id))){
  const source=compositionSource(config,pattern.id),cat=compositionCatalogue(source);expect(cat.assets.length).toBeGreaterThan(0);
  const c=emptyPieceComposition(pattern.id);c.plans[0].pieces=cat.assets.map((a,i)=>newCompositionPiece(a,source,String(i)));expect(()=>readPieceComposition(c)).not.toThrow();
 }
 const skirt=compositionCatalogue(compositionSource(config,'panel-circle-skirt')).assets.find(a=>a.key==='sandy.skirt')!;
 expect(skirt.foldAxisX).toBe(-91.16);expect(skirt.netBounds.x+skirt.netBounds.width/2).toBeCloseTo(skirt.foldAxisX!,5);
 const women=compositionCatalogue(compositionSource(config,'womens-basic-tee')).assets.find(a=>a.key==='neck-front')!;expect(women.sourceId).toBe('womens-basic-tee.finish.neckband');
},30000);

it('replaces matching sleeve and neck slots across views without stacking or moving the garment',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),cat=compositionCatalogue(source);
 const plan={id:'p',name:'固定三视图',pieces:compositionTeeStarter(source,()=>crypto.randomUUID())};
 const sleeves=plan.pieces.filter(p=>compositionSlot(p)?.includes(':sleeve'));
 const sleeve=cat.assets.find(a=>a.key==='sleeve')!;
 let result=replaceCompositionAsset(plan,sleeve,cat,()=>crypto.randomUUID(),'side',900,600);
 for(let i=0;i<3;i++)result=replaceCompositionAsset(result.plan,sleeve,cat,()=>crypto.randomUUID(),'back',10,20);
 expect(result.plan.pieces).toEqual(plan.pieces);expect(sleeves).toHaveLength(5);
 const neck=cat.assets.find(a=>a.key==='neck-back')!;
 result=replaceCompositionAsset(result.plan,neck,cat,()=>crypto.randomUUID(),'side',40,800);
 expect(result.plan.pieces).toEqual(plan.pieces);
 const women=compositionCatalogue({...source,templateId:'womens-basic-tee'});
 const changed=replaceCompositionAsset(plan,women.assets.find(a=>a.key==='sleeve')!,women,()=>crypto.randomUUID(),'front');
 expect(changed.plan.pieces).toHaveLength(11);
 expect(changed.plan.pieces.filter(p=>compositionSlot(p)?.includes(':sleeve')).every(p=>p.source.templateId==='womens-basic-tee')).toBe(true);
 expect(changed.plan.pieces.filter(p=>!compositionSlot(p)?.includes(':sleeve'))).toEqual(plan.pieces.filter(p=>!compositionSlot(p)?.includes(':sleeve')));
});
it('locks structural positions and rotation at save and load boundaries while preserving pocket placement',async()=>{
 const store=editor(),source=compositionSource(store.getState().getConfiguration(),'t-shirt'),cat=compositionCatalogue(source);
 const c=emptyPieceComposition('p');c.plans[0].pieces=compositionTeeStarter(source,()=>crypto.randomUUID());
 const pocket=newCompositionPiece(cat.assets.find(a=>a.key==='design.patch-pocket')!,source,'pocket');
 Object.assign(pocket,{x:313,y:279,rotation:17,view:'back'});c.plans[0].pieces.push(pocket);
 const legacy=structuredClone(c);legacy.plans[0].pieces.forEach(p=>{if(!compositionMovable(p)){p.x=999;p.y=888;p.rotation=45;}});
 store.getState().setPieceComposition(legacy);expect(store.getState().pieceComposition).toEqual(c);
 const id=await store.getState().saveDesign();
 docs.get(id)!.configuration.pieceComposition=legacy;
 store.getState().newDesign();expect(await store.getState().loadDesign(id)).toBe(true);
 expect(store.getState().pieceComposition).toEqual(c);expect(normalizeComposition(c)).toEqual(c);
});
it('keeps the shoulder mounting point fixed when changing dimensions and retains the left sleeve orientation',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt');
 const left=compositionTeeStarter(source,()=>crypto.randomUUID()).find(p=>p.assetKey==='sleeve'&&p.mirrored)!;
 const a=resolveCompositionPiece(left),oldSize=pieceDisplaySize(left,a),next=anchorCompositionPiece({...left,widthMm:left.widthMm*1.4,heightMm:left.heightMm*1.2,x:500,y:500,rotation:50});
 const nextSize=pieceDisplaySize(next,a),anchor=a.anchor!,b=a.artBounds;
 const shoulder=(p:typeof left,s:typeof oldSize)=>({x:p.x-(anchor.x-b.x-b.width/2)*s.width/b.width,y:p.y+(anchor.y-b.y-b.height/2)*s.height/b.height});
 expect(shoulder(next,nextSize).x).toBeCloseTo(shoulder(left,oldSize).x,8);
 expect(shoulder(next,nextSize).y).toBeCloseTo(shoulder(left,oldSize).y,8);
 expect(next.mirrored).toBe(true);expect(next.rotation).toBe(0);
 const restored=anchorCompositionPiece({...next,widthMm:a.widthMm,heightMm:a.heightMm});expect(restored).toEqual(left);
});
it('adds and copies pockets independently and refuses an unmapped source net as a garment replacement',()=>{
 const config=editor().getState().getConfiguration(),source=compositionSource(config,'t-shirt'),cat=compositionCatalogue(source);
 const plan={id:'p',name:'口袋',pieces:compositionTeeStarter(source,()=>crypto.randomUUID())},a=cat.assets.find(a=>a.key==='design.patch-pocket')!;
 let result=replaceCompositionAsset(plan,a,cat,()=>crypto.randomUUID(),'front',315,280);
 result=replaceCompositionAsset(result.plan,a,cat,()=>crypto.randomUUID(),'back',302,290);
 expect(result.plan.pieces).toHaveLength(13);expect(result.plan.pieces.at(-1)).toMatchObject({x:302,y:290,view:'back'});
 expect(compositionSlot(result.plan.pieces.at(-1)!)).toBeNull();
 const raw=compositionCatalogue(compositionSource(config,'long-sleeve-tee'));
 expect(()=>replaceCompositionAsset(plan,raw.assets.find(a=>a.key==='sven.sleeve')!,raw,()=>crypto.randomUUID(),'front')).toThrow(/三视图映射/);
});
