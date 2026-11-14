/** Rasterise the exact local SVG shown by the design editor; no remote image. */
export async function styleReferencePng(svg:string):Promise<string>{
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
  const image=new Image();image.src=url;await image.decode();
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height)throw Error('三视图缺少有效图幅，不能拉伸导出');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const c=canvas.getContext('2d');if(!c)throw Error('无法生成三视图参考图');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');
 }finally{URL.revokeObjectURL(url);}
}
export async function downloadStylePng(svg:string,name:string){const image=await styleReferencePng(svg),a=document.createElement('a');a.href=image;a.download=name;a.click();}
