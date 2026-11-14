/**
 * ─────────────────────────────────────────────────────────────
 *  端到端自动化验证工作流 (E2E Verify)
 * ─────────────────────────────────────────────────────────────
 *  真实浏览器操作 + 每步 DOM 断言 + 每步截图。
 *  运行: node scripts/e2e-verify.mjs  (需 dev server @ :5341)
 *  结果: scripts/e2e-shots/*.png + summary.json
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'scripts/e2e-shots';
mkdirSync(OUT, { recursive: true });

const results = [];
let shotN = 0;
async function shot(page, name) {
  shotN++;
  const file = `${OUT}/${String(shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  return file;
}
function record(step, pass, detail) {
  results.push({ step, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${step}  ${detail}`);
}

/** 点击包含指定文本的按钮 */
async function clickButtonWithText(page, text) {
  const ok = await page.evaluate((t) => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((el) => el.textContent?.includes(t));
    if (b) { b.click(); return true; }
    return false;
  }, text);
  if (!ok) throw new Error(`找不到按钮: ${text}`);
  await new Promise((r) => setTimeout(r, 400));
}

/** 主画布 path 数 */
async function sketchPathCount(page) {
  return page.evaluate(() => document.querySelectorAll('#garment-sketch path').length);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1680,1050'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1000 });
  await page.goto('http://localhost:5341/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  // ── V1 主界面加载 + 画布渲染 ──
  const hasSketch = await page.$('#garment-sketch') !== null;
  const basePaths = hasSketch ? await sketchPathCount(page) : 0;
  record('V1 主界面加载, 成衣画布渲染', hasSketch && basePaths > 0, `画布 path=${basePaths}`);
  await shot(page, 'home');

  // ── V2 打开裁片库 → QC 列表 ──
  await clickButtonWithText(page, '裁片库');
  await new Promise((r) => setTimeout(r, 600));
  const qcCount = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => /×\d*|✓|✕/.test(b.textContent ?? '') && b.textContent?.includes('mm')).length);
  record('V2 裁片库打开, QC 列表渲染', qcCount >= 2, `裁片项=${qcCount}`);
  await shot(page, 'qc-list');

  // ── V3 点选袖片 → 详情预览 + CAD 检验项 ──
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((el) => el.textContent?.includes('袖片'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const hasChecks = await page.evaluate(() => document.body.textContent?.includes('CAD 检验项') ?? false);
  record('V3 裁片详情 + CAD 检验项', hasChecks, '检验面板渲染');
  await shot(page, 'piece-detail');

  // ── V4 生成器 tab → 7 裁片卡 ──
  await clickButtonWithText(page, '裁片生成器');
  await new Promise((r) => setTimeout(r, 500));
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('div')].filter((d) => d.textContent?.includes('毛样') && d.textContent?.includes('边') && d.style.borderRadius).length);
  record('V4 生成器打开, 裁片卡渲染', cards >= 5, `裁片卡=${cards}`);
  await shot(page, 'generator');

  // ── V5 关键数据驱动: 改胸围 → 半胸宽联动 ──
  const before5 = await page.evaluate(() => document.body.textContent?.match(/半胸围线宽\s*(\d+)/)?.[1]);
  await page.evaluate(() => {
    const inp = [...document.querySelectorAll('input[type=number]')].find((i) => {
      const slider = i.closest('div')?.parentElement?.querySelector('input[type=range]');
      return !!slider || i.value === '980' || i.value === '970' || Number(i.value) > 900;
    });
    if (inp) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, '1250');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 600));
  const after5 = await page.evaluate(() => document.body.textContent?.match(/半胸围线宽\s*(\d+)/)?.[1]);
  record('V5 关键数据驱动尺寸', !!before5 && !!after5 && before5 !== after5, `半胸宽 ${before5}→${after5}`);
  await shot(page, 'generator-keydata');

  // ── V6 推档: 尺码叠加图 ──
  await clickButtonWithText(page, '推档');
  await new Promise((r) => setTimeout(r, 500));
  const nestPaths = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    for (const s of svgs) {
      const paths = s.querySelectorAll('path[stroke]');
      const texts = [...s.querySelectorAll('text')].filter((t) => /^(S|M|L|XL|XS|XXL|XXXL)$/.test(t.textContent ?? ''));
      if (texts.length >= 3) return { paths: paths.length, texts: texts.length };
    }
    return { paths: 0, texts: 0 };
  });
  record('V6 推档叠加图 (多尺码)', nestPaths.texts >= 3 && nestPaths.paths >= 3, `尺码标签=${nestPaths.texts} 套叠path=${nestPaths.paths}`);
  await shot(page, 'grading');

  // ── V7 QC 标签筛选: 袖类 → 列表只剩袖片 ──
  await clickButtonWithText(page, '裁片检验');
  await new Promise((r) => setTimeout(r, 400));
  const before7 = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => /×\d*|✓|✕/.test(b.textContent ?? '') && b.textContent?.includes('mm')).length);
  await clickButtonWithText(page, '袖类');
  await new Promise((r) => setTimeout(r, 500));
  const after7 = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => /×\d*|✓|✕/.test(b.textContent ?? '') && b.textContent?.includes('mm')).length);
  const filteredNames = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => /×\d*|✓|✕/.test(b.textContent ?? '') && b.textContent?.includes('mm'))
      .map((b) => b.textContent?.trim().split('\n')[0]?.replace(/[×✓✕]\s*\d*\s*mm.*/g, '').trim())
  );
  record('V7 标签筛选: 袖类 → 列表只剩袖片', after7 < before7 && after7 >= 1, `剩余=${JSON.stringify(filteredNames)}`);
  await shot(page, 'tag-filter');

  // ── V8 画布跟随筛选: 只显示袖片 ──
  await clickButtonWithText(page, '裁片库'); // 关闭裁片库视图
  await new Promise((r) => setTimeout(r, 600));
  const sleeveOnly = await sketchPathCount(page);
  record('V8 画布跟随筛选: 只渲染袖片', sleeveOnly > 0 && sleeveOnly < basePaths, `画布 path ${basePaths}→${sleeveOnly}`);
  await shot(page, 'canvas-sleeve-only');

  // ── V9 清除筛选 → 画布恢复 ──
  await clickButtonWithText(page, '裁片库');
  await new Promise((r) => setTimeout(r, 500));
  await clickButtonWithText(page, '清除标签筛选');
  await new Promise((r) => setTimeout(r, 500));
  await clickButtonWithText(page, '裁片库'); // 关闭
  await new Promise((r) => setTimeout(r, 600));
  const restored = await sketchPathCount(page);
  record('V9 清除筛选 → 画布恢复全部', restored === basePaths, `画布 path ${restored}/${basePaths}`);
  await shot(page, 'canvas-restored');

} catch (err) {
  record('EXCEPTION', false, String(err).slice(0, 200));
} finally {
  await browser.close();
}

const pass = results.filter((r) => r.pass).length;
console.log(`\n═══ E2E 结果: ${pass}/${results.length} 通过 ═══`);
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ pass, total: results.length, results }, null, 2));
process.exit(pass === results.length ? 0 : 1);

