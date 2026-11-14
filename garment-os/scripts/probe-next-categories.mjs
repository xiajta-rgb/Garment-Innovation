import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Sandy} from '@freesewing/sandy';
import {Penelope} from '@freesewing/penelope';
import * as models from '@freesewing/models';
const out='research/category-connection-20261111';fs.mkdirSync(out,{recursive:true});
const measurements=models.cisFemaleAdult34;
const results=[];
for(const [name,Design,options] of [
  ['sandy',Sandy,{waistbandPosition:0,waistbandShape:'straight',seamlessFullCircle:false,panels:2,circleRatio:1,gathering:0}],
  ['penelope',Penelope,{}],
]){
  const p=new Design({measurements,options,sa:10,expand:true});p.draft();
  const cutlist=p.setStores[0].get('cutlist');
  const parts=Object.entries(p.parts[0]).filter(([,v])=>!v.hidden).map(([id,part])=>({id,
    cutlist:cutlist[id],points:Object.fromEntries(Object.entries(part.points).filter(([key])=>!key.startsWith('_')).map(([key,v])=>[key,{x:v.x,y:v.y}])),
    paths:Object.fromEntries(Object.entries(part.paths).filter(([,v])=>!v.hidden).map(([key,v])=>[key,{d:v.asPathstring(),ops:v.ops,lengthMm:v.length(),classes:v.attributes?.list?.class}])),
  }));
  const sourceFiles=name==='sandy'?['skirt','straight-waistband','curved-waistband','waistband']:['waistband','shape','front','back'];
  const sources=sourceFiles.map(file=>{const path=`node_modules/@freesewing/${name}/src/${file}.mjs`;return {path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')};});
  const probe={name,version:'4.10.2',profile:'cisFemaleAdult34',measurements,options:p.settings[0].options,parts,sources,productionApproved:false};
  fs.writeFileSync(`${out}/${name}-probe.json`,JSON.stringify(probe,null,2));
  results.push({name,pieces:parts.map(p=>({id:p.id,cutlist:p.cutlist,paths:Object.keys(p.paths),netLength:p.paths.seam?.lengthMm??p.paths.outline?.lengthMm}))});
}
console.log(JSON.stringify(results,null,2));
