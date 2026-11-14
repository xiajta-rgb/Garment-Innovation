import { expect, it } from 'vitest';
import { listPatterns } from '@/data/patternLibrary';
import { TEMPLATE_STRUCTURAL_REVIEWS, requireDesignMatrixReady } from '@/data/templateStructuralReview';
import { auditTemplateStructure, templateAuditCases } from '@/application/template-structural-audit';
import { templateAuditSheet } from '@/lib/pattern/template-audit-sheet';
import { supplementaryTemplateScope, auditStructurePresets } from '@/application/template-review-scope';

it('covers every formal template with source scope, eight criteria and concrete unresolved findings', () => {
  expect(Object.keys(TEMPLATE_STRUCTURAL_REVIEWS).sort()).toEqual(listPatterns().map(p => p.id).sort());
  for (const p of listPatterns()) {
    const a = auditTemplateStructure(p.id);
    expect(a.criteria).toHaveLength(8); expect(a.findings.length).toBeGreaterThan(0);
    expect(a.matrixEligible).toBe(false); expect(a.productionApproved).toBe(false);
    expect(a.criteria.some(c => c.status !== 'checked')).toBe(true);
    if (!a.source) { expect(a.pieces).toEqual([]); expect(a.assembly).toBeNull(); expect(templateAuditSheet(a)).toBeNull(); }
  }
  expect(() => requireDesignMatrixReady()).toThrow(/全部模板/);
}, 30000);

it('does not treat the Simon source collar pair or a matched sleeve cap as finished construction', () => {
  const a = auditTemplateStructure('button-up-shirt');
  expect(a.status).toBe('blocked'); expect(a.criteria.find(c => c.id === 'completion')?.status).toBe('failed');
  expect(a.findings.join(' ')).toContain('独立闭合领底');
  expect(a.assembly?.construction?.operations.some(op => op.status === 'needs-redraft')).toBe(true);
});

it('exports only original source geometry with mm units and explicit incomplete status', () => {
  const a = auditTemplateStructure('t-shirt'), svg = templateAuditSheet(a)!;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelectorAll('[data-audit-piece]')).toHaveLength(3);
  expect(doc.documentElement.getAttribute('width')).toMatch(/mm$/);
  for (const piece of a.pieces) expect(doc.querySelector(`[data-audit-piece="${piece.key}"] [data-layer="seam-line"]`)?.getAttribute('d')).toBe(piece.paths.find(p => p.layer === 'seam-line')?.data);
  expect(JSON.parse(doc.querySelector('metadata')!.textContent!).matrixEligible).toBe(false);
});

it('declares bounded size/fit and option coverage rather than claiming continuous professional approval', () => {
  const cases = templateAuditCases(); expect(cases.length).toBeGreaterThan(213);
  expect(new Set(cases.map(c => c.id)).size).toBe(9);
  for (const branch of ['袖型/袖口/下摆分支', '罗纹/袋开关分支', '裙幅/抽褶分支']) expect(cases.some(c => c.label === branch)).toBe(true);
  expect(() => auditTemplateStructure('unknown')).toThrow(/缺少/);
});

it('includes company references and derived presets without promoting image proportions or incompatible shoulder hints to CAD approval', () => {
  const scope = supplementaryTemplateScope();
  expect(scope.companyMasters).toHaveLength(4);
  expect(scope.companyMasters.every(m => !m.sameStyleCadVerified && !m.matrixEligible)).toBe(true);
  expect(scope.companyMasters.find(m => m.sourceCode === 'COT25M002')?.findings.join(' ')).toContain('普通装袖');
  expect(scope.structurePresets.length).toBeGreaterThan(0);
  expect(scope.withdrawnDesignFamilies).toHaveLength(6);
  const presets = auditStructurePresets();
  expect(presets).toHaveLength(scope.structurePresets.length);
  expect(presets.every(p => !p.matrixEligible && !p.productionApproved)).toBe(true);
}, 30000);
