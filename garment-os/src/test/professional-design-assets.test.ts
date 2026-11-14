import { compositionDecoratedMarkup } from '@/application/composition-decoration';
import { expect,it } from 'vitest';
import { PROFESSIONAL_DESIGN_ASSETS } from '@/data/professionalDesignAssets';
import { requirePieceRole } from '@/data/pieceTaxonomy';
import { applyDesignAsset, designAssetPackage, designAssetTags } from '@/application/professional-design-assets';
import { compositionCatalogue, compositionSource } from '@/application/composition-catalogue';
import { DEFAULT_COMPOSITION_DETAILS, DEFAULT_COMPOSITION_ELEMENTS, readCompositionElements } from '@/lib/pattern/composition-elements';
import { emptyPieceComposition, readPieceComposition } from '@/lib/pattern/piece-composition';
import { createDesignStore } from '@/store/designStore';
import { applyTagDesign, resolveTagDesign } from '@/application/tag-design';
const editor=()=>createDesignStore({repository:{save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}}});
const uid=()=>crypto.randomUUID();
it('every registered preset has actual dictionary codes and existing piece roles or explicit BOM accessories',()=>{
 expect(new Set(PROFESSIONAL_DESIGN_ASSETS.map(a=>a.id)).size).toBe(PROFESSIONAL_DESIGN_ASSETS.length);
 for(const a of PROFESSIONAL_DESIGN_ASSETS){expect(()=>designAssetTags(a.id),a.id).not.toThrow();for(const c of a.components)if(c.role!=='bom.trim')expect(()=>requirePieceRole(c.role),a.id+'/'+c.role).not.toThrow();}
});
it('every preset can be applied, serialized and rendered; newly drawn components are never certified as cutting patterns',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),empty=emptyPieceComposition('assets');
 for(const a of PROFESSIONAL_DESIGN_ASSETS){const plan=applyDesignAsset(a.id,empty.plans[0],source,uid);expect(()=>readPieceComposition({...empty,plans:[plan]}),a.id).not.toThrow();
  const cat=compositionCatalogue(source,plan.elements);expect(cat.assets.map(a=>a.markup).join(''),a.id).not.toMatch(/NaN|Infinity|undefined/);
  const pack=designAssetPackage(plan);expect(pack.productionApproved).toBe(false);expect(pack.netPatternReady).toBe(false);
 }
},30000);
it('keeps all structural anchors fixed and provides movable pocket accessories with genuine open mouths',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),empty=emptyPieceComposition('assets');
 const first=applyDesignAsset('shoulder.raglan',empty.plans[0],source,uid);
 const next=applyDesignAsset('pocket.kangaroo',first,source,uid);
 expect(next.pieces.slice(0,first.pieces.length)).toEqual(first.pieces);expect(next.pieces.at(-1)?.assetKey).toBe('design.kangaroo-pocket');
 expect(compositionCatalogue(source,next.elements).assets.find(a=>a.key==='design.kangaroo-pocket')?.markup).toContain('pocket-open-edges');
 const zip=applyDesignAsset('opening.full',first,source,uid);expect(()=>applyDesignAsset('pocket.kangaroo',zip,source,uid)).toThrow('全开襟');expect(()=>applyDesignAsset('opening.full',next,source,uid)).toThrow('全开襟');
});
it('requires explicit part context for trim, panel, hood and zip-pocket tags and can resolve complete combinations',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),empty=emptyPieceComposition('tags');
 for(const tags of [['罗纹收口'],['连帽'],['抽绳调节'],['嵌线袋'],['色块拼接']])expect(resolveTagDesign({tags}).previewReady,tags.join()).toBe(false);
 const result=resolveTagDesign({tags:['插肩','连帽','抽绳调节','袋鼠式前袋','罗纹收口','弧线拼片','色块拼接'],hoodType:'three-piece',finishPart:'cuff',panelPart:'yoke'});
 expect(result.issues).toEqual([]);expect(result.elements.details?.hood).toBe('three-piece');expect(result.elements.details?.cuffFinish).toBe('rib');expect(result.elements.details?.panel).toBe('yoke');
 const plan=applyTagDesign(result,empty.plans[0],source,uid);expect(plan.pieces.at(-1)?.assetKey).toBe('design.kangaroo-pocket');expect(plan.elements?.tagIntent?.hoodType).toBe('three-piece');
 const checked=readPieceComposition({...empty,plans:[plan]}),pack=designAssetPackage(checked.plans[0]);expect(pack.assets.map(a=>a.id)).toContain('pocket.kangaroo');expect(pack.assets.map(a=>a.id)).toContain('hood.three');
 expect(resolveTagDesign({tags:['嵌线袋','拉链口袋','胸袋']}).previewReady).toBe(true);
 const polo=resolveTagDesign({tags:['Polo领','半开襟','拉链']});expect(polo.assetIds).toContain('neck.polo');expect(polo.assetIds).toContain('opening.quarter');const p=applyTagDesign(polo,empty.plans[0],source,uid);expect(designAssetPackage(p).assets.flatMap(a=>a.components).some(c=>c.name.includes('纽扣'))).toBe(false);
});
it('preserves details and part context through undo and rejects invalid values and incompatible structures',()=>{
 const store=editor(),source=compositionSource(store.getState().getConfiguration(),'t-shirt'),empty=emptyPieceComposition('one');
 let plan=applyDesignAsset('finish.slit',empty.plans[0],source,uid);store.getState().setPieceComposition({...empty,plans:[plan]});
 plan=applyDesignAsset('hood.cord',plan,source,uid);store.getState().setPieceComposition({...empty,plans:[plan]});store.getState().undo();expect(store.getState().pieceComposition?.plans[0].elements?.details?.hood).toBe('none');
 for(const details of [{...DEFAULT_COMPOSITION_DETAILS,slitHeightMm:0},{...DEFAULT_COMPOSITION_DETAILS,panelColor:'url(bad)'},{...DEFAULT_COMPOSITION_DETAILS,drawcord:true},{...DEFAULT_COMPOSITION_DETAILS,hoodHeightMm:Infinity}])expect(()=>readCompositionElements({...DEFAULT_COMPOSITION_ELEMENTS,details})).toThrow();
});

it('applies enterprise cuff and hem photos to independent rib pieces without changing the body fabric',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt'),empty=emptyPieceComposition('fabric');
 let plan=applyDesignAsset('finish.cuff-rib',empty.plans[0],source,uid);plan=applyDesignAsset('finish.hem-rib',plan,source,uid);
 const assignment={source:'basedata.material.list' as const,version:'1' as const,endpoint:'https://example.com/mcp',fetchedAt:'2026-11-12T10:00:00Z',material:{materialId:'1',materialName:'Rib',status:0,materialType:'M',materialPic:'https://example.com/image.png'}};
 const image={dataUrl:'data:image/png;base64,AAAA',width:100,height:100,materialId:'1'};
 const e=readCompositionElements({...plan.elements,materials:{cuff:assignment,hem:assignment},materialImages:{cuff:image,hem:image}}),cat=compositionCatalogue(source,e);
 for(const [key,slot] of [['sleeve','cuff'],['side-sleeve','cuff'],['body-front','hem'],['body-back','hem'],['side-body','hem']]){const piece=plan.pieces.find(p=>p.assetKey===key)!,asset=cat.assets.find(a=>a.key===key)!;const markup=compositionDecoratedMarkup(asset,piece,e,'photo');expect(markup,key).toContain(`url(#photo-fabric-${slot})`);}
 expect(e.fabric).toBe('jersey');expect(e.materialImages?.main).toBeUndefined();
});
