import {expect,it} from 'vitest';
import {garmentRasterResolution,rasterGarment} from '@/lib/pattern/mesh/garment-raster';
import type {GarmentAppearance,GarmentAssembly3d,GarmentDisplay3d,GarmentDisplaySurface} from '@/types/garment3d';
const surface:GarmentDisplaySurface={id:'test.front#1',sourceId:'test.front',sourceSurfaceId:'test.front#1',copy:1,foldAxis:null,sourceHalfSign:0,localMm:[[0,0],[100,0],[100,100],[0,100]],uvMm:[[0,0],[100,0],[100,100],[0,100]],positionsMm:[[0,0,10],[100,0,10],[100,100,10],[0,100,10]],triangles:[0,1,2,0,2,3],simulationIds:[0,1,2,3],boundary:[0,1,2,3],layer:'outer',renderNormals:[[0,0,1],[0,0,1],[0,0,1],[0,0,1]]};
const source:GarmentAssembly3d={schema:'garment-os/garment-assembly/v1',templateId:'fixture',unit:'mm',stage:'seam-constrained-preview',surfaces:[surface],sourcePanelCount:1,seams:[],unassembledPanelIds:[],pending:[],drapeValidated:false,productionApproved:false,quality:{vertices:4,triangles:2,iterations:0,strainP95:0,maxStrain:0,maxSeamGapMm:0,connectedComponents:1,remeshAreaErrorRatio:0,nonManifoldEdges:0,boundaryLoops:1,maxBoundarySnapMm:0,maxBoundaryDeviationMm:0}};
const model:GarmentDisplay3d={templateId:'fixture',source,surfaces:[surface],settings:{subdivision:0,thicknessMm:0,roundedEdges:false},metrics:{controlTriangles:2,renderTriangles:2,boundaryEdges:4,maxControlDisplacementMm:0,maxBoundaryDisplacementMm:0,closedShell:false}},appearance:GarmentAppearance={color:'#ff0000',fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0},camera={centerMm:[50,50,0] as [number,number,number],yawDeg:0,tiltDeg:0,pixelsPerMm:1,panCss:[0,0] as [number,number]},size={width:120,height:120,dpr:1};
const pixel=(data:ReturnType<typeof rasterGarment>)=>Array.from(data.pixels.slice((60*data.width+60)*4,(60*data.width+60)*4+4));
it('software depth hides a thin inner/turnback layer independently of triangle draw order',()=>{
  const hidden={...surface,id:'turnback',positionsMm:surface.positionsMm.map(p=>[p[0],p[1],9.8] as [number,number,number]),detail:{kind:'turnback' as const,operationId:'fold',label:'fold',coordinateSpace:'path-mm' as const}},base=rasterGarment(model,appearance,camera,size,{scale:1});
  for(const surfaces of [[hidden,surface],[surface,hidden]])expect(rasterGarment({...model,surfaces},appearance,camera,size,{scale:1}).pixels).toEqual(base.pixels);
  expect(pixel(base)[0]).toBeGreaterThan(150);expect(pixel(base)[1]).toBe(0);
});
it('software texture uses source UV, restricts front-only print and blends transparent raster pixels',()=>{
  const image={width:1,height:1,pixels:new Uint8Array([0,255,0,255])},settings={...appearance,imageDataUrl:'data:image/png;base64,x',imageMode:'print' as const,imageTarget:'front' as const},front=rasterGarment(model,settings,camera,size,{scale:1,image}),back=rasterGarment({...model,surfaces:[{...surface,sourceId:'test.back'}]},settings,camera,size,{scale:1,image});
  expect(pixel(front)[0]).toBe(0);expect(pixel(front)[1]).toBeGreaterThan(150);expect(pixel(back)[0]).toBeGreaterThan(150);expect(pixel(back)[1]).toBe(0);
  const alpha=rasterGarment(model,settings,camera,size,{scale:1,image:{...image,pixels:new Uint8Array([0,255,0,128])}});expect(Math.abs(pixel(alpha)[0]-pixel(alpha)[1])).toBeLessThan(2);
});
it('software inspection preserves source data and scales the raster without changing world geometry',()=>{
  const before=JSON.stringify(model),one=rasterGarment(model,appearance,camera,size,{scale:1}),two=rasterGarment(model,appearance,camera,size,{scale:2});
  expect(two.width).toBe(one.width*2);expect(two.height).toBe(one.height*2);expect(JSON.stringify(model)).toBe(before);expect(one.pixels[3]).toBe(255);
});
it('quarter-pixel thread retains its area coverage as it moves across subpixel phases',()=>{
  // Independent oracle: a .25px-wide black strip covers exactly one quarter
  // of this pixel. A 2x2 sampler would miss two of these positions entirely.
  for(const shift of [.05,.30,.55,.70]){
    const strip={...surface,positionsMm:[[20,50+shift,10],[80,50+shift,10],[80,50+shift+.25,10],[20,50+shift+.25,10]] as GarmentDisplaySurface['positionsMm']};
    const frame=rasterGarment({...model,surfaces:[strip]},{...appearance,color:'#000000'},camera,size),i=(59*frame.width+60)*4;
    expect(Array.from(frame.pixels.slice(i,i+3))).toEqual([171,172,170]);
  }
});
it('adaptive coverage stays within the existing default depth and output buffer budget',()=>{
  for(const dpr of [1,1.5,2,3])for(const [width,height]of [[120,120],[900,650],[1800,1300],[3840,2160]]){
    const r=garmentRasterResolution({width,height,dpr});expect(r.samples).toBeGreaterThanOrEqual(2);expect(r.samples).toBeLessThanOrEqual(4);
    expect(r.width*r.height*8+r.outputWidth*r.outputHeight*4).toBeLessThanOrEqual(72000000);
  }
  expect(garmentRasterResolution(size).samples).toBe(4);expect(garmentRasterResolution({width:900,height:650,dpr:1}).samples).toBe(3);
});
