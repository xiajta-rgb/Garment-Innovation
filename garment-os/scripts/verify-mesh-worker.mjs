import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

// Execute the actual Vite worker bundle in a native thread without any DOM or graphics mocks.
// The bridge only adapts worker_threads messaging to the browser worker's self API.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inputDir=path.resolve(root,process.env.GARMENT_MESH_INPUT_DIR??'doc/evidence/mapping-precision-20261111'),dir=process.env.GARMENT_EVIDENCE_DIR?path.resolve(root,process.env.GARMENT_EVIDENCE_DIR):inputDir;
const assets=path.join(root,'dist/assets');
// Resolve the worker actually referenced by the current build, never the first
// matching file: old hashed assets may coexist in a locally served dist folder.
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/.vite/manifest.json'),'utf8'));
const panelEntry=manifest['src/features/piece-library/Pattern3dPanel.tsx'];
assert(panelEntry,'Run npm run build before verifying the compiled worker');
const panelBundle=fs.readFileSync(path.join(root,'dist',panelEntry.file),'utf8');
const bundles=[...panelBundle.matchAll(/["'](?:\/assets\/|\.\/)(mesh\.worker-[^"']+\.js)["']/g)].map(m=>m[1]);
assert.equal(new Set(bundles).size,1,'Current 3D entry must reference exactly one worker bundle');
const bundle=bundles[0];assert(fs.existsSync(path.join(assets,bundle)));
const inputs=JSON.parse(fs.readFileSync(path.join(inputDir,'worker-inputs.json'),'utf8'));
const pending=new Map(),results=[];
const worker=new Worker(`
  import { parentPort,threadId } from 'node:worker_threads';
  globalThis.self={onmessage:null,postMessage(reply,options){
    const buffers=reply.renderData?.geometries.flatMap(g=>[g.positions.buffer,g.indices.buffer])??[];
    const bytesBefore=buffers.map(b=>b.byteLength);
    parentPort.postMessage({kind:'reply',reply},options?.transfer??[]);
    parentPort.postMessage({kind:'receipt',requestId:reply.requestId,bytesBefore,bytesAfter:buffers.map(b=>b.byteLength),canonicalVerticesAfter:reply.model?.panels.reduce((s,p)=>s+p.vertices.length,0)??null});
  }};
  await import(${JSON.stringify(pathToFileURL(path.join(assets,bundle)).href)});
  parentPort.on('message',data=>globalThis.self.onmessage({data}));
  parentPort.postMessage({kind:'ready',threadId,hasDocument:typeof document!=='undefined',hasWindow:typeof window!=='undefined'});
`,{eval:true,type:'module'});
let environment;
const ready=new Promise((resolve,reject)=>{
  worker.on('error',error=>{reject(error);for(const job of pending.values())job.reject(error);});
  worker.on('message',message=>{
    if(message.kind==='ready'){environment=message;resolve();return;}
    const id=message.kind==='reply'?message.reply.requestId:message.requestId,job=pending.get(id);if(!job)return;
    job[message.kind]=message.kind==='reply'?message.reply:message;
    if(job.reply&&job.receipt){clearTimeout(job.timeout);pending.delete(id);job.resolve({reply:job.reply,receipt:job.receipt});}
  });
});
try{
  await Promise.race([ready,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Native worker startup timeout')),30000);timer.unref();})]);
  assert(environment.threadId>0);assert.equal(environment.hasDocument,false);assert.equal(environment.hasWindow,false);
  for(const [i,{configuration,expectedPanels,expectedError,failureField,scenario}] of inputs.entries()){
    const requestId=i+1,revision=`native-${requestId}`;
    const result=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`Worker request ${requestId} timed out`)),30000);
      pending.set(requestId,{resolve,reject,timeout});worker.postMessage({requestId,revision,configuration});
    });
    const {reply,receipt}=result;assert.equal(reply.revision,revision);
    if(expectedError){assert.equal(typeof reply.error,'string');assert(reply.error.includes(expectedError),`Request ${requestId}: expected ${expectedError}, received ${reply.error}`);assert.equal(reply.model,undefined);results.push({requestId,template:configuration.activePatternId,failureField,rejectedAsExpected:true,error:reply.error});continue;}
    assert.equal(reply.error,undefined);assert.equal(reply.model.panels.length,expectedPanels);assert.equal(reply.model.unit,'mm');assert.equal(reply.model.productionApproved,false);
    assert(reply.renderData.geometries.every(g=>g.positions instanceof Float32Array&&g.indices instanceof Uint32Array));
    assert(receipt.bytesBefore.every(n=>n>0));assert(receipt.bytesAfter.every(n=>n===0));assert(receipt.canonicalVerticesAfter>0);
    results.push({requestId,template:configuration.activePatternId,scenario,panels:reply.model.panels.length,sourceGeometries:reply.renderData.geometries.length,workerDurationMs:reply.durationMs,displayBuffersTransferred:true,canonicalVerticesRetained:receipt.canonicalVerticesAfter});
  }
  const report={mode:'compiled production worker in native Node thread with self messaging bridge',entry:panelEntry.file,bundle,environment,results,actualBrowserChecked:false,hardwareGpuFpsMeasured:false};
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'native-worker.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{for(const job of pending.values())clearTimeout(job.timeout);await worker.terminate();}
