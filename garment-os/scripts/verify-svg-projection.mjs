/** Offline rendering of the actual compatibility component; NOT browser screenshots. */
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';

const out = process.argv[2] ?? 'doc/evidence/svg-projection-20261111';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const [{ ProjectedMesh }, { createPattern3d }, { getReferenceMeasurements }, { fitPhysicalCamera,framePhysicalCamera },{listExecutablePatterns},{getAssemblyDefinition}] = await Promise.all([
    server.ssrLoadModule('/src/features/piece-library/ProjectedMesh.tsx'),
    server.ssrLoadModule('/src/application/pattern-3d.ts'),
    server.ssrLoadModule('/src/data/referenceMeasurements.ts'),
    server.ssrLoadModule('/src/lib/pattern/mesh/viewport-mapping.ts'),
    server.ssrLoadModule('/src/data/patternLibrary.ts'),
    server.ssrLoadModule('/src/data/assemblyPlans.ts'),
  ]);
  const results = [];
  for (const {id:template} of listExecutablePatterns()) {
    const count=getAssemblyDefinition(template).pieces.reduce((n,p)=>n+p.quantity,0);
    const model = createPattern3d({ activePatternId: template, gender: 'male', standardSize: 'M', fit: 'regular',
      measurements: getReferenceMeasurements('male', 'M'), engineVersion: '4.10.2', garmentColor: '#ffffff', fabricId: 'solid' });
    const source = JSON.stringify(model), size = { width: 1100, height: 620, dpr: 1 };
    const baseCamera = fitPhysicalCamera(model, size);
    let previous = '';
    for (const yawDeg of [25, 65, -35]) {
      const content = renderToStaticMarkup(createElement(ProjectedMesh, { model, camera: framePhysicalCamera(model,size,{...baseCamera,yawDeg}), size,
        visible: model.panels.map(p => p.id), selected: model.panels[0].id, wire: false, seams: false, anchors: [] }));
      assert.equal((content.match(/data-projected-panel=/g) ?? []).length, count);
      assert(!/NaN|Infinity/.test(content));
      assert.notEqual(content, previous);
      assert.equal(JSON.stringify(model), source);
      previous = content;
      const file = path.join(out, `${template}-${yawDeg}.svg`);
      writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="620" viewBox="0 0 1100 620"><rect width="1100" height="620" fill="#25262a"/>${content}</svg>`);
      results.push({ template, yawDeg, panels: count, unchangedSource: true, artifact: file, browserScreenshot: false });
    }
  }
  writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ kind: 'offline-react-svg-render', results }, null, 2));
  console.log(JSON.stringify({ kind: 'offline-react-svg-render', renders: results.length, results }, null, 2));
} finally {
  await server.close();
}
