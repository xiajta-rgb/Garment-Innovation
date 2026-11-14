import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const dir='doc/evidence/piece-design-20261111';
const json=name=>JSON.parse(fs.readFileSync(`${dir}/${name}`,'utf8'));
const sha=name=>createHash('sha256').update(fs.readFileSync(`${dir}/${name}`)).digest('hex');
const live=json('senling-live.json'),browser=json('browser.json'),restore=json('senling-session-restore.json'),log=fs.readFileSync(`${dir}/final-check.log`,'utf8');
assert.match(log,/Test Files\s+58 passed/);assert.match(log,/Tests\s+1230 passed/);assert.match(log,/built in/);
assert.equal(live.records.length,2);assert.deepEqual(live.errors,[]);assert.equal(browser.steps.length,11);assert(browser.steps.every(s=>s.pass));assert.deepEqual(browser.errors,[]);assert(restore.passed);assert.equal(restore.extraSubmissions,0);
for(const r of live.records){assert.equal(r.state,'done');assert.equal(sha(r.referenceFile),r.referenceSha256);assert.equal(sha(r.originalFile),r.originalSha256);assert.equal(r.reference.inputSha256,r.referenceSha256);}
assert.equal(live.records[0].referenceSha256,live.records[1].referenceSha256);
const cad=fs.readFileSync(`${dir}/裁片组合-毫米裁片.svg`,'utf8'),encoded=cad.match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1];assert(encoded);
const decoded=encoded.replace(/&(?:amp|lt|gt|quot|apos);/g,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[v]));
assert.deepEqual(JSON.parse(decoded),json('裁片组合-设计与配缝.json'));
const result={verifiedAt:new Date().toISOString(),fullCheck:{exitCode:0,filesPassed:58,testsPassed:1230,log:'final-check.log'},browser:{passed:browser.steps.length,log:'browser.json'},exports:{cadUnit:'mm',cadMetadataMatchesJson:true,cadSha256:sha('裁片组合-毫米裁片.svg')},senling:{submitted:2,completed:2,sameInputReference:true,inputAndOriginalHashesVerified:true,sessionRestore:restore,log:'senling-live.json',visualReview:'agent-reviewed-with-deviations-human-review-pending'},productionApproved:false};
fs.writeFileSync(`${dir}/verification.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
