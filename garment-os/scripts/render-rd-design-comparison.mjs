/** Compare actual source artwork and current offline renders. No browser or AI image. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.GARMENT_SHARP_MODULE??'C:/Users/xmls/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir='doc/evidence/rd-design-alignment-20261111',samples=JSON.parse(fs.readFileSync('research/rd-design-reference-20261111/samples.json','utf8'));
for(const s of samples){if(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex')!==s.sha256.toLowerCase())throw Error('Reference image changed: '+s.recordId);}
const source=samples.find(s=>s.recordId==='reczz28Xjq3qifFs');
const metadata=await sharp(source.file).metadata();
const reference=await sharp(source.file).extract({left:Math.round(metadata.width*.015),top:Math.round(metadata.height*.266),width:Math.round(metadata.width*.308),height:Math.round(metadata.height*.484)}).resize(470,600,{fit:'contain',background:'#fff'}).toBuffer();
const drawing=await sharp(dir+'/t-shirt-fashion.png').extract({left:20,top:120,width:560,height:590}).resize(470,600,{fit:'contain',background:'#fff'}).toBuffer();
const model=await sharp(dir+'/t-shirt-after-depth.png').resize(470,600,{fit:'contain',background:'#fff'}).toBuffer();
const labels=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="960"><g font-family="Microsoft YaHei, sans-serif" fill="#26313c"><text x="30" y="45" font-size="27" font-weight="600">研发设计稿表达对照</text><text x="30" y="75" font-size="14">不同款式，比较表达规则；未作同款尺寸一致判定。当前图片为真实网格离线渲染，非页面截图。</text><text x="30" y="125" font-size="18">飞书原稿 · COT25M002</text><text x="545" y="125" font-size="18">当前系统 · 前后款式稿中的正面</text><text x="1060" y="125" font-size="18">当前系统 · 同一三维完成态</text><text x="30" y="800" font-size="17">已对应：自然袖姿、圆领罗纹、装袖结构线、袖口与下摆双针、可追溯工艺标注。</text><text x="30" y="840" font-size="15">原稿该款：领高17.5mm，袖口/下摆20mm坎车。当前示例：领宽18mm，袖口20mm、下摆25mm。</text><text x="30" y="875" font-size="15">保留缺口：后领包边、商标、实际材料、物理垂坠；侧视仅为组装参考。未宣称生产验收通过。</text><text x="30" y="925" font-size="12" fill="#6b7480">原稿为用户指定研发货盘的设计稿字段；当前示例为Teagan参考裁片生成，未改变原始CAD尺寸。</text></g></svg>');
await sharp({create:{width:1560,height:960,channels:4,background:'#fff'}}).composite([{input:reference,left:30,top:155},{input:drawing,left:545,top:155},{input:model,left:1060,top:155},{input:labels,left:0,top:0}]).png().toFile(dir+'/reference-comparison.png');
console.log(JSON.stringify({samplesVerified:samples.length,sourceRecordId:source.recordId,output:dir+'/reference-comparison.png',browserAcceptance:false,productionApproved:false},null,2));
