/** Real pointer/keyboard tests of the running app. Screenshots are actual UI, not generated drawings. */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const out = 'doc/evidence/reference-ui';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--window-size=1767,1131'] });
const results = [], errors = [];
const page = await browser.newPage();
await page.setViewport({ width: 1767, height: 1131 });
page.on('pageerror', e => errors.push(String(e)));
async function clickText(text) {
  for (const handle of await page.$$('button')) {
    if ((await handle.evaluate(el => el.textContent?.trim())) === text) {
      await handle.click(); return;
    }
    await handle.dispose();
  }
  throw new Error(`Button not found: ${text}`);
}
async function input(field, value) {
  const handle = await page.$(`[data-testid="reference-input-${field}"]`);
  assert(handle);
  await handle.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await handle.type(String(value));
  await handle.press('Tab');
}
async function shot(name) {
  const path = `${out}/${String(results.length + 1).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path });
  return { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
}
async function step(name, action) {
  await action();
  results.push({ name, pass: true, screenshot: await shot(name) });
  console.log(`PASS ${name}`);
}
const net = () => page.$eval('[data-testid="reference-preview"] [data-layer="net"]', e => e.getAttribute('d'));
try {
  await page.goto('http://localhost:5341/', { waitUntil: 'networkidle0', timeout: 30000 });
  await step('home-reference-canvas', async () => {
    await page.waitForFunction(() => document.querySelectorAll('#garment-sketch path').length > 0);
    assert((await page.$eval('body', e => e.textContent)).includes('Brian'));
  });
  await clickText('裁片库');
  await page.waitForSelector('[data-testid="brian-generator"]');
  await step('front-upstream-overlay', async () => {
    assert.equal(await page.$$eval('[data-testid^="reference-piece-"]', es => es.length), 3);
    assert.equal(await page.$eval('[data-testid="reference-preview"]', e => e.dataset.pieceId), 'front-body');
    assert.equal(await net(), await page.$eval('[data-layer="reference"]', e => e.getAttribute('d')));
    assert.equal(await page.$$eval('[data-pass="false"]', es => es.length), 0);
  });
  await step('back-upstream-overlay', async () => {
    await page.click('[data-testid="reference-piece-back-body"]');
    await page.waitForSelector('[data-testid="reference-preview"][data-piece-id="back-body"]');
    assert.equal(await net(), await page.$eval('[data-layer="reference"]', e => e.getAttribute('d')));
  });
  await step('sleeve-upstream-overlay', async () => {
    await page.click('[data-testid="reference-piece-sleeve"]');
    await page.waitForSelector('[data-testid="reference-preview"][data-piece-id="sleeve"]');
    assert.equal(await net(), await page.$eval('[data-layer="reference"]', e => e.getAttribute('d')));
    assert((await page.$eval('[data-testid="reference-dimensions"]', e => e.textContent)).includes('袖山曲线 5'));
  });
  await step('measured-shoulder-response', async () => {
    await page.click('[data-testid="reference-piece-front-body"]');
    const before = await net();
    await input('shoulderSlope', 18);
    await page.waitForFunction(d => document.querySelector('[data-layer="net"]')?.getAttribute('d') !== d, {}, before);
    assert.notEqual(await net(), before);
  });
  await step('empty-filter-removes-preview', async () => {
    // family + incompatible cut tags must not retain a previously selected preview.
    await page.click('[data-reference-tag="collar"]');
    await page.waitForSelector('[data-testid="reference-empty"]');
    assert.equal(await page.$('[data-testid="reference-preview"]'), null);
    assert.equal(await page.$$eval('[data-testid^="reference-piece-"]', es => es.length), 0);
  });
  await clickText('清除筛选');
  await step('sleeve-filter-only', async () => {
    await page.click('[data-reference-tag="sleeve"]');
    await page.waitForSelector('[data-testid="reference-preview"][data-piece-id="sleeve"]');
    assert.equal(await page.$$eval('[data-testid^="reference-piece-"]', es => es.length), 1);
  });
  await clickText('清除筛选');
  await step('invalid-measurement-blocks-output', async () => {
    await input('hpsToWaistBack', 0);
    await page.waitForSelector('[data-testid="reference-error"]');
    assert.equal(await page.$('[data-testid="reference-preview"]'), null);
    assert.equal(await page.$eval('[data-testid="reference-apply"]', e => e.disabled), true);
  });
  await page.click('[data-testid="load-reference-sample"]');
  await step('size-samples-visible', async () => {
    await page.waitForSelector('[data-testid="reference-preview"]');
    await clickText('多样本尺寸对照');
    await page.waitForSelector('[data-testid="reference-size-overlay"]');
    assert.equal(await page.$$eval('[data-size]', es => es.length), 7);
    const bounds = await page.$eval('[data-testid="reference-size-overlay"]', svg => {
      const vb = svg.viewBox.baseVal;
      return [...svg.querySelectorAll('path')].every(p => { const b = p.getBBox(); return b.x >= vb.x && b.y >= vb.y && b.x + b.width <= vb.x + vb.width && b.y + b.height <= vb.y + vb.height; });
    });
    assert.equal(bounds, true);
  });
  await clickText('返回单片');
  const referencePath = await net();
  await page.click('[data-testid="reference-apply"]');
  await clickText('裁片库');
  await step('applied-geometry-reaches-canvas', async () => {
    await page.waitForSelector('#garment-sketch');
    await page.waitForFunction(d => [...document.querySelectorAll('#garment-sketch path')].some(p => p.getAttribute('d')?.replace(/\s+/g, '') === d), {}, referencePath.replace(/\s+/g, ''));
    assert.equal(errors.length, 0, errors.join('\n'));
  });
  await step('pattern-board-shares-geometry', async () => {
    await clickText('Pattern');
    await page.waitForSelector('[data-testid="reference-pattern-board"]');
    assert.equal(await page.$$eval('[data-board-piece]', es => es.length), 3);
    assert.equal(await page.$eval('[data-board-source="front-body-reference-net"]', e => e.getAttribute('d')), referencePath);
  });
  await step('canvas-sleeve-filter', async () => {
    await clickText('裁片库');
    await page.waitForSelector('[data-testid="brian-generator"]');
    await page.click('[data-reference-tag="sleeve"]');
    await clickText('裁片库');
    await page.waitForSelector('#garment-sketch path[data-piece-category="sleeve"]');
    assert.equal(await page.$$eval('#garment-sketch path[data-piece-category="body"]', es => es.length), 0);
    assert.equal(await page.$$eval('[data-board-piece]', es => es.length), 1);
    assert.equal(await page.$eval('[data-board-piece]', e => e.getAttribute('data-board-piece')), 'sleeve:all');
  });
  await step('legacy-pattern-quarantined', async () => {
    await clickText('裁片库');
    await clickText('清除筛选');
    await clickText('裁片库');
    await page.click('[data-testid="template-t-shirt-pro"]');
    await page.waitForSelector('[data-testid="legacy-pattern-quarantine"]');
    await page.waitForFunction(() => document.querySelectorAll('#garment-sketch path[data-piece-category]').length === 0);
  });
  // Leave an actual front-piece comparison as the final review screen in evidence.
  await clickText('裁片库');
  await page.waitForSelector('[data-testid="brian-generator"]');
  await page.click('[data-testid="reference-apply"]');
  await step('final-front-comparison', async () => {
    await page.click('[data-testid="reference-piece-front-body"]');
    assert.equal(errors.length, 0);
  });
} catch (error) {
  results.push({ name: 'failure', pass: false, error: String(error), screenshot: await shot('failure') });
  process.exitCode = 1;
} finally {
  writeFileSync(`${out}/summary.json`, JSON.stringify({ url: 'http://localhost:5341/', generatedAt: new Date().toISOString(), productionApproved: false, results, browserErrors: errors }, null, 2));
  await browser.close();
}
