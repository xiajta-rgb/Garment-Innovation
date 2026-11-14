import type { GarmentDisplay3d } from '@/types/garment3d';
import type { XY,XYZ } from '@/types/pattern3d';
import { garmentBounds } from './garment-view';
import { cameraBasis,projectPhysicalPoint } from './viewport-mapping';
import type { PhysicalCamera } from './viewport-mapping';
import { maskContour,simplifyViewLine,viewLine } from './garment-view-contour';

/** Orthographic drawing of the finished mesh. CAD coordinates remain separate. */
export function garmentTechnicalView(model:GarmentDisplay3d,yawDeg:number,width=240,height=210,colorRegions=false,pixelsPerMm?:number){
  if(pixelsPerMm!==undefined&&(!Number.isFinite(pixelsPerMm)||pixelsPerMm<=0))throw Error('绘图比例无效');
  const size={width,height,dpr:1},{min,max,center}=garmentBounds(model),camera:PhysicalCamera={centerMm:center,yawDeg,tiltDeg:0,panCss:[0,0],pixelsPerMm:pixelsPerMm??.82*Math.min(width/Math.max(1,max[0]-min[0],max[2]-min[2]),height/Math.max(1,max[1]-min[1]))},basis=cameraBasis(camera);
  const scale=2,rw=Math.ceil(width*scale),rh=Math.ceil(height*scale),zbuffer=new Float32Array(rw*rh).fill(-Infinity),mask=new Uint8Array(rw*rh);
  const regions=colorRegions?new Uint16Array(rw*rh):null,regionIds:string[]=[];
  for(const s of model.surfaces.filter(s=>s.layer==='outer'||s.detail?.kind==='rib')){
    const regionId=s.sourceId;let region=regionIds.indexOf(regionId);if(region<0){region=regionIds.length;regionIds.push(regionId);}
    const screen=s.positionsMm.map(p=>projectPhysicalPoint(p,camera,size)),depth=s.positionsMm.map(p=>p.reduce((sum,v,k)=>sum+v*basis.forward[k],0));
    for(let t=0;t<s.triangles.length;t+=3){
      const ids=s.triangles.slice(t,t+3),[a,b,c]=ids.map(i=>screen[i].map(v=>v*scale)),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-10)continue;
      const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(rw-1,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(rh-1,Math.ceil(Math.max(a[1],b[1],c[1])));
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den;
        if(Math.min(u,v,1-u-v)<-1e-6)continue;
        const z=u*depth[ids[0]]+v*depth[ids[1]]+(1-u-v)*depth[ids[2]],index=y*rw+x;
        if(z>zbuffer[index]){zbuffer[index]=z;mask[index]=s.detail?.kind==='rib'?2:1;if(regions)regions[index]=region+1;}
      }
    }
  }
  const visible=(p:XYZ)=>{
    const q=projectPhysicalPoint(p,camera,size),depth=p.reduce((sum,v,k)=>sum+v*basis.forward[k],0),x=Math.floor(q[0]*scale),y=Math.floor(q[1]*scale);
    return x>=0&&x<rw&&y>=0&&y<rh&&depth>=zbuffer[y*rw+x]-Math.max(1.5,.8/(camera.pixelsPerMm*scale));
  };
  const silhouette=maskContour(mask,rw,rh,scale),rib=maskContour(mask,rw,rh,scale,true),fills=[{rib:false,path:silhouette},{rib:true,path:rib}];
  const lines=(model.constructionLines??[]).map(line=>{
    const runs:XY[][]=[];let run:XY[]=[];
    const append=(p:XYZ)=>{if(visible(p)){run.push(projectPhysicalPoint(p,camera,size));}else if(run.length){runs.push(run);run=[];}};
    for(let i=1;i<line.pointsMm.length;i++){
      const a=line.pointsMm[i-1],b=line.pointsMm[i],n=Math.max(1,Math.ceil(Math.hypot(...b.map((v,k)=>v-a[k]))*camera.pixelsPerMm));
      for(let j=0;j<n;j++)append(a.map((v,k)=>v+(b[k]-v)*j/n) as XYZ);
    }
    if(line.pointsMm.length)append(line.pointsMm.at(-1)!);if(run.length)runs.push(run);
    const continuous:XY[][]=[];
    for(const points of runs){const prior=continuous.at(-1);if(prior&&Math.hypot(...points[0].map((v,k)=>v-prior.at(-1)![k]))<=1.25)prior.push(...points);else continuous.push([...points]);}
    const readable=continuous.filter(points=>points.slice(1).reduce((length,p,i)=>length+Math.hypot(...p.map((v,k)=>v-points[i][k])),0)>=(line.kind==='stitch'?2:1));
    return {id:line.id,kind:line.kind,path:readable.map(points=>viewLine(simplifyViewLine(points,.65))).join(''),points:readable.flat()};
  });
  let ribs='';
  for(const surface of model.surfaces.filter(s=>s.detail?.kind==='rib')){
    // Outer-face stations share a longitudinal cut-piece coordinate. Hatches
    // follow the real strip direction, with a minimum screen-space spacing.
    const stations=new Map<number,number[]>();
    for(let i=0;i<surface.positionsMm.length/2;i++){const u=surface.uvMm[i][0],list=stations.get(u)??[];list.push(i);stations.set(u,list);}
    let previous:XY=[-Infinity,-Infinity];
    for(const ids of stations.values()){
      const a=surface.positionsMm[ids[0]],b=surface.positionsMm[ids.at(-1)!],middle=a.map((v,k)=>(v+b[k])/2) as XYZ,q=projectPhysicalPoint(middle,camera,size);
      if(Math.hypot(q[0]-previous[0],q[1]-previous[1])<3.5||!visible(middle))continue;
      ribs+=viewLine([projectPhysicalPoint(a,camera,size),projectPhysicalPoint(b,camera,size)]);previous=q;
    }
  }
  const pieceFills=regions?regionIds.map((sourceId,i)=>({sourceId,path:maskContour(Uint8Array.from(regions,v=>v===i+1?1:0),rw,rh,scale)})):[];
  // A flat technical pocket follows its actual CAD corner stations. Rasterized
  // surface triangles must not introduce bends into the designed straight edges.
  const pocket=model.surfaces.find(s=>s.sourceId==='design.patch-pocket');
  if(pocket&&Math.cos(yawDeg*Math.PI/180)>.999){
    const source=pocket.boundary.map(i=>pocket.localMm[i]);
    const corners=simplifyViewLine([...source,source[0]],.05);
    const projected=corners.map(p=>projectPhysicalPoint(pocket.positionsMm[pocket.localMm.indexOf(p)],camera,size));
    const fill=pieceFills.find(f=>f.sourceId===pocket.sourceId);if(fill)fill.path=viewLine(projected)+'Z';
    for(const line of lines){
      if(line.id==='design.patch-pocket-attachment')line.path=viewLine(projected.slice(1));
      if(line.id==='design.patch-pocket-open-top')line.path=viewLine(projected.slice(0,2));
    }
  }
  return {camera,width,height,fills,silhouette,lines,ribs,pieceFills};
}
export type GarmentTechnicalView=ReturnType<typeof garmentTechnicalView>;
export const escapeSvg=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
/** Shared by preview and export. Variable text is escaped. */
export function technicalDrawingSvg(view:GarmentTechnicalView,palette?:Record<string,string>){
  const fills=palette&&view.pieceFills.length?view.pieceFills.map(f=>`<path data-source-piece="${escapeSvg(f.sourceId)}" d="${f.path}" fill="${escapeSvg(palette[f.sourceId]??'#fff')}" stroke="${escapeSvg(palette[f.sourceId]??'#fff')}" stroke-width=".3"/>`).join(''):view.fills.map(f=>`<path d="${f.path}" fill="${f.rib?'#e5e7e9':'#fff'}" fill-rule="nonzero"/>`).join('');
  const body=view.pieceFills.find(f=>f.path && /\.(front|back)$/.test(f.sourceId));
  const base=palette&&body?`<path d="${view.silhouette}" fill="${escapeSvg(palette[body.sourceId]??'#fff')}"/>`:'';
  return `<g stroke-linejoin="round" stroke-linecap="round">${base}${fills}<path d="${view.ribs}" fill="none" stroke="#60656b" stroke-width=".45"/><path d="${view.fills[1].path}" fill="none" stroke="#454b52" stroke-width=".65"/><path d="${view.silhouette}" fill="none" stroke="#252b32" stroke-width="1.2"/>${view.lines.map(l=>`<path data-operation="${escapeSvg(l.id)}" d="${l.path}" fill="none" stroke="${l.kind==='seam'?'#353c44':'#59616b'}" stroke-width="${l.kind==='seam'?'.8':'.55'}" ${l.kind==='stitch'?'stroke-dasharray="2.4 1.8"':''}/>`).join('')}</g>`;
}
export function exportGarmentTechnicalSvg(model:GarmentDisplay3d){
  const views=[['正面',0],['背面',180],['侧面 · 组装参考',90]] as const;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="570" viewBox="0 0 1200 570"><rect width="1200" height="570" fill="#fff"/>${views.map(([label,yaw],i)=>{const view=garmentTechnicalView(model,yaw,400,500);return `<g transform="translate(${i*400} 25)"><text x="200" y="10" text-anchor="middle" font-family="sans-serif" font-size="15">${label}</text>${technicalDrawingSvg(view)}</g>`;}).join('')}<text x="600" y="555" text-anchor="middle" font-family="sans-serif" font-size="11">Same finished mesh / 同一完成态模型、同一比例尺 · 款式示意，非裁剪图纸</text></svg>`;
}
