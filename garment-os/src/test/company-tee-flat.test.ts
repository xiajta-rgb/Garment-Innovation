import { expect,it } from 'vitest';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { createDesignStore } from '@/store/designStore';
import { defaultPieceDesign } from '@/lib/pattern/piece-design-spec';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { teeFlatSpecification } from '@/lib/pattern/tee-flat-pattern';
import { companyTeeDrawing,companyTeeDrawingSvg,COMPANY_TEE_GUIDE_ID } from '@/lib/pattern/company-tee-flat';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import type { DesignConfiguration } from '@/types/design';

const baseline=()=>{const store=createDesignStore({repository:{save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}}});return {...store.getState().getConfiguration(),activePatternId:'t-shirt',measurements:getReferenceMeasurements('male','M'),pieceDesign:defaultPieceDesign()};};
const draw=(c:DesignConfiguration)=>{const source=draftStandard(c.activePatternId,c.measurements,c.fit,c.construction);return companyTeeDrawing(c,teeFlatSpecification(source,c.measurements.bust));};
it('uses company source neckline, hem and sleeve landmarks at neutral inputs, with an explicit set-in derivative and no claimed CAD link',()=>{
 const c=baseline(),before=JSON.stringify(c),m=companyStyleMaster(COMPANY_TEE_GUIDE_ID),d=draw(c),l=d.provenance.landmarks;
 expect(l.neck[0]).toBe(m.shape.neckHalf);expect(l.hem).toEqual([m.shape.hemHalf,1]);
 expect(l.cuffOuter[0]).toBeCloseTo(m.shape.cuffOuter[0],8);expect(l.cuffOuter[1]).toBeCloseTo(m.shape.cuffOuter[1],8);
 expect(l.cuffInner[0]).toBeCloseTo(m.shape.cuffInner[0],8);expect(l.cuffInner[1]).toBeCloseTo(m.shape.cuffInner[1],8);
 expect(l.shoulder[0]).toBeLessThan(l.outerShoulder[0]);expect(l.shoulder[0]).toBeGreaterThan(l.underarm[0]);
 expect(d.provenance.source.sha256).toBe(m.source.sha256);expect(d.provenance.sameStyleCad).toBe(false);expect(m.cadTemplateId).toBeNull();
 expect(JSON.stringify(c)).toBe(before);
});
it('shows back neck behind front, paired hem/cuff topstitching and keeps the side free of mesh holes or pocket carryover',()=>{
 const c=baseline(),d=draw(c),doc=new DOMParser().parseFromString(companyTeeDrawingSvg(d,{configuration:c}),'image/svg+xml');
 expect(doc.querySelectorAll('[data-piece-design-view]')).toHaveLength(3);
 expect(doc.querySelector('[data-piece-design-view="front"] [data-operation="back-neck-binding"]')).toBeTruthy();
 expect(doc.querySelector('[data-piece-design-view="back"] [data-operation="back-neck-binding"]')).toBeNull();
 for(const view of ['front','back']){
  expect(doc.querySelectorAll(`[data-piece-design-view="${view}"] [data-operation="body-double-needle"]`)).toHaveLength(2);
  expect(doc.querySelectorAll(`[data-piece-design-view="${view}"] [data-operation="sleeve-double-needle"]`)).toHaveLength(4);
 }
 const side=doc.querySelector('[data-piece-design-view="side"]')!;
 expect(side.querySelectorAll('ellipse,circle')).toHaveLength(0);expect(side.querySelector('[data-source-piece="design.patch-pocket"]')).toBeNull();
 expect(doc.querySelectorAll('[data-flat-measure]')).toHaveLength(0);
});
it('draws a Polo as a separate knit collar stand, two pointed collar leaves and a visible short placket',()=>{
 const c=baseline(),source=draftStandard(c.activePatternId,c.measurements,c.fit,c.construction),d=companyTeeDrawing(c,teeFlatSpecification(source,c.measurements.bust),{neckline:'polo',craft:{opening:'buttons',neckFinish:'rib',bindingWidthMm:8,backNeckTape:false,seamFinish:'plain',trimColor:'#e5dcc9',openingLengthMm:140,placketWidthMm:22,collarHeightMm:35},neckColor:'#e6d3b1'});
 expect(d.provenance.landmarks.frontDrop).toBeLessThan(draw(c).provenance.landmarks.frontDrop);
 // The Polo front neckline must stay shallow; the stand and leaf supply the
 // collar height in the company reference rather than a deep crew-neck drop.
 expect(d.provenance.landmarks.frontDrop).toBeLessThan(.05);
 const doc=new DOMParser().parseFromString(companyTeeDrawingSvg(d,{}),'image/svg+xml'),front=doc.querySelector('[data-piece-design-view="front"]')!,back=doc.querySelector('[data-piece-design-view="back"]')!,side=doc.querySelector('[data-piece-design-view="side"]')!;
 expect(doc.documentElement.textContent).toContain('Polo翻领');expect(doc.documentElement.textContent).toContain('短纽扣门襟');
 expect(front.querySelector('[data-operation="polo-front-collar-stand"]')).toBeTruthy();expect(front.querySelector('[data-operation="polo-collar-stand-band"]')).toBeTruthy();expect(front.querySelector('[data-operation="polo-collar-stand-rib"]')).toBeTruthy();expect(front.querySelector('[data-operation="polo-front-collar-stand-edge"]')).toBeTruthy();expect(front.querySelector('[data-operation="polo-collar-left"]')).toBeTruthy();expect(front.querySelector('[data-operation="polo-collar-right"]')).toBeTruthy();expect(front.querySelector('[data-operation="polo-collar-centre-fold"]')).toBeTruthy();expect(front.querySelector('[data-operation="placket-facing"]')).toBeTruthy();expect(front.querySelectorAll('[data-operation="placket-button"]')).toHaveLength(3);expect(back.querySelector('[data-operation="polo-back-collar-stand"]')).toBeTruthy();expect(side.querySelector('[data-operation="side-polo-collar"]')).toBeTruthy();
 const collar=front.querySelector('[data-operation="polo-collar-left"]')!;expect(collar.getAttribute('fill')).toBe('#e6d3b1');expect(collar.getAttribute('fill')).not.toBe(c.garmentColor);
 const stand=front.querySelector('[data-operation="polo-front-collar-stand"]')!,standValues=stand.getAttribute('d')!.match(/-?(?:\d+\.?\d*|\.\d+)/g)!.map(Number);
 // SVG y grows downward: the stand apex must sit above the crew-neck apex,
 // while the lower edge remains a shallow band instead of a bib.
 expect(standValues[1]).toBeLessThan(0);expect(standValues[3]/2).toBeLessThan(d.provenance.landmarks.frontDrop);
 const collarPoints=collar.getAttribute('d')!.match(/-?(?:\d+\.?\d*|\.\d+)/g)!.map(Number);
 // The leaf point sits above the centre join in the flat view; this keeps a
 // shallow commercial polo spread instead of the previous bow-tie triangle.
 expect(collarPoints[7]).toBeGreaterThan(collarPoints[5]);
 const sideCollar=side.querySelector('[data-operation="side-polo-collar"]')!;
 const sideValues=sideCollar.getAttribute('d')!.match(/-?(?:\d+\.?\d*|\.\d+)/g)!.map(Number);
 expect(Math.max(...sideValues.filter((_,i)=>i%2===1))).toBeLessThan(.08);
});
it('propagates length, fit, neckline, sleeve and pocket changes without stretching every component together',()=>{
 const c=baseline(),d=draw(c),long=draw({...c,measurements:{...c.measurements,totalLength:c.measurements.totalLength+40}}),wide=draw({...c,fit:'loose'});
 expect(long.provenance.landmarks.hem[1]).toBeGreaterThan(d.provenance.landmarks.hem[1]);
 expect(long.provenance.relativeEdits.sleeve).toBe(d.provenance.relativeEdits.sleeve);
 expect(long.provenance.landmarks.cuffOuter[1]).toBe(d.provenance.landmarks.cuffOuter[1]);
 expect(long.provenance.landmarks.cuffOuter[0]).toBeCloseTo(d.provenance.landmarks.cuffOuter[0],3);
 expect(wide.provenance.landmarks.underarm[0]).toBeGreaterThan(d.provenance.landmarks.underarm[0]);
 expect(wide.provenance.shoulder).toBe('set-in-derivative');
 const sleeve=draw({...c,construction:{schema:'garment-os/construction/v1',options:{sleeveLength:.65,necklineWidth:.35}}});
 expect(sleeve.provenance.relativeEdits.sleeve).toBeGreaterThan(1);expect(sleeve.provenance.landmarks.neck[0]).toBeGreaterThan(d.provenance.landmarks.neck[0]);
 expect(sleeve.provenance.landmarks.hem).toEqual(d.provenance.landmarks.hem);
 for(const size of ['XS','XXXL'] as const){const sized=draw({...c,standardSize:size,measurements:getReferenceMeasurements('male',size)});expect(sized.provenance.relativeEdits.length).toBe(1);expect(sized.figures.join('')).not.toMatch(/NaN|Infinity/);}
});

it('keeps a continuous symmetric external boundary, a single seam per armhole and lighter internal line weights',()=>{
 const c=baseline();
 for(const config of [c,{...c,fit:'loose' as const},{...c,measurements:{...c.measurements,totalLength:640},construction:{schema:'garment-os/construction/v1' as const,options:{sleeveLength:.65}}}]){
  const doc=new DOMParser().parseFromString(companyTeeDrawingSvg(draw(config),{}),'image/svg+xml');
  for(const view of ['front','back']){
   const group=doc.querySelector(`[data-company-tee-view="${view}"]`)!;
   const contours=group.querySelectorAll('[data-operation="garment-contour"]');expect(contours).toHaveLength(1);
   const contour=contours[0],width=Number(contour.getAttribute('stroke-width'));
   const underlay=group.querySelector('[data-contour-underlay]')!;
   expect(underlay.getAttribute('d')).toContain(contour.getAttribute('d'));
   expect(underlay.getAttribute('data-source-piece')).toBeNull();
   const seams=group.querySelectorAll('[data-operation="armhole-seam"]');expect(seams).toHaveLength(2);
   for(const seam of seams)expect(Number(seam.getAttribute('stroke-width'))).toBeLessThan(width*.6);
   for(const stitch of group.querySelectorAll('[data-operation$="double-needle"]'))expect(Number(stitch.getAttribute('stroke-width'))).toBeLessThan(width*.4);
   const values=contour.getAttribute('d')!.match(/-?(?:\d+\.?\d*|\.\d+)/g)!.map(Number),start=values.slice(0,2);
   const points=[start,...Array.from({length:(values.length-2)/2},(_,i)=>values.slice(2+i*2,4+i*2))];
   // All cubic joins share their endpoint and tangent, including cuff, pit and hem turns.
   for(let i=3;i<points.length-1;i+=3){
    const a=points[i-1],b=points[i],next=points[i+1],u=[b[0]-a[0],b[1]-a[1]],v=[next[0]-b[0],next[1]-b[1]];
    const cosine=(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v));
    expect(cosine).toBeGreaterThan(.995);
   }
   for(let i=0;i<points.length;i++){
    const other=points[points.length-1-i];expect(points[i][0]).toBeCloseTo(-other[0],5);expect(points[i][1]).toBeCloseTo(other[1],5);
   }
   // Piece fills no longer stroke their shared boundaries twice.
   for(const piece of group.querySelectorAll('[data-source-piece]'))expect(piece.getAttribute('stroke')).toBe('none');
  }
 }
});
