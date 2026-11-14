import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='doc/evidence/category-workbench-20261111';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const log=fs.readFileSync(`${out}/check.log`,'utf8');
const testFiles=Number(log.match(/Test Files\s+(\d+) passed/)?.[1]);
const tests=Number(log.match(/Tests\s+(\d+) passed/)?.[1]);
assert.equal(testFiles,50);assert.equal(tests,1010);
assert.match(log,/built in/);assert.match(log,/"cycles": \[\]/);assert.match(log,/"violations": \[\]/);
assert(!/error TS|FAIL|\d+ failed/.test(log));
const coverage=read(`${out}/coverage.json`);
assert.equal(coverage.counts.templates,7);assert.equal(coverage.counts.cadCategories,7);
assert.equal(coverage.counts.garment3dCategories,5);assert.equal(coverage.counts.companyOnlyCategories,2);
assert.equal(coverage.productionApproved,false);assert.equal(coverage.browserAcceptance,'deferred');
assert.equal(coverage.rows.length,coverage.counts.categories);
const http=read(`${out}/http-status.json`);assert.equal(http.length,4);assert(http.every(r=>r.status===200));
const research=read(`${out}/research-hashes.json`);
for(const f of research.files)assert.equal(createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=[...walk('src'),...walk('dist'),...walk('public'),...walk('scripts'),'README.md','package.json','package-lock.json','doc/品类与功能工作台-20261111.md',`${out}/coverage.json`,`${out}/research-hashes.json`,`${out}/check.log`,`${out}/http-status.json`].sort();
const report={checkedAt:new Date().toISOString(),checks:{testFiles,tests,architecture:'passed',lint:'passed',typecheck:'passed',build:'passed',http:'4/4'},
  coverage:coverage.counts,browserAcceptance:false,browserWorkflow:'prepared-not-run',productionApproved:false,
  limitations:['独立参考不等于整款CAD','曲面示意不等于布料物理仿真','浏览器操作截图暂缓','构建仍有既有大文件包提醒'],
  files:files.map(file=>({path:file.split(path.sep).join('/'),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({testFiles,tests,coverage:coverage.counts,hashedFiles:files.length,browserAcceptance:false,productionApproved:false},null,2));
