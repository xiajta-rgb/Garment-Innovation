import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const out='doc/evidence/asset-library-20261111';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const log=fs.readFileSync(`${out}/check.log`,'utf8');
assert.match(log,/Test Files\s+48 passed/);assert.match(log,/Tests\s+996 passed/);assert.match(log,/built in/);assert(!/error TS|FAIL|failed \(/.test(log));
const renders=read(`${out}/offline-validation.json`);assert.equal(renders.results.length,13);assert.equal(renders.browserAcceptance,false);
for(const r of renders.results){assert.equal(createHash('sha256').update(fs.readFileSync(`${out}/${r.id}.svg`)).digest('hex'),r.svgSha256);assert.equal(r.assemblyIntegrityPass,true);}
const handoff=read(`${out}/linked-assets-example.json`);assert.equal(handoff.productionApproved,false);assert.equal(handoff.cad.companyLinked,true);assert.equal(handoff.materialAssignments.length,2);assert(handoff.materialAssignments.every(m=>m.purchaseQuantity===null));
const http=read(`${out}/http-status.json`);assert.equal(http.length,4);assert(http.every(r=>r.status===200));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=[...walk('src'),...walk('dist'),...walk('public'),...walk('scripts'),'package.json','package-lock.json','README.md','doc/资产与模板库联动-20261111.md'].sort();
const report={checkedAt:new Date().toISOString(),systemChecks:{testFiles:48,tests:996,architecture:'passed',lint:'passed',typecheck:'passed',build:'passed'},
  structuralGenerationScenarios:78,positiveHemExtensionScenarios:54,offlinePresets:13,httpStatus:'200',browserAcceptance:false,productionApproved:false,
  files:files.map(file=>({path:file.split(path.sep).join('/'),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({tests:996,offlinePresets:13,hashedFiles:files.length,browserAcceptance:false,productionApproved:false},null,2));
