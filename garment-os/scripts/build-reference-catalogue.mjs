/**
 * Deterministic, offline extraction from pinned MIT upstream packages.
 * No AI outlines, guessed role from shape, fabricated grain or automatic manufacturing release.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as models from '@freesewing/models';
import { referenceSources, referenceSamples, netPathKeys, cutPathKeys } from './reference-catalogue-config.mjs';

const version = '4.10.2';
const entries = [], samples = [], excluded = [];
const taxonomy=ts.createSourceFile('pieceTaxonomy.ts',readFileSync('src/data/pieceTaxonomy.ts','utf8'),ts.ScriptTarget.Latest,true);
const taxonomyRoles=[],taxonomyFamilies=[];
function visit(node) {
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)){
    if(node.expression.text==='family'&&ts.isStringLiteral(node.arguments[0])&&ts.isStringLiteral(node.arguments[1])){
      taxonomyFamilies.push({id:node.arguments[0].text,label:node.arguments[1].text});
    }else if(node.expression.text==='roles'&&ts.isStringLiteral(node.arguments[0])&&ts.isArrayLiteralExpression(node.arguments[1])){
      const family=node.arguments[0].text;
      for(const tuple of node.arguments[1].elements){
        if(ts.isArrayLiteralExpression(tuple)&&ts.isStringLiteral(tuple.elements[0])&&ts.isStringLiteral(tuple.elements[1]))
          taxonomyRoles.push({id:family+'.'+tuple.elements[0].text,label:tuple.elements[1].text,family});
      }
    }
  }
  ts.forEachChild(node,visit);
}
visit(taxonomy);
for (const sample of referenceSamples) {
  const { design, profile, options } = sample;
  const mod = await import('@freesewing/' + design);
  if (mod.about.version !== version) throw Error('Unpinned reference version: ' + design);
  const Design = mod[design[0].toUpperCase() + design.slice(1)];
  const draft = new Design({ measurements: models[profile], options, sa: 10, expand: true });
  draft.draft();
  const cutlist = draft.setStores[0].get('cutlist', {});
  samples.push({ id: sample.id, design, version, profile, options,
    designer:String(mod.about.design),codeAuthor:String(mod.about.code),license:'MIT',
    measurementKeys: Object.keys(draft.settings[0].measurements).sort() });
  for (const [sourceId, part] of Object.entries(draft.parts[0])) {
    if (part.hidden || (sample.only && !sample.only.includes(sourceId))) continue;
    const roleId = sample.role ?? referenceSources[sourceId];
    if (!roleId) {
      if (Object.keys(part.paths).length) excluded.push({ sample: sample.id, sourceId, reason: 'Source role not registered' });
      continue;
    }
    for (const netPathKey of netPathKeys[sourceId] ?? ['seam']) {
      const net = part.paths[netPathKey];
      if (!net || net.hidden) continue;
      const data = net.asPathstring();
      const ops = net.ops, first = ops.find(op=>op.type==='move')?.to;
      const last = ops.at(-1), lastPoint = last?.type==='close' ? first : last?.to;
      if (!first || !lastPoint || Math.hypot(first.x-lastPoint.x,first.y-lastPoint.y)>.001 || /NaN|Infinity|undefined/.test(data)) {
        excluded.push({ sample: sample.id, sourceId, netPathKey, reason: 'Source net path is not a finite, closed contour' });
        continue;
      }
      if(!taxonomyRoles.some(r=>r.id===roleId))throw Error('Unregistered role: '+roleId);
      const paths = [{ key: netPathKey, data, layer: 'net' }];
      for (const [key,path] of Object.entries(part.paths)) {
        if (path.hidden || key===netPathKey) continue;
        const classes=(path.attributes?.list?.class??[]).join(' ').split(/\s+/);
        let layer;
        if (classes.includes('sa')) {
          const selectedCuts=cutPathKeys[sourceId+'/'+netPathKey];
          if(!selectedCuts||selectedCuts.includes(key))layer='cut';
        }
        else if (/grainline|cutonfold/.test(key)&&key.endsWith('_line')) layer='grain';
        else if (/fold|pleat/i.test(key)&&!key.includes('banner')) layer='fold';
        else if (['underCollar','dart','placketCut','roll','breakLine'].includes(key)) layer='detail';
        if (layer) paths.push({key,data:path.asPathstring(),layer});
      }
      entries.push({id:sample.id+'/'+sourceId+'/'+netPathKey,sourceId,sampleId:sample.id,roleId,
        family:roleId.split('.')[0],label:sourceId,variant:sample.label,paths,netPathKey,
        perimeterMm:net.length(),cutInstructions:cutlist[sourceId]??{},productionApproved:false});
    }
  }
}
const snapshot={schema:'garment-os/reference-catalogue/v1',unit:'mm',version,samples,entries};
const json=JSON.stringify(snapshot)+'\n';
writeFileSync('src/data/referencePieceCatalogue.snapshot.json',json);
const index=entries.map(({id,sourceId,sampleId,roleId,family})=>({id,sourceId,sampleId,roleId,family}));
writeFileSync('src/data/referencePieceIndex.ts',
  "import type { ReferenceCatalogueEntry } from '@/types/reference-catalogue';\n"+
  "/** Generated index without geometry; catalogue payload loads only when opened. */\n"+
  "export const REFERENCE_PIECE_INDEX: Array<Pick<ReferenceCatalogueEntry,'id'|'sourceId'|'sampleId'|'roleId'|'family'>> = "+
  JSON.stringify(index,null,2)+";\n");
mkdirSync('doc/evidence/reference-catalogue-20261111',{recursive:true});
const illustrations=JSON.parse(readFileSync('src/data/referenceIllustrations.json','utf8'));
const roles=taxonomyRoles.map(r=>({...r,cadCount:entries.filter(e=>e.roleId===r.id).length,
  imageCount:illustrations.filter(i=>i.roleIds.includes(r.id)).length}));
const familyCoverage=taxonomyFamilies.map(f=>({...f,cadCount:entries.filter(e=>e.family===f.id).length,
  imageCount:illustrations.filter(i=>i.family===f.id).length}));
const missingReferences=roles.filter(r=>!r.cadCount&&!r.imageCount);
const missingCad=roles.filter(r=>!r.cadCount);
const report={upstream:'FreeSewing',version,license:'MIT',sampleCount:samples.length,entryCount:entries.length,
  sourceIdentityCount:new Set(entries.map(e=>e.sourceId)).size,roleCount:new Set(entries.map(e=>e.roleId)).size,
  familyCount:new Set(entries.map(e=>e.family)).size,families:[...new Set(entries.map(e=>e.family))].sort(),
  sha256:createHash('sha256').update(json).digest('hex'),excluded,actualBrowserChecked:false,productionApproved:false};
writeFileSync('doc/evidence/reference-catalogue-20261111/source-extraction.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('doc/evidence/reference-catalogue-20261111/coverage.json',JSON.stringify({
  taxonomyRoleCount:roles.length,cadRoleCount:roles.filter(r=>r.cadCount).length,
  illustratedFamilyCount:familyCoverage.filter(f=>f.cadCount||f.imageCount).length,
  missingReferenceRoleCount:missingReferences.length,missingCadRoleCount:missingCad.length,
  familyCoverage,roles,missingReferences,missingCad,actualBrowserChecked:false,productionApproved:false,
},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
