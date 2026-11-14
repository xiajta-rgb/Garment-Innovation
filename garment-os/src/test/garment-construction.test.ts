import {beforeAll,expect,it} from 'vitest';
import {createPattern3d} from '@/application/pattern-3d';
import {getReferenceMeasurements} from '@/data/referenceMeasurements';
import {assembleGarment} from '@/lib/pattern/mesh/garment-assembly';
import {createFinishedGarment} from '@/lib/pattern/mesh/garment-finish';
import {DEFAULT_GARMENT_FINISH,exportGarmentFinishCad,garmentFinishPlan,validateGarmentFinish} from '@/lib/pattern/mesh/garment-finish-plan';
import {DEFAULT_GARMENT_SURFACE} from '@/lib/pattern/mesh/garment-surface';
import {garmentTechnicalView,exportGarmentTechnicalSvg} from '@/lib/pattern/mesh/garment-technical-view';
import {projectPhysicalPoint} from '@/lib/pattern/mesh/viewport-mapping';
import {garmentFashionSheet,exportGarmentFashionSvg} from '@/lib/pattern/mesh/garment-fashion-sheet';
import {maskContour,cleanViewContour} from '@/lib/pattern/mesh/garment-view-contour';
import type {GarmentAssembly3d,GarmentDisplay3d,GarmentDisplaySurface} from '@/types/garment3d';

const build=(id:string)=>assembleGarment(createPattern3d({activePatternId:id,gender:'male',standardSize:'M',fit:'regular',measurements:getReferenceMeasurements('male','M'),engineVersion:'4.10.2',garmentColor:'#87CEEB',fabricId:'solid'}));
let source:GarmentAssembly3d,finished:GarmentDisplay3d;
beforeAll(()=>{source=build('brian-reference');finished=createFinishedGarment(source);});

for(const id of ['brian-reference','t-shirt','womens-basic-tee','long-sleeve-tee','bound-tank'])it(`finished example stays attached to explicit source openings: ${id}`,()=>{
  const model=id==='brian-reference'?source:build(id),before=JSON.stringify(model),display=createFinishedGarment(model),neck=model.openings!.find(o=>o.role==='neck')!;
  expect(JSON.stringify(model)).toBe(before);expect(display.source).toBe(model);expect(display.illustration?.mode).toBe('technical-illustration');
  expect(model.openings).toHaveLength(4);expect(neck.sourceBoundaries.length).toBe(2);expect(neck.sourceBoundaries.every(b=>b.runs===2)).toBe(true);
  expect(model.surfaces.find(s=>s.id===neck.edges[0].surfaceId)!.sourceId.endsWith('.back')).toBe(true);
  for(const opening of model.openings!){
    expect(opening.sourceLengthMm).toBeGreaterThan(0);
    for(let i=0;i<opening.edges.length;i++){
      const a=opening.edges[i],b=opening.edges[(i+1)%opening.edges.length],sa=model.surfaces.find(s=>s.id===a.surfaceId)!,sb=model.surfaces.find(s=>s.id===b.surfaceId)!;
      expect(sa.simulationIds[a.b]).toBe(sb.simulationIds[b.a]);
    }
  }
  for(const s of display.surfaces){expect(s.positionsMm.flat().every(Number.isFinite)).toBe(true);expect(s.renderNormals.flat().every(Number.isFinite)).toBe(true);}
  expect(display.finishPlan?.productionApproved).toBe(false);expect(display.finishPlan?.materialValidated).toBe(false);
  if(id==='bound-tank'){expect(display.finishPlan?.neckband).toBeNull();expect(display.finishPlan?.hems).toHaveLength(1);}
  else {expect(display.finishPlan?.neckband).not.toBeNull();expect(display.finishPlan?.hems).toHaveLength(3);expect(display.surfaces.filter(s=>s.detail?.kind==='thread')).toHaveLength(11);}
},15000);

it('rib cutting dimensions and quarter notches follow the source loop and editable finish specification',()=>{
  const settings={...DEFAULT_GARMENT_FINISH,neckWidthMm:22,neckRatio:.88,seamAllowanceMm:7},plan=garmentFinishPlan(source,settings),b=plan.neckband!,loop=source.openings!.find(o=>o.role==='neck')!.sourceLengthMm;
  expect(b.netLengthMm).toBeCloseTo(loop*.88,10);expect(b.cutLengthMm).toBeCloseTo(loop*.88+14,10);expect(b.cutWidthMm).toBe(58);expect(b.foldYmm).toBe(29);
  expect(b.quarterNotchesMm).toEqual([0,.25,.5,.75,1].map(t=>7+loop*.88*t));
  const svg=exportGarmentFinishCad(plan);expect(svg).toContain(`width="${b.cutLengthMm+40}mm"`);expect(svg).toContain('draft example');
});

it('trim and turnback strips are closed with coherent edges; the rib loop has no shoulder spikes',()=>{
  for(const s of finished.surfaces.filter(s=>s.layer==='finish')){
    const edges=new Map<string,{count:number;direction:number}>();
    for(let t=0;t<s.triangles.length;t+=3)for(let k=0;k<3;k++){
      const a=s.simulationIds[s.triangles[t+k]],b=s.simulationIds[s.triangles[t+(k+1)%3]],key=`${Math.min(a,b)}:${Math.max(a,b)}`,e=edges.get(key)??{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);
    }
    expect([...edges.values()].every(e=>e.count===2&&e.direction===0)).toBe(true);
    const shared=new Map<number,number[]>();for(const [i,id]of s.simulationIds.entries()){const previous=shared.get(id);if(previous)expect(s.positionsMm[i]).toEqual(previous);else shared.set(id,s.positionsMm[i]);}
    if(s.detail?.kind==='rib'){
      const rows=6,stations=s.positionsMm.length/(2*rows)-1;
      for(let i=0;i<stations;i++)for(let j=0;j<rows;j++)expect(Math.hypot(...s.positionsMm[(i+1)*rows+j].map((v,k)=>v-s.positionsMm[i*rows+j][k]))).toBeLessThan(3);
    }
  }
});

it('finish toggle removes real detail geometry and default cache keys are shared with exports',()=>{
  expect(createFinishedGarment(source,{surface:{...DEFAULT_GARMENT_SURFACE},finish:{...DEFAULT_GARMENT_FINISH}})).toBe(finished);
  const off=createFinishedGarment(source,{finish:{...DEFAULT_GARMENT_FINISH,enabled:false}});
  expect(off.surfaces.some(s=>s.detail)).toBe(false);expect(off.constructionLines).toEqual([]);expect(off.finishPlan?.operations).toEqual([]);
  const wider=createFinishedGarment(source,{finish:{...DEFAULT_GARMENT_FINISH,neckWidthMm:26}});
  expect(wider.finishPlan!.neckband!.cutWidthMm-finished.finishPlan!.neckband!.cutWidthMm).toBe(16);
  expect(wider.surfaces.find(s=>s.detail?.kind==='rib')!.positionsMm).not.toEqual(finished.surfaces.find(s=>s.detail?.kind==='rib')!.positionsMm);
  expect(wider.surfaces.find(s=>s.layer==='outer')).toBe(finished.surfaces.find(s=>s.layer==='outer'));
});

it('technical flats use the displayed mesh and camera, with front/back occlusion',()=>{
  const donor=finished.surfaces[0],panel=(id:string,z:number,rib=false):GarmentDisplaySurface=>({...donor,id,sourceSurfaceId:id,positionsMm:[[-50,0,z],[50,0,z],[50,100,z],[-50,100,z]],localMm:[[0,0],[100,0],[100,100],[0,100]],uvMm:[[0,0],[100,0],[100,100],[0,100]],triangles:[0,1,2,0,2,3],simulationIds:[0,1,2,3],renderNormals:[[0,0,1],[0,0,1],[0,0,1],[0,0,1]],layer:rib?'finish':'outer',detail:rib?{kind:'rib',operationId:id,label:id,coordinateSpace:'cut-piece-mm'}:undefined});
  const model={...finished,surfaces:[panel('body',10),panel('hidden-rib',-10,true)],constructionLines:[]};
  const front=garmentTechnicalView(model,0),back=garmentTechnicalView(model,180);
  expect(front.camera.pixelsPerMm).toBe(back.camera.pixelsPerMm);expect(garmentTechnicalView(model,90).camera.pixelsPerMm).toBe(front.camera.pixelsPerMm);
  expect(front.fills.find(f=>f.rib)!.path).toBe('');expect(back.fills.find(f=>f.rib)!.path).not.toBe('');
  const expected=projectPhysicalPoint(model.surfaces[0].positionsMm[0],front.camera,{width:front.width,height:front.height,dpr:1}),coords=front.fills[0].path.match(/-?[\d.]+/g)!.map(Number);
  const distances=Array.from({length:coords.length/2},(_,i)=>Math.hypot(coords[2*i]-expected[0],coords[2*i+1]-expected[1]));
  expect(Math.min(...distances)).toBeLessThan(1.1);expect(exportGarmentTechnicalSvg(model)).toContain('Same finished mesh');
});

it('visible-union contours keep holes and separate pieces without triangle fragments',()=>{
  const mask=new Uint8Array(20*20);for(let y=2;y<16;y++)for(let x=2;x<16;x++)if(!(x>6&&x<11&&y>6&&y<11))mask[y*20+x]=1;
  mask[18*20+18]=2;
  const path=maskContour(mask,20,20,2);expect(path.match(/Z/g)).toHaveLength(3);expect(path).not.toMatch(/NaN|Infinity/);
  expect(maskContour(mask,20,20,2,true).match(/Z/g)).toHaveLength(1);
});

it('removes shallow display jitter while preserving right-angle pattern corners and the input stations',()=>{
  const points:[number,number][]=[[0,0],[100,0]];
  for(let y=10;y<100;y+=10)points.push([100+(y%20===0?1:-1),y]);
  points.push([100,100],[0,100],[0,0]);
  const before=JSON.stringify(points),path=cleanViewContour(points);
  expect(path).toBe('M0.00 0.00L100.00 0.00L100.00 100.00L0.00 100.00Z');
  expect(JSON.stringify(points)).toBe(before);
});

it('front/back fashion callouts share current operations and dimensions, with no hidden finish claims',()=>{
  const model=createFinishedGarment(source,{finish:{...DEFAULT_GARMENT_FINISH,neckWidthMm:21,bodyHemMm:29,needleGaugeMm:5}}),snapshot=JSON.stringify(model),sheet=garmentFashionSheet(model),svg=exportGarmentFashionSvg(model,sheet);
  expect(sheet.views[0].camera.pixelsPerMm).toBe(sheet.views[1].camera.pixelsPerMm);expect(sheet.notes).toHaveLength(4);
  expect(svg).toContain('成品宽 21 mm');expect(svg).toContain('下摆折深 29 mm');expect(svg).toContain('双针间距 5 mm');expect(svg).not.toMatch(/NaN|Infinity/);
  for(const n of sheet.notes){const lines=sheet.views[n.viewIndex].lines.filter(l=>n.operationIds.includes(l.id));expect(lines.some(l=>l.points.some(p=>p[0]===n.anchor[0]&&p[1]===n.anchor[1]))).toBe(true);}
  expect(sheet.views[0].ribs.length).toBeGreaterThan(100);expect(svg.length).toBeLessThan(180000);expect(JSON.stringify(model)).toBe(snapshot);
  const off=garmentFashionSheet(createFinishedGarment(source,{finish:{...DEFAULT_GARMENT_FINISH,enabled:false}}));expect(off.notes).toEqual([]);expect(off.views.every(v=>!v.ribs)).toBe(true);
  const escaped=exportGarmentFashionSvg({...model,templateId:'<script>&"test"'});expect(escaped).not.toContain('<script>');expect(escaped).toContain('&lt;script&gt;');
});

it('long sleeves hang below their caps and round-neck illustration retains separate front/back depths',()=>{
  for(const opening of source.openings!.filter(o=>o.role==='sleeve-hem')){
    const points=opening.edges.map(e=>source.surfaces.find(s=>s.id===e.surfaceId)!.positionsMm[e.a]),surfaceId=opening.edges[0].surfaceId,cap=source.seams.find(s=>s.id.startsWith('cap-')&&s.aPanels.includes(surfaceId))!;
    const capPoints=cap.path!.map(r=>source.surfaces.find(s=>s.id===r.surfaceId)!.positionsMm[r.vertex]),mean=(ps:number[][],k:number)=>ps.reduce((sum,p)=>sum+p[k]/ps.length,0);
    const dx=mean(points,0)-mean(capPoints,0),dy=mean(points,1)-mean(capPoints,1);expect(dy).toBeLessThan(0);expect(Math.abs(dy/dx)).toBeGreaterThan(1.3);
  }
  const neck=source.openings!.find(o=>o.role==='neck')!,depths=[false,true].map(back=>{
    const points=neck.edges.filter(e=>source.surfaces.find(s=>s.id===e.surfaceId)!.sourceId.endsWith('.back')===back).map(e=>finished.surfaces.find(s=>s.layer==='outer'&&s.sourceSurfaceId===e.surfaceId)!.positionsMm[e.a]);
    return Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
  });expect(depths[0]).toBeGreaterThan(depths[1]+10);
});

it('invalid dimensions and missing opening lineage block finish generation',()=>{
  for(const patch of [{neckWidthMm:NaN},{neckRatio:1.1},{bodyHemMm:10,needleGaugeMm:6}])expect(()=>validateGarmentFinish({...DEFAULT_GARMENT_FINISH,...patch})).toThrow();
  expect(()=>garmentFinishPlan({...source,openings:[]})).toThrow('缺少源工艺边界');
});
