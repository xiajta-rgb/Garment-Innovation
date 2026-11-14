import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const out=process.env.GARMENT_EDGE_EVIDENCE_DIR??'doc/evidence/garment-edge-review-20261111',before=JSON.parse(fs.readFileSync(`${out}/before.json`)),after=JSON.parse(fs.readFileSync(`${out}/after.json`));
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex'),frames=[];
assert.equal(before.results.length,12);assert.equal(after.results.length,12);
assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);
for(const [i,r]of after.results.entries()){
 for(const key of ['id','mode','view','modelSha256','camera'])assert.deepEqual(r[key],before.results[i][key]);
 const paths=['before','after'].map(stage=>`${out}/${stage}-${r.id}-${r.mode}-${r.view}.png`);
 for(const path of paths){const data=fs.readFileSync(path);assert.equal(data.readUInt32BE(16),900);assert.equal(data.readUInt32BE(20),650);}
 frames.push({id:r.id,mode:r.mode,view:r.view,modelSha256:r.modelSha256,images:paths.map(path=>({path,sha256:hash(path)}))});
}
const root='doc/evidence/garment-ui',latest=fs.readdirSync(root).filter(p=>fs.existsSync(`${root}/${p}/summary.json`)).sort().at(-1),uiPath=`${root}/${latest}/summary.json`,ui=JSON.parse(fs.readFileSync(uiPath));
assert.equal(ui.browserWorkflowPassed,true);assert.equal(ui.results.length,10);assert.deepEqual(ui.errors,[]);
const log=fs.readFileSync(`${out}/check.log`,'utf8');assert.match(log,/55 passed \(55\)/);assert.match(log,/1215 passed \(1215\)/);assert.match(log,/built in/);
const sourceFiles=['src/features/piece-library/garment-antialias.ts','src/features/piece-library/garment-renderer.ts','src/lib/pattern/mesh/garment-raster.ts'];
const report={kind:'garment-edge-rendering-verification',date:'2026-11-11',comparisonPairs:12,cameraAndMeshIdentical:true,sourceUnchanged:before.sourceUnchanged&&after.sourceUnchanged,frames,
 checks:{architecture:true,lint:true,testFiles:55,tests:1215,build:true,log:`${out}/check.log`,logSha256:hash(`${out}/check.log`)},
 ui:{path:uiPath,passed:10,errors:[],fullVisualAcceptance:false},rendererSources:sourceFiles.map(path=>({path,beforeSha256:hash(`${out}/baseline-renderer/${path.split('/').at(-1)}`),afterSha256:hash(path)})),
 visualReview:{scope:['comparison-t-shirt-webgl.png','comparison-t-shirt-software.png','after-brian-reference-webgl-neck.png'],note:'Image inspection of this bounded rendering fix; no general garment, drape or production acceptance.'},
 limitations:['Physical stitch pitch remains discrete; very fine stitches may merge at full-garment scale.','Software renderer spends more CPU time for denser coverage.','Floating three-view panel was closed before switching rendering modes in the UI workflow.'],drapeValidated:false,productionApproved:false};
fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({pairs:12,tests:1215,browserWorkflowPassed:10,cameraAndMeshIdentical:true}));
