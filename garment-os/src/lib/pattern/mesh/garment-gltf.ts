import { garmentNormals,garmentUv,garmentSourcePoint,garmentUsesImage } from './garment-view';
import { createFinishedGarment,garmentDetailColor } from './garment-finish';
import type { GarmentAppearance,GarmentAssembly3d } from '@/types/garment3d';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encode(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);out+=alphabet[n>>>18&63]+alphabet[n>>>12&63]+(i+1<bytes.length?alphabet[n>>>6&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}return out;}
/** One portable file with actual curved surfaces, UVs, materials and raster maps. */
export function exportGarmentGltf(model:GarmentAssembly3d,appearance:GarmentAppearance,tileDataUrl:string):string{
  if(!model.surfaces.length||!/^data:image\/png;base64,/.test(tileDataUrl))throw new Error('成衣表面或面料贴图不可用');
  const chunks:Uint8Array[]=[],bufferViews:object[]=[],accessors:object[]=[],meshes:object[]=[],nodes:object[]=[];let offset=0;
  const add=(values:number[],width:number,integer=false)=>{if(values.some(v=>!Number.isFinite(v)))throw new Error('成衣导出含无效坐标');const array=integer?new Uint32Array(values):new Float32Array(values),bytes=new Uint8Array(array.buffer),view=bufferViews.length;
    chunks.push(bytes);bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});offset+=bytes.length;
    accessors.push({bufferView:view,componentType:integer?5125:5126,count:values.length/width,type:width===3?'VEC3':width===2?'VEC2':'SCALAR',min:Array.from({length:width},(_,k)=>Math.min(...values.filter((_,i)=>i%width===k))),max:Array.from({length:width},(_,k)=>Math.max(...values.filter((_,i)=>i%width===k)))});return accessors.length-1;};
  const image=appearance.imageDataUrl;if(image&&!/^data:image\/(png|jpeg|webp);base64,/.test(image))throw new Error('只支持已读取的本地光栅贴图');
  const display=createFinishedGarment(model,appearance),detailBase=image?2:1;
  for(const surface of display.surfaces){const position=add(surface.positionsMm.flatMap(p=>p.map(v=>v/1000)),3),normal=add(garmentNormals(surface).flat(),3),uv=add(garmentUv(surface,appearance),2),cad=add(surface.uvMm.flat(),2),source=add(surface.uvMm.flatMap(p=>garmentSourcePoint(surface,p)),2),indices=add(surface.triangles,1,true);
    const uploaded=image&&garmentUsesImage(surface,appearance);
    const attributes=surface.detail?.coordinateSpace==='path-mm'?{POSITION:position,NORMAL:normal,TEXCOORD_0:uv,_PATH2D:cad}:{POSITION:position,NORMAL:normal,TEXCOORD_0:uv,_CAD2D:cad,_SOURCE2D:source};
    const detailMaterial=surface.detail?detailBase+(['rib','turnback','thread'] as const).indexOf(surface.detail.kind):null;
    meshes.push({name:surface.id,primitives:[{attributes,indices,material:detailMaterial??(uploaded?1:0),mode:4}]});nodes.push({name:surface.id,mesh:meshes.length-1,extras:{sourceId:surface.sourceId,sourceSurfaceId:surface.sourceSurfaceId,layer:surface.layer,copy:surface.copy,foldAxis:surface.foldAxis,sourceHalfSign:surface.sourceHalfSign,sourceAttributeUnit:'mm',detail:surface.detail??null}});
  }
  const binary=new Uint8Array(offset);let cursor=0;for(const chunk of chunks){binary.set(chunk,cursor);cursor+=chunk.length;}
  const material=(texture:number)=>({doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:texture},metallicFactor:0,roughnessFactor:.92}});
  const detailMaterials=(['rib','turnback','thread'] as const).map(kind=>{const s=display.surfaces.find(s=>s.detail?.kind===kind),hex=s?garmentDetailColor(s,appearance.color):appearance.color,rgb=[1,3,5].map(i=>{const v=parseInt(hex.slice(i,i+2),16)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return {name:kind,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:0,roughnessFactor:.95}};});
  return JSON.stringify({asset:{version:'2.0',generator:'GarmentOS seam constrained garment preview'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,
    accessors,bufferViews,buffers:[{byteLength:offset,uri:`data:application/octet-stream;base64,${encode(binary)}`}],
    images:[{uri:tileDataUrl},...(image?[{uri:image}]:[])],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497},{magFilter:9729,minFilter:9987,wrapS:appearance.imageMode==='print'?33071:10497,wrapT:appearance.imageMode==='print'?33071:10497}],
    textures:[{source:0,sampler:0},...(image?[{source:1,sampler:1}]:[])],materials:[material(0),...(image?[material(1)]:[]),...detailMaterials],
    extras:{schema:model.schema,sourceUnit:'mm',positionUnit:'m',stage:'technical-illustration',quality:model.quality,qualityAppliesTo:'source-seam-experiment',rendering:{settings:display.settings,metrics:display.metrics,illustration:display.illustration},finishPlan:display.finishPlan,constructionLines:display.constructionLines,seams:model.seams,unassembledPanelIds:model.unassembledPanelIds,pending:model.pending,drapeValidated:false,productionApproved:false}},null,2);
}
