import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const out = 'doc/evidence/tee-foundation-20261112'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage(), errors = [], submissions = [], steps = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => { if (r.method() === 'POST') submissions.push(r.url()); });
const record = name => { steps.push({ name, pass: true }); console.log(name); };
const click = async label => { for (const b of await page.$$('button')) if ((await b.evaluate(e => e.textContent)).includes(label)) { await b.click(); return; } throw Error('Missing ' + label); };
try {
  await page.setViewport({ width: 1600, height: 1050 });
  await page.goto('http://localhost:5341/?workspace=foundation', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="tee-foundation-studio"]');
  const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /tee|mens-tee/.test(k)).map(k => [k, localStorage.getItem(k)])));
  assert.equal(await page.$$eval('[data-foundation-piece]', es => es.length), 3);
  assert.equal(await page.$$eval('[data-flat-preview],[data-design-card]', es => es.length), 0);
  assert(await page.$eval('.foundation-use', e => !e.disabled));
  record('default-withdraws-unsupported-flats-and-shows-three-real-source-patterns');
  await click('采用此主体组合'); await page.waitForSelector('[data-combination-selection]');
  record('set-in-selection-confirms-exact-body-and-sleeve-cut-inventory');
  await click('袖山与前后袖窿');
  assert.equal(await page.$$eval('[data-join="sleevecap-left"][opacity="1"]', es => es.length), 3);
  await click('右袖山与前后袖窿');
  assert.equal(await page.$$eval('[data-join="sleevecap-right"][opacity="1"]', es => es.length), 3);
  await page.screenshot({ path: `${out}/set-in-source-pieces.png`, fullPage: true });
  await click('右袖山与前后袖窿');
  await page.select('[aria-label="基础库参考尺码"]', 'XS');
  assert.equal(await page.$$eval('[data-combination-selection]', es => es.length), 0);
  const xs = await page.$eval('[data-foundation-piece="teagan.sleeve"]>path', e => e.getAttribute('d'));
  await page.select('[aria-label="基础库参考尺码"]', 'M');
  assert.notEqual(await page.$eval('[data-foundation-piece="teagan.sleeve"]>path', e => e.getAttribute('d')), xs);
  record('sample-size-rebuilds-real-geometry-and-clears-stale-selection');
  await click('插肩结构'); await page.waitForSelector('[data-foundation-cad="raglan"]');
  assert.equal(await page.$$eval('[data-foundation-piece="hugo.sleeve"] [data-boundary="neck"]', es => es.length), 1);
  assert.equal(await page.$$eval('[data-boundary="shoulder"],[data-boundary="cap"]', es => es.length), 0);
  assert(await page.$eval('.foundation-use', e => e.disabled));
  await click('前插肩配缝');
  assert.equal(await page.$$eval('[data-join="raglan-front"][opacity="1"]', es => es.length), 2);
  await page.screenshot({ path: `${out}/raglan-front-interface.png`, fullPage: true });
  await click('后插肩配缝');
  assert.equal(await page.$$eval('[data-join="raglan-back"][opacity="1"]', es => es.length), 2);
  await page.screenshot({ path: `${out}/raglan-back-interface.png`, fullPage: true });
  record('real-raglan-sleeve-includes-neck-segment-and-separate-front-back-seams-with-selection-blocked');
  const downloads = fs.mkdtempSync(path.join(out, 'downloads-')), cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve(downloads) });
  await click('导出核对记录');
  const filename = '裁片基础库-raglan-M-核对记录.json';
  for (let i = 0; i < 50 && !fs.existsSync(path.join(downloads, filename)); i++) await new Promise(r => setTimeout(r, 100));
  const downloaded = JSON.parse(fs.readFileSync(path.join(downloads, filename), 'utf8'));
  assert.equal(downloaded.selectable, false); assert.equal(downloaded.productionApproved, false); assert.equal(downloaded.pieces.length, 3);
  assert(downloaded.sourceSettings.measurements.chest > 0); assert.equal(downloaded.sourceSettings.sa, 10);
  fs.copyFileSync(path.join(downloads, filename), path.join(out, filename));
  const audit = await page.evaluate(async () => {
    const { buildTeeFoundation, requireTeeFoundationCombination } = await import('/src/application/tee-foundation.ts');
    const result = {};
    for (const family of ['set-in', 'raglan', 'drop']) {
      const d = buildTeeFoundation(family); let selectionBlocked = false;
      try { requireTeeFoundationCombination(d, d.pieces.map(p => p.id)); } catch { selectionBlocked = true; }
      result[family] = { source: d.source, report: d.report, blockers: d.blockers, selectionBlocked };
    }
    const d = buildTeeFoundation('set-in'); let mixBlocked = false;
    try { requireTeeFoundationCombination(d, ['teagan.front', 'teagan.back', 'hugo.sleeve']); } catch { mixBlocked = true; }
    return { ...result, mixBlocked };
  });
  assert.equal(audit.mixBlocked, true); assert.equal(audit.raglan.selectionBlocked, true); assert.equal(audit.drop.selectionBlocked, true);
  fs.writeFileSync(`${out}/source-audit.json`, JSON.stringify(audit, null, 2));
  record('download-is-an-audit-record-and-application-rejects-cross-family-mixing');
  await click('落肩短T'); assert.equal(await page.$$eval('[data-foundation-piece]', es => es.length), 0);
  assert(await page.$eval('.foundation-use', e => e.disabled));
  await page.screenshot({ path: `${out}/drop-shoulder-missing-source.png`, fullPage: true });
  record('missing-drop-shoulder-method-remains-explicit-with-no-fabricated-patterns');
  await page.setViewport({ width: 390, height: 844 });
  await click('插肩结构');
  assert(await page.$eval('.tee-foundation', e => e.getBoundingClientRect().width <= 390));
  assert(await page.$eval('.foundation-workspace aside', e => e.getBoundingClientRect().right <= 390));
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /tee|mens-tee/.test(k)).map(k => [k, localStorage.getItem(k)]))), before);
  record('mobile-scroll-and-existing-selection-storage-preserved');
  assert.deepEqual(errors, []); assert.deepEqual(submissions, []);
} catch (e) { steps.push({ pass: false, error: String(e) }); console.error(e); process.exitCode = 1; await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {}); }
finally { fs.writeFileSync(`${out}/browser.json`, JSON.stringify({ steps, errors, submissions }, null, 2)); await browser.close(); }
