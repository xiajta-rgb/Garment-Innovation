/** Repeatable offline category connections. Browser/GPU/production acceptance remain separate. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const out=process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/category-connection-20261111';
fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const [{exportCategoryCoverage},{listExecutablePatterns},{getReferenceMeasurements},{computeDraft},{createPattern3d},{assembleGarment},{supportsGarmentAssembly,TEMPLATE_SOURCE_PIECES},{createPendingElementCandidates}]=await Promise.all([
    server.ssrLoadModule('/src/application/category-coverage.ts'),server.ssrLoadModule('/src/data/patternLibrary.ts'),server.ssrLoadModule('/src/data/referenceMeasurements.ts'),server.ssrLoadModule('/src/application/draft-service.ts'),server.ssrLoadModule('/src/application/pattern-3d.ts'),server.ssrLoadModule('/src/lib/pattern/mesh/garment-assembly.ts'),server.ssrLoadModule('/src/data/templateCapabilities.ts'),server.ssrLoadModule('/src/application/pending-element-candidates.ts'),
  ]);
  const coverage=exportCategoryCoverage(),cases=[],workerInputs=[];
  for(const template of listExecutablePatterns()){
    for(const gender of ['male','female'])for(const size of ['XS','S','M','L','XL','XXL','XXXL']){
      const configuration={activePatternId:template.id,gender,standardSize:size,fit:'regular',measurements:getReferenceMeasurements(gender,size),engineVersion:'4.10.2',garmentColor:'#cccccc',fabricId:'solid'};
      const start=performance.now(),draft=computeDraft(configuration);assert.equal(draft.status,'reference',`${template.id}/${gender}/${size}: ${draft.error}`);
      const sourceIds=draft.paths.filter(p=>p.layer==='seam-line').map(p=>p.pieceId).sort();
      assert.deepEqual(sourceIds,[...TEMPLATE_SOURCE_PIECES[template.id]].sort());
      assert(draft.assembly.integrityPass);assert.equal(draft.assembly.coverage.classifiedEdges,draft.assembly.coverage.totalEdges);
      const mesh=createPattern3d(configuration),expected=draft.paths.filter(p=>p.layer==='seam-line').reduce((sum,p)=>sum+p.cutQty,0);
      assert.equal(mesh.unit,'mm');assert.equal(mesh.panels.length,expected);assert.equal(mesh.productionApproved,false);assert.equal(mesh.simulationReady,false);
      for(const panel of mesh.panels){assert(panel.metrics.areaErrorRatio<.001);assert(panel.metrics.maxRoundtripMm<1e-6);assert(panel.metrics.maxEdgeDistortionMm<1e-6);}
      let garment=null;
      if(size==='M'&&supportsGarmentAssembly(template.id)){
        const result=assembleGarment(mesh);assert.equal(result.productionApproved,false);assert.equal(result.drapeValidated,false);assert.equal(result.quality.connectedComponents,1);assert.equal(result.quality.nonManifoldEdges,0);
        assert(result.surfaces.every(s=>s.positionsMm.every(p=>p.every(Number.isFinite))));
        garment={stage:result.stage,quality:result.quality,pending:result.pending,drapeValidated:false};
      }
      cases.push({templateId:template.id,gender,size,sourceIds,sourceQuantitiesExact:true,classifiedEdges:draft.assembly.coverage,panels:mesh.panels.length,
        maxRoundtripMm:Math.max(...mesh.panels.map(p=>p.metrics.maxRoundtripMm)),maxAreaErrorRatio:Math.max(...mesh.panels.map(p=>p.metrics.areaErrorRatio)),
        garment,elapsedMs:performance.now()-start,productionApproved:false});
      if(size==='M')workerInputs.push({configuration,expectedPanels:mesh.panels.length});
    }
    console.log(`verified ${template.id}: 14 source/mesh sample cases`);
  }
  const skirt=workerInputs.find(i=>i.configuration.activePatternId==='panel-circle-skirt').configuration;
  for(const key of ['waistToFloor','skirtLength'])workerInputs.push({configuration:{...skirt,measurements:{...skirt.measurements,[key]:undefined}},failureField:key,expectedError:'制版输入缺失'});
  workerInputs.push({configuration:{...skirt,construction:{schema:'garment-os/construction/v1',options:{panels:2.5}}},failureField:'panels',expectedError:'范围'});
  // Foundation guards travel through the actual compiled worker as well as the synchronous API.
  const pants=workerInputs.find(i=>i.configuration.activePatternId==='elastic-waist-pants')?.configuration;
  if(pants){
    const {configureStructureAsset}=await server.ssrLoadModule('/src/application/asset-library.ts');
    for(const preset of ['t-shirt-basic-sleeve','t-shirt-extended-sleeve','t-shirt-tapered-sleeve','pants-plain-base','pants-wide-opening','pants-shorter-leg']){
      const configuration=configureStructureAsset(pants,preset),model=createPattern3d(configuration);
      workerInputs.push({configuration,expectedPanels:model.panels.length,scenario:preset});
    }
    workerInputs.push({configuration:{...pants,measurements:{...pants.measurements,seatBack:undefined}},failureField:'seatBack',expectedError:'制版输入缺失'});
    workerInputs.push({configuration:{...pants,construction:{schema:'garment-os/construction/v1',options:{frontPockets:true}}},failureField:'frontPockets',expectedError:'未声明'});
    const tee=workerInputs.find(i=>i.configuration.activePatternId==='t-shirt').configuration;
    workerInputs.push({configuration:{...tee,construction:{schema:'garment-os/construction/v1',options:{sleeveLength:2}}},failureField:'sleeveLength',expectedError:'范围'});
  }
  const rows=coverage.rows.map(row=>{
    assert(row.category.dimensions.length&&row.category.interfaces.length&&row.category.requiredRoles.length);
    const actual=cases.filter(c=>row.templateIds.includes(c.templateId));
    assert.equal(actual.length,row.templateIds.length*14);
    return {categoryId:row.category.id,label:row.category.label,
      definition:{status:'registered',requiredRoles:row.roles.map(r=>r.id),missingSourceRoles:row.missingSourceRoles},
      cad:{status:actual.length?'sample-checked':'pending',caseKeys:actual.map(c=>`${c.templateId}/${c.gender}/${c.size}`)},
      pieces3d:{status:actual.length?'sample-checked':'pending',unit:'mm'},
      garment3d:{status:actual.some(c=>c.garment)?'illustration-sample-checked':'pending'},
      browser:{status:'deferred'},remoteSync:{status:'not-performed'},production:{status:'not-approved'},gaps:row.category.gaps};
  });
  fs.writeFileSync(`${out}/connection-stages.json`,JSON.stringify({kind:'offline-source-and-metric-verification',checkedAt:new Date().toISOString(),counts:coverage.counts,cases,rows,browserAcceptance:false,productionApproved:false,hardwareGpuFpsMeasured:false},null,2));
  fs.writeFileSync(`${out}/worker-inputs.json`,JSON.stringify(workerInputs,null,2));
  fs.writeFileSync(`${out}/element-registration-candidates.json`,JSON.stringify(createPendingElementCandidates(),null,2));
  console.log(JSON.stringify({out,categories:rows.length,sourceMeshCases:cases.length,garmentIllustrationCases:cases.filter(c=>c.garment).length,compiledWorkerInputs:workerInputs.length,browserAcceptance:false,productionApproved:false},null,2));
}finally{await server.close();}
