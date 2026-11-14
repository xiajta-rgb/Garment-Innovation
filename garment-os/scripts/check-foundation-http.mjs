/** HTTP source availability only; does not operate a browser or validate pixels. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='http://localhost:5341',out=process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/foundation-blocks-20261111';
const routes=[['/','/src/main.tsx'],['/src/data/foundationMethods.ts','elastic-waist-pants'],['/src/features/category-workbench/CategoryWorkbench.tsx','基础款快速改款'],['/src/lib/pattern/reference/standard.ts','Paco'],['/src/features/style-workflow/StyleWorkflow.tsx','从当前裁片同步结构'],['/src/application/asset-library.ts','componentId']];
const results=[];
for(const [route,expected]of routes){
  const response=await fetch(`${base}${route}`,{signal:AbortSignal.timeout(10000)}),body=await response.text();assert.equal(response.status,200);assert(body.includes(expected),`${route} is not the expected current app`);
  results.push({url:`${base}${route}`,status:response.status,expectedToken:expected,checkedAt:new Date().toISOString(),bodySha256:createHash('sha256').update(body).digest('hex'),browserAcceptance:false});
}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/http-status.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
