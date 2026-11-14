/** Current foundation scope: numeric/source/component checks, with no browser or manufacturing approval. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='doc/evidence/foundation-blocks-20261111';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const log=fs.readFileSync(`${out}/check.log`,'utf8'),testFiles=Number(log.match(/Test Files\s+(\d+) passed/)?.[1]),tests=Number(log.match(/Tests\s+(\d+) passed/)?.[1]);
assert.equal(testFiles,walk('src/test').filter(p=>/\.test\.tsx?$/.test(p)).length);assert(tests>=1194);
assert.match(log,/built in/);assert.match(log,/"cycles": \[\]/);assert.match(log,/"violations": \[\]/);assert(!/error TS|FAIL|\d+ failed|\d+ skipped/.test(log));
const coverage=read(`${out}/coverage.json`),stages=read(`${out}/connection-stages.json`),source=read(`${out}/source-matrix.json`),native=read(`${out}/native-worker.json`),renders=read(`${out}/offline-validation.json`),projection=read(`${out}/svg-projection/verification.json`);
assert.deepEqual(coverage.counts,stages.counts);assert.equal(coverage.counts.templates,9);assert.equal(stages.cases.length,126);
assert.equal(stages.cases.filter(c=>c.garment).length,10);assert.equal(stages.rows.length,45);
assert(stages.rows.every(r=>r.browser.status==='deferred'&&r.production.status==='not-approved'&&r.remoteSync.status==='not-performed'));
assert.equal(source.cases.length,60);assert(source.cases.every(c=>c.sourceEqual&&c.manufacturingApproved===false));
assert.equal(source.cases.filter(c=>c.template==='elastic-waist-pants'&&c.cutlistEqual&&c.meshPanels===5).length,42);
assert.equal(source.cases.filter(c=>c.unchangedBody&&c.unchangedSleeveCap).length,18);
assert.equal(source.cases.filter(c=>c.module==='tapered-sleeve'&&c.actualHemWidthMm<c.baseHemWidthMm).length,6);
const fixtures=read(`${out}/worker-inputs.json`);assert.equal(native.results.length,fixtures.length);assert.equal(native.results.length,30);
assert.equal(native.results.filter(r=>r.rejectedAsExpected).length,6);assert.equal(native.results.filter(r=>r.scenario).length,6);
assert(native.results.filter(r=>!r.rejectedAsExpected).every(r=>r.displayBuffersTransferred&&r.canonicalVerticesRetained>0));
assert.equal(native.actualBrowserChecked,false);assert.equal(native.hardwareGpuFpsMeasured,false);
assert.equal(renders.mode,'offline-source-SVG');assert.equal(renders.results.length,25);assert(renders.results.every(r=>r.assemblyIntegrityPass&&r.productionApproved===false));
assert.equal(projection.kind,'offline-react-svg-render');assert.equal(projection.results.length,27);assert(projection.results.every(r=>r.unchangedSource&&r.browserScreenshot===false));
const research=read('research/foundation-blocks-20261111/native-contracts.json');for(const f of research.sources)assert.equal(sha(f.path),f.sha256);
const candidates=read(`${out}/element-registration-candidates.json`);assert.equal(candidates.componentContracts.length,5);assert.equal(candidates.remoteWritten,false);assert.equal(candidates.methods.length,4);
const http=read(`${out}/http-status.json`);assert(http.length>=3&&http.every(r=>r.status===200));
const files=[...walk('src'),...walk('dist'),...walk('scripts'),'README.md','package.json','package-lock.json','doc/基础T恤与裤装模块化-20261111.md',...walk('research/foundation-blocks-20261111'),...walk(out).filter(p=>path.resolve(p)!==path.resolve(out,'verification.json'))].sort();
const report={checkedAt:new Date().toISOString(),checks:{testFiles,tests,architecture:'passed',lint:'passed',typecheck:'passed',build:'passed',independentPantsCases:42,independentSleeveCases:18,sourceMeshCases:126,nativeWorkerCases:native.results.length,offlineAssetPresets:25,offlineComponentRenders:27},coverage:coverage.counts,
  browserAcceptance:false,hardwareGpuFpsMeasured:false,remoteWritten:false,productionApproved:false,
  limitations:['胸贴袋、裤袋尚未开放','T恤仅支持装袖短袖比例变化；落肩、插肩等需专用衣身接口','独立领条净样、腰头完成态及裤装成衣3D尚未接通','浏览器验收按用户安排暂缓；没有物理仿真与生产批准'],
  files:files.map(file=>({path:file.split(path.sep).join('/'),sha256:sha(file)}))};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,files:undefined,hashedFiles:files.length},null,2));
