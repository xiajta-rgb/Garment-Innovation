import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {createServer} from 'vite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/garment-assembly-20261111');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/.vite/manifest.json'),'utf8')),entry=manifest['src/features/piece-library/Pattern3dPanel.tsx'].file;
const chunk=fs.readFileSync(path.join(root,'dist',entry),'utf8'),bundle=chunk.match(/["'](?:\/assets\/|\.\/)(garment\.worker-[^"']+\.js)["']/)?.[1];assert(bundle,'Build the garment worker first');
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'}),results=[];
let worker;
try{
  const [{createPattern3d},{getReferenceMeasurements}]=await Promise.all([server.ssrLoadModule('/src/application/pattern-3d.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts')]);
  worker=new Worker(`import {parentPort,threadId} from 'node:worker_threads';globalThis.self={onmessage:null,postMessage(data){parentPort.postMessage(data);}};await import(${JSON.stringify(pathToFileURL(path.join(root,'dist/assets',bundle)).href)});parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true,threadId,hasDocument:typeof document!=='undefined'});`,{eval:true,type:'module'});
  const receive=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Worker timed out'));},30000);function cleanup(){clearTimeout(timer);worker.off('message',message);worker.off('error',error);}function message(data){cleanup();resolve(data);}function error(err){cleanup();reject(err);}worker.on('message',message);worker.on('error',error);});
  const environment=await receive();assert(environment.threadId>0);assert.equal(environment.hasDocument,false);
  for(const [i,id]of ['brian-reference','t-shirt','bound-tank','hooded-zip-sweatshirt'].entries()){
    const source=createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#5785bd',fabricId:'solid'}),snapshot=JSON.stringify(source),replyPromise=receive();
    worker.postMessage({requestId:i+1,revision:id,model:source});const reply=await replyPromise;assert.equal(reply.requestId,i+1);assert.equal(reply.revision,id);assert.equal(JSON.stringify(source),snapshot);
    if(id==='hooded-zip-sweatshirt'){assert.match(reply.error,/尚未接通/);results.push({id,rejectedAsExpected:true});continue;}
    assert.equal(reply.error,undefined);assert.equal(reply.model.quality.connectedComponents,1);assert.equal(reply.model.quality.boundaryLoops,4);assert.equal(reply.model.quality.nonManifoldEdges,0);assert.equal(reply.model.productionApproved,false);
    assert(reply.model.surfaces.every(s=>s.uvMm.length===s.positionsMm.length));assert.equal(reply.model.openings.length,4);assert(reply.model.openings.every(o=>o.sourceLengthMm>0&&o.edges.length>2&&o.sourceBoundaries.length));assert(reply.model.seams.every(s=>s.path?.length>1));results.push({id,surfaces:reply.model.surfaces.length,durationMs:reply.durationMs,quality:reply.model.quality,openingRoles:reply.model.openings.map(o=>o.role),sourcePaths:true,sourceUnchanged:true});
  }
  fs.mkdirSync(out,{recursive:true});const report={kind:'actual-built-garment-worker-in-native-thread',entry,bundle,environment,results,browserAcceptance:false,productionApproved:false};fs.writeFileSync(path.join(out,'native-worker.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await worker?.terminate();await server.close();}
