import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cameraBasis } from '@/lib/pattern/mesh/viewport-mapping';
import { garmentBounds,garmentUv,garmentUsesImage } from '@/lib/pattern/mesh/garment-view';
import { garmentDetailColor } from '@/lib/pattern/mesh/garment-finish';
import { createFrameScheduler } from './frame-scheduler';
import { createGarmentAntialias } from './garment-antialias';
import type { GarmentAppearance,GarmentDisplay3d } from '@/types/garment3d';
import type { PhysicalCamera,ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';
import type { MannequinSpec } from '@/types/mannequin';
import { mannequinDimensions } from '@/types/mannequin';
import type { GarmentPerformanceProfile } from './garment-performance';

export interface GarmentFrameStats {frameMs:number;triangles:number;tier:GarmentPerformanceProfile['tier']}
export interface GarmentRenderView {camera:PhysicalCamera;size:ViewportSize;wire:boolean;selected:string;appearance:GarmentAppearance;tile:HTMLCanvasElement;image:HTMLImageElement|null;mannequin?:MannequinSpec;performance?:GarmentPerformanceProfile;onPerformance?:(stats:GarmentFrameStats)=>void;onAvatarStatus?:(status:'loading'|'ready'|'error'|'parametric'|'unsupported')=>void}
export function createGarmentRenderer(canvas:HTMLCanvasElement,model:GarmentDisplay3d,onFailure:()=>void){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});if(renderer.getContext().isContextLost()){renderer.dispose();throw new Error('图形连接不可用');}
  const antialias=createGarmentAntialias(renderer,canvas);
  renderer.setClearColor(0xe4e6e2);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),bounds=garmentBounds(model),center=bounds.center,r=bounds.radius;
  scene.add(new THREE.HemisphereLight(0xffffff,0x39424d,1.6));
  for(const [x,y,z,intensity]of [[1,2,3,2.2],[-2,1,1,.8],[0,1,-3,1.2]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(x*r,y*r,z*r);
    if(x===1){light.castShadow=true;light.shadow.intensity=.35;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-r*1.2,right:r*1.2,top:r*1.2,bottom:-r*1.2,near:r*.1,far:r*8});light.shadow.normalBias=.6;light.shadow.bias=-.0001;light.shadow.camera.updateProjectionMatrix();}scene.add(light);}
  const meshes=model.surfaces.map(surface=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(surface.positionsMm.flatMap(p=>p.map((v,k)=>v-center[k])),3));geometry.setIndex(surface.triangles);geometry.setAttribute('normal',new THREE.Float32BufferAttribute(surface.renderNormals.flat(),3));
    const solid=model.metrics.closedShell||!!surface.detail,material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92,metalness:0,side:solid?THREE.FrontSide:THREE.DoubleSide});
    // Closed cloth already has an inner shell. Casting its backfaces and every
    // 0.4mm thread into a coarse shadow map creates unstable dark speckles.
    material.shadowSide=solid?THREE.FrontSide:THREE.DoubleSide;
    // Only the main cloth participates in the shadow map. Inner cloth, rims,
    // rib, turnbacks and threads retain normal lighting and depth occlusion,
    // without receiving/casting coarse shadows from submillimetre neighbours.
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=surface.layer==='outer'&&!surface.detail;mesh.receiveShadow=mesh.castShadow;scene.add(mesh);return {surface,mesh,material,geometry};
  });
  const mannequinGroup=new THREE.Group();scene.add(mannequinGroup);const realAvatarGroup=new THREE.Group();realAvatarGroup.visible=false;realAvatarGroup.renderOrder=-2;scene.add(realAvatarGroup);
  let realAvatarReady=false,realAvatarRoot:THREE.Object3D|null=null,avatarMixer:THREE.AnimationMixer|null=null,disposed=false;
  let state:GarmentRenderView|null=null;
  let scheduler:ReturnType<typeof createFrameScheduler>|null=null;
  const avatarLoader=new GLTFLoader();
  // Resolve the public asset to an absolute URL so Three's FileLoader also
  // behaves deterministically in test/preview environments whose base URL is
  // not configured. The asset remains optional; failures use the error status.
  const avatarUrl=new URL('/avatars/xbot/Xbot.glb',globalThis.location?.href??'http://localhost/').href;
  avatarLoader.load(avatarUrl,gltf=>{
    if(disposed)return;
    realAvatarRoot=gltf.scene;realAvatarRoot.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=false;object.receiveShadow=false;object.renderOrder=-2;const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){material.transparent=true;material.opacity=.34;material.depthWrite=false;}}});
    const raw=new THREE.Box3().setFromObject(realAvatarRoot),height=Math.max(1,raw.max.y-raw.min.y);realAvatarRoot.scale.setScalar(1750/height);realAvatarGroup.add(realAvatarRoot);const idle=gltf.animations.find(clip=>clip.name.toLowerCase()==='idle');if(idle){avatarMixer=new THREE.AnimationMixer(realAvatarRoot);const action=avatarMixer.clipAction(idle);action.play();avatarMixer.setTime(Math.min(idle.duration*.45,1.2));action.paused=true;}realAvatarReady=true;if(state?.mannequin?.mode==='real-human'){positionRealAvatar(state.mannequin);realAvatarGroup.visible=true;}state?.onAvatarStatus?.('ready');scheduler?.invalidate();
  },undefined,()=>{if(!disposed&&state?.mannequin?.mode==='real-human')state.onAvatarStatus?.('error');});
  let mannequinKey='';
  function clearMannequin(){
    for(const child of [...mannequinGroup.children]){
      mannequinGroup.remove(child);
      const mesh=child as THREE.Mesh;
      mesh.geometry?.dispose();
      const material=mesh.material as THREE.Material|THREE.Material[]|undefined;
      if(Array.isArray(material))material.forEach(m=>m.dispose());else material?.dispose();
    }
  }
  function buildMannequin(spec:MannequinSpec){
    clearMannequin();
    const d=mannequinDimensions(spec),top=bounds.max[1]-center[1],shoulderY=top-8;
    const material=new THREE.MeshStandardMaterial({color:spec.gender==='female'?0xc7a9a0:0x9b8f8b,roughness:.92,transparent:true,opacity:.11,depthWrite:false,depthTest:true});
    const add=(geometry:THREE.BufferGeometry,position:[number,number,number],scale:[number,number,number],rotationZ=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.z=rotationZ;mesh.renderOrder=-1;mannequinGroup.add(mesh);};
    const capsule=(length:number)=>new THREE.CapsuleGeometry(1,length,8,16);
    const joint=(position:[number,number,number],radius:number,depth=radius)=>add(new THREE.SphereGeometry(1,16,12),position,[radius,radius,depth]);
    add(capsule(d.torsoLengthMm),[0,shoulderY-d.torsoLengthMm/2,0],[d.bustWidthMm/2,1,d.bustWidthMm*.38]);
    add(new THREE.CylinderGeometry(d.headRadiusMm*.72,d.headRadiusMm*.78,70,20),[0,shoulderY+55,0],[1,1,1]);
    add(new THREE.SphereGeometry(d.headRadiusMm,20,14),[0,shoulderY+55+d.headRadiusMm+38,0],[1,1,1]);
    const armX=d.shoulderWidthMm/2,armRadiusMm=d.upperArmRadiusMm,upperArmLength=d.armLengthMm*.34,lowerArmLength=d.armLengthMm*.4;
    for(const side of [-1,1]){const x=side*armX,upperY=shoulderY-upperArmLength*.55,lowerY=shoulderY-upperArmLength-lowerArmLength*.45;
      add(capsule(upperArmLength),[x,upperY,0],[armRadiusMm,1,armRadiusMm],side*.08);
      add(capsule(lowerArmLength),[x,lowerY,0],[armRadiusMm*.82,1,armRadiusMm*.82],side*.04);
      joint([x,shoulderY-upperArmLength-lowerArmLength*.86,0],armRadiusMm*.58,armRadiusMm*.52);
    }
    // This is the upper-garment mannequin. Lower-body geometry belongs to
    // the trouser workflow and is intentionally omitted here so it cannot
    // distort a T-shirt/upper-body framing.
    mannequinGroup.userData.mode='parametric-display-body';mannequinGroup.userData.productionApproved=false;mannequinGroup.userData.clearanceMm=spec.clearanceMm;
  }
  function positionRealAvatar(spec:MannequinSpec){
    if(!realAvatarRoot)return;const raw=new THREE.Box3().setFromObject(realAvatarRoot),centerX=(raw.min.x+raw.max.x)/2,centerZ=(raw.min.z+raw.max.z)/2,height=raw.max.y-raw.min.y,top=bounds.max[1]-center[1],targetShoulder=top-8;
    realAvatarRoot.position.x=-centerX;realAvatarRoot.position.z=-centerZ;realAvatarRoot.position.y=targetShoulder-(raw.min.y+height*.78);realAvatarGroup.userData.mode='real-human-glb';realAvatarGroup.userData.asset=avatarUrl;realAvatarGroup.userData.productionApproved=false;realAvatarGroup.userData.clearanceMm=spec.clearanceMm;
  }
  const grid=new THREE.GridHelper(r*3,24,0x646674,0x3d4048);grid.position.y=bounds.min[1]-center[1]-15;scene.add(grid);
  const textures:THREE.Texture[]=[];let appearanceKey='',lastImageUrl:string|undefined,lastSize='',lastTile:HTMLCanvasElement|null=null,lastImage:HTMLImageElement|null=null,failed=false;
  scheduler=createFrameScheduler(()=>{if(!state||failed)return;try{if(renderer.getContext().isContextLost())throw Error();const started=globalThis.performance.now();renderer.shadowMap.enabled=state.performance?.shadows??true;antialias.render(scene,camera);state.onPerformance?.({frameMs:globalThis.performance.now()-started,triangles:model.metrics.renderTriangles,tier:state.performance?.tier??'high'});}catch{failed=true;onFailure();}});
  return {update(view:GarmentRenderView){
    state=view;const {size,camera:c}=view,profile=view.performance,dpr=antialias.pixelRatio(size.dpr,size.width,size.height,profile?.tier),sizeKey=`${size.width}:${size.height}:${dpr}:${profile?.tier??'high'}`;
    grid.visible=!view.mannequin?.enabled;
    if(!view.mannequin?.enabled)grid.position.y=bounds.min[1]-center[1]-15;
    if(sizeKey!==lastSize){renderer.setPixelRatio(Math.min(dpr,profile?.pixelRatioCap??2));renderer.setSize(size.width,size.height,false);antialias.resize(size.width,size.height,dpr);lastSize=sizeKey;}
    const basis=cameraBasis(c),target=c.centerMm.map((v,k)=>v-center[k]-basis.right[k]*c.panCss[0]/c.pixelsPerMm+basis.up[k]*c.panCss[1]/c.pixelsPerMm);
    camera.position.set(...target.map((v,k)=>v+basis.forward[k]*(r*4+100)) as [number,number,number]);camera.up.set(...basis.up);camera.lookAt(new THREE.Vector3(...target));
    camera.left=-size.width/(2*c.pixelsPerMm);camera.right=-camera.left;camera.top=size.height/(2*c.pixelsPerMm);camera.bottom=-camera.top;
    // Tight mm-space depth range; panning changes only the screen plane.
    const depthCenter=camera.position.x*basis.forward[0]+camera.position.y*basis.forward[1]+camera.position.z*basis.forward[2];
    camera.near=Math.max(.1,depthCenter-r-1);camera.far=Math.max(camera.near+1,depthCenter+r+1);camera.updateProjectionMatrix();
    const a=view.appearance,nextKey=[a.color,a.fabric,a.repeatMm,a.imageMode,a.imageTarget,a.rotationDeg].join(':');
    const nextMannequinKey=view.mannequin?.enabled?JSON.stringify([view.mannequin.mode,view.mannequin.gender,view.mannequin.standardSize,view.mannequin.clearanceMm,view.mannequin.measurements]):'off';
    if(nextMannequinKey!==mannequinKey){if(view.mannequin?.enabled){if(view.mannequin.mode==='real-human'){clearMannequin();realAvatarGroup.visible=true;mannequinGroup.visible=false;positionRealAvatar(view.mannequin);view.onAvatarStatus?.(realAvatarReady?'ready':'loading');}else{realAvatarGroup.visible=false;mannequinGroup.visible=true;buildMannequin(view.mannequin);view.onAvatarStatus?.('parametric');}}else{clearMannequin();realAvatarGroup.visible=false;mannequinGroup.visible=false;view.onAvatarStatus?.('unsupported');}mannequinKey=nextMannequinKey;}
    // Do not stringify multi-megabyte raster data or resize the canvas on orbit.
    if(appearanceKey!==nextKey||lastImageUrl!==a.imageDataUrl||lastTile!==view.tile||lastImage!==view.image){
      for(const t of textures)t.dispose();textures.length=0;
      const tile=new THREE.CanvasTexture(view.tile);tile.colorSpace=THREE.SRGBColorSpace;tile.flipY=false;tile.wrapS=tile.wrapT=THREE.RepeatWrapping;textures.push(tile);
      const uploaded=view.image?new THREE.Texture(view.image):null;if(uploaded){uploaded.needsUpdate=true;uploaded.colorSpace=THREE.SRGBColorSpace;uploaded.flipY=false;uploaded.wrapS=uploaded.wrapT=view.appearance.imageMode==='repeat'?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;textures.push(uploaded);}
      for(const texture of textures){texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;}
      for(const {surface,material,geometry}of meshes){const applyImage=uploaded&&garmentUsesImage(surface,view.appearance);material.map=surface.detail?null:applyImage?uploaded:tile;material.color.set(surface.detail?garmentDetailColor(surface,a.color):'#ffffff');material.needsUpdate=true;geometry.setAttribute('uv',new THREE.Float32BufferAttribute(garmentUv(surface,view.appearance),2));}
      appearanceKey=nextKey;lastImageUrl=a.imageDataUrl;lastTile=view.tile;lastImage=view.image;
    }
    for(const {surface,material}of meshes){material.wireframe=view.wire;material.emissive.setHex(surface.sourceSurfaceId===view.selected?0x151009:0x000000);}
    scheduler?.invalidate();
  },dispose(){disposed=true;scheduler?.dispose();antialias.dispose();for(const {geometry,material}of meshes){geometry.dispose();material.dispose();}clearMannequin();for(const t of textures)t.dispose();for(const light of scene.children)if(light instanceof THREE.DirectionalLight)light.shadow.dispose();grid.geometry.dispose();(grid.material as THREE.Material).dispose();renderer.dispose();}};
}
