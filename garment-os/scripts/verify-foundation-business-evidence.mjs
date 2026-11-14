/** Verify this business-fix scope, preserving prior snapshots and all acceptance boundaries. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='doc/evidence/foundation-business-20261111';
const read=file=>JSON.parse(fs.readFileSync(`${out}/${file}`,'utf8').replace(/^\uFEFF/,''));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const log=fs.readFileSync(`${out}/check.log`,'utf8'),testFiles=Number(log.match(/Test Files\s+(\d+) passed/)?.[1]),tests=Number(log.match(/Tests\s+(\d+) passed/)?.[1]);
assert.equal(testFiles,walk('src/test').filter(p=>/\.test\.tsx?$/.test(p)).length);assert(tests>=1209);assert.match(log,/built in/);assert.match(log,/"cycles": \[\]/);assert.match(log,/"violations": \[\]/);assert(!/error TS|FAIL|\d+ failed|\d+ skipped/.test(log));
const regressions=read('business-scenarios.json');assert.equal(regressions.scenarios.length,11);assert(regressions.scenarios.every(r=>r.passed));assert.equal(regressions.actualBrowserChecked,false);
const matrix=read('composition-matrix.json');assert.equal(matrix.cases.length,112);
assert.equal(matrix.cases.filter(c=>c.neckPreserved&&c.bodyContoursUnchanged).length,84);
assert.equal(matrix.cases.filter(c=>c.bothOrdersEqual&&c.unrelatedOptionsPreserved).length,28);
assert(matrix.cases.every(c=>c.productionApproved===false));
const stages=read('connection-stages.json');assert.equal(stages.cases.length,126);assert.equal(stages.cases.filter(c=>c.garment).length,10);
const native=read('native-worker.json'),business=read('business-worker/native-worker.json');
assert.equal(native.results.length,30);assert.equal(business.results.length,8);
for(const [worker,fixture,invalid]of [[native,read('worker-inputs.json'),6],[business,read('business-worker/worker-inputs.json'),2]]){
  assert.equal(worker.results.length,fixture.length);assert.equal(worker.results.filter(r=>r.rejectedAsExpected).length,invalid);
  assert(worker.results.filter(r=>!r.rejectedAsExpected).every(r=>r.displayBuffersTransferred&&r.canonicalVerticesRetained>0));assert.equal(worker.actualBrowserChecked,false);
}
assert(business.results.filter(r=>!r.rejectedAsExpected).every(r=>r.scenario.startsWith('business/')));
const renders=read('offline-validation.json');assert.equal(renders.results.length,25);assert(renders.results.every(r=>r.assemblyIntegrityPass&&r.productionApproved===false));
const http=read('http-status.json');assert.equal(http.length,6);assert(http.every(r=>r.status===200&&r.browserAcceptance===false));
for(const template of ['t-shirt','womens-basic-tee','elastic-waist-pants']){
  const work=read(`${template}-composed-workflow.json`);assert.equal(work.configuration.activePatternId,template);assert.equal(work.productionApproved,false);assert.equal(work.bom.lines.length,3);
  assert.equal(work.primaryCutQuantity,template==='elastic-waist-pants'?5:4);assert(!work.technical.pending.join(' ').includes('包条端头工艺'));
}
const files=[...walk('src'),...walk('dist'),...walk('scripts'),'README.md','package.json','package-lock.json','doc/基础款连续改款业务审查-20261111.md',...walk(out).filter(p=>path.resolve(p)!==path.resolve(out,'verification.json'))].sort();
const report={checkedAt:new Date().toISOString(),checks:{testFiles,tests,architecture:'passed',lint:'passed',typecheck:'passed',build:'passed',businessRegressionTests:15,compositionCases:112,sourceMeshCases:126,compiledWorkerCases:38,offlineAssetPresets:25,httpRoutes:6},
  fixedBusinessProblems:['换袖重置领口','裤长与脚口改款互相覆盖','基础款工作流默认误选背心','裤装草案误带包条工艺','缺少测量未指出字段','人体肩腕长度误标成品袖长'],
  browserAcceptance:false,remoteWritten:false,productionApproved:false,
  limitations:['胸贴袋和裤袋尚未接通','独立领条、插肩/落肩及裤装整件三维待补','设计中可保存组合，自定义命名结构资产尚无创建入口','面料物性、采购用量和生产放行待核定','浏览器页面与截图验收按用户安排暂缓'],
  files:files.map(file=>({path:file.split(path.sep).join('/'),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,files:undefined,hashedFiles:files.length},null,2));
