/** Preserve native source behavior and the pocket conflict; never patches third-party sources. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Paco} from '@freesewing/paco';
import {cisMaleAdult38} from '@freesewing/models';
const out='research/foundation-blocks-20261111';fs.mkdirSync(out,{recursive:true});
const sources=['paco','teagan'].flatMap(name=>{
  const root=`node_modules/@freesewing/${name}`;
  assert.equal(JSON.parse(fs.readFileSync(`${root}/package.json`)).version,'4.10.2');
  return ['package.json',...fs.readdirSync(`${root}/src`).filter(f=>f.endsWith('.mjs')).map(f=>`src/${f}`)].map(f=>{
    const file=`${root}/${f}`;return {path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
  });
});
const cases=[];
for(const frontPockets of [false,true]){
  const p=new Paco({measurements:cisMaleAdult38,options:{frontPockets,backPockets:false,elasticatedCuff:false},sa:10,expand:true});p.draft();
  const cutlist=p.setStores[0].get('cutlist'),parts=Object.entries(p.parts[0]).filter(([,part])=>Object.keys(part.paths).length).map(([id,part])=>({id,paths:Object.keys(part.paths),cutlist:cutlist[id]??null,netPath:part.paths.seam?.asPathstring()??part.paths.pocket?.asPathstring()??null}));
  cases.push({frontPockets,parts});
}
const bag=cases[1].parts.find(p=>p.id==='paco.frontPocketBag');assert(bag);assert(!bag.paths.includes('seam'));assert(bag.paths.includes('pocket'));
const bagSource=fs.readFileSync('node_modules/@freesewing/paco/src/frontpocketbag.mjs','utf8');assert(bagSource.includes("macro('cutonfold'"));
fs.writeFileSync(`${out}/native-contracts.json`,JSON.stringify({kind:'pinned-native-source-research',sources,cases,
  decisions:{pantsBaseline:{frontPockets:false,backPockets:false,elasticatedCuff:false},
    frontPocket:'blocked: bag uses paths.pocket plus cutonfold macro; cutlist must be resolved before generic source adapter integration',
    sleeve:'Teagan set-in sleeve extension/width only; raglan and dropped shoulder need a separate compatible body contract'},
  productionApproved:false},null,2));
console.log(JSON.stringify({out,sourceFiles:sources.length,cases:cases.length,pocketBag:bag},null,2));
