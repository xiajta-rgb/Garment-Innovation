import type { GarmentAppearance } from '@/types/garment3d';
/** Local procedural fabric. A visual tile, not measured fabric properties. */
export function fabricTile(appearance:Pick<GarmentAppearance,'color'|'fabric'>):HTMLCanvasElement{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');if(!c)throw new Error('面料图案画布不可用');
  c.fillStyle=appearance.color;c.fillRect(0,0,256,256);
  if(appearance.fabric==='stripe'){c.fillStyle='#ffffff99';for(let x=0;x<256;x+=64)c.fillRect(x,0,24,256);}
  if(appearance.fabric==='plaid'||appearance.fabric==='checker'){c.fillStyle='#ffffff55';c.fillRect(0,0,128,128);c.fillRect(128,128,128,128);if(appearance.fabric==='plaid'){c.strokeStyle='#22334f66';c.lineWidth=6;for(let x=0;x<=256;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.moveTo(0,x);c.lineTo(256,x);c.stroke();}}}
  if(appearance.fabric==='denim'){for(let i=-256;i<512;i+=6){c.strokeStyle=i%12===0?'#ffffff44':'#10182b44';c.lineWidth=2;c.beginPath();c.moveTo(i,0);c.lineTo(i-256,256);c.stroke();}}
  return canvas;
}
export async function readGarmentTexture(file:File):Promise<string>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  if(file.size>10*1024*1024)throw new Error('图片请控制在10MB以内');
  const image=await createImageBitmap(file);try{if(image.width<1||image.height<1||image.width>4096||image.height>4096)throw new Error('贴图边长须在1–4096像素之间');
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');if(!c)throw new Error('贴图读取失败');c.drawImage(image,0,0);return canvas.toDataURL('image/png');
  }finally{image.close();}
}
