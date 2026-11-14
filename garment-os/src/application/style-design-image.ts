import { resolvedStyleVariation } from '@/lib/pattern/style-variation';
import type { CompanyStyleDraft } from '@/types/company-style';

export function styleDesignImagePrompt(d:CompanyStyleDraft,effect:'technical'|'fabric'='technical'){
 const {v,neck,sleeve,pocket,hem}=resolvedStyleVariation(d);
 return `Use the attached garment drawing as the exact design reference. Output ONE clean white sheet with THREE consistent views of the SAME garment, left to right: FRONT, BACK, RIGHT SIDE. Preserve their shared color, silhouette, length, neck, sleeves, pockets, seams, blocks and graphic placement. The side view is a design proposal. No person, mannequin, scene, extra garment, logo or invented features. ${effect==='fabric'?'Show subtle realistic textile texture and soft form shading, keeping all three views flat and aligned.':'Keep a crisp flat technical fashion illustration, matching the reference lines and proportions, without perspective or shadows.'}
Design locks: base ${d.color}; accent ${v.accentColor}; neckline ${neck}; sleeves ${sleeve}; fit ${v.fit}; length ${v.length}; pocket ${pocket} (${pocket==='zip-side'?'two front-side openings; right opening visible in side view; no back pocket':'front only'}); hem ${hem}; blocking ${v.blocking}; graphic ${v.graphic}. ${d.fabric?'Fabric description: '+d.fabric.slice(0,160)+'. ':''}${d.notes?'Additional design direction: '+d.notes.slice(0,180)+'. ':''}Do not infer measurements, hidden construction or material test results.`;
}
