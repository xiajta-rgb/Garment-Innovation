import { Aaron } from '@freesewing/aaron';
import { Huey } from '@freesewing/huey';
import { Path } from '@freesewing/core';
import * as models from '@freesewing/models';
import { writeFileSync } from 'node:fs';

const reports=[];
for(const [name,Design] of [['aaron',Aaron],['huey',Huey]]){
  const draft=new Design({measurements:models.cisMaleAdult38,expand:true,sa:10});draft.draft();
  const store=draft.setStores[0],cutlist=store.get('cutlist');
  const pieces=Object.entries(draft.parts[0]).filter(([,p])=>!p.hidden&&p.paths.seam);
  const report={engine:name,measurements:draft.config.measurements,options:draft.settings[0].options,
    pieces:pieces.map(([id,p])=>({id,cutlist:cutlist[id],points:Object.keys(p.points).filter(k=>!k.startsWith('_')),
      paths:Object.fromEntries(Object.entries(p.paths).filter(([,v])=>!v.hidden).map(([k,v])=>[k,{classes:v.attributes?.list?.class,d:v.asPathstring()}])),
      edges:p.paths.seam.ops.map(o=>({type:o.type,point:Object.entries(p.points).filter(([k])=>!k.startsWith('_')).find(([,p])=>p.x===o.to?.x&&p.y===o.to?.y)?.[0],to:o.to&&{x:o.to.x,y:o.to.y}}))})),
    checks:[]};
  if(name==='aaron'){
    const f=draft.parts[0]['aaron.front'].points,b=draft.parts[0]['aaron.back'].points;
    const front=new Path().move(f.strapLeft).curve(f.strapLeftCp2,f.cfNeckCp1,f.cfNeck).length();
    const back=new Path().move(b.strapLeft).curve(b.strapLeftCp2,b.cbNeck,b.cbNeck).length();
    report.checks.push({id:'actual-neck-binding-ratio',actual:store.get('neckBindingLength'),target:(front+back)*2*.95,delta:store.get('neckBindingLength')-(front+back)*2*.95});
  }
  reports.push(report);
}
writeFileSync('research/source-study-20261110/knit-source-probe.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports.map(r=>({...r,pieces:r.pieces.map(p=>({id:p.id,cutlist:p.cutlist,edges:p.edges,visiblePaths:Object.keys(p.paths)}))})),null,2));
