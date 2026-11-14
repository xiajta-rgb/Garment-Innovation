import { PATTERN_LIBRARY, listPatterns } from '@/data/patternLibrary';
import { PATTERN_REVIEWS } from '@/data/patternReview';
import { TEMPLATE_STRUCTURAL_REVIEWS } from '@/data/templateStructuralReview';
import { getReferenceMeasurements } from '@/data/referenceMeasurements';
import { computeDraft } from './draft-service';
import { ENGINE_VERSION } from '@/types/design';
import type { DesignConfiguration, Fit } from '@/types/design';
import type { StandardSize } from '@/types/measurements';
import type { ConstructionSelection } from '@/types/construction';
import type { AssemblyReport } from '@/types/assembly';
import { TEE_PARAMETERS, PANTS_PARAMETERS } from '@/data/foundationMethods';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { CONSTRUCTION_PARAMETERS } from '@/data/constructionMethods';
import { SKIRT_PARAMETERS } from '@/data/skirtMethods';

export interface ReviewCriterion { id: string; label: string; status: 'checked' | 'pending' | 'failed' | 'unavailable'; detail: string }
export function auditTemplateStructure(id: string, size: StandardSize = 'M', fit: Fit = 'regular', construction?: ConstructionSelection) {
  const definition = PATTERN_LIBRARY[id], review = PATTERN_REVIEWS[id], structural = TEMPLATE_STRUCTURAL_REVIEWS[id];
  if (!definition || !review || !structural) throw Error('模板缺少完整的结构审查登记：' + id);
  const configuration: DesignConfiguration = { activePatternId: id, gender: id.startsWith('womens-') ? 'female' : 'male', standardSize: size, fit,
    measurements: getReferenceMeasurements(id.startsWith('womens-') ? 'female' : 'male', size), engineVersion: ENGINE_VERSION, garmentColor: '#e8e5dc', fabricId: 'solid', ...(construction ? { construction } : {}) };
  const result = review.engine ? computeDraft(configuration) : null, a = result?.assembly ?? null;
  const missingGrain = result?.pieces.filter(p => !p.paths.some(path => path.layer === 'grain-line')).map(p => p.key) ?? [];
  const unresolvedOperations = a?.construction?.operations.filter(op => op.status !== 'dimensioned') ?? [];
  const findings = [...structural.findings, ...(result?.error ? [result.error] : []), ...missingGrain.map(id => `${id}缺少源布纹/对折方向标线。`), ...unresolvedOperations.map(op => `${op.label}：${op.requirements.join('；')}`)];
  const criteria: ReviewCriterion[] = [
    { id: 'source', label: '方法与适用范围', status: review.engine ? 'checked' : 'unavailable', detail: review.engine ? `${review.engine}@${ENGINE_VERSION}；${structural.scope}` : structural.scope },
    { id: 'geometry', label: '毫米净样与裁边', status: !result ? 'unavailable' : result.status === 'blocked' ? 'failed' : 'checked', detail: result ? result.error ?? `${result.pieces.length}种源裁片，净样/裁边及数值有效性已检查` : '无可执行几何' },
    { id: 'cutting', label: '数量、材料与裁法', status: !a ? 'unavailable' : a.errors.some(e => /cut|material/.test(e.code)) ? 'failed' : 'checked', detail: a ? '数量与对折来自源裁剪指令；双层与异材差量仍按下列问题单处理' : '没有完整裁剪指令可核对' },
    { id: 'grain', label: '布纹与前后定位', status: !result?.pieces.length ? 'unavailable' : 'pending', detail: !result?.pieces.length ? '没有可核对的裁片标线' : missingGrain.length ? `缺少标线：${missingGrain.join('、')}` : '保留已有源标线；逐段剪口、肩部对位和实际材料方向未完成整体验证' },
    { id: 'interfaces', label: '结构接口与配缝', status: !a ? 'unavailable' : a.status === 'blocked' ? 'failed' : a.pending.length ? 'pending' : 'checked', detail: a ? `${a.joins.filter(j => j.status === 'passed').length}条长度/方向核对通过；${a.joins.filter(j => j.status === 'pending').length}条待定义；${a.errors.length}项错误` : '缺少完整接口规则' },
    { id: 'completion', label: '领袖腰头与开口完成态', status: !a ? 'unavailable' : unresolvedOperations.some(op => op.status === 'needs-redraft') ? 'failed' : 'pending', detail: unresolvedOperations.length ? unresolvedOperations.map(op => `${op.label}：${op.status === 'needs-redraft' ? '需重制' : op.status === 'needs-geometry' ? '缺完成态几何' : '缺少输入依据'}`).join('；') : '源参考尺寸不构成领袖/腰头、闭合、折返和收边的完整验收' },
    { id: 'range', label: '尺寸、参数与平衡', status: 'pending', detail: '参考样本和选定配置回放是有限覆盖；尚未完成连续参数范围、级放与目标人体平衡验证' },
    { id: 'material', label: '材料、工艺与试样', status: 'pending', detail: '实际伸缩、回弹、厚度、缩率、缝型及试样结果未录入，不推定通过' },
  ];
  return { id, name: definition.name, disposition: review.disposition, source: review.engine ? `${review.engine}@${ENGINE_VERSION}` : null, scope: structural.scope,
    status: !review.engine ? review.disposition === 'retired' ? 'retired' as const : 'rebuild-required' as const : criteria.some(c => c.status === 'failed') ? 'blocked' as const : 'incomplete' as const,
    matrixEligible: false, productionApproved: false, configuration, sourceFiles: structural.sourceFiles, criteria, findings: [...new Set(findings)], assembly: a,
    pieces: result?.pieces ?? [], issues: result?.issues ?? [] };
}
export type TemplateStructuralAudit = ReturnType<typeof auditTemplateStructure>;

/** Default samples plus explicit option branches. This is bounded sampling, not approval of a continuous domain. */
export function templateAuditCases() {
  const cases: Array<{ id: string; size: StandardSize; fit: Fit; options?: ConstructionSelection['options']; label: string }> = [];
  for (const p of listPatterns().filter(p => PATTERN_REVIEWS[p.id].engine)) {
    const fits: Fit[] = ['elastic-waist-pants', 'panel-circle-skirt', 'bound-tank'].includes(p.id) ? ['regular'] : ['slim', 'regular', 'loose'];
    for (const size of ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const) for (const fit of fits) cases.push({ id: p.id, size, fit, label: '默认子集' });
  }
  for (const sleeveStyle of ['long', 'short'] as const) for (const hemStyle of ['straight', 'baseball', 'slashed'] as const) for (const cuffStyle of ['angledBarrelCuff', 'roundedBarrelCuff', 'straightBarrelCuff'] as const) {
    if (sleeveStyle === 'short' && cuffStyle !== 'angledBarrelCuff') continue;
    for (const size of ['XS', 'M', 'XXXL'] as const) cases.push({ id: 'button-up-shirt', size, fit: 'regular', options: { sleeveStyle, hemStyle, ...(sleeveStyle === 'long' ? { cuffStyle } : {}) }, label: '袖型/袖口/下摆分支' });
  }
  for (const ribbing of [false, true]) for (const pocket of [false, true]) for (const size of ['XS', 'M', 'XXXL'] as const)
    cases.push({ id: 'hooded-zip-sweatshirt', size, fit: 'regular', options: { ribbing, pocket }, label: '罗纹/袋开关分支' });
  for (const panels of [2, 3, 4]) for (const gathering of [0, .5]) for (const size of ['XS', 'M', 'XXXL'] as const)
    cases.push({ id: 'panel-circle-skirt', size, fit: 'regular', options: { panels, gathering }, label: '裙幅/抽褶分支' });
  const parameters = { 't-shirt': TEE_PARAMETERS, 'womens-basic-tee': TEE_PARAMETERS, 'elastic-waist-pants': PANTS_PARAMETERS,
    ...KNIT_PARAMETERS, 'button-up-shirt': CONSTRUCTION_PARAMETERS, 'panel-circle-skirt': SKIRT_PARAMETERS };
  for (const [id, params] of Object.entries(parameters)) {
    const numeric = params.filter(p => typeof p.defaultValue === 'number' && typeof p.min === 'number' && typeof p.max === 'number');
    for (const p of numeric) for (const value of [p.min!, p.max!]) cases.push({ id, size: 'M', fit: 'regular', options: { ...('only' in p && p.only === 'short' ? { sleeveStyle: 'short' as const } : {}), [p.key]: value }, label: `公开数值端点：${p.key}` });
    for (const boundary of ['min', 'max'] as const) cases.push({ id, size: 'M', fit: 'regular', options: Object.fromEntries(numeric.filter(p => !('only' in p) || p.only !== 'short').map(p => [p.key, p[boundary]!])), label: `公开数值组合端点：${boundary}` });
  }
  return cases;
}
export function compactAssembly(a: AssemblyReport | null) {
  return a ? { status: a.status, integrityPass: a.integrityPass, pieces: a.pieces, joins: a.joins, errors: a.errors, pending: a.pending, coverage: a.coverage,
    operations: a.construction?.operations.map(op => ({ id: op.id, status: op.status, metrics: op.metrics })) ?? null } : null;
}
