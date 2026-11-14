import { useId,useMemo } from 'react';
import { cameraBasis,projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { garmentNormals,garmentUv,garmentUsesImage,uvAffine } from '@/lib/pattern/mesh/garment-view';
import { garmentLightGradient } from './garment-light';
import { garmentDetailColor } from '@/lib/pattern/mesh/garment-finish';
import type { PhysicalCamera,ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import type { GarmentAppearance,GarmentDisplay3d } from '@/types/garment3d';
import type { XY } from '@/types/pattern3d';
const normalCache=new WeakMap<GarmentDisplay3d,ReturnType<typeof garmentNormals>[]>();
const shaded=(hex:string,light:number)=>`#${[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*light).toString(16).padStart(2,'0')).join('')}`;
/** True curved triangles and source UV affine transforms, including user images. */
export function GarmentProjectedSurface({model,camera,size,appearance,tileUrl,wire}:{model:GarmentDisplay3d;camera:PhysicalCamera;size:ViewportSize;appearance:GarmentAppearance;tileUrl:string;wire:boolean}){
  const prefix=useId().replace(/[^a-zA-Z0-9]/g,'');
  const faces=useMemo(()=>{
    let normals=normalCache.get(model);if(!normals){normals=model.surfaces.map(garmentNormals);normalCache.set(model,normals);}
    const basis=cameraBasis(camera),result:Array<{id:string;depth:number;path:string;color:string;transform:number[]|null;light:number;gradient:ReturnType<typeof garmentLightGradient>;uploaded:boolean}>=[];
    for(const [j,surface]of model.surfaces.entries()){
      const projected=surface.positionsMm.map(p=>projectPhysicalPoint(p,camera,size)),uv=garmentUv(surface,appearance);
      for(let t=0;t<surface.triangles.length;t+=3){const ids=surface.triangles.slice(t,t+3),points=ids.map(i=>projected[i]),texture=ids.map(i=>[uv[i*2],uv[i*2+1]] as XY);
        // Closed cloth and trim have consistently outward winding. Reject
        // hidden backfaces before painter ordering, so an almost coplanar
        // inner/turnback layer cannot paint through the outside cloth.
        const [a,b,c]=points,signed=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
        if(signed>=-1e-9)continue;
        const lights=ids.map(id=>{const n=normals![j][id],length=Math.hypot(...n)||1;return .45+.5*Math.abs((n[0]*.2+n[1]*.25+n[2]*.94)/length);});
        const uploaded=garmentUsesImage(surface,appearance);
        result.push({id:`${surface.id}-${t}`,depth:ids.reduce((n,id)=>n+surface.positionsMm[id].reduce((s,v,k)=>s+v*basis.forward[k],0)/3,0),path:points.map((p,i)=>`${i?'L':'M'}${p.join(' ')}`).join(' ')+'Z',color:garmentDetailColor(surface,appearance.color),transform:surface.detail||appearance.fabric==='solid'&&!uploaded?null:uvAffine(texture,points),light:lights.reduce((a,b)=>a+b,0)/3,gradient:garmentLightGradient(points,lights),uploaded});
      }
    }return result.sort((a,b)=>a.depth-b.depth);
  },[model,camera,size,appearance]);
  return <><defs>{tileUrl&&<image id={`${prefix}-fabric`} href={tileUrl} width="1" height="1" preserveAspectRatio="none"/>}{appearance.imageDataUrl&&<image id={`${prefix}-image`} href={appearance.imageDataUrl} width="1" height="1" preserveAspectRatio="none"/>}</defs>
    {faces.map((face,i)=><g key={face.id} data-garment-triangle={face.id}>
      {face.gradient&&<defs><linearGradient id={`${prefix}-light-${i}`} gradientUnits="userSpaceOnUse" x1={face.gradient.from[0]} y1={face.gradient.from[1]} x2={face.gradient.to[0]} y2={face.gradient.to[1]}>
        <stop offset="0" stopColor={face.transform?'#000':shaded(face.color,face.gradient.low)} stopOpacity={face.transform?1-face.gradient.low:1}/><stop offset="1" stopColor={face.transform?'#000':shaded(face.color,face.gradient.high)} stopOpacity={face.transform?1-face.gradient.high:1}/>
      </linearGradient></defs>}
      {face.transform&&<defs><pattern id={`${prefix}-face-${i}`} width="1" height="1" patternUnits="userSpaceOnUse" patternTransform={`matrix(${face.transform.join(' ')})`}><use href={`#${prefix}-${face.uploaded?'image':'fabric'}`}/></pattern></defs>}
      <path d={face.path} fill={face.transform?`url(#${prefix}-face-${i})`:face.gradient?`url(#${prefix}-light-${i})`:shaded(face.color,face.light)} stroke={wire?'#cbd5e188':face.transform?`url(#${prefix}-face-${i})`:face.gradient?`url(#${prefix}-light-${i})`:shaded(face.color,face.light)} strokeWidth={face.id.includes('thread')||face.id.includes('needle')?'.1':'.5'}/>
      {face.transform&&<path d={face.path} fill={face.gradient?`url(#${prefix}-light-${i})`:'#000'} opacity={face.gradient?1:1-face.light} pointerEvents="none"/>}
    </g>)}
  </>;
}
