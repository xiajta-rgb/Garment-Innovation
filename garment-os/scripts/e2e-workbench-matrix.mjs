import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const out = 'doc/evidence/workbench-matrix-integration-20261112';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage(), errors = [], posts = [], steps = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
const record = name => { steps.push({ name, pass: true }); console.log(name); };
const click = async (text, scope = '') => {
  if(['公司设计稿','定制矩阵'].includes(text) && !await page.evaluate(text=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===text),text)) await click(text==='公司设计稿'?'参考资料':'设计台');
  for (const b of await page.$$(`${scope ? scope + ' ' : ''}button`)) {
    if ((await b.evaluate(e => e.textContent)).trim() === text) { await b.click(); return; }
  }
  throw Error('Missing button: ' + text);
};
const input = (selector, value) => page.$eval(selector, (e, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, String(value));
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
}, value);
const state = () => page.evaluate(async () => {
  // Vite retains HMR timestamps across navigations. Read the app's loaded singleton.
  const url = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);
  const { useDesignStore } = await import(url);
  const s = useDesignStore.getState();
  return { configuration: s.getConfiguration(), id: s.currentDesignId, saving: s.isSaving };
});
const metadata = () => page.$eval('.desk-stage [data-desk-drawing]', img => {
  const svg = decodeURIComponent(img.src.slice(img.src.indexOf(',') + 1));
  return JSON.parse(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('metadata').textContent);
});
const waitCount = n => page.waitForFunction(n => Number(document.querySelector('[data-desk-count]')?.textContent) === n, {}, n);
const waitPreview = expected => page.waitForFunction(expected => {
  const img = document.querySelector('.desk-stage [data-desk-drawing]');
  if (!img) return false;
  const svg = decodeURIComponent(img.src.slice(img.src.indexOf(',') + 1));
  const c = JSON.parse(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('metadata').textContent).configuration;
  return (!expected.size || c.standardSize === expected.size)
    && (!expected.length || c.measurements.totalLength === expected.length)
    && (!expected.bust || c.measurements.bust === expected.bust)
    && (!expected.color || c.pieceDesign.colors.front === expected.color)
    && (!expected.sleeve || c.construction.options.sleeveLength === expected.sleeve);
}, { timeout: 60000 }, expected);
const download = fs.mkdtempSync(path.join(out, 'downloads-'));
const downloaded = async name => {
  for (let i = 0; i < 60 && !fs.existsSync(path.join(download, name)); i++) await new Promise(r => setTimeout(r, 100));
  const value = fs.readFileSync(path.join(download, name), 'utf8');
  fs.writeFileSync(path.join(out, name), value);
  return value;
};
try {
  await page.setViewport({ width: 1600, height: 1100 });
  await page.goto('http://localhost:5341/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="piece-design-board"]');
  const shell = await page.$('[data-testid="workbench-shell"]');
  assert.equal(await page.$$eval('[data-testid="template-manager"]', es => es.length), 1);
  assert.equal(await page.$$eval('.desk-brand,.desk-library,[data-testid="design-desk"]', es => es.length), 0);
  const initial = await state();
  assert.notEqual(initial.configuration.activePatternId, 't-shirt');
  await page.evaluate(() => localStorage.setItem('garment-os/tee-design-studio/v2', 'legacy-kept'));
  record('root-retains-original-shell-single-sidebar-and-current-default-template');

  await page.click('[data-testid="template-t-shirt"]');
  for (const b of await page.$$('.left-panel button')) if ((await b.evaluate(e => e.textContent)).includes('点击展开微调')) { await b.click(); break; }
  await input('[aria-label="衣长"]', 680); await input('[aria-label="胸围"]', 1040);
  await click('定制矩阵', '[data-testid="workbench-canvas"]');
  await waitCount(4); await waitPreview({ length: 680, bust: 1040 });
  assert(await page.$$eval('[data-desk-option][aria-pressed="true"]', es => es.every(e => getComputedStyle(e).backgroundColor === getComputedStyle(document.querySelector('.desk-module-toolbar button[aria-pressed="true"]')).backgroundColor)));
  assert(await shell.evaluate(e => e === document.querySelector('[data-testid="workbench-shell"]')));
  assert.equal(await page.$$eval('.desk-brand,.desk-library', es => es.length), 0);
  record('matrix-is-in-original-canvas-and-uses-current-manual-measurements');

  await click('颜色', '[data-testid="template-manager"]');
  await page.click('[data-testid="template-manager"] button[title]');
  const color = (await state()).configuration.garmentColor;
  await waitPreview({ color }); await click('XS', '.left-panel'); await waitPreview({ size: 'XS', color });
  await input('[aria-label="衣长"]', 690); await waitPreview({ length: 690 });
  record('original-palette-size-and-measurement-controls-recompute-matrix-source-geometry');

  await input('[aria-label="衣长"]', ''); await waitCount(0);
  assert.equal(await page.$$eval('.desk-stage [data-desk-drawing]', es => es.length), 0);
  assert(await page.$('[data-testid="design-desk"] [role="alert"]'));
  await input('[aria-label="衣长"]', 690); await waitCount(4); await waitPreview({ length: 690 });
  record('clearing-a-measurement-keeps-workbench-editable-and-restoring-it-recovers-previews');

  const beforeApply = (await state()).configuration;
  await page.click('[data-desk-candidate*="/regular/extended/"]'); await waitPreview({ sleeve: .65 });
  await page.click('[data-testid="apply-matrix-to-workbench"]');
  assert.equal((await state()).configuration.construction.options.sleeveLength, .65);
  assert.equal((await state()).configuration.measurements.totalLength, 690);
  await page.click('[title="撤销 (Ctrl+Z)"]'); assert.deepEqual((await state()).configuration, beforeApply);
  await page.click('[title="重做 (Ctrl+Shift+Z)"]');
  assert.equal((await state()).configuration.construction.options.sleeveLength, .65);
  record('apply-uses-existing-design-history-with-working-undo-and-redo');

  await input('[placeholder="Design name..."]', '矩阵整合实测'); await click('Save', '.top-nav');
  await page.waitForFunction(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);
    const { useDesignStore } = await import(url);
    const s = useDesignStore.getState(); return !!s.currentDesignId && !s.isSaving;
  });
  const saved = await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/src\/store\/useDesignStore\.ts(?:\?|$)/.test(n)).at(-1);
    const { useDesignStore } = await import(url);
    const { designRepository } = await import('/src/lib/db/design-repository.ts');
    return designRepository.get(useDesignStore.getState().currentDesignId);
  });
  fs.writeFileSync(`${out}/saved-design-readback.json`, JSON.stringify(saved, null, 2));
  assert.equal(saved.configuration.measurements.totalLength, 690);
  assert.equal(saved.configuration.construction.options.sleeveLength, .65);
  assert.equal(saved.configuration.garmentColor, color);
  record('original-header-save-persists-applied-matrix-configuration-with-database-readback');

  await click('裁片组合设计', '[data-testid="workbench-canvas"]');
  await page.waitForSelector('.piece-three-view metadata');
  const piece = await page.$eval('.piece-three-view metadata', e => JSON.parse(e.textContent));
  assert.equal(piece.configuration.measurements.totalLength, 690);
  assert.equal(piece.configuration.construction.options.sleeveLength, .65);
  await page.click('[data-testid="open-3d-mapping"]'); await page.waitForSelector('[data-testid="pattern-3d-panel"]');
  assert.equal((await state()).configuration.measurements.totalLength, 690);
  await click('公司设计稿', '[data-testid="workbench-canvas"]'); await page.waitForSelector('[data-testid="company-design-board"]');
  await click('定制矩阵', '[data-testid="workbench-canvas"]'); await waitPreview({ length: 690 });
  assert(await shell.evaluate(e => e.isConnected));
  record('composition-three-dimensional-mapping-and-company-modules-share-current-style-and-shell');

  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve(download) });
  await click('Export', '.top-nav');
  assert((await downloaded('当前方案-参考三视图.svg')).includes('source-cad-mm'));
  await click('＋ 加入选款夹');
  await page.waitForFunction(()=>document.querySelector('.desk-module-toolbar nav button:last-child')?.textContent.trim()==='选款夹 1');
  await page.waitForFunction(() => document.querySelectorAll('.desk-auto-matrix [data-desk-drawing]').length === 4, { timeout: 60000 });
  await page.screenshot({ path: `${out}/desktop-integrated.png` });
  await page.$eval('.desk-matrix-section', e => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/desktop-matrix.png` });
  record('original-header-export-downloads-actual-matrix-three-view-and-shortlist-saves-baseline');

  await page.click('.theme-toggle-btn');
  assert.equal(await page.$eval('html', e => e.dataset.theme), 'dark');
  assert(await page.$eval('.desk-stage', e => getComputedStyle(e).backgroundColor === getComputedStyle(document.querySelector('.top-nav')).backgroundColor));
  await page.screenshot({ path: `${out}/shared-dark-theme.png` });
  await page.click('.theme-toggle-btn');
  record('module-follows-original-header-theme-and-workbench-colors');

  await page.click('[data-desk-option="shoulder-raglan"]'); await waitCount(8);
  await page.click('[data-desk-candidate*="/raglan/"]');
  assert.equal(await page.$$eval('.desk-stage [data-desk-drawing]', es => es.length), 0);
  assert(await page.$eval('[data-testid="apply-matrix-to-workbench"]', e => e.disabled));
  await click('＋ 保留设计需求');
  await page.waitForFunction(()=>document.querySelector('.desk-module-toolbar nav button:last-child')?.textContent.trim()==='选款夹 2');
  await click('Export', '.top-nav');
  const request = JSON.parse(await downloaded('当前方案-设计需求.json'));
  assert.equal(request.productionApproved, false); assert(request.candidate.blockers.length > 0);
  assert.equal(request.candidate.configuration, null);
  await click('模板审查', '.desk-module-toolbar'); await page.waitForSelector('[data-testid="template-review-studio"]');
  assert(await shell.evaluate(e => e.isConnected));
  await click('返回定制矩阵', '.workbench-reference-module'); await page.waitForSelector('[data-testid="design-desk"]');
  await click('基础裁片核对', '.desk-module-toolbar'); await page.waitForSelector('[data-testid="tee-foundation-studio"]');
  assert(await shell.evaluate(e => e.isConnected));
  await click('返回定制矩阵', '.workbench-reference-module'); await page.waitForSelector('[data-testid="design-desk"]');
  record('unsupported-requests-cannot-apply-and-review-foundation-open-within-same-workbench');

  await click('重置', '.desk-customization'); await waitCount(4);
  await click('选款夹 2', '.desk-module-toolbar');
  await page.waitForSelector('.desk-saved-actions button');
  await page.click('.desk-saved-actions button'); await waitPreview({ length: 690, size: 'XS', color });
  record('continue-customizing-restores-saved-workbench-baseline-with-manual-dimensions');
  await click('模板', '[data-testid="template-manager"]'); await click('衬衫', '[data-testid="template-manager"]');
  await page.click('[data-testid="template-button-up-shirt"]'); await waitCount(0); await page.waitForSelector('[data-desk-source]');
  assert.equal(await page.$$eval('[data-desk-source] [data-audit-piece]', es => es.length), 10);
  assert.equal(await page.$$eval('[data-desk-option]', es => es.length), 0);
  await click('针织 / 基型', '[data-testid="template-manager"]'); await page.click('[data-testid="template-t-shirt"]'); await waitCount(4);
  record('original-template-library-switches-matrix-to-real-shirt-source-without-tee-substitution');

  await page.setViewport({ width: 390, height: 844 });
  await click('模板与尺寸'); await click('S', '.left-panel');
  await page.click('[aria-label="关闭模板与尺寸面板"]'); await waitPreview({ size: 'S' });
  assert.equal(await page.$eval('[data-testid="workbench-shell"]', e => e.dataset.sidebarOpen), 'false');
  assert(await page.$eval('.top-nav>div:last-child>button:last-child', e => e.getBoundingClientRect().right <= 390));
  await page.waitForFunction(() => document.querySelectorAll('.desk-auto-matrix [data-desk-drawing]').length === 4, { timeout: 60000 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await page.$eval('.desk-stage', e => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/mobile-stage.png` });
  await page.$eval('.desk-matrix-section', e => e.scrollIntoView({ block: 'center' }));
  await page.$eval('.desk-matrix-scroll', e => { e.scrollLeft = 350; });
  assert(await page.$eval('.desk-matrix-scroll', e => e.scrollLeft > 0));
  await page.screenshot({ path: `${out}/mobile-matrix.png` });
  record('mobile-original-sidebar-and-matrix-scroll-work-without-document-overflow');

  await page.setViewport({ width: 1600, height: 1100 });
  for (const route of ['design', 'matrix', 'matrix-v1', 'review', 'foundation']) {
    await page.goto(`http://localhost:5341/?workspace=${route}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector(`[data-testid="${route === 'review' ? 'template-review-studio' : route === 'foundation' ? 'tee-foundation-studio' : 'design-desk'}"]`);
    assert.equal(await page.$$eval('[data-testid="template-manager"]', es => es.length), 1);
    assert.equal(await page.$$eval('.desk-brand,.desk-library', es => es.length), 0);
    assert(await page.$('[data-testid="workbench-shell"]'));
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('garment-os/tee-design-studio/v2')), 'legacy-kept');
  record('all-legacy-module-links-use-original-shell-and-historical-storage-is-preserved');
  await page.goto('http://localhost:5341/?workspace=matrix', { waitUntil: 'networkidle0' }); await waitCount(0);
  await page.click('[title="Saved Designs"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.left-panel button')].some(e => e.textContent.includes('矩阵整合实测')));
  for (const b of await page.$$('.left-panel button')) if ((await b.evaluate(e => e.textContent)).includes('矩阵整合实测')) { await b.click(); break; }
  await waitCount(4); await waitPreview({ length: 690, size: 'XS', color });
  assert.equal((await state()).configuration.construction.options.sleeveLength, .65);
  await page.screenshot({ path: `${out}/saved-design-restored.png` });
  record('reload-does-not-replace-current-template-and-original-saved-design-restores-applied-style');
  assert.deepEqual(errors, []); assert.deepEqual(posts, []);
} catch (e) {
  process.exitCode = 1; steps.push({ pass: false, error: String(e) }); console.error(e); console.error(await page.evaluate(()=>({selectionLabel:document.querySelector('.desk-module-toolbar nav')?.textContent, notice:document.querySelector('.desk-notice')?.textContent,session:localStorage.getItem('garment-os/design-desk/v1')})));
  console.error(JSON.stringify(await state().catch(() => null)));
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  fs.writeFileSync(`${out}/browser.json`, JSON.stringify({ steps, errors, posts }, null, 2));
  await browser.close();
}
