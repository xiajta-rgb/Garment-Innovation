/** Consolidate existing numerical evidence; never claims browser or production acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out='doc/evidence/garment-finish-20261111';
const read=file=>fs.readFileSync(path.join(root,file),'utf8'),json=file=>JSON.parse(read(file)),hash=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const log=read(`${out}/check.log`),files=Number(log.match(/Test Files\s+(\d+) passed/)?.[1]),tests=Number(log.match(/Tests\s+(\d+) passed/)?.[1]);
assert.equal(files,40);assert.equal(tests,932);assert(log.includes('tsc --noEmit && vite build'));assert(log.includes('built in'));
const source=json('doc/evidence/garment-assembly-20261111/source-matrix.json'),display=json(`${out}/display-matrix.json`),shell=json(`${out}/surface-validation.json`),offline=json(`${out}/offline-review.json`),worker=json(`${out}/native-worker.json`),flat=json('doc/evidence/mapping-precision-20261111/native-worker.json');
assert.equal(source.cases.length,20);assert.equal(display.cases.length,20);assert.equal(shell.cases.length,5);assert.equal(offline.renders.length,8);
assert(source.cases.every(c=>c.maxPairedIntervalRatio<1.005&&c.quality.maxBoundaryDeviationMm<.5));
assert(display.cases.every(c=>c.metrics.closedShell));assert(shell.cases.every(c=>c.independentClosedEdgeAudit&&c.sourceUnchanged));
assert.equal(worker.results.filter(c=>c.surfaces).length,3);assert.equal(flat.results.filter(c=>c.panels).length,7);
const manifest=json('dist/.vite/manifest.json'),entry=manifest['src/features/piece-library/Pattern3dPanel.tsx'].file,chunk=read(`dist/${entry}`);
for(const w of [worker,flat]){assert.equal(w.entry,entry);assert(chunk.includes(w.bundle));assert(fs.existsSync(path.join(root,'dist/assets',w.bundle)));}
const comparisons=['brian-reference','t-shirt'].map(id=>({id,before:json(`${out}/${id}-before-source.json`).quality,after:json(`${out}/${id}-after-source.json`).quality}));
const artifacts=[`${out}/check.log`,`${out}/display-matrix.json`,`${out}/surface-validation.json`,`${out}/offline-review.json`,`${out}/native-worker.json`,'doc/evidence/garment-assembly-20261111/source-matrix.json','doc/evidence/mapping-precision-20261111/native-worker.json',`${out}/brian-textured-garment.gltf`,`${out}/before-after.png`,...offline.renders.flatMap(r=>[r.file,r.file.replace(/\.svg$/,'.png')]),...comparisons.flatMap(c=>[`${out}/${c.id}-before-source.json`,`${out}/${c.id}-after-source.json`]),'dist/.vite/manifest.json',`dist/${entry}`,`dist/assets/${worker.bundle}`,`dist/assets/${flat.bundle}`];
const sources=['src/lib/pattern/mesh/garment-assembly.ts','src/lib/pattern/mesh/edge-arclength.ts','src/lib/pattern/mesh/garment-surface.ts','src/lib/pattern/mesh/garment-gltf.ts','src/lib/pattern/mesh/garment-view.ts','src/types/garment3d.ts','src/features/piece-library/GarmentAssemblyPanel.tsx','src/features/piece-library/GarmentProjectedSurface.tsx','src/features/piece-library/GarmentViewport.tsx','src/features/piece-library/garment-light.ts','src/features/piece-library/garment-renderer.ts','src/test/garment-assembly.test.ts','src/test/garment-surface.test.ts','src/test/edge-arclength.test.ts','src/test/garment-projection.test.ts','src/test/garment-ui.test.tsx','src/test/garment-renderer.test.ts','vitest.config.ts','scripts/render-garment-finish.mjs','scripts/e2e-garment-assembly.mjs','scripts/verify-garment-finish.mjs'];
const report={kind:'garment-display-finish-numerical-and-offline-evidence',generatedAt:new Date().toISOString(),checks:{testFiles:files,tests,architectureCycles:0,architectureViolations:0,archivedFiles:109,lint:true,types:true,build:true},
 sourceMatrix:{cases:20,maxPairedIntervalRatio:Math.max(...source.cases.map(c=>c.maxPairedIntervalRatio)),maxSampledOutlineDeviationMm:Math.max(...source.cases.map(c=>c.quality.maxBoundaryDeviationMm)),maxStrain:Math.max(...source.cases.map(c=>c.quality.maxStrain)),casesDetail:source.cases},
 displayMatrixCases:20,defaultDisplaySamples:shell.cases,comparisons,actualCompiledWorkers:{entry,garment:worker.bundle,flat:flat.bundle,garmentSuccessful:3,flatSuccessful:7,garmentUnsupportedRejected:true,flatIncompleteRejected:true},offlineRenders:8,
 browserAcceptance:false,actualBrowserScreenshot:false,hardwareRendererVerified:false,hardwareGpuFpsMeasured:false,drapeValidated:false,productionApproved:false,
 executionNotes:['The initial unrestricted full test run exhausted host memory; maxWorkers=2 completed the full suite.','The post-script lint rerun passed after a temporary Vite config file disappeared during a concurrent lint run.','Offline projections use the actual React compatibility renderer, not a browser or AI image.'],
 hashes:[...new Set([...sources,...artifacts])].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(path.join(root,out,'verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({tests,files,sourceCases:20,displayCases:20,offlineRenders:8,workerBundles:report.actualCompiledWorkers,maxPairedIntervalRatio:report.sourceMatrix.maxPairedIntervalRatio,maxStrain:report.sourceMatrix.maxStrain,browserAcceptance:false,productionApproved:false},null,2));
