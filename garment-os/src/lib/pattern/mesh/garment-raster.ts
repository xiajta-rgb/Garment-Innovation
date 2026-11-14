import {garmentDetailColor} from './garment-finish';
import {garmentUv,garmentUsesImage} from './garment-view';
import {cameraBasis,projectPhysicalPoint} from './viewport-mapping';
import {garmentTextureMips,sampleGarmentTexture} from './garment-raster-texture';
import type {GarmentRasterTexture} from './garment-raster-texture';
import type {PhysicalCamera,ViewportSize} from './viewport-mapping';
import type {GarmentAppearance,GarmentDisplay3d} from '@/types/garment3d';

export type {GarmentRasterTexture} from './garment-raster-texture';
/** Bound working storage to ~72MB (RGBA + depth + resolved image). */
export function garmentRasterResolution(size:ViewportSize,scale?:number){
  const outputScale=scale??Math.min(Math.max(1,size.dpr),2,Math.sqrt(2000000/(Math.max(1,size.width)*Math.max(1,size.height))));
  const outputWidth=Math.max(1,Math.floor(size.width*outputScale)),outputHeight=Math.max(1,Math.floor(size.height*outputScale));
  // Spend the existing eight-million depth-sample budget on small viewports
  // too. At 900x650 use 3x3 coverage; small detail views use 4x4, HiDPI 2x2.
  const samples=Math.max(2,Math.min(4,Math.floor(Math.sqrt(8000000/(outputWidth*outputHeight)))));
  return {outputWidth,outputHeight,samples,width:outputWidth*samples,height:outputHeight*samples};
}
/** Pixel depth, interpolated normals and source-mm UVs, shared by the real
 * software viewport and offline inspection. No SVG triangle depth sorting. */
export function rasterGarment(model:GarmentDisplay3d,appearance:GarmentAppearance,camera:PhysicalCamera,size:ViewportSize,options:{scale?:number;tile?:GarmentRasterTexture;image?:GarmentRasterTexture;wire?:boolean}={}){
  const {outputWidth,outputHeight,width,height,samples}=garmentRasterResolution(size,options.scale),scaleX=width/Math.max(1,size.width),scaleY=height/Math.max(1,size.height),pixels=new Uint8ClampedArray(width*height*4),depth=new Float32Array(width*height).fill(-Infinity);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=228;pixels[i+1]=230;pixels[i+2]=226;pixels[i+3]=255;}
  const basis=cameraBasis(camera);
  for(const surface of model.surfaces){
    const hex=garmentDetailColor(surface,appearance.color),rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),uploaded=!!options.image&&garmentUsesImage(surface,appearance),texture=surface.detail?undefined:uploaded?options.image:options.tile,repeat=!(uploaded&&appearance.imageMode==='print'),uv=texture?garmentUv(surface,appearance):[];
    const mips=texture?garmentTextureMips(texture):null;
    const ps=surface.positionsMm.map(p=>projectPhysicalPoint(p,camera,size).map((v,k)=>v*(k===0?scaleX:scaleY))),zs=surface.positionsMm.map(p=>p[0]*basis.forward[0]+p[1]*basis.forward[1]+p[2]*basis.forward[2]);
    for(let t=0;t<surface.triangles.length;t+=3){
      const ia=surface.triangles[t],ib=surface.triangles[t+1],ic=surface.triangles[t+2],a=ps[ia],b=ps[ib],c=ps[ic],den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)continue;
      if((model.metrics.closedShell||surface.detail)&&den>=0)continue;
      const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1]))),na=surface.renderNormals[ia],nb=surface.renderNormals[ib],nc=surface.renderNormals[ic];
      let lod=0;
      if(texture){
        const dxu=(b[1]-c[1])/den,dxv=(c[1]-a[1])/den,dyu=(c[0]-b[0])/den,dyv=(a[0]-c[0])/den;
        const derivative=(k:number,du:number,dv:number)=>(uv[ia*2+k]-uv[ic*2+k])*du+(uv[ib*2+k]-uv[ic*2+k])*dv;
        lod=Math.max(0,Math.log2(Math.max(Math.hypot(derivative(0,dxu,dxv)*texture.width,derivative(1,dxu,dxv)*texture.height),Math.hypot(derivative(0,dyu,dyv)*texture.width,derivative(1,dyu,dyv)*texture.height),1)));
      }
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-8)continue;
        const d=zs[ia]*u+zs[ib]*v+zs[ic]*w,index=y*width+x;if(d<depth[index])continue;depth[index]=d;
        const nx=na[0]*u+nb[0]*v+nc[0]*w,ny=na[1]*u+nb[1]*v+nc[1]*w,nz=na[2]*u+nb[2]*v+nc[2]*w,length=Math.hypot(nx,ny,nz)||1,sign=nx*basis.forward[0]+ny*basis.forward[1]+nz*basis.forward[2]<0?-1:1;
        const diffuse=Math.max(0,(nx*.3+ny*.45+nz*.84)*sign/length),fill=Math.max(0,(-nx*.8+ny*.4+nz*.4)*sign/length),brightness=Math.min(1,.42+.46*diffuse+.12*fill);
        let r=rgb[0],g=rgb[1],bl=rgb[2];
        if(mips){
          const su=uv[ia*2]*u+uv[ib*2]*v+uv[ic*2]*w,sv=uv[ia*2+1]*u+uv[ib*2+1]*v+uv[ic*2+1]*w,texel=sampleGarmentTexture(mips,su,sv,lod,repeat);
          r=r*(1-texel[3])+texel[0];g=g*(1-texel[3])+texel[1];bl=bl*(1-texel[3])+texel[2];
        }
        if(options.wire&&Math.min(u,v,w)<.025){r=190;g=201;bl=218;}
        pixels[index*4]=Math.round(r*brightness);pixels[index*4+1]=Math.round(g*brightness);pixels[index*4+2]=Math.round(bl*brightness);
      }
    }
  }
  // Resolve independent depth samples. This covers subpixel silhouettes and
  // threads without blurring interior pixels or altering the physical mesh.
  const resolved=new Uint8ClampedArray(outputWidth*outputHeight*4);
  for(let y=0;y<outputHeight;y++)for(let x=0;x<outputWidth;x++){
    const a=(y*samples*width+x*samples)*4,out=(y*outputWidth+x)*4;
    for(let c=0;c<3;c++){
      let sum=0;for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++)sum+=pixels[a+(sy*width+sx)*4+c];
      resolved[out+c]=sum/(samples*samples);
    }
    resolved[out+3]=255;
  }
  return {pixels:resolved,width:outputWidth,height:outputHeight,samples,triangles:model.metrics.renderTriangles};
}
