import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out = 'doc/evidence/all-template-structures-20261112'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage(); await page.goto('http://localhost:5341/?workspace=review', { waitUntil: 'networkidle0' });
  const result = await page.evaluate(async () => {
    const { listPatterns } = await import('/src/data/patternLibrary.ts');
    const { auditTemplateStructure, templateAuditCases, compactAssembly } = await import('/src/application/template-structural-audit.ts');
    const { templateAuditSheet } = await import('/src/lib/pattern/template-audit-sheet.ts');
    const { supplementaryTemplateScope, auditStructurePresets } = await import('/src/application/template-review-scope.ts');
    const defaults = listPatterns().map(p => auditTemplateStructure(p.id));
    const samples = templateAuditCases().map(c => {
      const a = auditTemplateStructure(c.id, c.size, c.fit, c.options ? { schema: 'garment-os/construction/v1', options: c.options } : undefined);
      return { ...c, status: a.status, matrixEligible: a.matrixEligible, geometryAvailable: a.pieces.length > 0, criteria: a.criteria, assembly: compactAssembly(a.assembly), issues: a.issues };
    });
    return { defaults, sheets: defaults.map(a => ({ id: a.id, svg: templateAuditSheet(a) })), samples, supplementary: supplementaryTemplateScope(), structurePresets: auditStructurePresets() };
  });
  assert.equal(result.defaults.length, 14); assert(result.samples.length > 213);
  assert(result.defaults.every(a => a.matrixEligible === false && a.productionApproved === false));
  const files = [...new Set(result.defaults.flatMap(a => a.sourceFiles))].map(source => {
    const match = source.match(/^(@freesewing\/[^@]+)@([^/]+)\/(.+)$/);
    const file = match ? path.join('node_modules', match[1], match[3]) : source;
    assert(fs.existsSync(file), `Missing reviewed source: ${source}`);
    if (match) assert.equal(JSON.parse(fs.readFileSync(path.join('node_modules', match[1], 'package.json'), 'utf8')).version, match[2]);
    const content = fs.readFileSync(file); return { source, file, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  });
  fs.writeFileSync(`${out}/source-provenance.json`, JSON.stringify(files, null, 2));
  for (const a of result.defaults) fs.writeFileSync(`${out}/${a.id}.review.json`, JSON.stringify(a, null, 2));
  for (const a of result.sheets) if (a.svg) fs.writeFileSync(`${out}/${a.id}.source-mm.svg`, a.svg);
  const summary = { schema: 'garment-os/all-template-structural-audit/v1', formalTemplates: 14, sourceExecutable: result.defaults.filter(a => a.source).length,
    rebuildRequired: result.defaults.filter(a => a.status === 'rebuild-required').length, retired: result.defaults.filter(a => a.status === 'retired').length,
    matrixEligible: 0, productionApproved: false, samples: result.samples.length, continuousDomainApproved: false,
    sampleGeometryBlocked: result.samples.filter(a => !a.geometryAvailable).map(a => ({ id: a.id, size: a.size, fit: a.fit, options: a.options, issues: a.issues })),
    templates: result.defaults.map(a => ({ id: a.id, name: a.name, status: a.status, scope: a.scope, findings: a.findings, criteria: a.criteria })),
    candidateStructures: [{ id: 'raglan', status: 'blocked', scope: 'Hugo long-sleeve source study; not a completed short T' }, { id: 'drop', status: 'missing-source', scope: 'No compatible body and sleeve method' }],
    referenceGallery: { scope: 'Reference-only source sheets are not executable complete templates', includedInFormalApprovalCount: false } };
  fs.writeFileSync(`${out}/audit.json`, JSON.stringify(summary, null, 2));
  fs.writeFileSync(`${out}/samples.json`, JSON.stringify(result.samples, null, 2));
  fs.writeFileSync(`${out}/supplementary.json`, JSON.stringify({ ...result.supplementary, presetChecks: result.structurePresets }, null, 2));
  console.log(JSON.stringify({ formal: 14, samples: result.samples.length, geometryBlocked: summary.sampleGeometryBlocked.length, matrixEligible: 0, sourceFiles: files.length }));
} finally { await browser.close(); }
