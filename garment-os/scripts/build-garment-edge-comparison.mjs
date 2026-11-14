/** Compose captured pixels only: identical crops and nearest-neighbour zoom. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=process.env.GARMENT_EDGE_EVIDENCE_DIR??'doc/evidence/garment-edge-review-20261111',before=JSON.parse(fs.readFileSync(`${out}/before.json`)),after=JSON.parse(fs.readFileSync(`${out}/after.json`));
assert.equal(before.results.length,after.results.length);
for(const [i,r]of before.results.entries())for(const k of ['id','mode','view','modelSha256','camera'])assert.deepEqual(r[k],after.results[i][k]);
const label=(text,width=1200,height=42)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f3f4f5"/><text x="18" y="28" font-family="Microsoft YaHei,sans-serif" font-size="18" fill="#263238">${text}</text></svg>`);
for(const mode of ['webgl','software']){
 const inputs=[{input:label(`短袖 T 恤 · ${mode==='webgl'?'显卡显示':'兼容显示'} · 左：修改前 / 右：修改后`),left:0,top:0}];
 for(const [col,stage]of ['before','after'].entries()){
  const file=`${out}/${stage}-t-shirt-${mode}-oblique.png`;
  inputs.push({input:await sharp(file).resize(600,433).png().toBuffer(),left:col*600,top:42});
  inputs.push({input:await sharp(file).extract({left:335,top:60,width:240,height:140}).resize(600,350,{kernel:'nearest'}).png().toBuffer(),left:col*600,top:517});
  inputs.push({input:await sharp(file).extract({left:140,top:245,width:160,height:120}).resize(600,450,{kernel:'nearest'}).png().toBuffer(),left:col*600,top:909});
 }
 inputs.push({input:label('领口 · 同坐标裁切放大（像素原样保留）'),left:0,top:475},{input:label('袖口与双针线迹 · 同坐标裁切放大（像素原样保留）'),left:0,top:867});
 await sharp({create:{width:1200,height:1359,channels:3,background:'#ffffff'}}).composite(inputs).png().toFile(`${out}/comparison-t-shirt-${mode}.png`);
}
const rows=after.results.map(r=>{
 const name=`${r.id}-${r.mode}-${r.view}`,camera=r.camera;
 return `<section><h2>${r.id==='t-shirt'?'短袖 T 恤':'Brian 基型'} · ${r.mode==='webgl'?'显卡显示':'兼容显示'} · ${{oblique:'斜视',front:'正面',neck:'领口近景'}[r.view]}</h2><p>相机 ${camera.yawDeg}° / ${camera.tiltDeg}° · ${camera.pixelsPerMm.toFixed(3)} 像素/mm</p><div class="pair"><figure><figcaption>修改前</figcaption><a href="before-${name}.png"><img src="before-${name}.png" alt="修改前"></a></figure><figure><figcaption>修改后</figcaption><a href="after-${name}.png"><img src="after-${name}.png" alt="修改后"></a></figure></div><details><summary>模型与相机核对</summary><pre>${JSON.stringify({modelSha256:r.modelSha256,camera},null,2)}</pre></details></section>`;
}).join('\n');
fs.writeFileSync(`${out}/comparison.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>领口、袖口与细线边缘对照</title><style>body{margin:0;background:#f5f6f7;color:#263238;font:16px/1.6 "Microsoft YaHei",sans-serif}main{max-width:1840px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}figcaption{text-align:center;padding:8px;background:#e8edf0}img{display:block;width:100%}section{background:white;padding:20px;margin:24px 0;border-radius:8px}details{padding-top:12px;color:#53636e}pre{white-space:pre-wrap;word-break:break-all}</style><main><h1>领口、袖口与细线边缘对照</h1><p>2026-11-11 · 两款服装 × 两种显示方式 × 三个固定视角，共 12 组原始浏览器截图。点击图片查看原尺寸。</p><p>逐组核对模型指纹、相机中心、角度、倍率和平移完全一致。两侧截图均为 900 × 650；修改后显卡绘制以更高分辨率采样再显示。毫米几何与实际针距一致。</p><p>本轮改善采样与薄层阴影；真实针距保留，极细线在整衣倍率下仍会融合。当前仍是成衣示意，未做材料、垂坠与生产验收。</p><section><h2>领口与袖口局部放大</h2><img src="comparison-t-shirt-webgl.png" alt="相同裁切的领口与袖口对照"></section>${rows}</main></html>`);
console.log(JSON.stringify({pairs:after.results.length,comparison:`${out}/comparison.html`,contactSheets:2,cameraAndMeshIdentical:true}));
