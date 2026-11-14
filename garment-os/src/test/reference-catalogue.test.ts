import { expect, it } from 'vitest';
import * as models from '@freesewing/models';
import snapshot from '@/data/referencePieceCatalogue.snapshot.json';
import { REFERENCE_PIECE_INDEX } from '@/data/referencePieceIndex';
import illustrations from '@/data/referenceIllustrations.json';
import { PIECE_FAMILIES, PIECE_ROLE_MAP } from '@/data/pieceTaxonomy';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { referenceBounds, referenceCatalogueSvg, referenceCoverage } from '@/application/reference-catalogue';
import { flattenSvgPathD } from '@/lib/pattern/geometry';
import type { ReferenceCatalogueSnapshot } from '@/types/reference-catalogue';

const catalogue=snapshot as ReferenceCatalogueSnapshot;
it('all categories have an actual source drawing or explicitly unscaled paper-pattern photograph',()=>{
  const coverage=referenceCoverage();
  expect(coverage).toHaveLength(PIECE_FAMILIES.length);
  for(const family of coverage)expect(family.cadCount+family.imageCount,family.id).toBeGreaterThan(0);
  expect(catalogue.entries.length).toBe(172);
  expect(REFERENCE_PIECE_INDEX).toEqual(catalogue.entries.map(({id,sourceId,sampleId,roleId,family})=>({id,sourceId,sampleId,roleId,family})));
  expect(new Set(catalogue.entries.map(e=>e.id)).size).toBe(catalogue.entries.length);
  for(const sourceId of Object.keys(SOURCE_PIECE_ROLES)){
    expect(catalogue.entries.some(e=>e.sourceId===sourceId),sourceId).toBe(true);
  }
  for(const entry of catalogue.entries){
    const role=PIECE_ROLE_MAP[entry.roleId];
    expect(role,entry.id).toBeDefined();expect(entry.family).toBe(role.family);
    expect(entry.productionApproved).toBe(false);
    const net=entry.paths.find(p=>p.layer==='net')!,pts=flattenSvgPathD(net.data,64);
    expect(Math.hypot(pts[0].x-pts.at(-1)!.x,pts[0].y-pts.at(-1)!.y),entry.id).toBeLessThan(.001);
    expect(referenceBounds(entry).width).toBeGreaterThan(0);
    expect(entry.perimeterMm).toBeGreaterThan(0);
  }
  // Photographs do not acquire dimensions or become CAD by being displayed.
  expect(illustrations[0]).toMatchObject({dimensionalStatus:'unscaled-reference',availableCad:false,license:'CC0 1.0'});
  expect(illustrations[0]).not.toHaveProperty('perimeterMm');
  expect(coverage.flatMap(f=>f.roles).filter(r=>!r.cadCount&&!r.imageCount).length).toBeGreaterThan(0);
});

type RawPart={paths:Record<string,{asPathstring():string;length():number;hidden?:boolean;attributes?:{list?:{class?:string[]}}}>};
type DesignClass=new(settings:object)=>{draft():void;parts:Array<Record<string,RawPart>>};
it.each(catalogue.samples)('every path in sample $id matches independently regenerated FreeSewing source',async sample=>{
  const upstream=await import(/* @vite-ignore */ '@freesewing/'+sample.design);
  const Design=upstream[sample.design[0].toUpperCase()+sample.design.slice(1)] as DesignClass;
  const draft=new Design({measurements:models[sample.profile],options:sample.options,sa:10,expand:true});
  draft.draft();
  const pieces=catalogue.entries.filter(e=>e.sampleId===sample.id);
  expect(pieces.length).toBeGreaterThan(0);
  for(const entry of pieces){
    const part=draft.parts[0][entry.sourceId];expect(part,entry.sourceId).toBeDefined();
    for(const path of entry.paths)expect(path.data,entry.id+'/'+path.key).toBe(part.paths[path.key].asPathstring());
    const expectedCuts=Object.entries(part.paths).filter(([key,path])=>!path.hidden&&
      (path.attributes?.list?.class??[]).join(' ').split(/\s+/).includes('sa')&&
      (entry.sourceId!=='cathrin.panel1'||key===(entry.netPathKey==='panel1a'?'saA':'saB'))).map(([key])=>key);
    expect(entry.paths.filter(p=>p.layer==='cut').map(p=>p.key)).toEqual(expectedCuts);
    expect(entry.perimeterMm).toBe(part.paths[entry.netPathKey].length());
    const svg=referenceCatalogueSvg(entry,sample);
    expect(svg).toContain('width="');expect(svg).toContain('mm"');expect(svg).toContain('productionApproved=false');
    expect(svg).toContain(`d="${entry.paths[0].data}"`);
  }
});
