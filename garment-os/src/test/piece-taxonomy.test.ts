import { afterAll, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { auditPieceTaxonomy } from '@/application/piece-taxonomy-audit';
import { auditPieceElementLinks } from '@/application/piece-element-links';
import { PIECE_FAMILIES, PIECE_ROLES, requirePieceRole } from '@/data/pieceTaxonomy';
import { SOURCE_PIECE_ROLES, requireSourcePieceRole } from '@/data/pieceRoleBindings';
import { listExecutablePatterns } from '@/data/patternLibrary';
import { composePattern } from '@/lib/patterns/compose';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { groupSolutionPieces, validateAllPieces } from '@/lib/pattern/piece-registry';
import { matchesTagFilter } from '@/lib/pattern/piece-tags';
import type { StandardSize } from '@/types/measurements';
import type { ConstructionSelection } from '@/types/construction';
import { ELEMENT_LIBRARY } from '@/data/elementRegistry';

const samples:unknown[]=[],covered=new Set<string>();
const makePieces=(id='button-up-shirt',size:StandardSize='M',construction?:ConstructionSelection)=>{
  const pattern=listExecutablePatterns().find(p=>p.id===id)!;
  const gender=id==='womens-basic-tee'?'female':'male';
  return validateAllPieces(groupSolutionPieces(composePattern(pattern,{},getReferenceMeasurements(gender,size),gender,{view:'all',construction}).paths));
};
it('the entire dictionary has unique stable identities, definitions, dimensions, interfaces and scene coverage',()=>{
  const report=auditPieceTaxonomy();
  expect(report.issues).toEqual([]);expect(report.classificationPass).toBe(true);
  expect(report.counts.families).toBe(22);
  expect(report.counts.roles).toBeGreaterThan(120);
  expect(report.counts.boundRoles).toBe(20);expect(report.counts.boundFamilies).toBe(13);
  expect(report.counts.sourceIdentities).toBe(35);
  expect(report.productionApproved).toBe(false);
  for(const role of PIECE_ROLES){expect(requirePieceRole(role.id)).toBe(role);expect(role.definition.trim()).not.toBe('');}
  expect(()=>requirePieceRole('constructor')).toThrow();expect(()=>requireSourcePieceRole('__proto__')).toThrow();
});

for(const pattern of listExecutablePatterns())for(const size of ['XS','M','XXXL'] as const){
  it(`${pattern.id}/${size}: every real generated path has exact classification and selectors select only that role`,()=>{
    const pieces=makePieces(pattern.id,size),report=auditPieceTaxonomy(pieces);
    expect(report.issues).toEqual([]);expect(pieces.every(p=>p.pass)).toBe(true);
    pieces.forEach(p=>covered.add(p.key));
    for(const role of PIECE_ROLES){
      const selected=pieces.filter(p=>matchesTagFilter(p.tags,[role.family,`role:${role.id}`]));
      const expected=pieces.filter(p=>p.paths.find(x=>x.layer==='seam-line')?.pieceRole===role.id);
      expect(selected.map(p=>p.key)).toEqual(expected.map(p=>p.key));
    }
    expect(pieces.filter(p=>matchesTagFilter(p.tags,['material:interfacing']))).toEqual([]);
    expect(pieces.filter(p=>matchesTagFilter(p.tags,['unknown']))).toEqual([]);
    samples.push({patternId:pattern.id,size,classificationPass:report.classificationPass,productionApproved:false,
      pieces:pieces.map(p=>({id:p.key,tags:p.tags,previewChecksPass:p.pass})),counts:report.counts});
  });
}

it('all registered source identities are exercised; counts never mean a standalone lining or interfacing was generated',()=>{
  for(const pattern of listExecutablePatterns())makePieces(pattern.id).forEach(p=>covered.add(p.key));
  expect([...covered].sort()).toEqual(Object.keys(SOURCE_PIECE_ROLES).sort());
  const pieces=makePieces();
  expect(pieces.find(p=>p.key==='simon.collar')!.tags).toContain('role:collar.unsplit-pair');
  expect(pieces.filter(p=>matchesTagFilter(p.tags,['role:collar.top']))).toEqual([]);
  expect(pieces.filter(p=>matchesTagFilter(p.tags,['role:collar.under']))).toEqual([]);
  expect(pieces.filter(p=>matchesTagFilter(p.tags,['yoke'])).map(p=>p.key)).toEqual(['simon.yoke']);
});

it('short sleeves remove cuff/placket roles rather than leaving false current coverage',()=>{
  const pieces=makePieces('button-up-shirt','M',{schema:'garment-os/construction/v1',options:{sleeveStyle:'short'}});
  expect(pieces).toHaveLength(7);
  const report=auditPieceTaxonomy(pieces);
  expect(report.issues).toEqual([]);
  for(const role of ['cuff.barrel','placket.sleeve-overlap','placket.sleeve-underlap']){
    const row=report.rows.find(r=>r.id===role)!;
    expect(row.currentCount).toBe(0);expect(row.stage).toBe('reference-bound');
  }
});

it.each([
  ['missing-role',{pieceRole:undefined}],['unknown-role',{pieceRole:'collar.fake'}],['wrong-family',{category:'pocket' as const}],
  ['missing-material',{materialRole:undefined}],['missing-version',{taxonomyVersion:undefined}],['old-version',{taxonomyVersion:'v0'}],
])('%s blocks preview for the entire piece',(_name,change)=>{
  const original=makePieces().find(p=>p.key==='simon.collarStand')!;
  const paths=original.paths.map(p=>({...p,...change}));
  const result=validateAllPieces(groupSolutionPieces(paths))[0];
  expect(result.pass).toBe(false);expect(result.checks.find(c=>c.id==='C9-taxonomy')!.pass).toBe(false);
  expect(auditPieceTaxonomy([result]).issues.length).toBeGreaterThan(0);
});
it('mixed metadata, missing cutting method and a valid but false role binding cannot masquerade as a classified source',()=>{
  const piece=makePieces().find(p=>p.key==='simon.collarStand')!;
  for(const change of [{materialRole:'lining' as const},{pieceRole:'collar.top'},{cutQty:3}]){
    const mixed={...piece,paths:piece.paths.map((p,i)=>i===0?{...p,...change}:p)};
    expect(validateAllPieces([mixed])[0].pass).toBe(false);expect(auditPieceTaxonomy([mixed]).classificationPass).toBe(false);
  }
  const noCut={...piece,paths:piece.paths.map(p=>({...p,cutOnFold:undefined}))};
  expect(validateAllPieces([noCut])[0].pass).toBe(false);expect(auditPieceTaxonomy([noCut]).classificationPass).toBe(false);
  const wrongSource={...piece,paths:piece.paths.map(p=>({...p,pieceRole:'collar.top'}))};
  expect(validateAllPieces([wrongSource])[0].pass).toBe(false);
  expect(auditPieceTaxonomy([wrongSource]).classificationPass).toBe(false);
});
it('duplicate definitions, orphan roles and missing source bindings are reported',()=>{
  const r=auditPieceTaxonomy([],{
    families:[...PIECE_FAMILIES,PIECE_FAMILIES[0]],roles:[...PIECE_ROLES,{...PIECE_ROLES[0],family:'bogus' as never}],
    bindings:{...SOURCE_PIECE_ROLES,'invented.source':{role:'nonexistent',material:'fabric'}},
  });
  expect(r.classificationPass).toBe(false);
  expect(r.issues.some(i=>i.message.includes('重复'))).toBe(true);
  expect(r.issues.some(i=>i.message.includes('归属'))).toBe(true);
  expect(r.issues.some(i=>i.message.includes('未注册'))).toBe(true);
});
it('the local snapshot crosswalk preserves 12 quarantined legacy records and links all 19 real identities through 18 records',()=>{
  const report=auditPieceElementLinks();
  expect(report.issues).toEqual([]);expect(report.counts).toEqual({records:30,quarantined:12,linkedRecords:18,linkedSourceIdentities:19,pendingSourceIdentities:16,unmapped:0});
  expect(report.pendingSourceIds).toHaveLength(16);
  const missing=structuredClone(ELEMENT_LIBRARY);missing.elements=missing.elements.filter(e=>!e.sourceId.endsWith('/simon.yoke'));
  expect(auditPieceElementLinks(missing).issues.some(i=>i.includes('simon.yoke'))).toBe(true);
  expect(report.remoteWritten).toBe(false);expect(report.remoteClassificationVerified).toBe(false);
  for(const row of report.rows.filter(r=>r.disposition==='quarantined'))expect(row.localRoles).toEqual([]);
  expect(report.rows.find(r=>r.sourceId.endsWith('/simon.yoke'))!.localRoles).toEqual(['yoke.back']);
  const bad=structuredClone(ELEMENT_LIBRARY);bad.elements.find(e=>e.sourceId.endsWith('/simon.yoke'))!.status='隔离';
  expect(auditPieceElementLinks(bad).issues.some(i=>i.includes('隔离元素'))).toBe(true);
});

afterAll(()=>{
  const dir='doc/evidence/taxonomy-20261111';mkdirSync(dir,{recursive:true});
  for(const [name,data] of Object.entries({dictionary:{families:PIECE_FAMILIES,roles:PIECE_ROLES},audit:auditPieceTaxonomy(),
    'runtime-coverage':{samples,coveredSourceIdentities:[...covered].sort(),productionApproved:false},'snapshot-crosswalk':auditPieceElementLinks()}))
    writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2));
});
