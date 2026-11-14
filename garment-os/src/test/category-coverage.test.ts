import { expect,it } from 'vitest';
import { GARMENT_CATEGORIES,CATEGORY_GROUPS,garmentCategory } from '@/data/garmentCategories';
import { PIECE_ROLE_MAP } from '@/data/pieceTaxonomy';
import { COMPANY_STYLE_MASTERS } from '@/data/companyStyleMasters';
import { listPatterns,listExecutablePatterns } from '@/data/patternLibrary';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { TEMPLATE_SOURCE_PIECES,supportsGarmentAssembly } from '@/data/templateCapabilities';
import { categoryCoverage,exportCategoryCoverage } from '@/application/category-coverage';
import { useDesignStore } from '@/store/useDesignStore';

it('registers explicit constructions with real role references, dimension contracts and interfaces',()=>{
  expect(new Set(GARMENT_CATEGORIES.map(c=>c.id)).size).toBe(GARMENT_CATEGORIES.length);
  for(const c of GARMENT_CATEGORIES){
    expect(CATEGORY_GROUPS.some(([id])=>id===c.group)).toBe(true);
    expect(c.construction.length).toBeGreaterThan(4);
    expect(c.requiredRoles.length).toBeGreaterThan(0);
    expect(c.dimensions.length).toBeGreaterThan(0);expect(c.interfaces.length).toBeGreaterThan(0);
    const roles=[...c.requiredRoles,...c.optionalRoles];
    expect(new Set(roles).size).toBe(roles.length);
    for(const id of roles)expect(PIECE_ROLE_MAP[id]?.id).toBe(id);
    for(const id of c.companyMasterIds)expect(COMPANY_STYLE_MASTERS.some(m=>m.id===id)).toBe(true);
  }
  expect(()=>garmentCategory('not-registered')).toThrow('未登记');
});
it('maps every catalogue template once, including blocked and retired entries, and every company original',()=>{
  const ids=GARMENT_CATEGORIES.flatMap(c=>c.templateIds);
  expect([...ids].sort()).toEqual(listPatterns().map(p=>p.id).sort());
  expect(GARMENT_CATEGORIES.flatMap(c=>c.companyMasterIds).sort()).toEqual(COMPANY_STYLE_MASTERS.map(m=>m.id).sort());
  expect(Object.keys(TEMPLATE_SOURCE_PIECES).sort()).toEqual(listExecutablePatterns().map(p=>p.id).sort());
  for(const sources of Object.values(TEMPLATE_SOURCE_PIECES))for(const id of sources)expect(SOURCE_PIECE_ROLES[id]?.role).toBeTruthy();
});
it('never promotes independent pants/skirt/underwear references into executable product templates',()=>{
  for(const id of ['straight-pants','a-line-skirt','bra','gloves']){
    const report=categoryCoverage(id);
    expect(report.roles.some(r=>r.cadCount+r.imageCount>0)).toBe(true);
    expect(report.executableIds).toEqual([]);expect(report.garment3dIds).toEqual([]);
    expect(report.missingSourceRoles).toEqual(report.category.requiredRoles);
    expect(report.productionApproved).toBe(false);
  }
});
it('keeps pullover and crew company masters separate from Huey zip CAD and Sven non-rib CAD',()=>{
  for(const id of ['pullover-hoodie','crew-sweatshirt']){
    const report=categoryCoverage(id);
    expect(report.stage).toBe('company-drawing');expect(report.executableIds).toEqual([]);
    expect(report.companies).toHaveLength(1);expect(report.companies[0].cadTemplateId).toBeNull();
  }
  expect(categoryCoverage('zip-hoodie').companies).toEqual([]);
  expect(categoryCoverage('zip-hoodie').executableIds).toEqual(['hooded-zip-sweatshirt']);
});
it('exposes missing collar net patterns even when CAD and illustrative surfaces exist',()=>{
  expect(categoryCoverage('round-short-tee').missingSourceRoles).toContain('binding.neck');
  expect(categoryCoverage('shirt').missingSourceRoles).toEqual(['collar.top','collar.under']);
  expect(categoryCoverage('bound-tank').missingSourceRoles).toEqual([]);
  expect(categoryCoverage('zip-hoodie').garment3dIds).toEqual([]);
  expect(categoryCoverage('shirt').garment3dIds).toEqual([]);
  for(const p of listPatterns())expect(supportsGarmentAssembly(p.id)).toBe(GARMENT_CATEGORIES.some(c=>categoryCoverage(c.id).garment3dIds.includes(p.id)));
});
it('checks registered source-piece identities against actual complete engine outputs',()=>{
  const store=useDesignStore.getState();store.newDesign();
  for(const p of listExecutablePatterns()){
    store.applyPattern(p.id);
    const draft=useDesignStore.getState().draft;
    expect(draft.status,p.id).toBe('reference');
    const sourceIds=[...new Set(draft.paths.filter(p=>p.layer==='seam-line').map(p=>p.pieceId))];
    expect(sourceIds.sort(),p.id).toEqual([...TEMPLATE_SOURCE_PIECES[p.id]].sort());
  }
  store.newDesign();
});
it('exports actionable mappings without inferring production approval, remote sync or browser acceptance',()=>{
  const report=exportCategoryCoverage();
  expect(report.counts.cadCategories).toBe(9);expect(report.counts.templates).toBe(9);
  expect(report.counts.garment3dCategories).toBe(5);expect(report.counts.companyOnlyCategories).toBe(2);
  expect(report.counts.categories).toBe(report.counts.cadCategories+report.counts.companyOnlyCategories+report.counts.definitionOnlyCategories);
  expect(report.productionApproved).toBe(false);expect(report.remoteSync).toBe('not-performed');expect(report.browserAcceptance).toBe('deferred');
  expect(report.rows.every(r=>r.productionApproved===false)).toBe(true);
});
