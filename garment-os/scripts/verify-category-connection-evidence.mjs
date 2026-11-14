/** Bind current checks, runtime audit, native worker and offline renders into one reproducible manifest. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out=process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/category-connection-20261111';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const log=fs.readFileSync(`${out}/check.log`,'utf8');
const testFiles=Number(log.match(/Test Files\s+(\d+) passed/)?.[1]),tests=Number(log.match(/Tests\s+(\d+) passed/)?.[1]);
assert.equal(testFiles,walk('src/test').filter(p=>/\.test\.tsx?$/.test(p)).length);assert(tests>1000);
assert.match(log,/built in/);assert.match(log,/"cycles": \[\]/);assert.match(log,/"violations": \[\]/);assert(!/error TS|FAIL|\d+ failed|\d+ skipped/.test(log));
const coverage=read(`${out}/coverage.json`),stages=read(`${out}/connection-stages.json`),source=read(`${out}/sandy-source-matrix.json`),native=read(`${out}/native-worker.json`),renders=read(`${out}/offline-validation.json`),http=read(`${out}/http-status.json`);
assert.deepEqual(coverage.counts,stages.counts);assert.equal(stages.rows.length,coverage.counts.categories);
assert.equal(stages.cases.length,coverage.counts.templates*14);assert.equal(stages.cases.filter(c=>c.garment).length,coverage.counts.garment3dCategories*2);
assert.equal(stages.rows.filter(r=>r.cad.status==='sample-checked').length,coverage.counts.cadCategories);
assert.equal(stages.rows.filter(r=>r.garment3d.status==='illustration-sample-checked').length,coverage.counts.garment3dCategories);
assert(stages.rows.every(r=>r.browser.status==='deferred'&&r.production.status==='not-approved'&&r.remoteSync.status==='not-performed'));
assert.equal(source.source,'@freesewing/sandy@4.10.2');assert.equal(source.cases.length,42);assert(source.cases.every(c=>c.sourceContoursEqual&&c.sourcePointsEqual&&c.sourceCutlistEqual&&c.allEdgesClassified&&c.productionApproved===false));
const workerInputs=read(`${out}/worker-inputs.json`);assert.equal(native.results.length,workerInputs.length);
assert(native.results.filter(r=>!r.rejectedAsExpected).every(r=>r.displayBuffersTransferred));assert.equal(native.results.filter(r=>r.rejectedAsExpected).length,3);
assert.equal(native.actualBrowserChecked,false);assert.equal(native.hardwareGpuFpsMeasured,false);
assert.equal(renders.mode,'offline-source-SVG');assert.equal(renders.results.filter(r=>r.id.startsWith('skirt-')).length,3);
const projection=read(`${out}/svg-projection/verification.json`);assert.equal(projection.kind,'offline-react-svg-render');assert.equal(projection.results.length,coverage.counts.templates*3);
assert(projection.results.every(r=>r.unchangedSource&&r.browserScreenshot===false));
assert(http.length>=4&&http.every(r=>r.status===200));
for(const name of ['sandy','penelope'])for(const f of read(`research/category-connection-20261111/${name}-probe.json`).sources)assert.equal(createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);
const files=[...walk('src'),...walk('dist'),...walk('scripts'),'README.md','package.json','package-lock.json','doc/品类持续接通与圆裙验收-20261111.md',...walk('research/category-connection-20261111'),...walk(out).filter(p=>path.resolve(p)!==path.resolve(out,'verification.json'))].sort();
const report={checkedAt:new Date().toISOString(),checks:{testFiles,tests,architecture:'passed',lint:'passed',typecheck:'passed',build:'passed',sourceMeshCases:stages.cases.length,independentSkirtCases:source.cases.length,garmentIllustrationCases:stages.cases.filter(c=>c.garment).length,nativeWorkerCases:native.results.length,offlineComponentRenders:projection.results.length,http:http.length},coverage:coverage.counts,
  browserAcceptance:false,hardwareGpuFpsMeasured:false,remoteWritten:false,productionApproved:false,
  limitations:[`${coverage.counts.definitionOnlyCategories}类尚无整款CAD`,'圆裙未实现整件成衣映射、开口及翻折完成态','成衣曲面是示意，没有材料物理仿真与人台试穿','真实浏览器与截图验收暂缓'],
  files:files.map(file=>({path:file.split(path.sep).join('/'),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,files:undefined,hashedFiles:files.length},null,2));
