import type { GarmentAppearance,GarmentAssembly3d,GarmentSurface } from '@/types/garment3d';
import type { PhysicalCamera,ViewportSize } from './viewport-mapping';
import type { XY,XYZ } from '@/types/pattern3d';
import { cameraBasis,projectPhysicalPoint } from './viewport-mapping';
import { reflect } from './panel-mesh';
import type { MannequinSpec } from '@/types/mannequin';
import { mannequinDimensions } from '@/types/mannequin';
export function garmentSourcePoint(surface:GarmentSurface,point:XY):XY{
  if(!surface.foldAxis)return [...point];const [a,b]=surface.foldAxis,side=(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
  return side*surface.sourceHalfSign< -1e-8?reflect(point,a,b):[...point];
}

export function garmentBounds(model:Pick<GarmentAssembly3d,'surfaces'>){
  const min:XYZ=[Infinity,Infinity,Infinity],max:XYZ=[-Infinity,-Infinity,-Infinity];
  for(const s of model.surfaces)for(const p of s.positionsMm)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  return {min,max,center:min.map((v,k)=>(v+max[k])/2) as XYZ,radius:Math.hypot(...min.map((v,k)=>(max[k]-v)/2))};
}
function mannequinWorldBounds(model:Pick<GarmentAssembly3d,'surfaces'>,spec:MannequinSpec){
  const garment=garmentBounds(model),d=mannequinDimensions(spec),top=garment.max[1],shoulderY=top-8;
  const halfWidth=Math.max(d.hipWidthMm/2,d.shoulderWidthMm/2+d.upperArmRadiusMm*1.4),depth=Math.max(d.bustWidthMm*.38,d.hipWidthMm*.42);
  // The garment scene is an upper-body fitting view. Keep the avatar's legs
  // in the scene for orbiting, but do not let the floor-to-head distance make
  // a shirt shrink to a thumbnail during the initial frame.
  return {min:[garment.center[0]-halfWidth,Math.min(garment.min[1]-20,garment.center[1]+shoulderY-d.torsoLengthMm),garment.center[2]-depth] as XYZ,max:[garment.center[0]+halfWidth,garment.center[1]+shoulderY+55+d.headRadiusMm*2+38,garment.center[2]+depth] as XYZ};
}
export function fitGarmentCamera(model:Pick<GarmentAssembly3d,'surfaces'>,size:ViewportSize,yawDeg=25,tiltDeg=8,mannequin?:MannequinSpec):PhysicalCamera{
  const garment=garmentBounds(model),extra=mannequin?.enabled?mannequinWorldBounds(model,mannequin):null,minWorld=extra?garment.min.map((v,k)=>Math.min(v,extra.min[k])) as XYZ:garment.min,maxWorld=extra?garment.max.map((v,k)=>Math.max(v,extra.max[k])) as XYZ:garment.max,center=minWorld.map((v,k)=>(v+maxWorld[k])/2) as XYZ;
  const camera:PhysicalCamera={centerMm:center,yawDeg,tiltDeg,pixelsPerMm:1,panCss:[0,0]};
  const corners:XYZ[]=[[minWorld[0],minWorld[1],minWorld[2]],[minWorld[0],minWorld[1],maxWorld[2]],[minWorld[0],maxWorld[1],minWorld[2]],[minWorld[0],maxWorld[1],maxWorld[2]],[maxWorld[0],minWorld[1],minWorld[2]],[maxWorld[0],minWorld[1],maxWorld[2]],[maxWorld[0],maxWorld[1],minWorld[2]],[maxWorld[0],maxWorld[1],maxWorld[2]]];
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const world of corners){const p=projectPhysicalPoint(world,camera,size);for(let k=0;k<2;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}
  const width=max[0]-min[0],height=max[1]-min[1];
  // A full GLB avatar has a measured head/hand envelope that is a little
  // larger than the proportion-body estimate above. Give it a small margin
  // so the real reference body is not clipped at the top of the viewport.
  const fitFactor=mannequin?.mode==='real-human'?.58:mannequin?.enabled?.68:.82;
  return {...camera,pixelsPerMm:fitFactor*Math.min(size.width/width,size.height/height)};
}
export function garmentUv(surface:GarmentSurface,appearance:GarmentAppearance){
  const print=garmentUsesImage(surface,appearance)&&appearance.imageMode==='print';
  const min=[0,1].map(k=>Math.min(...surface.uvMm.map(p=>p[k]))),max=[0,1].map(k=>Math.max(...surface.uvMm.map(p=>p[k]))),a=appearance.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return surface.uvMm.flatMap(p=>{const u=print?(p[0]-min[0])/(max[0]-min[0]):p[0]/appearance.repeatMm,v=print?(p[1]-min[1])/(max[1]-min[1]):p[1]/appearance.repeatMm;
    return [c*(u-.5)-s*(v-.5)+.5,s*(u-.5)+c*(v-.5)+.5];});
}
export function garmentUsesImage(surface:GarmentSurface,appearance:GarmentAppearance){
  return !!appearance.imageDataUrl&&(!('layer' in surface)||surface.layer==='outer')&&(appearance.imageTarget==='all'||surface.sourceId.endsWith('.front'));
}
export function garmentNormals(surface:GarmentSurface):XYZ[]{
  if('renderNormals' in surface)return surface.renderNormals as XYZ[];
  const normals:XYZ[]=surface.positionsMm.map(()=>[0,0,0]);
  for(let t=0;t<surface.triangles.length;t+=3){const ids=surface.triangles.slice(t,t+3),[a,b,c]=ids.map(i=>surface.positionsMm[i]),u=b.map((v,k)=>v-a[k]),v=c.map((n,k)=>n-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const id of ids)for(let k=0;k<3;k++)normals[id][k]+=normal[k];
  }return normals.map(p=>{const length=Math.hypot(...p)||1;return p.map(v=>v/length) as XYZ;});
}
export function pickGarment(model:Pick<GarmentAssembly3d,'surfaces'>,camera:PhysicalCamera,size:ViewportSize,point:XY){
  const basis=cameraBasis(camera);let best:{id:string;triangle:number;uvMm:XY;sourceMm:XY;depth:number}|null=null;
  for(const surface of model.surfaces){const projected=surface.positionsMm.map(p=>projectPhysicalPoint(p,camera,size));
    for(let t=0;t<surface.triangles.length;t+=3){const ids=surface.triangles.slice(t,t+3),[a,b,c]=ids.map(i=>projected[i]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)continue;
      const u=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/den,v=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-8)continue;
      const weights=[u,v,w],depth=ids.reduce((n,id,j)=>n+surface.positionsMm[id].reduce((s,p,k)=>s+p*basis.forward[k],0)*weights[j],0);
      if(!best||depth>best.depth){const uvMm=[0,1].map(k=>ids.reduce((n,id,j)=>n+surface.uvMm[id][k]*weights[j],0)) as XY;best={id:surface.id,triangle:t/3,depth,uvMm,sourceMm:garmentSourcePoint(surface,uvMm)};}
    }
  }return best;
}
/** Affine UV → projected triangle transform, shared by SVG texture fallback. */
export function uvAffine(uv:XY[],screen:XY[]):number[]|null{
  const [p,q,r]=uv,[a,b,c]=screen,den=(q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]);if(Math.abs(den)<1e-12)return null;
  const x=(b[0]-a[0])*(r[1]-p[1])-(c[0]-a[0])*(q[1]-p[1]),z=(c[0]-a[0])*(q[0]-p[0])-(b[0]-a[0])*(r[0]-p[0]);
  const y=(b[1]-a[1])*(r[1]-p[1])-(c[1]-a[1])*(q[1]-p[1]),w=(c[1]-a[1])*(q[0]-p[0])-(b[1]-a[1])*(r[0]-p[0]);
  return [x/den,y/den,z/den,w/den,a[0]-(x*p[0]+z*p[1])/den,a[1]-(y*p[0]+w*p[1])/den];
}
