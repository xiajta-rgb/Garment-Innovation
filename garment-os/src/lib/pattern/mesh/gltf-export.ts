import type { PatternMesh3d } from '@/types/pattern3d';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes:Uint8Array):string{
  let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}return out;
}
/** Self-contained glTF 2.0. POSITION uses metres; custom CAD attributes explicitly use mm. */
export function exportPatternGltf(model:PatternMesh3d):string{
  if(model.stage!=='flat-panel-placement'||!model.panels.length)throw new Error('没有可导出的裁片网格');
  const chunks:Uint8Array[]=[],bufferViews:unknown[]=[],accessors:unknown[]=[],meshes:unknown[]=[],nodes:unknown[]=[];let offset=0;
  const attribute=(values:number[],width:number,integer=false)=>{
    if(values.some(v=>!Number.isFinite(v)))throw new Error('网格导出含无效数值');
    const array=integer?new Uint32Array(values):new Float32Array(values),index=bufferViews.length;
    const bytes=new Uint8Array(array.buffer);chunks.push(bytes);bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});offset+=bytes.length;
    const min=Array.from({length:width},(_,k)=>Math.min(...values.filter((_,i)=>i%width===k))),max=Array.from({length:width},(_,k)=>Math.max(...values.filter((_,i)=>i%width===k)));
    accessors.push({bufferView:index,componentType:integer?5125:5126,count:values.length/width,type:width===3?'VEC3':width===2?'VEC2':'SCALAR',min,max});return accessors.length-1;
  };
  for(const panel of model.panels){
    const positions=attribute(panel.positionsMm.flatMap(v=>v.map(x=>x/1000)),3),cad=attribute(panel.vertices.flatMap(v=>v.localMm),2),source=attribute(panel.vertices.flatMap(v=>v.sourceMm),2),indices=attribute(panel.triangles,1,true);
    meshes.push({name:panel.id,primitives:[{attributes:{POSITION:positions,_CAD2D:cad,_SOURCE2D:source},indices,material:0,mode:4}]});
    nodes.push({name:panel.id,mesh:meshes.length-1,extras:{sourceId:panel.sourceId,copy:panel.copy,quantity:panel.quantity,material:panel.material,unfolded:panel.unfolded,placementMm:panel.placement,customAttributeUnit:'mm',sourceEdges:panel.sourceEdges,
      vertexTrace:panel.vertices.map(v=>({edge:v.sourceEdge,t:v.t,mirrored:v.mirrored})),metrics:panel.metrics}});
  }
  const binary=new Uint8Array(offset);let cursor=0;for(const chunk of chunks){binary.set(chunk,cursor);cursor+=chunk.length;}
  return JSON.stringify({asset:{version:'2.0',generator:'GarmentOS source pattern mapping'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,
    materials:[{name:'Reference panels',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.4,.65,.85,1],metallicFactor:0,roughnessFactor:1}}],
    buffers:[{byteLength:offset,uri:`data:application/octet-stream;base64,${base64(binary)}`}],bufferViews,accessors,
    extras:{schema:model.schema,templateId:model.templateId,engine:model.engine,version:model.version,sourceUnit:'mm',positionUnit:'m',stage:model.stage,seams:model.seams,pending:model.pending,simulationReady:false,drapeValidated:false,productionApproved:false}},null,2);
}
