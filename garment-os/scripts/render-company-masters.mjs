/** Offline rendering of the exact company-master SVG used by the UI. No browser. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const sharp=createRequire(import.meta.url)(process.env.GARMENT_SHARP_MODULE??'C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out='doc/evidence/company-master-20261111';fs.mkdirSync(out,{recursive:true});fs.mkdirSync('public/company-reference',{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const [{COMPANY_STYLE_MASTERS},{newCompanyStyle},{exportCompanyStyleSvg,companyStyleFigure}]=await Promise.all([server.ssrLoadModule('/src/data/companyStyleMasters.ts'),server.ssrLoadModule('/src/lib/pattern/company-style.ts'),server.ssrLoadModule('/src/lib/pattern/company-style-drawing.ts')]);
 const samples=JSON.parse(fs.readFileSync('research/rd-design-reference-20261111/samples.json','utf8')),results=[];
 for(const m of COMPANY_STYLE_MASTERS){
  const sample=samples.find(s=>s.recordId===m.source.recordId);if(!sample||sample.url!==m.source.url)throw Error('Source link mismatch');
  const bytes=fs.readFileSync(sample.file),hash=createHash('sha256').update(bytes).digest('hex');if(hash!==m.source.sha256)throw Error('Source hash mismatch');
  await sharp(bytes).resize({width:1800,withoutEnlargement:true}).webp({quality:88}).toFile(`public/company-reference/${m.source.styleCode}.webp`);
  const draft=newCompanyStyle(m.id),svg=exportCompanyStyleSvg(draft);if(/NaN|Infinity/.test(svg))throw Error('Invalid drawing');
  fs.writeFileSync(`${out}/${m.source.styleCode}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${out}/${m.source.styleCode}.png`);
  // Registered drawing overlay; these are manual traced drawing ratios, not CAD measurements.
  const [w,h]=m.source.drawingFrame,[x,y]=m.source.originPx,scale=m.source.bodyHeightPx;
  const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="translate(${x} ${y}) scale(${scale})">${companyStyleFigure(m,draft,'front',true).replaceAll('#222b24','#e000dc').replace('stroke-width=".0022"','stroke-width=".004"')}</g></svg>`;
  await sharp(bytes).resize(w,h,{fit:'fill'}).composite([{input:Buffer.from(overlay)}]).png().toFile(`${out}/${m.source.styleCode}-registered-overlay.png`);
  results.push({id:m.id,sourceRecord:m.source.recordId,sha256:hash,sourceVerified:true,cadTemplateId:m.cadTemplateId,landmarks:'manual drawing proportions',productionApproved:false});
 }
 await sharp({create:{width:1500,height:1060,channels:4,background:'#eee'}}).composite(await Promise.all(COMPANY_STYLE_MASTERS.map(async(m,i)=>({input:await sharp(`${out}/${m.source.styleCode}.png`).resize(750,530).toBuffer(),left:i%2*750,top:Math.floor(i/2)*530})))).png().toFile(`${out}/company-masters-overview.png`);
 fs.writeFileSync(`${out}/offline-validation.json`,JSON.stringify({mode:'offline-shared-SVG',results,browserAcceptance:false,productionApproved:false},null,2));console.log(JSON.stringify(results,null,2));
}finally{await server.close();}
