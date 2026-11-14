import { COMPANY_STYLE_MASTERS } from '@/data/companyStyleMasters';
import { STRUCTURE_ASSETS } from '@/data/reusableAssets';
import { STYLE_VARIATION_PRESETS } from '@/data/styleVariations';
import { TEE_DESIGN_FAMILIES } from './tee-design-system';
import { TEMPLATE_STRUCTURAL_REVIEWS } from '@/data/templateStructuralReview';
import { configureStructureAsset } from './asset-library';
import { auditTemplateStructure, compactAssembly } from './template-structural-audit';
import { computeDraft } from './draft-service';

/** Secondary libraries are reviewed explicitly, without counting references as complete construction templates. */
export function supplementaryTemplateScope() {
  return {
    companyMasters: COMPANY_STYLE_MASTERS.map(m => ({ id: m.id, name: m.name, sourceCode: m.source.styleCode, status: 'reference-only', matrixEligible: false,
      cadReferenceHint: m.cadTemplateId, sameStyleCadVerified: false,
      findings: [...m.pending, ...(m.id === 'company-cot25m002' ? ['已撤销普通装袖Teagan的错误关联；保留原图稿，落肩毫米纸样仍待建立。'] : [])] })),
    structurePresets: STRUCTURE_ASSETS.map(a => ({ id: a.id, name: a.name, templateId: a.templateId, status: 'inherits-template-findings', matrixEligible: false,
      findings: TEMPLATE_STRUCTURAL_REVIEWS[a.templateId].findings })),
    appearancePresets: STYLE_VARIATION_PRESETS.map(p => ({ id: p.id, name: p.name, status: 'appearance-only', matrixEligible: false, sameStyleCadVerified: false })),
    withdrawnDesignFamilies: TEE_DESIGN_FAMILIES.map(p => ({ id: p.id, name: p.name, status: 'withdrawn', matrixEligible: false })),
    referenceGallery: { status: 'reference-only', completeGarmentVerified: false, note: '图库中的源片、参考照片及品类占位不代表可执行整款；不得计入结构验收通过数量。' },
  };
}
export function auditStructurePresets() {
  return STRUCTURE_ASSETS.map(asset => {
    const base = auditTemplateStructure(asset.templateId).configuration;
    const configuration = configureStructureAsset(base, asset.id), draft = computeDraft(configuration);
    return { id: asset.id, name: asset.name, templateId: asset.templateId, configuration, geometryAvailable: draft.status === 'reference',
      assembly: compactAssembly(draft.assembly), issues: draft.issues, matrixEligible: false, productionApproved: false };
  });
}
