/** Business composition checks on real source geometry, using declared reference bodies. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const out='doc/evidence/foundation-business-20261111';fs.mkdirSync(`${out}/business-worker`,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const [{configureStructureAsset},{configureStyle,createStyleWorkflow,createWorkflowSheet},{computeDraft},{getReferenceMeasurements}]=await Promise.all([
    server.ssrLoadModule('/src/application/asset-library.ts'),server.ssrLoadModule('/src/application/style-workflow.ts'),server.ssrLoadModule('/src/application/draft-service.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts'),
  ]);
  const cases=[],fixtures=[];
  const workFor=config=>{const draft=computeDraft(config);assert.equal(draft.status,'reference',draft.error);return {draft,work:createStyleWorkflow(config,draft)};};
  const capture=(configuration,work,gender,size)=>{
    if(size!=='M')return;
    const id=configuration.activePatternId;fixtures.push({configuration,expectedPanels:work.primaryCutQuantity,scenario:`business/${id}/${gender}/composed`});
    if(gender==='male'){
      fs.writeFileSync(`${out}/${id}-composed-workflow.json`,JSON.stringify(work,null,2));
      fs.writeFileSync(`${out}/${id}-composed-cad.svg`,createWorkflowSheet(`${id} 基础款组合范例`,work));
    }
  };
  for(const gender of ['male','female'])for(const size of ['XS','S','M','L','XL','XXL','XXXL']){
    const base={activePatternId:'brian-reference',gender,standardSize:size,fit:'regular',measurements:getReferenceMeasurements(gender,size),engineVersion:'4.10.2',garmentColor:'#87ceeb',fabricId:'solid'};
    for(const template of ['t-shirt','womens-basic-tee']){
      const original=configureStyle(base,{templateId:template,options:{necklineDepth:.32,necklineWidth:.28}}),{draft:old}=workFor(original);
      for(const variant of ['basic','extended','tapered']){
        const configuration=configureStructureAsset(original,`${template}-${variant}-sleeve`),{draft,work}=workFor(configuration);
        assert.equal(configuration.construction.options.necklineDepth,.32);assert.equal(configuration.construction.options.necklineWidth,.28);
        for(const id of ['teagan.front:seam','teagan.back:seam'])assert.equal(draft.paths.find(p=>p.id===id).data,old.paths.find(p=>p.id===id).data);
        assert.equal(work.primaryCutQuantity,4);assert.equal(work.bom.lines.length,3);assert(!work.technical.pending.join(' ').includes('包条端头工艺'));
        cases.push({template,gender,size,variant,neckPreserved:true,bodyContoursUnchanged:true,cutQuantity:4,bomRevision:work.revisionId,productionApproved:false});
        if(variant==='extended')capture(configuration,work,gender,size);
      }
    }
    const pants=configureStyle(base,{templateId:'elastic-waist-pants',options:{seatEase:.08,waistbandWidth:.04}}),orders=[['pants-wide-opening','pants-shorter-leg'],['pants-shorter-leg','pants-wide-opening']];
    const composed=orders.map(order=>order.reduce(configureStructureAsset,pants));
    assert.deepEqual(composed[0],composed[1]);const generated=composed.map(workFor);assert.deepEqual(generated[0].draft.paths,generated[1].draft.paths);
    for(const [index,{work}]of generated.entries()){
      assert.deepEqual(work.configuration.construction.options,{seatEase:.08,waistbandWidth:.04,heelEase:.3,lengthBonus:-.1});assert.equal(work.primaryCutQuantity,5);assert.equal(work.bom.lines.length,3);assert(!work.technical.pending.join(' ').includes('包条端头工艺'));
      cases.push({template:'elastic-waist-pants',gender,size,order:orders[index],unrelatedOptionsPreserved:true,bothOrdersEqual:true,cutQuantity:5,bomRevision:work.revisionId,productionApproved:false});
    }
    capture(composed[0],generated[0].work,gender,size);
  }
  const tee=fixtures.find(f=>f.configuration.activePatternId==='t-shirt').configuration,pants=fixtures.find(f=>f.configuration.activePatternId==='elastic-waist-pants').configuration;
  fixtures.push({configuration:{...pants,measurements:{...pants.measurements,waistBack:undefined}},failureField:'waistBack',expectedError:'后腰弧长'});
  fixtures.push({configuration:{...tee,construction:{schema:'garment-os/construction/v1',options:{necklineDepth:1}}},failureField:'necklineDepth',expectedError:'超出'});
  fs.writeFileSync(`${out}/business-worker/worker-inputs.json`,JSON.stringify(fixtures,null,2));
  fs.writeFileSync(`${out}/composition-matrix.json`,JSON.stringify({kind:'cross-size-business-composition',measurementSource:'@freesewing/models@4.10.2 reference samples',cases,actualBrowserChecked:false,productionApproved:false},null,2));
  console.log(JSON.stringify({out,cases:cases.length,workerInputs:fixtures.length,actualBrowserChecked:false,productionApproved:false},null,2));
}finally{await server.close();}
