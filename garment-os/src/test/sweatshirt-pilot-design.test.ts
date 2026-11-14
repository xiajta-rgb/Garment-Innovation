import {expect,it} from 'vitest';
import {newCompanyStyle,readCompanyStyle} from '@/lib/pattern/company-style';
import {DEFAULT_STYLE_VARIATION} from '@/data/styleVariations';
import {exportStyleThreeViewSvg} from '@/lib/pattern/style-variation-drawing';
import {styleDesignImagePrompt} from '@/application/style-design-image';

it('keeps quarter zip, side openings and sweatshirt cuffs consistent across three views without asserting CAD',()=>{
 const draft=readCompanyStyle({...newCompanyStyle('company-at25m3295'),design:{...DEFAULT_STYLE_VARIATION,neckline:'quarter-zip',pocket:'zip-side',hem:'rib',blocking:'collar'}});
 const doc=new DOMParser().parseFromString(exportStyleThreeViewSvg(draft),'image/svg+xml');
 expect(doc.querySelector('parsererror')).toBeNull();
 expect(doc.querySelectorAll('[data-design-view]')).toHaveLength(3);
 expect(doc.querySelectorAll('[data-operation="quarter-zip"]')).toHaveLength(1);
 expect(doc.querySelectorAll('[data-operation="zip-collar"]')).toHaveLength(2);
 expect(doc.querySelectorAll('[data-operation="zip-collar-side"]')).toHaveLength(1);
 expect(doc.querySelectorAll('[data-design-view="front"] [data-operation="zip-pocket"]')).toHaveLength(2);
 expect(doc.querySelectorAll('[data-design-view="back"] [data-operation^="zip-pocket"]')).toHaveLength(0);
 expect(doc.querySelectorAll('[data-operation="zip-pocket-side"]')).toHaveLength(1);
 expect(doc.querySelectorAll('[data-operation="rib-cuff"]')).toHaveLength(5);
 expect(doc.querySelector('[data-operation="zip-collar"]')?.getAttribute('fill')).toBe(draft.design!.accentColor);
 expect(doc.querySelector('[data-operation="zip-collar-side"]')?.getAttribute('fill')).toBe(draft.design!.accentColor);
 expect(doc.querySelectorAll('[data-operation="hood"], [data-operation="hood-back"], [data-operation="placket"]')).toHaveLength(0);
 expect(draft.cadApplied).toBe(false);
 expect(JSON.parse(doc.querySelector('metadata')!.textContent!).productionApproved).toBe(false);
 expect(styleDesignImagePrompt(draft)).toContain('two front-side openings');
 expect(()=>readCompanyStyle({...draft,cadApplied:true})).toThrow();
});
