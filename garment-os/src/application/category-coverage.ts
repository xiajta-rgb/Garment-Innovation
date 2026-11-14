import { GARMENT_CATEGORIES,CATEGORY_SCOPE,garmentCategory } from '@/data/garmentCategories';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { isReferencePattern,PATTERN_REVIEWS } from '@/data/patternReview';
import { TEMPLATE_SOURCE_PIECES,supportsGarmentAssembly } from '@/data/templateCapabilities';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { COMPANY_STYLE_MASTERS } from '@/data/companyStyleMasters';
import { STRUCTURE_ASSETS } from '@/data/reusableAssets';
import { referenceCoverage } from './reference-catalogue';

const references=referenceCoverage().flatMap(f=>f.roles);
export function categoryCoverage(id:string){
  const category=garmentCategory(id);
  const executableIds=category.templateIds.filter(isReferencePattern);
  const sourceIds=[...new Set(executableIds.flatMap(id=>TEMPLATE_SOURCE_PIECES[id]??[]))];
  const sourceRoles=new Set(sourceIds.map(id=>SOURCE_PIECE_ROLES[id]?.role));
  const roles=category.requiredRoles.map(id=>{
    const ref=references.find(r=>r.id===id);
    if(!ref)throw new Error(`品类角色未登记：${id}`);
    return {...ref,sourceBound:sourceRoles.has(id)};
  });
  const structures=STRUCTURE_ASSETS.filter(a=>executableIds.includes(a.templateId));
  const companies=COMPANY_STYLE_MASTERS.filter(m=>category.companyMasterIds.includes(m.id));
  const garment3dIds=executableIds.filter(supportsGarmentAssembly);
  return {category,executableIds,sourceIds,roles,structures,companies,garment3dIds,
    missingSourceRoles:roles.filter(r=>!r.sourceBound).map(r=>r.id),
    stage:executableIds.length?'cad-reference':companies.length?'company-drawing':'definition-only',
    productionApproved:false as const,
  };
}
export function exportCategoryCoverage(){
  const rows=GARMENT_CATEGORIES.map(c=>categoryCoverage(c.id));
  return {schema:CATEGORY_SCOPE.version,scope:CATEGORY_SCOPE,productionApproved:false,browserAcceptance:'deferred',remoteSync:'not-performed',
    counts:{categories:rows.length,cadCategories:rows.filter(r=>r.executableIds.length).length,
      templates:new Set(rows.flatMap(r=>r.executableIds)).size,
      garment3dCategories:rows.filter(r=>r.garment3dIds.length).length,
      companyOnlyCategories:rows.filter(r=>r.stage==='company-drawing').length,
      definitionOnlyCategories:rows.filter(r=>r.stage==='definition-only').length},
    rows:rows.map(r=>({category:r.category,stage:r.stage,templateIds:r.executableIds,garment3dIds:r.garment3dIds,
      companyMasterIds:r.companies.map(m=>m.id),structureIds:r.structures.map(a=>a.id),
      roles:r.roles.map(role=>({id:role.id,label:role.label,sourceBound:role.sourceBound,independentReferenceCad:role.cadCount,referenceImages:role.imageCount})),
      missingSourceRoles:r.missingSourceRoles,templateLimits:r.category.templateIds.map(id=>({id,name:PATTERN_LIBRARY[id].name,limitations:PATTERN_REVIEWS[id].limitations})),
      productionApproved:false})),
  };
}
