import {expect,it} from 'vitest';
import {COMPANY_STYLE_MASTERS} from '@/data/companyStyleMasters';
import {DEFAULT_STYLE_VARIATION,STYLE_VARIATION_OPTIONS,STYLE_VARIATION_PRESETS} from '@/data/styleVariations';
import {newCompanyStyle,readCompanyStyle} from '@/lib/pattern/company-style';
import {exportStyleThreeViewSvg} from '@/lib/pattern/style-variation-drawing';
import {readStyleVariation} from '@/lib/pattern/style-variation';
import {styleDesignImagePrompt} from '@/application/style-design-image';
import {createDesignStore} from '@/store/designStore';
import type {DesignDocument} from '@/types/design';
import type {StyleVariation} from '@/types/style-variation';
const dom=(svg:string)=>new DOMParser().parseFromString(svg,'image/svg+xml');
const figure=(patch:Partial<StyleVariation>={})=>dom(exportStyleThreeViewSvg({...newCompanyStyle(),design:{...DEFAULT_STYLE_VARIATION,...patch}}));
it('changes affect actual drawing paths and visible parts, with front-only pockets and correctly placed graphics',()=>{
 const base=figure(),body=(d:Document)=>d.querySelector('[data-design-view="front"] [data-part="body"]')!.getAttribute('d');
 for(const patch of [{neckline:'v'},{fit:'boxy'},{length:'cropped'},{hem:'curved'}] as Partial<StyleVariation>[])expect(body(figure(patch))).not.toBe(body(base));
 expect(figure({hem:'split'}).querySelectorAll('[data-operation="side-slit"]')).toHaveLength(3);
 expect(figure({sleeve:'sleeveless'}).querySelectorAll('[data-part^="sleeve-"]')).toHaveLength(0);
 expect(figure({sleeve:'long'}).querySelector('[data-part="sleeve-right"]')!.getAttribute('d')).not.toBe(base.querySelector('[data-part="sleeve-right"]')!.getAttribute('d'));
 const polo=figure({neckline:'polo',pocket:'double-chest'});expect(polo.querySelectorAll('[data-design-view="front"] [data-operation="pocket"]')).toHaveLength(2);expect(polo.querySelectorAll('[data-design-view="back"] [data-operation="pocket"]')).toHaveLength(0);expect(polo.querySelectorAll('[data-operation="placket"]')).toHaveLength(1);expect(polo.querySelector('[data-operation="polo-front-collar-stand"]')).toBeTruthy();expect(polo.querySelector('[data-operation="polo-collar-left"]')).toBeTruthy();expect(polo.querySelector('[data-operation="polo-collar-right"]')).toBeTruthy();expect(polo.querySelector('[data-operation="polo-collar-left"]')!.getAttribute('d')).not.toContain('L0 .055');
 const back=figure({graphic:'back'});expect(back.querySelectorAll('[data-design-view="front"] [data-operation="graphic"]')).toHaveLength(0);expect(back.querySelectorAll('[data-design-view="back"] [data-operation="graphic"]')).toHaveLength(1);
 expect(figure({blocking:'sleeves',accentColor:'#abcdef'}).querySelector('[data-part="sleeve-left"]')!.getAttribute('fill')).toBe('#abcdef');
});
it.each(COMPANY_STYLE_MASTERS)('$id supports finite shared-scale three-view drawings for every option and preset without modifying its source',m=>{
 const original=JSON.stringify(m),d=newCompanyStyle(m.id);
 for(const [key,options]of Object.entries(STYLE_VARIATION_OPTIONS))for(const [value]of options){
  const svg=exportStyleThreeViewSvg({...d,design:{...DEFAULT_STYLE_VARIATION,[key]:value}}),doc=dom(svg);
  expect(svg).not.toMatch(/NaN|Infinity|undefined/);expect(doc.querySelector('parsererror')).toBeNull();expect(doc.querySelectorAll('[data-design-view]')).toHaveLength(3);
  const scales=[...doc.querySelectorAll('[data-design-view]')].map(n=>n.parentElement!.getAttribute('transform')!.match(/scale\(([^)]+)\)/)![1]);expect(new Set(scales).size).toBe(1);
 }
 for(const p of STYLE_VARIATION_PRESETS)expect(readCompanyStyle({...d,design:{...DEFAULT_STYLE_VARIATION,...p.patch}}).design).toMatchObject(p.patch);
 expect(JSON.stringify(m)).toBe(original);
});
it('invalid choices and drawing dimensions cannot be smuggled into the design contract; text is escaped',()=>{
 for(const patch of [{neckline:'invented'},{accentColor:'red'},{measurements:{chest:999}},{toString:'x'}])expect(()=>readStyleVariation({...DEFAULT_STYLE_VARIATION,...patch})).toThrow();
 const svg=exportStyleThreeViewSvg({...newCompanyStyle(),name:'<script>x</script>',notes:'<img onerror="x"/>'});expect(svg).not.toContain('<script>');expect(svg).not.toContain('<img');expect(svg).toContain('&lt;script&gt;');
});
it('combined variations survive saving and undo without claiming unsupported CAD binding',async()=>{
 const docs=new Map<string,DesignDocument>(),s=createDesignStore({repository:{save:async d=>{docs.set(d.id,structuredClone(d));},get:async id=>docs.get(id),list:async()=>[],delete:async()=>{}}}),initial=s.getState().draft;
 const d={...newCompanyStyle(),design:{...DEFAULT_STYLE_VARIATION,neckline:'polo' as const}};s.getState().setCompanyDraft(d);
 s.getState().setCompanyDraft({...s.getState().companyDraft!,design:{...d.design,pocket:'chest'}});expect(s.getState().companyDraft?.design).toMatchObject({neckline:'polo',pocket:'chest'});expect(s.getState().draft).toBe(initial);
 s.getState().undo();expect(s.getState().companyDraft?.design?.pocket).toBe('source');s.getState().redo();
 expect(()=>s.getState().applyCompanyDraft(s.getState().companyDraft!)).toThrow(/二维改款/);const id=await s.getState().saveDesign();s.getState().newDesign();expect(await s.getState().loadDesign(id)).toBe(true);expect(s.getState().companyDraft?.design).toMatchObject({neckline:'polo',pocket:'chest'});expect(s.getState().companyDraft?.cadApplied).toBe(false);
 const prompt=styleDesignImagePrompt(s.getState().companyDraft!);expect(prompt).toContain('THREE');expect(prompt).toContain('polo');expect(prompt).toContain('chest');expect(prompt.length).toBeLessThan(1600);
});
