import { expect,it } from 'vitest';
import { createDesignStore } from '@/store/designStore';
import { compositionCatalogue,compositionSource,compositionTeeStarter,anchorCompositionPiece } from '@/application/composition-catalogue';
import { compositionDecoratedMarkup,compositionGraphicMarkup,compositionPieceColor } from '@/application/composition-decoration';
import { DEFAULT_COMPOSITION_ELEMENTS,readCompositionElements } from '@/lib/pattern/composition-elements';
import { emptyPieceComposition } from '@/lib/pattern/piece-composition';
import type { DesignDocument } from '@/types/design';

const documents=new Map<string,DesignDocument>();
const editor=()=>createDesignStore({repository:{save:async d=>{documents.set(d.id,structuredClone(d));},get:async id=>documents.get(id),list:async()=>[],delete:async()=>{}}});
it('raglan changes the paired body and sleeve topology to the neckline and keeps source CAD intact',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),base=compositionCatalogue(source),raglan=compositionCatalogue(source,{...DEFAULT_COMPOSITION_ELEMENTS,shoulder:'raglan'});
 const a=base.assets.find(a=>a.key==='body-front')!,b=raglan.assets.find(a=>a.key==='body-front')!;
 expect(b.markup).not.toBe(a.markup);expect(b.netPath).toBe(a.netPath);
 const sleeve=raglan.assets.find(a=>a.key==='sleeve')!,baseSleeve=base.assets.find(a=>a.key==='sleeve')!;
 expect(sleeve.anchor!.y).toBe(0);expect(sleeve.artBounds.y).toBe(0);
 expect(sleeve.anchor!.x).toBeLessThan(baseSleeve.anchor!.x);expect(sleeve.markup).not.toBe(baseSleeve.markup);
 const piece=compositionTeeStarter(source,()=>crypto.randomUUID()).find(p=>p.assetKey==='sleeve')!;
 const placed=anchorCompositionPiece(piece,sleeve);
 expect(placed.y-sleeve.artBounds.height*sleeve.artScale/2).toBeCloseTo(105,6);
 const drop=compositionCatalogue(source,{...DEFAULT_COMPOSITION_ELEMENTS,shoulder:'drop'}).assets.find(a=>a.key==='sleeve')!;
 expect(drop.anchor!.x).toBeGreaterThan(baseSleeve.anchor!.x);
},20000);
it('V neck changes both the body opening and the band, while contrast fills and cuff boundaries remain distinct',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),e={...DEFAULT_COMPOSITION_ELEMENTS,neckline:'v' as const,cuffContrast:true,neckContrast:true,sleeveContrast:true};
 const cat=compositionCatalogue(source,e),base=compositionCatalogue(source),pieces=compositionTeeStarter(source,()=>crypto.randomUUID());
 for(const key of ['body-front','neck-front'])expect(cat.assets.find(a=>a.key===key)!.markup).not.toBe(base.assets.find(a=>a.key===key)!.markup);
 const sleeve=cat.assets.find(a=>a.key==='sleeve')!,piece=pieces.find(p=>p.assetKey==='sleeve')!;
 expect(sleeve.markup).toContain(`fill="${e.cuffColor}"`);expect(sleeve.markup).toContain('data-design-element="cuff-contrast"');
 expect(compositionPieceColor(piece,sleeve,e)).toBe(e.sleeveColor);
 const markup=compositionDecoratedMarkup(sleeve,piece,e,'unique');expect(markup).toContain('unique-cuff-clip');expect(markup).not.toContain('id="cuff-piece-clip"');
},20000);
it('closes texture fills on existing paths, embeds selected material photos and escapes editable graphics',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),cat=compositionCatalogue(source),piece=compositionTeeStarter(source,()=>crypto.randomUUID()).find(p=>p.assetKey==='body-front')!,a=cat.assets.find(a=>a.key==='body-front')!;
 const e={...structuredClone(DEFAULT_COMPOSITION_ELEMENTS),fabric:'waffle' as const};
 const markup=compositionDecoratedMarkup(a,piece,e,'texture');expect(markup).toContain('url(#texture-fabric-main)');expect(markup).toContain(a.markup.match(/d="([^"]+)"/)![1]);
 expect(compositionGraphicMarkup({id:'g',kind:'text',text:'<script>',color:'#ffffff',view:'front',x:315,y:270,width:70,height:18})).toContain('&lt;script&gt;');
 const photo=compositionDecoratedMarkup(a,piece,{...e,materialImages:{main:{dataUrl:'data:image/png;base64,AAAA',width:100,height:100,materialId:'1'}}},'photo');
 expect(photo).toContain('<image href="data:image/png;base64,AAAA"');expect(photo).toContain('url(#photo-fabric-main)');
});
it('keeps normalized flat-drawing line weights small enough for the scaled three-view canvas',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),cat=compositionCatalogue(source,{...DEFAULT_COMPOSITION_ELEMENTS,neckline:'polo'});
 for(const asset of cat.assets.filter(a=>a.illustration&&!a.key.startsWith('design.'))){
  const widths=[...asset.markup.matchAll(/stroke-width="([^"]+)"/g)].map(m=>Number(m[1]));
  if(widths.length) expect(Math.max(...widths),asset.key).toBeLessThan(.01);
  expect(asset.markup).not.toContain('stroke-width="2.05"');
 }
});
it('persists independent design combinations and logos across plan copying, undo and save/reopen',async()=>{
 const store=editor(),source=compositionSource(store.getState().getConfiguration(),'t-shirt'),c=emptyPieceComposition('one');
 c.plans[0].pieces=compositionTeeStarter(source,()=>crypto.randomUUID());c.plans[0].elements={...structuredClone(DEFAULT_COMPOSITION_ELEMENTS),shoulder:'raglan',cuffContrast:true,fabric:'rib',graphics:[{id:'g',kind:'monogram',text:'AB',color:'#fafafa',view:'back',x:250,y:270,width:40,height:30,rotation:45}]};
 store.getState().setPieceComposition(c);
 const copy={...structuredClone(c.plans[0]),id:'two',name:'方案二'};copy.elements!.fabric='waffle';copy.elements!.graphics[0].text='CD';
 store.getState().setPieceComposition({...c,activePlanId:'two',plans:[c.plans[0],copy]});store.getState().undo();expect(store.getState().pieceComposition!.plans).toHaveLength(1);store.getState().redo();
 const snapshot=structuredClone(store.getState().pieceComposition),id=await store.getState().saveDesign();store.getState().newDesign();expect(await store.getState().loadDesign(id)).toBe(true);expect(store.getState().pieceComposition).toEqual(snapshot);
 expect(snapshot!.plans[0].elements!.graphics[0].text).toBe('AB');expect(snapshot!.plans[1].elements!.graphics[0].text).toBe('CD');
 expect(store.getState().pieceComposition!.plans[1].elements!.graphics[0].rotation).toBe(45);
},20000);
it('rejects executable uploads, broken material lineage, duplicate logos and invalid design choices',()=>{
 const e=structuredClone(DEFAULT_COMPOSITION_ELEMENTS);expect(readCompositionElements(e)).toEqual(e);
 expect(()=>readCompositionElements({...e,shoulder:'pretend'})).toThrow();
 expect(()=>readCompositionElements({...e,materialImages:{main:{dataUrl:'data:image/png;base64,AAAA',width:1,height:1,materialId:'1'}}})).toThrow(/来源/);
 const graphic={id:'g',kind:'image',text:'上传',color:'#ffffff',view:'front',x:300,y:270,width:40,height:40,image:{dataUrl:'data:image/svg+xml;base64,AAAA',width:1,height:1}};
 expect(()=>readCompositionElements({...e,graphics:[graphic]})).toThrow(/图片/);
 const text={...graphic,kind:'text',image:undefined};expect(()=>readCompositionElements({...e,graphics:[text,text]})).toThrow(/重复/);
 expect(readCompositionElements({...e,graphics:[text]}).graphics[0].rotation).toBeUndefined();
 for(const rotation of [NaN,Infinity,361,-361,'45'])expect(()=>readCompositionElements({...e,graphics:[{...text,rotation}]})).toThrow();
});
