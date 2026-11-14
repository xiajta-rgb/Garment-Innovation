import { expect, it } from 'vitest';
import { createDesignStore } from '@/store/designStore';
import { compositionSource } from '@/application/composition-catalogue';
import { applyDesignAsset } from '@/application/professional-design-assets';
import { batchPackage, emptyBatchRequest, generateRedesignBatch, importBatchSelection, readBatchRequest, suggestBatchRequest } from '@/application/redesign-batch';
import { emptyPieceComposition, readPieceComposition } from '@/lib/pattern/piece-composition';
import type { RedesignBatchRequest } from '@/types/redesign-batch';

const uid=()=>crypto.randomUUID(),store=createDesignStore({repository:{save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}}});
const source=compositionSource(store.getState().getConfiguration(),'t-shirt');
const base=()=>applyDesignAsset('graphic.text',applyDesignAsset('shoulder.set-in',emptyPieceComposition(uid()).plans[0],source,uid),source,uid);
const request=(patch:Partial<RedesignBatchRequest>={})=>({...emptyBatchRequest('休闲短T系列'),...patch});
it('reads 16 visible WPS collections honestly and generates distinct candidates without changing the base',()=>{
 const b=base(),before=structuredClone(b),r=request();r.choices.neck=['keep','neck.v'];r.choices.shoulder=['keep','shoulder.raglan'];r.choices.fabric=['keep','fabric.waffle'];r.maxChangedAxes=3;
 const result=generateRedesignBatch(r,b,source,uid);expect(result.knowledge).toEqual({read:16,indexed:19,complete:false});expect(result.counts).toMatchObject({combinations:8,unchanged:1,conflicting:0,eligible:7});expect(result.candidates).toHaveLength(7);expect(b).toEqual(before);
 const raglan=result.candidates.find(c=>c.options.shoulder==='shoulder.raglan'&&c.options.neck==='neck.v'&&c.options.fabric==='fabric.waffle')!;
 expect(raglan.plan.elements).toMatchObject({shoulder:'raglan',neckline:'v',fabric:'waffle'});expect(raglan.plan.elements!.graphics[0]).toMatchObject({...b.elements!.graphics[0],id:expect.any(String)});
 expect(raglan.plan.pieces.map(p=>[p.assetKey,p.widthMm,p.heightMm,p.source])).toEqual(b.pieces.map(p=>[p.assetKey,p.widthMm,p.heightMm,p.source]));
 expect(readPieceComposition({schema:'garment-os/piece-composition-editor/v1',activePlanId:raglan.id,plans:[raglan.plan]}).plans[0].matrix).toEqual(raglan.plan.matrix);
 expect(batchPackage(result).candidates[0].package.matrix).toEqual(result.candidates[0].plan.matrix);expect(result.productionApproved).toBe(false);
});
it('excludes incompatible combinations instead of silently overriding chosen V neck with crew binding',()=>{
 const r=request();r.choices.neck=['neck.v','neck.crew'];r.choices.finish=['finish.binding'];const result=generateRedesignBatch(r,base(),source,uid);
 expect(result.candidates).toHaveLength(1);expect(result.candidates[0].plan.elements?.neckline).toBe('crew');expect(result.counts.conflicting).toBe(1);expect(result.rejected[0].reason).toContain('不能覆盖');
});
it('checks final pocket and opening combination while permitting an explicit removal from the base',()=>{
 const b=applyDesignAsset('pocket.kangaroo',base(),source,uid),r=request({maxChangedAxes:4});r.choices.neck=['opening.full'];r.choices.pocket=['keep','none'];const result=generateRedesignBatch(r,b,source,uid);
 expect(result.counts.conflicting).toBe(1);expect(result.candidates).toHaveLength(1);expect(result.candidates[0].plan.pieces.some(p=>p.assetKey.includes('pocket'))).toBe(false);
});
it('preserves positioned and rotated accessories with keep, and replaces only explicitly selected pocket axes',()=>{
 const b=applyDesignAsset('pocket.patch',base(),source,uid);const pocket=b.pieces.find(p=>p.assetKey.includes('pocket'))!;Object.assign(pocket,{x:300,y:310,rotation:30,widthMm:110});
 const r=request();r.choices.fabric=['fabric.rib'];const result=generateRedesignBatch(r,b,source,uid);expect(result.candidates[0].plan.pieces.find(p=>p.assetKey.includes('pocket'))).toMatchObject({x:300,y:310,rotation:30,widthMm:110});
 r.choices.pocket=['none','pocket.welt'];const next=generateRedesignBatch(r,b,source,uid);expect(next.candidates.every(c=>c.plan.pieces.filter(p=>p.assetKey.includes('pocket')).length<=1)).toBe(true);
});
it('deduplicates semantically identical neckline presets and counts actual changed axes',()=>{
 const r=request();r.choices.neck=['neck.henley','opening.buttons'];const result=generateRedesignBatch(r,base(),source,uid);expect(result.counts.duplicates).toBe(1);expect(result.candidates).toHaveLength(1);
 const b=applyDesignAsset('finish.binding',base(),source,uid);r.choices.neck=['neck.crew'];r.maxChangedAxes=1;const linked=generateRedesignBatch(r,b,source,uid);expect(linked.candidates[0].changedAxes).toEqual(['finish']);
 r.locks=['finish'];expect(generateRedesignBatch(r,b,source,uid).counts.conflicting).toBe(1);
});
it('blocks photo color overrides, clears main photo when changing texture and preserves other assignments',()=>{
 const b=base();b.elements!.materialImages={main:{dataUrl:'data:image/png;base64,iVBORw0KGgo=',width:1,height:1,materialId:'real-1'}};
 const r=request();r.choices.contrast=['contrast.sleeve'];expect(generateRedesignBatch(r,b,source,uid).counts.conflicting).toBe(1);
 r.choices.contrast=['keep'];r.choices.fabric=['fabric.waffle'];const n=generateRedesignBatch(r,b,source,uid);expect(n.candidates[0].plan.elements?.materialImages?.main).toBeUndefined();
});
it('retains all unsupported and exclusion intent until the user explicitly chooses partial execution',()=>{
 const r=suggestBatchRequest('保留原款，增加华夫格、插肩、泡泡袖和压褶');expect(r.choices.shoulder).toContain('shoulder.raglan');expect(r.pendingRequirements.join()).toContain('泡泡袖');expect(r.pendingRequirements.join()).toContain('压褶');expect(()=>readBatchRequest(r)).toThrow('待补');r.allowPartial=true;expect(readBatchRequest(r).brief).toBe(r.brief);
 expect(()=>readBatchRequest({...r,maxCandidates:1000})).toThrow();expect(()=>readBatchRequest({...r,locks:['fabric']})).toThrow('锁定');
});
it('imports atomically, rejects overflow and stale bases, and preserves original plus batch lineage',()=>{
 const b=base(),r=request();r.choices.neck=['neck.v'];const batch=generateRedesignBatch(r,b,source,uid),current={...emptyPieceComposition(b.id),plans:[b]},id=batch.candidates[0].id;
 const next=importBatchSelection(current,batch,[id]);expect(next.plans[0]).toEqual(b);expect(next.plans[1].matrix?.brief).toBe(r.brief);expect(current.plans).toHaveLength(1);
 expect(()=>importBatchSelection(next,batch,[id])).toThrow('已经');const crowded={...current,plans:Array.from({length:12},(_,i)=>({...b,id:i===0?b.id:uid()}))};expect(()=>importBatchSelection(crowded,batch,[id])).toThrow('还可加入0');
 const edited=structuredClone(current);edited.plans[0].elements!.shoulder='raglan';expect(()=>importBatchSelection(edited,batch,[id])).toThrow('基款已修改');
});
