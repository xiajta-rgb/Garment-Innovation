import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const out = 'doc/evidence/all-template-structures-20261112'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage(), errors = [], submissions = [], steps = [];
page.on('pageerror', e => errors.push(String(e))); page.on('request', r => { if (r.method() === 'POST') submissions.push(r.url()); });
const record = name => { steps.push({ name, pass: true }); console.log(name); };
try {
  await page.setViewport({ width: 1600, height: 1100 }); await page.goto('http://localhost:5341/?workspace=review', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="template-review-studio"]');
  const saved = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  assert.equal(await page.$$eval('[data-review-template]', es => es.length), 14);
  assert(await page.$eval('.review-actions button:disabled', e => e.textContent.includes('整款验收')));
  await page.screenshot({ path: `${out}/all-template-review.png`, fullPage: true });
  record('review-shows-all-fourteen-templates-with-construction-matrix-paused');
  const ids = await page.$$eval('[data-review-template]', es => es.map(e => e.getAttribute('data-review-template')));
  for (const id of ids) {
    await page.click(`[data-review-template="${id}"]`); await page.waitForSelector(`[data-reviewed-id="${id}"]`);
    assert.equal(await page.$$eval('.review-criteria article', es => es.length), 8);
    const audit = JSON.parse(fs.readFileSync(`${out}/${id}.review.json`, 'utf8'));
    assert.equal(await page.$$eval('[data-audit-piece]', es => es.length), audit.pieces.length);
    if (audit.pieces.length) {
      const actual = await page.$eval('[data-template-audit-sheet] metadata', e => JSON.parse(e.textContent));
      assert.equal(actual.matrixEligible, false); assert.equal(actual.productionApproved, false);
    }
    assert(await page.$eval('.review-actions button:disabled', e => e.disabled));
    await (await page.$('.review-detail')).screenshot({ path: `${out}/${id}.browser.png` });
    record(`actual-template-detail-${id}`);
  }
  await page.click('[data-review-template="t-shirt"]'); const m = await page.$eval('[data-audit-piece="teagan.sleeve"] [data-layer="seam-line"]', e => e.getAttribute('d'));
  await page.select('[aria-label="模板审查参考尺码"]', 'XS');
  assert.notEqual(await page.$eval('[data-audit-piece="teagan.sleeve"] [data-layer="seam-line"]', e => e.getAttribute('d')), m);
  await page.select('[aria-label="模板审查参考尺码"]', 'M'); record('sample-change-recomputes-source-geometry');
  await page.click('[data-review-template="button-up-shirt"]');
  assert.equal(await page.$eval('[data-criterion="completion"]', e => e.getAttribute('data-review-status')), 'failed');
  const downloads = fs.mkdtempSync(path.join(out, 'downloads-')), cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve(downloads) });
  await page.click('.review-actions button:not(:disabled)'); const filename = 'button-up-shirt-M-结构审查.json';
  for (let i = 0; i < 50 && !fs.existsSync(path.join(downloads, filename)); i++) await new Promise(r => setTimeout(r, 100));
  const downloaded = JSON.parse(fs.readFileSync(path.join(downloads, filename), 'utf8'));
  assert.equal(downloaded.status, 'blocked'); assert.equal(downloaded.matrixEligible, false);
  assert(downloaded.findings.some(f => f.includes('独立闭合领底')));
  fs.copyFileSync(path.join(downloads, filename), path.join(out, filename)); record('real-download-retains-shirt-blockers-and-source-pieces');
  for (const route of ['matrix', 'matrix-v1']) {
    await page.goto(`http://localhost:5341/?workspace=${route}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="design-desk"]');
    assert.equal(await page.$$eval('[data-design-card],[data-testid="tee-matrix-studio"]', es => es.length), 0);
  }
  const blocked = await page.evaluate(async () => {
    const { buildTeeMatrix, newTeeBase } = await import('/src/application/tee-matrix.ts');
    const { buildTeeDesignMatrix, newTeeDesignBase } = await import('/src/application/tee-design-system.ts');
    const { createTeeTechnicalDesign } = await import('/src/lib/pattern/tee-technical-flat.ts');
    const c = newTeeDesignBase(), checks = [];
    for (const fn of [() => buildTeeMatrix(newTeeBase(), 'neck'), () => buildTeeDesignMatrix(c.configuration, c.intent, 'neckline'), () => createTeeTechnicalDesign({ id: 'old', name: 'saved', row: 'raglan', column: 'crew', ...c })]) {
      try { fn(); checks.push(false); } catch (e) { checks.push(String(e).includes('设计矩阵暂停')); }
    } return checks;
  }); assert.deepEqual(blocked, [true, true, true]); record('legacy-routes-builders-and-direct-export-cannot-bypass-review-hold');
  assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))), saved);
  await page.goto('http://localhost:5341/?workspace=review', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="template-review-studio"]');
  await page.setViewport({ width: 390, height: 844 }); await page.$eval('.review-detail', e => e.scrollIntoView());
  assert(await page.$eval('.review-detail', e => e.getBoundingClientRect().right <= 390));
  await page.screenshot({ path: `${out}/mobile-review.png` }); record('old-storage-preserved-and-mobile-detail-fits');
  await page.setViewport({ width: 1600, height: 1100 });
  await page.goto('http://localhost:5341/?workspace=company', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="company-design-board"]');
  const cadButton = await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === '使用此母版查看裁片 / 三维')?.disabled);
  assert.equal(cadButton, true);
  const compatibility = await page.evaluate(async () => {
    const { newCompanyStyle, readCompanyStyle } = await import('/src/lib/pattern/company-style.ts');
    const { companyStyleMaster } = await import('/src/data/companyStyleMasters.ts');
    const saved = { ...newCompanyStyle('company-cot25m002'), cadApplied: true, name: '旧落肩稿', notes: '保留我的修改' };
    const restored = readCompanyStyle(saved);
    return { templateId: companyStyleMaster(saved.masterId).cadTemplateId, cadApplied: restored.cadApplied, name: restored.name, notes: restored.notes, originalCadApplied: saved.cadApplied };
  });
  assert.deepEqual(compatibility, { templateId: null, cadApplied: false, name: '旧落肩稿', notes: '保留我的修改', originalCadApplied: true });
  await page.screenshot({ path: `${out}/company-drop-link-withdrawn.png`, fullPage: true });
  record('drop-shoulder-master-cannot-use-set-in-cad-and-old-artwork-edits-survive');
  assert.deepEqual(errors, []); assert.deepEqual(submissions, []);
} catch (e) { process.exitCode = 1; steps.push({ pass: false, error: String(e) }); console.error(e); await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {}); }
finally { fs.writeFileSync(`${out}/browser.json`, JSON.stringify({ steps, errors, submissions }, null, 2)); await browser.close(); }
