/** Evidence assembly only; does not launch a browser or approve appearance. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='doc/evidence/garment-construction-20261111',read=p=>JSON.parse(fs.readFileSync(`${out}/${p}`,'utf8')),log=fs.readFileSync(`${out}/check.log`,'utf8'),testFiles=log.match(/Test Files\s+(\d+) passed \((\d+)\)/),tests=log.match(/Tests\s+(\d+) passed \((\d+)\)/);
assert(testFiles&&tests&&/built in/.test(log),'Complete npm run check evidence required');assert.equal(testFiles[1],testFiles[2]);assert.equal(tests[1],tests[2]);assert(/"cycles": \[\]/.test(log)&&/"violations": \[\]/.test(log));
const offline=read('offline-validation.json'),garment=read('garment-worker/native-worker.json'),mesh=read('mesh-worker/native-worker.json'),benchmark=read('cpu-benchmark.json');
assert.equal(offline.kind,'shared-software-viewport-depth-raster-and-orthographic-views');assert.equal(offline.renders,6);assert.equal(garment.results.length,4);assert.equal(mesh.results.length,8);assert(garment.results.filter(r=>!r.rejectedAsExpected).every(r=>r.sourcePaths&&r.openingRoles.length===4));
const files=[
 ...fs.readdirSync('src/lib/pattern/mesh').filter(n=>n.startsWith('garment-')&&n.endsWith('.ts')).map(n=>`src/lib/pattern/mesh/${n}`),
 ...fs.readdirSync('src/features/piece-library').filter(n=>/^(Garment.*\.tsx|garment-.*\.ts)$/.test(n)).map(n=>`src/features/piece-library/${n}`),
 'src/types/garment3d.ts','src/test/garment-construction.test.ts','src/test/garment-ui.test.tsx','src/test/garment-raster.test.ts',
 'scripts/render-garment-construction.mjs','scripts/benchmark-garment-construction.mjs','scripts/e2e-garment-assembly.mjs',
 'dist/.vite/manifest.json',`dist/${garment.entry}`,`dist/assets/${garment.bundle}`,`dist/assets/${mesh.bundle}`,
 `${out}/check.log`,`${out}/offline-validation.json`,`${out}/cpu-benchmark.json`,`${out}/garment-worker/native-worker.json`,`${out}/mesh-worker/native-worker.json`,
 ...['brian-reference','t-shirt'].flatMap(id=>['after-depth.png','neck-depth.png','back-depth.png','technical.png','plan.json'].map(s=>`${out}/${id}-${s}`)),`${out}/construction-overview.png`
];
const fingerprints=[...new Set(files)].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={kind:'current-construction-engineering-evidence',generatedAt:new Date().toISOString(),checks:{testFiles:Number(testFiles[1]),tests:Number(tests[1]),architecture:true,lint:true,build:true,nativeGarmentWorkerCases:garment.results.length,nativePieceWorkerCases:mesh.results.length},offline:{renders:offline.renders,technicalSheets:offline.technicalViewSheets,sharedSoftwareViewport:true},benchmark:benchmark.results,fingerprints,browserWorkflowExecuted:false,visualAcceptance:false,hardwareGpuFpsMeasured:false,materialValidated:false,drapeValidated:false,productionApproved:false};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,fingerprints:`${fingerprints.length} files`},null,2));
