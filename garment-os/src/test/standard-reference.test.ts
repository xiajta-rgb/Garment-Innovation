import { afterAll, describe, expect, it } from 'vitest';
import { Teagan } from '@freesewing/teagan';
import { Sven } from '@freesewing/sven';
import { Simon } from '@freesewing/simon';
import * as models from '@freesewing/models';
import { mkdirSync, writeFileSync } from 'node:fs';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { getReferenceMeasurements, referenceProfileId } from '@/data/referenceMeasurements';
import type { StandardSize } from '@/types/measurements';
import { listPatterns, PATTERN_LIBRARY } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { generatePatternSheet } from '@/lib/svg-export/pattern-sheet-exporter';
interface OraclePath { asPathstring():string; hidden?:boolean;attributes:{list:Record<string,string[]>} }
interface OraclePart { hidden?:boolean;paths:Record<string,OraclePath>;points:Record<string,{x:number;y:number}>;snippets:Record<string,{anchor?:{x:number;y:number};def:string}> }
const evidence: unknown[] = [];
const sizes: StandardSize[] = ['XS','S','M','L','XL','XXL','XXXL'];
const cases = [
  { id:'t-shirt', Engine:Teagan, namespace:'teagan', gender:'male' as const, options:{ fitWaist:false } },
  { id:'womens-basic-tee', Engine:Teagan, namespace:'teagan', gender:'female' as const, options:{ fitWaist:true } },
  { id:'long-sleeve-tee', Engine:Sven, namespace:'sven', gender:'male' as const, options:{ ribbing:false } },
  { id:'button-up-shirt', Engine:Simon, namespace:'simon', gender:'male' as const, options:{} },
];
describe('independent upstream comparison for all rebuilt templates', () => {
  for (const sample of cases) for (const size of sizes) for (const fit of ['slim','regular','loose'] as const) {
    it(`${sample.id}/${size}/${fit}: contours, control points, markings, every cutting segment and cutlist`, () => {
      const sourceId = referenceProfileId(sample.gender, size), source = models[sourceId];
      // Independently map the source model and options; do not use the adapter settings to draft the oracle.
      const chestEase = fit === 'slim' ? .08 : fit === 'loose' ? .25 : sample.namespace === 'teagan' ? .12 : .15;
      const upstream = new sample.Engine({ measurements:source, options:{ ...sample.options, chestEase, lengthBonus:0 }, sa:10 });
      upstream.draft();
      const ours = draftStandard(sample.id, getReferenceMeasurements(sample.gender,size),fit);
      const expected = Object.entries(upstream.parts[0] as Record<string,OraclePart>).filter(([,p]) => !p.hidden && p.paths.seam);
      expect(ours.pieces.map(p=>p.id).sort()).toEqual(expected.map(([id])=>id).sort());
      expect(ours.pieces).toHaveLength(sample.namespace === 'simon' ? 10 : 3);
      let pointCount=0, pathCount=0, markingCount=0;
      for (const piece of ours.pieces) {
        const part = upstream.parts[0][piece.id] as OraclePart;
        expect(piece.netPathD).toBe(part.paths.seam.asPathstring());
        const cutKeys = piece.id === 'simon.back' ? ['sa','hemSa','saConnect'] : ['simon.frontLeft','simon.frontRight'].includes(piece.id) ? ['ffsa','saFromArmhole','hemSa','saConnect'] : ['sa'];
        const cutting = Object.fromEntries(cutKeys.map(key => [key,part.paths[key].asPathstring()]));
        expect(piece.cutPaths).toEqual(cutting);
        expect(piece.cutInstructions).toEqual((upstream.setStores[0].get('cutlist') as Record<string,unknown>)[piece.id]);
        for (const [key,p] of Object.entries(piece.points)) { expect(p).toEqual({ x:part.points[key].x,y:part.points[key].y }); pointCount++; }
        expect(Object.keys(piece.sourcePaths).sort()).toEqual(Object.keys(part.paths).sort());
        for (const [key,path] of Object.entries(piece.sourcePaths)) { expect(path.data).toBe(part.paths[key].asPathstring()); expect(path.hidden).toBe(!!part.paths[key].hidden); pathCount++; }
        for (const path of piece.paths.filter(p => p.layer === 'grain-line')) {
          const key = path.id!.slice(piece.id.length + 1), source = part.paths[key];
          expect(path.data).toBe(source.asPathstring());
          for (const [attr, value] of [['marker-start', path.markerStart], ['marker-end', path.markerEnd]]) {
            expect(value).toBe(source.attributes.list[attr][0].replace('url(#', 'url(#reference-'));
          }
        }
        const marks = Object.entries(part.snippets).filter(([,s])=>s.anchor && /button|notch/.test(s.def));
        expect(Object.keys(piece.markings).sort()).toEqual(marks.map(([key])=>key).sort());
        for (const [key,snippet] of marks) { expect(piece.markings[key]).toEqual({kind:snippet.def,x:snippet.anchor.x,y:snippet.anchor.y}); markingCount++; }
        expect(piece.qty).toBeGreaterThan(0);
      }
      expect(ours.checks.every(c=>c.pass)).toBe(true);
      expect(ours.productionApproved).toBe(false);
      evidence.push({ template:sample.id,sourceId,size,fit,pieces:ours.pieces.length,comparedPoints:pointCount,comparedPaths:pathCount,comparedMarkings:markingCount,maxCoordinateDeltaMm:0,allSourcePathsEqual:true,checks:ours.checks,productionApproved:false });
    });
  }
});
it('actual chest, length, waist, neck and wrist measurements drive the corresponding contours', () => {
  const male = getReferenceMeasurements('male','M'), female=getReferenceMeasurements('female','M');
  const path = (id:string,m:typeof male,part:string) => draftStandard(id,m).pieces.find(p=>p.id===part)!.netPathD;
  expect(path('t-shirt',{...male,bust:male.bust+40},'teagan.front')).not.toBe(path('t-shirt',male,'teagan.front'));
  expect(path('womens-basic-tee',{...female,waist:female.waist+40},'teagan.front')).not.toBe(path('womens-basic-tee',female,'teagan.front'));
  expect(path('long-sleeve-tee',{...male,sleeveLength:male.sleeveLength+20},'sven.sleeve')).not.toBe(path('long-sleeve-tee',male,'sven.sleeve'));
  expect(path('button-up-shirt',{...male,neckCirc:male.neckCirc+10},'simon.collarStand')).not.toBe(path('button-up-shirt',male,'simon.collarStand'));
  expect(path('button-up-shirt',{...male,wristCirc:male.wristCirc+10},'simon.cuff')).not.toBe(path('button-up-shirt',male,'simon.cuff'));
});
it('missing, nonfinite and out-of-range inputs block rather than guess or clamp', () => {
  const m = getReferenceMeasurements('male','M');
  for(const sample of cases) {
    for(const key of ['shoulderSlope','waistToArmpit','hpsToWaistBack','waist','hip'] as const) expect(()=>draftStandard(sample.id,{...m,[key]:undefined})).toThrow();
    expect(()=>draftStandard(sample.id,{...m,bust:NaN})).toThrow();
    expect(()=>draftStandard(sample.id,{...m,totalLength:100})).toThrow();
  }
  expect(()=>draftStandard('long-sleeve-tee',{...m,totalLength:m.totalLength*.99})).toThrow(/衣长/);
});
it('Teagan uses its own declared short-length range without inheriting Brian restrictions', () => {
  const m = getReferenceMeasurements('male', 'M'), totalLength = m.totalLength * .85;
  const ours = draftStandard('t-shirt', { ...m, totalLength });
  const source = new Teagan({ measurements: models[referenceProfileId('male', 'M')], options: { fitWaist: false, chestEase: .12, lengthBonus: -.15 }, sa: 10 });
  source.draft();
  expect(ours.settings.options.lengthBonus).toBeCloseTo(-.15, 12);
  expect(ours.pieces.find(p => p.id === 'teagan.front')!.netPathD).toBe((source.parts[0]['teagan.front'] as OraclePart).paths.seam.asPathstring());
});
afterAll(()=>{
  const dir='doc/evidence/template-review-20261111';mkdirSync(dir,{recursive:true});
  writeFileSync(`${dir}/upstream-comparison.json`,JSON.stringify({samples:evidence.length,productionApproved:false,comparisons:evidence},null,2));
  const templates=listPatterns().map(p=>{const review=PATTERN_REVIEWS[p.id],sample=cases.find(c=>c.id===p.id);const draft=sample?draftStandard(p.id,getReferenceMeasurements(sample.gender,'M')):null;
    if(draft && sample) {
      writeFileSync(`${dir}/${p.id}.cad.json`,JSON.stringify({templateId:p.id,sample:referenceProfileId(sample.gender,'M'),...draft},null,2));
      const oracle = new sample.Engine({ measurements: models[referenceProfileId(sample.gender,'M')], options: { ...sample.options, chestEase: sample.namespace === 'teagan' ? .12 : .15, lengthBonus: 0 }, sa: 10 });
      oracle.draft();
      const sheet = generatePatternSheet(PATTERN_LIBRARY[p.id], draft.pieces.flatMap(piece => piece.paths));
      const overlays = draft.pieces.map(piece => {
        const source = oracle.parts[0][piece.id] as OraclePart;
        return `<path data-independent-source="${piece.id}" d="${source.paths.seam.asPathstring()}" transform="${piece.paths[0].transform}" fill="none" stroke="#ea580c" stroke-width="0.7" stroke-dasharray="5 3"/>`;
      }).join('');
      writeFileSync(`${dir}/${p.id}.comparison.svg`,sheet.replace('</svg>',`${overlays}<desc>Independent upstream M regular net contours: orange dashed. Application: blue. Reference drawing only, not a browser screenshot or manufacturing approval.</desc></svg>`));
    }
    return {id:p.id,name:p.name,category:p.category,...review,settings:draft?.settings??null,parts:draft?.pieces.map(piece=>({id:piece.id,name:piece.name,category:piece.category,view:piece.view,qty:piece.qty,onFold:piece.onFold,grainDefined:!!Object.keys(piece.grainPaths).length}))??[]};});
  writeFileSync(`${dir}/review-manifest.json`,JSON.stringify({version:'template-review-v1',upstreamVersion:'4.10.2',templates,productionApproved:false},null,2));
});
