/** Offline source CAD renders, not browser screenshots or production acceptance. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const sharp=createRequire(import.meta.url)(process.env.GARMENT_SHARP_MODULE??'C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/asset-library-20261111';fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const [{STRUCTURE_ASSETS},{createDesignStore},{previewStructureAsset,exportAssetHandoff},{PATTERN_LIBRARY},{generatePatternSheet},{newCompanyStyle},{applyMaterialAsset,applyFinishAsset,applyColorAsset},{exportCompanyStyleSvg},{assetPiecePreviews}]=await Promise.all([
    server.ssrLoadModule('/src/data/reusableAssets.ts'),server.ssrLoadModule('/src/store/designStore.ts'),server.ssrLoadModule('/src/application/asset-library.ts'),server.ssrLoadModule('/src/data/patternLibrary.ts'),server.ssrLoadModule('/src/lib/svg-export/pattern-sheet-exporter.ts'),server.ssrLoadModule('/src/lib/pattern/company-style.ts'),server.ssrLoadModule('/src/lib/pattern/reusable-assets.ts'),server.ssrLoadModule('/src/lib/pattern/company-style-drawing.ts'),server.ssrLoadModule('/src/lib/pattern/asset-preview.ts'),
  ]);
  const repository={save:async()=>{},get:async()=>undefined,list:async()=>[],delete:async()=>{}},store=createDesignStore({repository}),results=[],images=[];
  for(const asset of STRUCTURE_ASSETS){
    const {configuration,draft}=previewStructureAsset(store.getState().getConfiguration(),asset.id);
    if(draft.status!=='reference'||!draft.assembly?.integrityPass)throw Error(`${asset.id}: ${draft.error??'assembly failed'}`);
    const svg=generatePatternSheet(PATTERN_LIBRARY[asset.templateId],draft.paths,{patternName:asset.name,construction:configuration.construction});
    fs.writeFileSync(`${out}/${asset.id}.svg`,svg);
    const pieces=assetPiecePreviews(draft.paths),tile=async(p)=>{
      const label=`<svg width="420" height="70"><rect width="420" height="70" fill="#f3f5ef"/><g font-family="Microsoft YaHei, sans-serif" fill="#25352a"><text x="14" y="24" font-size="16">${p.name}</text><text x="14" y="51" font-size="13">${p.widthMm.toFixed(1)} x ${p.heightMm.toFixed(1)} mm / cut ${p.quantity??'?'}</text></g></svg>`;
      return sharp({create:{width:440,height:430,channels:4,background:'#fff'}}).composite([{input:Buffer.from(p.svg),left:10,top:10},{input:Buffer.from(label),left:10,top:350}]).png().toBuffer();
    };
    const detail=await Promise.all(pieces.map(async(p,i)=>({input:await tile(p),left:i%3*440,top:Math.floor(i/3)*430})));
    await sharp({create:{width:1320,height:Math.ceil(pieces.length/3)*430,channels:4,background:'#dce3d8'}}).composite(detail).png().toFile(`${out}/${asset.id}.png`);
    const preferred=asset.templateId==='elastic-waist-pants'?['paco.front','paco.waistband']:['t-shirt','womens-basic-tee'].includes(asset.templateId)?['teagan.front','teagan.sleeve']:asset.templateId==='panel-circle-skirt'?['sandy.skirt','sandy.waistband']:asset.templateId==='button-up-shirt'?[asset.id.startsWith('shirt-long')?'simon.cuff':'simon.sleeve','simon.frontRight']:asset.templateId==='bound-tank'?['aaron.front','aaron.neckBinding']:['huey.front',asset.selection.options.ribbing?'huey.cuff':'huey.hood'];
    const header=Buffer.from(`<svg width="880" height="55"><rect width="880" height="55" fill="#506c38"/><text x="16" y="35" font-family="Microsoft YaHei, sans-serif" font-size="23" fill="white">${asset.name}</text></svg>`);
    const overviewFull=await sharp({create:{width:880,height:485,channels:4,background:'#fff'}}).composite([{input:header,left:0,top:0},...await Promise.all(preferred.map(async(id,i)=>({input:await tile(pieces.find(p=>p.id===id)),left:i*440,top:55})))]).png().toBuffer();
    const overviewTile=await sharp(overviewFull).resize(704,388).png().toBuffer();
    images.push({input:overviewTile,left:results.length%3*704,top:Math.floor(results.length/3)*388});
    results.push({id:asset.id,name:asset.name,source:asset.source,configuration,sourcePieces:draft.pieces.map(p=>({id:p.key,name:p.name})),cuts:draft.paths.filter(p=>p.layer==='seam-line').map(p=>({id:p.pieceId,quantity:p.cutQty,onFold:p.cutOnFold,role:p.materialRole})),svgSha256:createHash('sha256').update(svg).digest('hex'),assemblyIntegrityPass:true,productionApproved:false});
  }
  await sharp({create:{width:2112,height:Math.ceil(results.length/3)*388,channels:4,background:'#e8ece5'}}).composite(images).png().toFile(`${out}/structure-overview.png`);
  let d=applyMaterialAsset(newCompanyStyle('company-lt26m1581'),'mat-fc304','main');d=applyMaterialAsset(d,'mat-fc00332','neck');d=applyFinishAsset(d,'finish-lt26m1581');d=applyColorAsset(d,'color-808080');
  store.getState().applyCompanyDraft(d);const s=store.getState();
  const svg=exportCompanyStyleSvg(s.companyDraft);fs.writeFileSync(`${out}/linked-company-long-tee.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${out}/linked-company-long-tee.png`);
  fs.writeFileSync(`${out}/linked-assets-example.json`,JSON.stringify(exportAssetHandoff(s.getConfiguration(),s.draft,s.companyDraft),null,2));
  fs.writeFileSync(`${out}/offline-validation.json`,JSON.stringify({mode:'offline-source-SVG',results,browserAcceptance:false,productionApproved:false},null,2));
  console.log(JSON.stringify({out,presets:results.length,sourcePieceCounts:results.map(r=>({id:r.id,count:r.sourcePieces.length})),browserAcceptance:false},null,2));
}finally{await server.close();}
