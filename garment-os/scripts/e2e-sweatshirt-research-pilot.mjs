import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

if (process.env.GARMENT_RUN_BROWSER_ACCEPTANCE !== '1') throw Error('浏览器验收尚待安排；确认允许执行后设置 GARMENT_RUN_BROWSER_ACCEPTANCE=1。');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = `doc/evidence/company-ui/sweatshirt-research-${stamp}`;
fs.mkdirSync(out, { recursive: true });
const results = [];
const errors = [];
let browser;
let page;

async function settle() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function clickButton(text) {
  let button;
  for (const candidate of await page.$$('button')) {
    if (await candidate.evaluate((element, expected) => element.textContent?.trim() === expected, text)) {
      button = candidate;
      break;
    }
    await candidate.dispose();
  }
  assert(button, `找不到按钮：${text}`);
  assert.equal(await button.evaluate(element => element.disabled), false, `按钮不可用：${text}`);
  await button.click();
  await button.dispose();
}

async function clickSelector(selector) {
  const element = await page.$(selector);
  assert(element, `找不到元素：${selector}`);
  await element.click();
  await element.dispose();
}

async function step(name, action) {
  await action();
  await settle();
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  results.push({ name, pass: true });
}

try {
  browser = await puppeteer.launch({ executablePath: process.env.GARMENT_E2E_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  page = await browser.newPage();
  await page.setViewport({ width: 1767, height: 1131 });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(process.env.GARMENT_E2E_URL ?? 'http://localhost:5341/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="workbench-shell"]');
  await clickSelector('[data-workbench-section="references"]');
  await settle();
  await clickButton('公司设计稿');
  await page.waitForSelector('[data-testid="company-design-board"]');

  await step('matrix-load', async () => {
    await clickButton('查看基款校正与改款矩阵');
    await page.waitForSelector('[data-testid="sweatshirt-pilot-content"]');
    const content = await page.$eval('[data-testid="sweatshirt-pilot-content"]', element => element.textContent ?? '');
    assert(content.includes('证据与机会判断'));
    assert.equal((await page.$$('[data-pilot-candidate]')).length, 4);
    assert(content.includes('机会候选'));
    assert(content.includes('来源阻断'));
    assert(await page.$('a[href$="design-matrix.md"]'));
    assert(await page.$('a[href$="design-matrix.png"]'));
    assert(await page.$('a[href$="competitor-benchmark.md"]'));
    const benchmark = await page.$eval('[data-testid="competitor-benchmark"]', element => element.textContent ?? '');
    assert(benchmark.includes('BELLA+CANVAS 3901'));
    assert(benchmark.includes('Carhartt Paxton 1/4 Zip'));
    assert(await page.$('[data-testid="competitor-benchmark"] a[href*="bellacanvas.com"]'));
  });

  await step('competitor-benchmark-display', async () => {
    await page.$eval('[data-testid="competitor-benchmark"]', element => element.scrollIntoView({ block: 'center' }));
    const cards = await page.$$('[data-testid="competitor-benchmark"] article');
    assert.equal(cards.length, 3);
    assert(await page.$('[data-testid="competitor-benchmark"] .competitor-sketch-raglan'));
    assert(await page.$('[data-testid="competitor-benchmark"] a[href*="39010311_1.jpg"]'));
    const visible = await page.$eval('[data-testid="competitor-benchmark"]', element => {
      const box = element.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
    assert.equal(visible, true);
  });

  await step('select-s1-opportunity', async () => {
    await clickButton('查看 S1');
    const row = await page.$('[data-pilot-candidate="S1"]');
    assert(row);
    assert.equal(await row.evaluate(element => element.getAttribute('aria-selected')), 'true');
    const active = await page.$eval('[data-testid="pilot-selected-candidate"]', element => element.textContent ?? '');
    assert(active.includes('FC063'));
    assert(active.includes('机会候选'));
    assert(active.includes('candidate-opportunity'));
    assert(active.includes('同版型样衣'));
  });

  await step('select-s2-visual-boundary', async () => {
    await clickButton('查看 S2');
    const active = await page.$eval('[data-testid="pilot-selected-candidate"]', element => element.textContent ?? '');
    assert(active.includes('视觉假设'));
    assert(active.includes('visual-hypothesis-only'));
    assert.equal(await page.$('[data-apply-pilot="S2"]'), null);
  });

  await step('select-q0-source-block', async () => {
    await clickButton('查看 Q0');
    const row = await page.$('[data-pilot-candidate="Q0"]');
    assert(row);
    assert.equal(await row.evaluate(element => element.getAttribute('aria-selected')), 'true');
    const active = await page.$eval('[data-testid="pilot-selected-candidate"]', element => element.textContent ?? '');
    assert(active.includes('来源阻断'));
    assert(active.includes('blocked-pending-source-pattern'));
    assert(active.includes('B23M2009'));
    assert.equal(await page.$('[data-apply-pilot="Q0"]'), null);
  });

  assert.deepEqual(errors, []);
} catch (error) {
  results.push({ name: 'failure', pass: false, error: String(error) });
  process.exitCode = 1;
  if (page) await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  fs.writeFileSync(`${out}/result.json`, JSON.stringify({ results, errors, browserAcceptance: results.every(result => result.pass) && !errors.length, productionApproved: false }, null, 2));
  await browser?.close();
  console.log(JSON.stringify({ out, results, errors }, null, 2));
}
