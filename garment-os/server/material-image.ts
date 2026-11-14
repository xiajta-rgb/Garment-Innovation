import { MaterialError } from '../src/application/managed-materials';
import sharp from 'sharp';

const SOURCE_LIMIT=64_000_000,OUTPUT_LIMIT=4_000_000,MAX_EDGE=2560;

/** Keep ordinary photos byte-for-byte; prepare oversized sources for local design use. */
async function prepareMaterialImage(bytes:Buffer,contentType:string){
 if(bytes.length<=12_000_000)return {bytes,contentType};
 try{
  const image=sharp(bytes,{limitInputPixels:80_000_000,animated:false}).rotate();
  for(const [edge,quality] of [[MAX_EDGE,90],[2048,84],[1536,78]]){
   const result=await image.clone().resize({width:edge,height:edge,fit:'inside',withoutEnlargement:true}).webp({quality,effort:4}).toBuffer();
   if(result.length<=OUTPUT_LIMIT)return {bytes:result,contentType:'image/webp'};
  }
  throw new MaterialError(413,'面料图压缩后仍过大，请换用局部肌理图');
 }catch(error){if(error instanceof MaterialError)throw error;throw new MaterialError(422,'面料图无法压缩，请换用可读取的图片');}
}

/** Only source images observed in actual material queries may be read. No credentials are forwarded. */
export async function fetchMaterialImage(value:unknown,observed:Map<string,string>,request:typeof fetch=fetch){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new MaterialError(400,'请选择已查询的面料图片');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['materialId','url'].includes(k))||typeof v.materialId!=='string'||typeof v.url!=='string'||observed.get(v.materialId)!==v.url)throw new MaterialError(400,'图片与已查询的面料来源不一致，请重新查询后选择');
 const url=new URL(v.url);
 if(url.protocol!=='https:'||url.username||url.password||!/^[a-z0-9-]+\.cos\.[a-z0-9-]+\.myqcloud\.com$/.test(url.hostname))throw new MaterialError(400,'此面料图片来源尚未接通本地读取');
 try{
  const response=await request(url.href,{redirect:'error',headers:{Accept:'image/png,image/jpeg,image/webp'},signal:AbortSignal.timeout(45_000)});
  const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(!response.ok||!type||!['image/png','image/jpeg','image/webp'].includes(type)||!response.body)throw new MaterialError(502,'来源图片未返回可读取的PNG、JPEG或WebP');
  const limit=SOURCE_LIMIT;
  if(Number(response.headers.get('content-length'))>limit){await response.body.cancel();throw new MaterialError(413,'来源图片超过64MB，请换用局部肌理图');}
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>limit){await reader.cancel();throw new MaterialError(413,'来源图片超过64MB，请换用局部肌理图');}chunks.push(next.value);}}finally{reader.releaseLock();}
  if(!size)throw new MaterialError(502,'来源图片为空');
  const prepared=await prepareMaterialImage(Buffer.concat(chunks),type);
  return {...prepared,sourceBytes:size,compressed:prepared.contentType!==type||prepared.bytes.length!==size};
 }catch(error){if(error instanceof MaterialError)throw error;throw new MaterialError(502,'无法读取来源图片，请重试或选择其他面料');}
}
