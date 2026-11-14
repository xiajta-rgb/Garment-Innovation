import { expect,it } from 'vitest';
import { newTeeBase } from '@/application/tee-matrix';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { teeFlatFigure,teeFlatSpecification,unfoldedTeeBody,teeFlatDrawingScale } from '@/lib/pattern/tee-flat-pattern';
import { flattenSvgPathD } from '@/lib/pattern/geometry';

const base=()=>{const c=newTeeBase();return {c,source:draftStandard(c.activePatternId,c.measurements,c.fit,c.construction)};};
it('measures source net points, separates body chest from garment circumference and excludes cutting allowances',()=>{
 const {c,source}=base(),spec=teeFlatSpecification(source,c.measurements.bust),f=source.pieces[0].points,s=source.pieces[2].points;
 const value=(id:string)=>spec.rows.find(r=>r.id===id)!.valueMm;
 expect(value('front-length')).toBeCloseTo(f.cfHem.y-f.neck.y,2);
 expect(value('shoulder')).toBeCloseTo(2*f.shoulder.x,2);
 expect(value('sleeve-length')).toBeCloseTo(s.hemLeft.y-s.top.y,2);
 expect(value('cuff')).toBeCloseTo((s.hemRight.x-s.hemLeft.x)/2,2);
 expect(value('chest-circumference')).toBeCloseTo(value('front-chest')+value('back-chest'),2);
 expect(value('chest-ease')).toBeCloseTo(value('chest-circumference')-c.measurements.bust,2);
 expect(spec.productionApproved).toBe(false);
 const missing=structuredClone(source);delete missing.pieces[0].points.armhole;
 expect(()=>teeFlatSpecification(missing,c.measurements.bust)).toThrow('量点缺失');
 expect(()=>teeFlatSpecification(source,NaN)).toThrow('人体胸围');
});

it('unfolds source cubic boundaries and closes both armholes using the same source curves, without raster masks',()=>{
 const {c,source}=base(),before=JSON.stringify(source);
 const flat=teeFlatFigure(source,c.pieceDesign!),doc=new DOMParser().parseFromString(`<svg>${flat.svg}</svg>`,'image/svg+xml');
 const body=doc.querySelector('[data-source-piece="teagan.front"]')!.getAttribute('d')!;
 expect(body).toBe(unfoldedTeeBody(source.pieces[0]));expect(body).toContain('C');
 const sleeve=doc.querySelector('[data-source-piece="teagan.sleeve"]')!.getAttribute('d')!;
 expect(sleeve.match(/C/g)).toHaveLength(2); // Both true armhole cubics, no triangular gap.
 const points=flattenSvgPathD(body,256),left=points.filter(p=>p.x<0),right=points.filter(p=>p.x>0);
 expect(Math.min(...left.map(p=>p.x))).toBeCloseTo(-Math.max(...right.map(p=>p.x)),2);
 const band=flattenSvgPathD(doc.querySelector('[data-source-piece="design.neckband"]')!.getAttribute('d')!,256);
 expect(band[0].x).toBeLessThan(0);expect(band[0].y).toBeCloseTo(source.pieces[0].points.neck.y,2);
 expect(JSON.stringify(source)).toBe(before);
});

it('preserves measured sleeve top length and cuff width at all supported sizes, fits and sleeve choices',()=>{
 for(const size of ['XS','M','XXXL'] as const)for(const fit of ['slim','regular','loose'] as const)for(const length of [.3,.65,1]){
  const c=newTeeBase(size);c.construction!.options.sleeveLength=length;
  const source=draftStandard(c.activePatternId,c.measurements,fit,c.construction),spec=teeFlatSpecification(source,c.measurements.bust);
  const value=(id:string)=>spec.rows.find(r=>r.id===id)!.valueMm;
  for(const back of [false,true]){
   const flat=teeFlatFigure(source,c.pieceDesign!,back),a=source.pieces[back?1:0].points.shoulder,p=flat.sleeveDisplay;
   const scale=teeFlatDrawingScale(source,c.pieceDesign!,.44);
   expect((flat.maxX-flat.minX)*scale).toBeLessThanOrEqual(440.001);
   expect((flat.maxY-flat.minY)*scale).toBeLessThanOrEqual(340.001);
   expect(Math.hypot(p.top.x-a.x,p.top.y-a.y)).toBeCloseTo(value('sleeve-length'),2);
   expect(Math.hypot(p.top.x-p.openingEnd.x,p.top.y-p.openingEnd.y)).toBeCloseTo(value('cuff'),2);
   expect(flat.svg).not.toMatch(/NaN|Infinity/);
  }
 }
},30000);
