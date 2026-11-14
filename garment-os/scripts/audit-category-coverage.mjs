/** Offline registry/source audit. This does not operate a browser or approve production. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const out=process.env.GARMENT_EVIDENCE_DIR??'doc/evidence/category-workbench-20261111';
fs.mkdirSync(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {exportCategoryCoverage}=await server.ssrLoadModule('/src/application/category-coverage.ts');
  const report=exportCategoryCoverage();
  fs.writeFileSync(`${out}/coverage.json`,JSON.stringify(report,null,2));
  const count=report.counts;
  const lines=['# 服装品类映射审查','',
    `范围：${report.scope.includes}`,`不含：${report.scope.excludes}`,'',
    `登记 ${count.categories} 种构型；${count.templates} 个可执行参考模板；${count.garment3dCategories} 类含基型支持三维示意；${count.companyOnlyCategories} 类仅公司二维母版；${count.definitionOnlyCategories} 类待接整款 CAD。`,
    '', '角色需求是选定构型的设计契约；独立参考图不代表本款 CAD，源绑定不代表已完成工艺和试穿。全部生产验收为未通过。','',
    '| 品类 | 构型 | 可执行模板 | 成衣三维 | 必需角色缺同源身份 | 公司母版 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.rows.map(r=>`| ${r.category.label} | ${r.category.construction} | ${r.templateIds.join('、')||'待接入'} | ${r.garment3dIds.length?'曲面示意':'待接入'} | ${r.missingSourceRoles.join('、')||'无（仍须查工艺/材料）'} | ${r.companyMasterIds.join('、')||'未登记'} |`),
    '', '浏览器验收：依用户安排稍后进行。本表是源数据审查结果，不是页面截图或生产验收。',
  ];
  fs.writeFileSync(`${out}/品类映射审查.md`,lines.join('\n'));
  const research='research/style3d-reference-20261111';
  const files=fs.readdirSync(research).filter(name=>/\.(html|txt|json)$/.test(name));
  const hashes=files.map(name=>({path:`${research}/${name}`,sha256:createHash('sha256').update(fs.readFileSync(`${research}/${name}`)).digest('hex')}));
  fs.writeFileSync(`${out}/research-hashes.json`,JSON.stringify({files:hashes,note:'Public HTTP captures; interface and first-project articles contain the usable UI/workflow evidence. Studio product shell and empty core-module article do not substantiate features.'},null,2));
  console.log(JSON.stringify({out,counts:count,browserAcceptance:false,productionApproved:false},null,2));
}finally{await server.close();}
