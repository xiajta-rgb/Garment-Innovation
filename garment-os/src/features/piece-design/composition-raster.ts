import type { EmbeddedRaster } from '@/types/composition-elements';
import { readEmbeddedRaster } from '@/lib/pattern/composition-elements';
import type { ManagedMaterial } from '@/types/managed-material';
import { MATERIAL_API } from '@/application/managed-materials';

async function raster(url:string,transparent:boolean,remote:boolean):Promise<EmbeddedRaster>{
 const image=new Image();if(remote){image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';}
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{image.src='';reject(Error('图片加载超时，请稍后重试'));},20_000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('来源图片无法用于套料，请确认图片可访问'));};image.src=url;});
 const ratio=Math.min(1,(transparent?512:768)/Math.max(image.naturalWidth,image.naturalHeight)),width=Math.max(1,Math.round(image.naturalWidth*ratio)),height=Math.max(1,Math.round(image.naturalHeight*ratio));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法读取图片');
 if(!transparent){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);}ctx.drawImage(image,0,0,width,height);
 try{return readEmbeddedRaster({dataUrl:canvas.toDataURL(transparent?'image/png':'image/jpeg',.85),width,height});}catch{throw Error('图片无法嵌入，请换用可读取的PNG、JPEG或WebP图片');}
}
export async function materialRaster(material:ManagedMaterial){
 const response=await fetch(MATERIAL_API+'/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({materialId:material.materialId,url:material.materialPic}),signal:AbortSignal.timeout(60_000)});
 if(!response.ok){const error=await response.json().catch(()=>({error:'无法读取来源图片'}));throw Error(error.error??'无法读取来源图片');}
 const blob=await response.blob(),url=URL.createObjectURL(blob);try{return await raster(url,false,false);}finally{URL.revokeObjectURL(url);}
}
export async function logoRaster(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000)throw Error('请上传8MB以内的PNG、JPEG或WebP Logo');
 const url=URL.createObjectURL(file);try{return await raster(url,true,false);}finally{URL.revokeObjectURL(url);}
}
