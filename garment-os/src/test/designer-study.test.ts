import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { readDesignerStudy, selectStudyPlans } from '@/application/designer-study';
import { emptyPieceComposition } from '@/lib/pattern/piece-composition';
import { CompositionCanvas } from '@/features/piece-design/CompositionCanvas';

const raw=()=>JSON.parse(fs.readFileSync('public/designer-studies/short-tee-20261113/manifest.json','utf8'));
it('loads all authored designs with valid plans and distinct structural directions',()=>{
 const study=readDesignerStudy(raw());expect(study.designs).toHaveLength(12);expect(study.groups).toHaveLength(4);
 expect(study.designs.find(d=>d.id==='A01')!.plan.elements?.shoulder).toBe('raglan');
 expect(study.designs.find(d=>d.id==='C01')!.plan.elements).toMatchObject({neckline:'v',fabric:'rib'});
 expect(study.designs.find(d=>d.id==='D03')!.plan.elements?.craft?.opening).toBe('full-zip');
 for(const d of study.designs)expect(d.plan.pieces.filter(p=>!p.assetKey.includes('pocket')).map(p=>[p.assetKey,p.widthMm,p.heightMm,p.source])).toEqual(study.base.pieces.map(p=>[p.assetKey,p.widthMm,p.heightMm,p.source]));
});
it('appends the reference base once and preserves the user plan without mutation',()=>{
 const study=readDesignerStudy(raw()),current=emptyPieceComposition('existing-user-plan'),before=structuredClone(current);
 const adding=selectStudyPlans(study,['A01','A02'],current);expect(adding.map(p=>p.id)).toEqual([study.base.id,...study.designs.filter(d=>['A01','A02'].includes(d.id)).map(d=>d.plan.id)]);expect(current).toEqual(before);
 const next={...current,plans:[...current.plans,...adding]};const more=selectStudyPlans(study,['B01'],next);expect(more).toHaveLength(1);
 expect(()=>selectStudyPlans(study,['A01'],next)).toThrow('已经加入');
});
it('blocks excess selection atomically rather than dropping choices or overwriting plans',()=>{
 const study=readDesignerStudy(raw()),current=emptyPieceComposition('existing-user-plan');
 expect(()=>selectStudyPlans(study,study.designs.map(d=>d.id),current)).toThrow('请减少');expect(current.plans).toHaveLength(1);
 expect(()=>selectStudyPlans(study,['A01','A01'],current)).toThrow('不同');expect(()=>selectStudyPlans(study,['unknown'],current)).toThrow('不存在');
});
it('rejects a corrupted series mapping or reused plan identity before importing',()=>{
 const bad=raw();bad.designs[0].group='unknown';expect(()=>readDesignerStudy(bad)).toThrow('系列不存在');
 const duplicate=raw();duplicate.designs[0].plan.id=duplicate.base.id;expect(()=>readDesignerStudy(duplicate)).toThrow('标识重复');
});
it('keeps exploration evidence below professional approval until review evidence exists',()=>{
 const study=readDesignerStudy(raw());
 expect(study.productionApproved).toBe(false);
 expect(study.knowledge).toMatchObject({read:16,indexed:19,complete:false});
 for(const d of study.designs)expect(d.reviewStatus).toMatch(/待|探索/);
});
it('exports a focused view without neighboring geometry that could leak into a resized viewport',()=>{
 const base=readDesignerStudy(raw()).base;
 for(const [index,view]of (['front','back','side'] as const).entries()){
  const markup=renderToStaticMarkup(createElement(CompositionCanvas,{plan:base,focusView:view,showGrid:false}));
  const doc=new DOMParser().parseFromString(markup,'image/svg+xml');
  expect(doc.querySelectorAll('[data-composition-view]')).toHaveLength(1);
  expect(doc.querySelector('[data-composition-view]')!.getAttribute('data-composition-view')).toBe(view);
  expect(doc.documentElement.getAttribute('viewBox')).toBe(`${index*500} 0 500 760`);
 }
 const all=new DOMParser().parseFromString(renderToStaticMarkup(createElement(CompositionCanvas,{plan:base,showGrid:false})),'image/svg+xml');expect(all.querySelectorAll('[data-composition-view]')).toHaveLength(3);
});
