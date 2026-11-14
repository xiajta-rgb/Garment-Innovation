/** Drawing silhouette comparison only: never a millimetre or production acceptance. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
const sharp=createRequire(import.meta.url)(process.env.GARMENT_SHARP_MODULE??'C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out='doc/evidence/company-master-20261111',server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const [{companyStyleMaster},{newCompanyStyle},{companyStyleFigure}]=await Promise.all([server.ssrLoadModule('/src/data/companyStyleMasters.ts'),server.ssrLoadModule('/src/lib/pattern/company-style.ts'),server.ssrLoadModule('/src/lib/pattern/company-style-drawing.ts')]);
 const m=companyStyleMaster('company-cot25m002'),[width,height]=m.source.drawingFrame,[x,y]=m.source.originPx,source=await sharp(`research/rd-design-reference-20261111/images/${m.source.recordId}.jpg`).resize(width,height,{fit:'fill'}).png().toBuffer(),draft=newCompanyStyle(m.id);
 const vector=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><g transform="translate(${x} ${y}) scale(${m.source.bodyHeightPx})">${companyStyleFigure(m,draft,'front')}</g></svg>`;
 const generated=await sharp(Buffer.from(vector)).png().toBuffer(),region={left:25,top:365,width:595,height:640},left=await sharp(source).extract(region).ensureAlpha().raw().toBuffer(),right=await sharp(generated).extract(region).ensureAlpha().raw().toBuffer();
 const mask=(p,i)=>p[i]<100&&p[i+1]>p[i]+3&&p[i+1]>p[i+2]+3;
 let intersection=0,union=0,sourceArea=0,generatedArea=0;for(let i=0;i<left.length;i+=4){const a=mask(left,i),b=mask(right,i);if(a)sourceArea++;if(b)generatedArea++;if(a&&b)intersection++;if(a||b)union++;}
 const result={masterId:m.id,method:'dark-green front-figure pixel mask in registered source frame',region,intersection,union,sourceArea,generatedArea,intersectionOverUnion:intersection/union,scope:'drawing silhouette only; source back-neck display and fine strokes remain differences; not CAD tolerance',browserAcceptance:false,productionApproved:false};
 fs.writeFileSync(`${out}/source-silhouette-comparison.json`,JSON.stringify(result,null,2));
 const labels=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="740"><g font-family="Microsoft YaHei, sans-serif" fill="#34452d"><text x="20" y="30" font-size="22">公司原稿 · COT25M002</text><text x="640" y="30" font-size="22">母版派生稿 · 相同图稿比例</text><text x="20" y="716" font-size="14">原稿与母版逐点注册对照 · 手工提取轮廓 · 不从图片推断毫米尺寸</text></g></svg>');
 await sharp({create:{width:1240,height:740,channels:4,background:'white'}}).composite([{input:await sharp(source).extract(region).png().toBuffer(),left:20,top:50},{input:await sharp(generated).extract(region).png().toBuffer(),left:640,top:50},{input:labels,left:0,top:0}]).png().toFile(`${out}/COT25M002-source-vs-master.png`);
 console.log(JSON.stringify(result,null,2));if(!Number.isFinite(result.intersectionOverUnion)||result.intersectionOverUnion<.9)throw Error('Company source silhouette has drifted beyond the drawing regression guard');
}finally{await server.close();}
