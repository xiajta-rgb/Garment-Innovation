import * as THREE from 'three';
import { cameraBasis,projectPhysicalPoint } from '@/lib/pattern/mesh/viewport-mapping';
import { createFrameScheduler } from './frame-scheduler';
import { viewportGrid } from '@/lib/pattern/mesh/viewport-grid';
import type { PhysicalCamera,SurfaceAnchor,ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import type { MeshRenderData } from '@/lib/pattern/mesh/render-data';
import type { PatternMesh3d,XYZ } from '@/types/pattern3d';

export interface RenderView {camera:PhysicalCamera;size:ViewportSize;visible:readonly string[];selected:string;wire:boolean;seams:boolean;grid?:boolean;anchors:SurfaceAnchor[]}
export interface PhysicalRenderer {mode:'WebGL2'|'Canvas2D'|'unavailable';update(view:RenderView):void;dispose():void}
const colors=[0x96c8a2,0xc4b5fd,0xf4cd93];
const vec=(p:XYZ)=>new THREE.Vector3(...p);
const relative=(p:XYZ,origin:XYZ):XYZ=>p.map((v,k)=>v-origin[k]) as XYZ;

export function createPhysicalRenderer(canvas:HTMLCanvasElement,model:PatternMesh3d,data:MeshRenderData,onFailure?:()=>void):PhysicalRenderer{
  // Use the actual surface. Probing another context can exhaust graphics limits.
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});}catch{return createCanvasRenderer(canvas,model,onFailure);}
  if(renderer.getContext().isContextLost()){
    renderer.dispose();return {mode:'unavailable',update(){},dispose(){}};
  }
  renderer.setClearColor(0x25262a);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),owned:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const groups:Array<{nodes:MeshRenderData['panels'];solid:THREE.InstancedMesh;wire:THREE.InstancedMesh}>=[];
  const matrices=new Map<string,THREE.Matrix4>(),color=new THREE.Color();
  scene.add(new THREE.AmbientLight(0xffffff,1.7));
  const keyLight=new THREE.DirectionalLight(0xfff4e7,2.4);keyLight.position.set(data.radiusMm,2*data.radiusMm,3*data.radiusMm);scene.add(keyLight);
  const fillLight=new THREE.DirectionalLight(0xb6cfff,1.3);fillLight.position.set(-2*data.radiusMm,data.radiusMm,-data.radiusMm);scene.add(fillLight);
  const floor=viewportGrid(model),floorGeometry=new THREE.BufferGeometry(),floorPositions:number[]=[],floorColors:number[]=[];
  for(const line of floor.lines){floorPositions.push(...relative(line.a,data.originMm),...relative(line.b,data.originMm));const c=new THREE.Color(line.axis==='x'?0x765153:line.axis==='z'?0x485f7c:0x3d4048);floorColors.push(c.r,c.g,c.b,c.r,c.g,c.b);}
  floorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(floorPositions,3));floorGeometry.setAttribute('color',new THREE.Float32BufferAttribute(floorColors,3));
  const floorMaterial=new THREE.LineBasicMaterial({vertexColors:true}),floorMesh=new THREE.LineSegments(floorGeometry,floorMaterial);scene.add(floorMesh);owned.push(floorGeometry);materials.push(floorMaterial);
  for(const p of data.panels){const matrix=new THREE.Matrix4().makeRotationY(p.yawDeg*Math.PI/180);matrix.setPosition(...p.translation);matrices.set(p.id,matrix);}
  for(const g of data.geometries){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(g.positions,3));geometry.setIndex(new THREE.BufferAttribute(g.indices,1));geometry.computeVertexNormals();owned.push(geometry);
    const nodes=data.panels.filter(p=>p.geometry===g.key);
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    const wireMaterial=new THREE.MeshBasicMaterial({color:0x424650,side:THREE.DoubleSide,wireframe:true});
    materials.push(material,wireMaterial);
    const solid=new THREE.InstancedMesh(geometry,material,nodes.length),wire=new THREE.InstancedMesh(geometry,wireMaterial,nodes.length);
    solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);wire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Aggregate bounds are recomputed on filter changes, never during rotation.
    groups.push({nodes,solid,wire});scene.add(solid,wire);
  }
  // One shared outline draw call. Positions upload once; filtering only changes the index buffer.
  const boundaryPositions:number[]=[],boundarySpans=new Map<string,{offset:number;count:number}>();
  for(const p of data.panels){
    const g=data.geometries.find(g=>g.key===p.geometry)!,offset=boundaryPositions.length/3,matrix=matrices.get(p.id)!;
    for(let i=0;i<g.positions.length/3;i++){const v=new THREE.Vector3().fromArray(g.positions,i*3).applyMatrix4(matrix);boundaryPositions.push(v.x,v.y,v.z);}
    boundarySpans.set(p.id,{offset,count:g.positions.length/3});
  }
  const boundaryGeometry=new THREE.BufferGeometry();boundaryGeometry.setAttribute('position',new THREE.Float32BufferAttribute(boundaryPositions,3));
  const boundaryColor=new THREE.BufferAttribute(new Float32Array(boundaryPositions.length),3).setUsage(THREE.DynamicDrawUsage);boundaryGeometry.setAttribute('color',boundaryColor);
  const boundaryIndex=new THREE.BufferAttribute(new Uint32Array(boundaryPositions.length/3*2),1).setUsage(THREE.DynamicDrawUsage);boundaryGeometry.setIndex(boundaryIndex);
  const edgeMaterial=new THREE.LineBasicMaterial({vertexColors:true}),boundary=new THREE.LineSegments(boundaryGeometry,edgeMaterial);scene.add(boundary);owned.push(boundaryGeometry);materials.push(edgeMaterial);
  const annotationMaterial=new THREE.LineBasicMaterial({color:0xc2410c}),annotationGeometry=new THREE.BufferGeometry();
  const annotationBuffer=new THREE.BufferAttribute(new Float32Array((model.seams.reduce((s,p)=>s+p.samples.length,0)+1)*6),3).setUsage(THREE.DynamicDrawUsage);
  annotationGeometry.setAttribute('position',annotationBuffer);annotationGeometry.setDrawRange(0,0);
  const annotations=new THREE.LineSegments(annotationGeometry,annotationMaterial);annotations.frustumCulled=false;scene.add(annotations);owned.push(annotationGeometry);materials.push(annotationMaterial);
  let state:RenderView|undefined,lastSize='',lastVisible='',lastSelection='',lastAnnotations='';
  let failed=false;
  const scheduler=createFrameScheduler(()=>{
    if(state&&!failed)try{
      if(renderer.getContext().isContextLost()){failed=true;onFailure?.();return;}
      renderer.render(scene,camera);
    }catch{failed=true;onFailure?.();}
  });
  return {mode:'WebGL2',update(view){
    if(failed)return;
    state=view;floorMesh.visible=view.grid!==false;const {size,camera:c}=view,dpr=Math.min(2,Math.max(1,size.dpr)),sizeKey=`${size.width}:${size.height}:${dpr}`;
    if(sizeKey!==lastSize){renderer.setPixelRatio(dpr);renderer.setSize(size.width,size.height,false);lastSize=sizeKey;}
    const basis=cameraBasis(c),center=relative(c.centerMm,data.originMm),distance=data.radiusMm*4+100;
    const target=center.map((v,k)=>v-basis.right[k]*c.panCss[0]/c.pixelsPerMm+basis.up[k]*c.panCss[1]/c.pixelsPerMm) as XYZ;
    camera.position.copy(vec(target.map((v,k)=>v+basis.forward[k]*distance) as XYZ));camera.up.copy(vec(basis.up));camera.lookAt(vec(target));
    camera.left=-size.width/(2*c.pixelsPerMm);camera.right=-camera.left;camera.top=size.height/(2*c.pixelsPerMm);camera.bottom=-camera.top;camera.near=.01;camera.far=distance*3;camera.updateProjectionMatrix();
    const visibleKey=JSON.stringify(view.visible),selectionKey=visibleKey+view.selected,visible=new Set(view.visible);
    if(selectionKey!==lastSelection){
      for(const group of groups){
        let count=0;
        for(const node of group.nodes)if(visible.has(node.id)){
          group.solid.setMatrixAt(count,matrices.get(node.id)!);group.wire.setMatrixAt(count,matrices.get(node.id)!);
          group.solid.setColorAt(count,color.setHex(colors[data.panels.indexOf(node)%colors.length]));count++;
        }
        group.solid.count=count;group.wire.count=count;group.solid.instanceMatrix.needsUpdate=true;group.wire.instanceMatrix.needsUpdate=true;
        if(group.solid.instanceColor)group.solid.instanceColor.needsUpdate=true;
        group.solid.computeBoundingSphere();group.wire.computeBoundingSphere();
      }
      for(const [id,span] of boundarySpans){color.setHex(id===view.selected?0xf1b673:0x65717f);for(let i=0;i<span.count;i++)boundaryColor.setXYZ(span.offset+i,color.r,color.g,color.b);}boundaryColor.needsUpdate=true;
      lastSelection=selectionKey;
    }
    if(visibleKey!==lastVisible){
      let n=0;for(const id of view.visible){const span=boundarySpans.get(id);if(!span)continue;for(let i=0;i<span.count;i++){boundaryIndex.setX(n++,span.offset+i);boundaryIndex.setX(n++,span.offset+(i+1)%span.count);}}
      boundaryIndex.needsUpdate=true;boundaryGeometry.setDrawRange(0,n);boundaryGeometry.computeBoundingSphere();lastVisible=visibleKey;
    }
    for(const group of groups)group.wire.visible=view.wire;
    const annotationKey=JSON.stringify([visibleKey,view.seams,view.anchors]);
    if(annotationKey!==lastAnnotations){
      const lines:number[]=[];
      if(view.seams)for(const seam of model.seams)if(visible.has(seam.aPanel)&&visible.has(seam.bPanel))for(const sample of seam.samples)lines.push(...relative(sample.a,data.originMm),...relative(sample.b,data.originMm));
      if(view.anchors.length===2)lines.push(...relative(view.anchors[0].worldMm,data.originMm),...relative(view.anchors[1].worldMm,data.originMm));
      (annotationBuffer.array as Float32Array).set(lines);annotationBuffer.needsUpdate=true;annotationGeometry.setDrawRange(0,lines.length/3);lastAnnotations=annotationKey;
    }
    scheduler.invalidate();
  },dispose(){
    scheduler.dispose();for(const g of owned)g.dispose();for(const m of materials)m.dispose();
    // React may mount again on the same canvas. Release owned resources without
    // destroying the shared browser context underneath the next renderer.
    for(const group of groups){group.solid.dispose();group.wire.dispose();}renderer.dispose();
  }};
}

function createCanvasRenderer(canvas:HTMLCanvasElement,model:PatternMesh3d,onFailure?:()=>void):PhysicalRenderer{
  let context:CanvasRenderingContext2D|null=null;try{context=canvas.getContext('2d');}catch{/* unavailable is visible to the user */}
  if(!context)return {mode:'unavailable',update(){},dispose(){}};
  const ctx=context;let state:RenderView|undefined,failed=false;
  const draw=()=>{
    if(!state)return;const view=state,{size}=view,dpr=Math.min(2,Math.max(1,size.dpr));
    const width=Math.round(size.width*dpr),height=Math.round(size.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#25262a';ctx.fillRect(0,0,size.width,size.height);
    if(view.grid!==false)for(const line of viewportGrid(model).lines){ctx.beginPath();ctx.strokeStyle=line.axis==='x'?'#765153':line.axis==='z'?'#485f7c':'#3d4048';ctx.moveTo(...projectPhysicalPoint(line.a,view.camera,size));ctx.lineTo(...projectPhysicalPoint(line.b,view.camera,size));ctx.stroke();}
    const basis=cameraBasis(view.camera),depth=(panel:PatternMesh3d['panels'][number])=>panel.positionsMm[0].reduce((s,v,k)=>s+v*basis.forward[k],0);
    for(const panel of model.panels.filter(p=>view.visible.includes(p.id)).sort((a,b)=>depth(a)-depth(b))){
      const points=panel.positionsMm.map(p=>projectPhysicalPoint(p,view.camera,size));ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=['#96c8a2','#c4b5fd','#f4cd93'][model.panels.indexOf(panel)%3];ctx.fill();ctx.strokeStyle=panel.id===view.selected?'#f1b673':'#65717f';ctx.lineWidth=panel.id===view.selected?2:1;ctx.stroke();
      if(view.wire){ctx.beginPath();for(let i=0;i<panel.triangles.length;i+=3){const ids=panel.triangles.slice(i,i+3);ctx.moveTo(...points[ids[0]]);ctx.lineTo(...points[ids[1]]);ctx.lineTo(...points[ids[2]]);ctx.lineTo(...points[ids[0]]);}ctx.stroke();}
    }
    ctx.beginPath();ctx.strokeStyle='#c2410c';
    if(view.seams)for(const seam of model.seams)if(view.visible.includes(seam.aPanel)&&view.visible.includes(seam.bPanel))for(const sample of seam.samples){ctx.moveTo(...projectPhysicalPoint(sample.a,view.camera,size));ctx.lineTo(...projectPhysicalPoint(sample.b,view.camera,size));}
    if(view.anchors.length===2){ctx.moveTo(...projectPhysicalPoint(view.anchors[0].worldMm,view.camera,size));ctx.lineTo(...projectPhysicalPoint(view.anchors[1].worldMm,view.camera,size));}ctx.stroke();
  };
  const scheduler=createFrameScheduler(()=>{if(!failed)try{draw();}catch{failed=true;onFailure?.();}});
  return {mode:'Canvas2D',update(view){if(!failed){state=view;scheduler.invalidate();}},dispose(){scheduler.dispose();}};
}
