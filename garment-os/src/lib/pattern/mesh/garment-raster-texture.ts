export interface GarmentRasterTexture {width:number;height:number;pixels:Uint8Array|Uint8ClampedArray}
type Mip={width:number;height:number;pixels:Float32Array};
const cache=new WeakMap<GarmentRasterTexture,Mip[]>();
/** Immutable texture cache. Premultiplied mip levels avoid transparent colour fringes. */
export function garmentTextureMips(texture:GarmentRasterTexture){
  const cached=cache.get(texture);if(cached)return cached;
  const pixels=new Float32Array(texture.pixels.length);
  for(let i=0;i<pixels.length;i+=4){const alpha=texture.pixels[i+3]/255;for(let c=0;c<3;c++)pixels[i+c]=texture.pixels[i+c]*alpha;pixels[i+3]=alpha;}
  const levels:Mip[]=[{width:texture.width,height:texture.height,pixels}];
  while(levels.at(-1)!.width>1||levels.at(-1)!.height>1){
    const source=levels.at(-1)!,width=Math.max(1,Math.ceil(source.width/2)),height=Math.max(1,Math.ceil(source.height/2)),next=new Float32Array(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<4;c++){
      let sum=0,count=0;
      for(let j=0;j<2;j++)for(let i=0;i<2;i++)if(x*2+i<source.width&&y*2+j<source.height){sum+=source.pixels[((y*2+j)*source.width+x*2+i)*4+c];count++;}
      next[(y*width+x)*4+c]=sum/count;
    }
    levels.push({width,height,pixels:next});
  }
  cache.set(texture,levels);return levels;
}
/** Bilinear within a level, continuous blending between levels; texel-centred wrap/clamp. */
export function sampleGarmentTexture(levels:Mip[],u:number,v:number,lod:number,repeat:boolean){
  const level=Math.max(0,Math.min(levels.length-1,lod)),lo=Math.floor(level),hi=Math.min(levels.length-1,lo+1),f=level-lo,result=[0,0,0,0];
  for(const [index,weight]of [[lo,1-f],[hi,f]]){
    if(!weight)continue;
    const m=levels[index],x=u*m.width-.5,y=v*m.height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const coord=(n:number,max:number)=>repeat?((n%max)+max)%max:Math.max(0,Math.min(max-1,n));
    const x0=coord(ix,m.width),x1=coord(ix+1,m.width),y0=coord(iy,m.height),y1=coord(iy+1,m.height);
    for(let c=0;c<4;c++)result[c]+=weight*((m.pixels[(y0*m.width+x0)*4+c]*(1-fx)+m.pixels[(y0*m.width+x1)*4+c]*fx)*(1-fy)+(m.pixels[(y1*m.width+x0)*4+c]*(1-fx)+m.pixels[(y1*m.width+x1)*4+c]*fx)*fy);
  }
  return result;
}
