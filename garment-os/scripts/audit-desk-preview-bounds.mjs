import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = 'doc/evidence/design-desk-20261112'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage(); await page.goto('http://localhost:5341/', { waitUntil: 'networkidle0' });
  const results = await page.evaluate(async () => {
    const { newTeeBase } = await import('/src/application/tee-matrix.ts');
    const { DESK_DRAWING_SCALE } = await import('/src/application/design-desk.ts');
    const { draftStandard } = await import('/src/lib/pattern/reference/standard.ts');
    const { buildPanelMeshes } = await import('/src/lib/pattern/mesh/panel-mesh.ts');
    const { assembleGarment } = await import('/src/lib/pattern/mesh/garment-assembly.ts');
    const { createFinishedGarment } = await import('/src/lib/pattern/mesh/garment-finish.ts');
    const { garmentBounds } = await import('/src/lib/pattern/mesh/garment-view.ts');
    const results = [];
    for (const size of ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']) for (const fit of ['slim', 'regular', 'loose']) for (const sleeveLength of [.3, .65, 1]) {
      const c = newTeeBase(size); c.fit = fit; c.construction.options.sleeveLength = sleeveLength;
      const model = createFinishedGarment(assembleGarment(buildPanelMeshes(draftStandard('t-shirt', c.measurements, c.fit, c.construction))), { surface: { subdivision: 0, thicknessMm: .8, roundedEdges: true } });
      const b = garmentBounds(model), width = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) * DESK_DRAWING_SCALE, height = (b.max[1] - b.min[1]) * DESK_DRAWING_SCALE;
      results.push({ size, fit, sleeveLength, pixelsPerMm: DESK_DRAWING_SCALE, width, height, withinFrame: width < 480 && height < 460 });
    }
    return results;
  });
  fs.writeFileSync(`${out}/preview-frame-bounds.json`, JSON.stringify(results, null, 2));
  assert.equal(results.length, 63); assert(results.every(r => r.withinFrame));
  console.log(JSON.stringify({ cases: results.length, maxWidth: Math.max(...results.map(r => r.width)), maxHeight: Math.max(...results.map(r => r.height)), allWithinFrame: true }));
} finally { await browser.close(); }
