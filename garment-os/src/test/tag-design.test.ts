import { expect,it } from 'vitest';
import { applyTagDesign, designCapabilityAudit, DESIGN_TAG_DICTIONARY, resolveTagDesign } from '@/application/tag-design';
import { createDesignStore } from '@/store/designStore';
import { compositionCatalogue, compositionSource } from '@/application/composition-catalogue';
import { DEFAULT_COMPOSITION_CRAFT, DEFAULT_COMPOSITION_ELEMENTS, readCompositionElements } from '@/lib/pattern/composition-elements';
import { emptyPieceComposition, readPieceComposition } from '@/lib/pattern/piece-composition';
const editor=()=>createDesignStore({repository:{save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}}});
it('resolves exact stable codes from the real dictionary and does not certify unverified materials',()=>{
 const audit=designCapabilityAudit();expect(audit.tagCount).toBe(439);expect(audit.verifiedTaggedAssets).toBe(0);
 const result=resolveTagDesign({tags:['TAG_BC9B1A078423','TAG_FBE7E6A5A3E8','TAG_86757B1A94E1','TAG_38E20D629B20']});
 expect(result.previewReady).toBe(true);expect(result.elements.shoulder).toBe('raglan');expect(result.elements.neckline).toBe('stand');expect(result.elements.craft?.opening).toBe('quarter-zip');
 expect(result.patternReady).toBe(false);expect(result.productionApproved).toBe(false);expect(result.dictionaryRevision).toBe(DESIGN_TAG_DICTIONARY.source.revision);
 expect(resolveTagDesign({tags:['假标签']}).issues.join('')).toContain('未找到');
});
it('blocks mutually exclusive structures and underspecified openings without mutating the current plan',()=>{
 const before=structuredClone(DEFAULT_COMPOSITION_ELEMENTS);
 for(const tags of [['圆领','V领'],['装袖','插肩'],['插肩','微落肩'],['半开襟','全开襟','拉链'],['亨利领开口','拉链','半开襟'],['V领','拉链','半开襟'],['拉链'],['半开襟'],['胸袋'],['拉链口袋'],['大落肩'],['色块拼接'],['外露拉链'],['包边']])expect(resolveTagDesign({tags},before).previewReady,tags.join(',')).toBe(false);
 expect(before).toEqual(DEFAULT_COMPOSITION_ELEMENTS);
 const result=resolveTagDesign({tags:['拉链']});expect(()=>applyTagDesign(result,emptyPieceComposition('x').plans[0],{} as never,()=>crypto.randomUUID())).toThrow('未修改');
});
it('keeps binding, back-neck reinforcement and fabric structure semantics separate',()=>{
 const neck=resolveTagDesign({tags:['圆领','包边'],bindingPart:'neck'});expect(neck.elements.craft?.neckFinish).toBe('binding');expect(neck.elements.craft?.backNeckTape).toBe(false);
 const back=resolveTagDesign({tags:['包边'],bindingPart:'back-neck'});expect(back.elements.craft?.backNeckTape).toBe(true);
 expect(resolveTagDesign({tags:['领肩加固条']}).previewReady).toBe(false);
 expect(resolveTagDesign({tags:['Polo领','包边'],bindingPart:'neck'}).previewReady).toBe(false);
 expect(resolveTagDesign({tags:['华夫格','珠地']}).previewReady).toBe(false);
 expect(resolveTagDesign({tags:['华夫格肌理']}).warnings.join('')).toContain('期望外观');
 expect(resolveTagDesign({tags:['包缝']}).warnings.join('')).toContain('内侧工序');
});
it('creates source-guided neck and opening drawing elements in their correct views while retaining CAD as reference only',()=>{
 const source=compositionSource(editor().getState().getConfiguration(),'t-shirt');
 const variants=[{tags:['亨利领开口','半开襟','纽扣'],marker:'placket-button'},{tags:['Polo领','半开襟','拉链'],marker:'polo-fold-collar'},{tags:['插肩','立领','半开襟','拉链'],marker:'stand-collar'},{tags:['圆领','包边'],bindingPart:'neck' as const,marker:'neck-edge-binding'},{tags:['圆领','全开襟','拉链'],marker:'zipper-teeth'}];
 for(const v of variants){const result=resolveTagDesign(v),cat=compositionCatalogue(source,result.elements),markup=cat.assets.map(a=>a.markup).join('');expect(result.previewReady).toBe(true);expect(markup).toContain(v.marker);expect(markup).not.toMatch(/NaN|Infinity|undefined/);
  if(result.elements.craft?.opening!=='none'){const front=cat.assets.find(a=>a.key==='neck-front')!.markup;expect(front).toContain('placket-facing');expect(cat.assets.find(a=>a.key==='neck-back')!.markup).not.toContain('placket-facing');if(result.elements.neckline==='stand')expect(front.indexOf('stand-collar')).toBeLessThan(front.indexOf('placket-facing'));}
  if(result.elements.neckline==='stand'){expect(cat.assets.find(a=>a.key==='neck-back')!.markup).toContain('stand-collar');expect(cat.assets.find(a=>a.key==='side-body')!.markup).toContain('side-stand-collar');}
  const base=compositionCatalogue(source);expect(cat.assets.find(a=>a.key==='body-front')!.netPath).toBe(base.assets.find(a=>a.key==='body-front')!.netPath);
 }
},20000);
it('applies multiple tag combinations atomically and preserves their codes, crafts and pocket through validation and undo',()=>{
 const store=editor(),source=compositionSource(store.getState().getConfiguration(),'t-shirt'),empty=emptyPieceComposition('one');
 const result=resolveTagDesign({tags:['亨利领开口','贴袋','胸袋']}),plan=applyTagDesign(result,empty.plans[0],source,()=>crypto.randomUUID());
 expect(plan.pieces.filter(p=>p.assetKey==='design.patch-pocket')).toHaveLength(1);
 const twice=applyTagDesign(result,plan,source,()=>crypto.randomUUID());expect(twice.pieces).toEqual(plan.pieces);
 store.getState().setPieceComposition({...empty,plans:[plan]});const saved=structuredClone(store.getState().pieceComposition);
 expect(readPieceComposition(saved)).toEqual(saved);expect(saved?.plans[0].elements?.tagIntent?.codes).toEqual(result.codes);
 const next=resolveTagDesign({tags:['立领','半开襟','拉链']},plan.elements);store.getState().setPieceComposition({...empty,plans:[applyTagDesign(next,plan,source,()=>crypto.randomUUID())]});
 store.getState().undo();expect(store.getState().pieceComposition).toEqual(saved);
});
it('rejects broken craft inputs and mismatched dictionary identities, preserving old documents without craft fields',()=>{
 expect(readCompositionElements(DEFAULT_COMPOSITION_ELEMENTS)).toEqual(DEFAULT_COMPOSITION_ELEMENTS);
 for(const craft of [{...DEFAULT_COMPOSITION_CRAFT,opening:'bogus'},{...DEFAULT_COMPOSITION_CRAFT,openingLengthMm:NaN},{...DEFAULT_COMPOSITION_CRAFT,bindingWidthMm:0},{...DEFAULT_COMPOSITION_CRAFT,trimColor:'url(x)'}])expect(()=>readCompositionElements({...DEFAULT_COMPOSITION_ELEMENTS,craft})).toThrow();
 expect(()=>readCompositionElements({...DEFAULT_COMPOSITION_ELEMENTS,tagIntent:{codes:['UNKNOWN'],dictionaryRevision:2629}})).toThrow('标签');
});
