import { expect, it } from 'vitest';
import { createDesignStore } from '@/store/designStore';
import { compositionSource, normalizeComposition } from '@/application/composition-catalogue';
import { applyDesignAsset, designAssetPackage } from '@/application/professional-design-assets';
import { createRedesign, graphicTechniqueTag, planSignature } from '@/application/redesign-workflow';
import { REDESIGN_METHODS } from '@/data/redesignMethods';
import { emptyPieceComposition, readPieceComposition } from '@/lib/pattern/piece-composition';
import type { CompositionPlan } from '@/types/piece-composition';
import type { RedesignRequest } from '@/application/redesign-workflow';

const uid=()=>crypto.randomUUID();
const store=()=>createDesignStore({repository:{save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}}});
const source=compositionSource(store().getState().getConfiguration(),'t-shirt');
const base=()=>applyDesignAsset('shoulder.set-in',emptyPieceComposition(uid()).plans[0],source,uid);
const graphicBase=()=>{const b=applyDesignAsset('graphic.text',base(),source,uid);return b;};
const run=(r:RedesignRequest,b=base())=>createRedesign(r,b,source,uid);
const coords=(b:CompositionPlan)=>b.pieces.map(p=>{const copy={...p};Reflect.deleteProperty(copy,'id');return copy;});
const mounted=(b:CompositionPlan,n:CompositionPlan)=>normalizeComposition({...emptyPieceComposition(b.id),plans:[{...b,elements:n.elements}]}).plans[0];

it('keeps the original intact, stores source provenance and changes an actual shoulder parameter',()=>{
 const b=base(),before=structuredClone(b),n=run({methodId:'replacement',assetId:'shoulder.raglan'},b);
 expect(b).toEqual(before);expect(n.elements?.shoulder).toBe('raglan');expect(coords(n)).toEqual(coords(mounted(b,n)));
 expect(n.pieces.map(p=>[p.widthMm,p.heightMm,p.source])).toEqual(b.pieces.map(p=>[p.widthMm,p.heightMm,p.source]));
 expect(n.id).not.toBe(b.id);expect(n.pieces.every(p=>!b.pieces.some(old=>old.id===p.id))).toBe(true);
 expect(n.redesign?.baseSignature).toBe(planSignature(b));expect(n.redesign?.sourceBlockId).toBe('fQsBghMKOECyueNa');
 expect(()=>run({methodId:'replacement',assetId:'shoulder.set-in'},b)).toThrow('相同');
});
it('locks all structural dimensions and placement while changing fabric and preserves pockets',()=>{
 const b=applyDesignAsset('pocket.patch',base(),source,uid),n=run({methodId:'silhouette-lock',assetId:'fabric.waffle'},b);
 expect(n.elements?.fabric).toBe('waffle');expect(coords(n)).toEqual(coords(b));expect(n.elements?.neckline).toBe(b.elements?.neckline);
 expect(()=>run({methodId:'silhouette-lock',assetId:'neck.v'},b)).toThrow('允许');
});
it('distinguishes a detail move from an extension and preserves graphic content, size and rotation',()=>{
 const b=graphicBase(),g=b.elements!.graphics[0];g.rotation=25;
 const r={graphicId:g.id,targetView:'back' as const};
 const moved=run({...r,methodId:'detail-transfer'},b),extended=run({...r,methodId:'detail-extension'},b);
 expect(moved.elements?.graphics).toHaveLength(1);expect(moved.elements?.graphics[0]).toMatchObject({view:'back',width:g.width,height:g.height,text:g.text,rotation:25});
 expect(extended.elements?.graphics).toHaveLength(2);expect(extended.elements?.graphics.map(g=>g.view)).toEqual(['front','back']);expect(b.elements?.graphics).toHaveLength(1);
 expect(()=>run({...r,methodId:'detail-transfer',targetView:'front'},b)).toThrow('不同');expect(()=>run({...r,methodId:'detail-transfer',targetView:'side'},b)).toThrow('侧面');
});
it('borrows a parameterized neckline or shoulder, preserving host dimensions instead of copying donor pieces',()=>{
 const b=base(),donor=applyDesignAsset('neck.polo',applyDesignAsset('shoulder.raglan',base(),source,uid),source,uid);
 donor.pieces.forEach(p=>p.widthMm*=1.2);
 const n=run({methodId:'style-combination',donor,donorPart:'neck'},b),s=run({methodId:'style-combination',donor,donorPart:'shoulder'},b);
 expect(n.elements?.neckline).toBe('polo');expect(n.elements?.craft?.opening).toBe('buttons');expect(n.elements?.shoulder).toBe('set-in');expect(coords(n)).toEqual(coords(mounted(b,n)));
 expect(s.elements?.shoulder).toBe('raglan');expect(s.elements?.neckline).toBe('crew');expect(coords(s)).toEqual(coords(mounted(b,s)));
 expect(s.pieces.map(p=>p.widthMm)).toEqual(b.pieces.map(p=>p.widthMm));
 expect(()=>run({methodId:'style-combination',donor:b,donorPart:'neck'},b)).toThrow('另一个');
});
it('reverses only the body and sleeve color relationship and requires a visible relationship',()=>{
 const b=base();b.elements!.sleeveContrast=true;const old=b.pieces.find(p=>p.assetKey==='body-front')!.color,accent=b.elements!.sleeveColor;
 const n=run({methodId:'reverse'},b);expect(n.elements?.sleeveColor).toBe(old);expect(n.pieces.find(p=>p.assetKey==='body-front')?.color).toBe(accent);expect(n.elements?.neckline).toBe(b.elements?.neckline);
 expect(()=>run({methodId:'reverse'})).toThrow('撞色');
});
it('keeps the original graphic while recording a real technique intent and exposes absent exact labels',()=>{
 const b=graphicBase(),g=b.elements!.graphics[0],n=run({methodId:'change-form',graphicId:g.id,technique:'embroidery'},b);
 expect(n.elements?.graphics[0]).toMatchObject({text:g.text,width:g.width,height:g.height,x:g.x,y:g.y,technique:'embroidery'});
 expect(graphicTechniqueTag('embroidery')).toBeUndefined();expect(n.redesign?.notes.join()).toContain('精确叶子标签');
 expect(graphicTechniqueTag('digital-print')?.name).toBe('数码印花');expect(graphicTechniqueTag('applique')?.name).toBe('贴布绣');
 const pack=designAssetPackage(n);expect(pack.graphics[0].techniqueTag).toBeNull();expect(pack.redesign).toEqual(n.redesign);expect(pack.productionApproved).toBe(false);
});
it('adds and removes independently selectable parts without deleting structural body pieces',()=>{
 const b=base(),n=run({methodId:'add-part',assetId:'pocket.welt'},b),pocket=n.pieces.find(p=>p.assetKey==='design.welt-pocket')!;
 expect(pocket).toBeDefined();expect(n.pieces.length).toBe(b.pieces.length+1);
 const removed=run({methodId:'remove-part',removeId:pocket.id},n);expect(removed.pieces.map(p=>p.assetKey)).toEqual(b.pieces.map(p=>p.assetKey));
 expect(()=>run({methodId:'remove-part',removeId:b.pieces[0].id},b)).toThrow('不能');
 const hood=run({methodId:'add-part',assetId:'hood.three'},b);expect(run({methodId:'remove-part',removeId:'hood'},hood).elements?.details?.hood).toBe('none');
 expect(()=>run({methodId:'add-part',assetId:'hood.two'},hood)).toThrow('已有');
 const panel=applyDesignAsset('panel.yoke',b,source,uid);expect(run({methodId:'remove-part',removeId:'panel'},panel).elements?.details?.panel).toBe('none');
});
it('removes decorative contrast or piping without removing functional structure or graphics',()=>{
 const b=applyDesignAsset('finish.piping',applyDesignAsset('hood.cord',graphicBase(),source,uid),source,uid);b.elements!.neckContrast=true;
 const n=run({methodId:'reduce-decoration',decoration:'contrast'},b),p=run({methodId:'reduce-decoration',decoration:'piping'},b);
 expect(n.elements?.neckContrast).toBe(false);expect(n.elements?.details?.drawcord).toBe(true);expect(n.elements?.graphics).toHaveLength(1);expect(p.elements?.craft?.seamFinish).toBe('plain');
});
it('reduces or removes one chosen graphic while preserving all others and fabric',()=>{
 const b=graphicBase(),g=b.elements!.graphics[0];b.elements!.graphics.push({...g,id:uid(),view:'back'});
 const n=run({methodId:'reduce-pattern',graphicId:g.id,patternAction:'shrink'},b),r=run({methodId:'reduce-pattern',graphicId:g.id,patternAction:'remove'},b);
 expect(n.elements?.graphics[0].width).toBeCloseTo(g.width*.65);expect(n.elements?.graphics[1].width).toBe(g.width);expect(r.elements?.graphics).toHaveLength(1);expect(r.elements?.fabric).toBe(b.elements?.fabric);
});
it('blocks unavailable categories, incomplete bases, too many graphics and conflicting openings',()=>{
 expect(REDESIGN_METHODS.filter(m=>m.implemented)).toHaveLength(11);expect(()=>run({methodId:'category-transfer'})).toThrow('目标品类');
 expect(()=>run({methodId:'replacement',assetId:'neck.v'},emptyPieceComposition(uid()).plans[0])).toThrow('基础起稿');
 const b=graphicBase(),g=b.elements!.graphics[0];b.elements!.graphics=Array.from({length:12},()=>({...g,id:uid()}));
 expect(()=>run({methodId:'detail-extension',graphicId:b.elements!.graphics[0].id,targetView:'back'},b)).toThrow('12');
 const zip=applyDesignAsset('opening.full',base(),source,uid);expect(()=>run({methodId:'add-part',assetId:'pocket.kangaroo'},zip)).toThrow('全开襟');
});
it('preserves provenance and technique through save parsing and history; rejects forged source blocks',()=>{
 const b=graphicBase(),n=run({methodId:'change-form',graphicId:b.elements!.graphics[0].id,technique:'digital-print'},b),state=store();
 const c={...emptyPieceComposition(b.id),activePlanId:n.id,plans:[b,n]};state.getState().setPieceComposition(c);state.getState().setPieceComposition({...c,activePlanId:b.id});state.getState().undo();
 const checked=readPieceComposition(JSON.parse(JSON.stringify(state.getState().pieceComposition)));
 expect(checked.activePlanId).toBe(n.id);expect(checked.plans[1].redesign).toEqual(n.redesign);expect(checked.plans[1].elements?.graphics[0].technique).toBe('digital-print');
 n.redesign!.sourceBlockId='invented';expect(()=>readPieceComposition({...c,plans:[b,n]})).toThrow('来源');
});
it('compares content independently of JSON property order and optional defaults',()=>{
 const b=base(),c=structuredClone(b);delete c.elements!.craft;delete c.elements!.details;
 expect(planSignature(c)).toBe(planSignature(b));
 const round=readPieceComposition({...emptyPieceComposition(b.id),plans:[b]}).plans[0];expect(planSignature(round)).toBe(planSignature(b));
 expect(()=>run({methodId:'replacement',assetId:'shoulder.set-in'},c)).toThrow('相同');
});
it('blocks color-only actions over real photographs rather than misrepresenting a material change',()=>{
 const b=base();b.elements!.sleeveContrast=true;b.elements!.neckContrast=true;
 const assignment={source:'basedata.material.list' as const,version:'1' as const,endpoint:'https://example.com/mcp',fetchedAt:'2026-11-12T10:00:00Z',material:{materialId:'1',materialName:'Rib',status:0,materialType:'M',materialPic:'https://example.com/image.png'}};
 const image={dataUrl:'data:image/png;base64,AAAA',width:100,height:100,materialId:'1'};
 b.elements!.materials={main:assignment,neck:assignment};b.elements!.materialImages={main:image,neck:image};
 expect(()=>run({methodId:'reverse'},b)).toThrow('真实换料');expect(()=>run({methodId:'reduce-decoration',decoration:'contrast'},b)).toThrow('照片');
 const replaced=run({methodId:'silhouette-lock',assetId:'fabric.waffle'},b);expect(replaced.elements?.materialImages?.main).toBeUndefined();expect(replaced.elements?.materialImages?.neck).toEqual(image);
});
