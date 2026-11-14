import { designPocketDrawing } from '@/lib/pattern/design-pocket-drawing';
import { computeDraft } from './draft-service';
import { createPieceDesign } from './piece-design';
import { defaultPieceDesign, supportsPieceDesign } from '@/lib/pattern/piece-design-spec';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { requireReviewedPattern } from '@/data/patternReview';
import { SOURCE_PIECE_ROLES } from '@/data/pieceRoleBindings';
import { escapeSvg } from '@/lib/pattern/mesh/garment-technical-view';
import type { DesignConfiguration } from '@/types/design';
import type { CompositionPiece, CompositionSource, CompositionView } from '@/types/piece-composition';
import type { CompositionElements } from '@/types/composition-elements';
import { companyTeeDrawing } from '@/lib/pattern/company-tee-flat';

export interface ArtworkBounds {x:number;y:number;width:number;height:number}
export interface CompositionAsset {
 key:string;sourceId:string;name:string;role:string;defaultView:CompositionView;
 netPath:string;cutPath:string;onFold:boolean;foldAxisX?:number;widthMm:number;heightMm:number;
 netBounds:ArtworkBounds;artBounds:ArtworkBounds;markup:string;artScale:number;
 illustration:boolean;netReferenceAvailable?:boolean;
 anchor?:{x:number;y:number};
}
export interface CompositionCatalogue {source:CompositionSource;name:string;assets:CompositionAsset[]}
const cache=new Map<string,CompositionCatalogue>();
const illustrationSources=new Map<string,ReturnType<typeof createPieceDesign>>();
export function compositionSource(c:DesignConfiguration,templateId=c.activePatternId):CompositionSource {
 return {templateId,gender:c.gender,standardSize:c.standardSize,fit:c.fit,measurements:structuredClone(c.measurements),construction:templateId===c.activePatternId?c.construction:undefined};
}
/** Bounds of the actual source path, including relative H/V and quadratic curves. */
function bounds(d:string):ArtworkBounds {
 const chunks=d.match(/[MLCQHVZ][^MLCQHVZ]*/gi)??[],points:{x:number;y:number}[]=[];let x=0,y=0,sx=0,sy=0;
 for(const chunk of chunks){
  const command=chunk[0].toUpperCase(),relative=chunk[0]!==command,nums=(chunk.slice(1).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)??[]).map(Number);
  if(command==='Z'){x=sx;y=sy;points.push({x,y});continue;}
  const stride=command==='C'?6:command==='Q'?4:command==='H'||command==='V'?1:2;
  for(let i=0;i<nums.length;i+=stride){
   const ox=x,oy=y;
   if(command==='H')x=nums[i]+(relative?x:0);
   else if(command==='V')y=nums[i]+(relative?y:0);
   else {
    const coords=nums.slice(i,i+stride).map((n,j)=>n+(relative?(j%2?oy:ox):0));
    if(command==='C'||command==='Q')for(let s=0;s<=64;s++){
     const t=s/64,u=1-t;
     points.push(command==='C'?{x:u**3*ox+3*u*u*t*coords[0]+3*u*t*t*coords[2]+t**3*coords[4],y:u**3*oy+3*u*u*t*coords[1]+3*u*t*t*coords[3]+t**3*coords[5]}:{x:u*u*ox+2*u*t*coords[0]+t*t*coords[2],y:u*u*oy+2*u*t*coords[1]+t*t*coords[3]});
    }
    x=coords.at(-2)!;y=coords.at(-1)!;
   }
   if(command==='M'){sx=x;sy=y;}points.push({x,y});
  }
 }
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX,height=Math.max(...ys)-minY;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('裁片净样范围无效');
 return {x:minX,y:minY,width,height};
}
function asset(key:string,sourceId:string,name:string,netPath:string,cutPath:string,onFold:boolean,view:CompositionView,foldAxisX?:number):CompositionAsset {
 const original=bounds(netPath),axis=foldAxisX??(Math.abs(original.x)<.05?0:undefined);
 if(onFold&&axis===undefined)throw Error('此对折裁片的展开轴尚未接通，不能猜测镜像位置');
 const folded=onFold&&axis!==undefined;
 const minX=folded?Math.min(original.x,2*axis-(original.x+original.width)):original.x;
 const maxX=folded?Math.max(original.x+original.width,2*axis-original.x):original.x+original.width;
 const b={...original,x:minX,width:maxX-minX};
 const net=`<path d="${escapeSvg(netPath)}" fill="currentColor" stroke="#273a30" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
 return {key,sourceId,name,role:SOURCE_PIECE_ROLES[sourceId]?.role??(sourceId==='design.patch-pocket'?'pocket.patch':'binding.neck'),defaultView:view,netPath,cutPath,onFold,foldAxisX:folded?axis:undefined,widthMm:b.width,heightMm:b.height,netBounds:b,artBounds:b,markup:net+(folded?`<g transform="translate(${2*axis} 0) scale(-1 1)">${net}</g>`:''),artScale:Math.min(.66,440/b.width,490/b.height),illustration:false};
}
export function compositionCatalogue(source:CompositionSource,elements?:CompositionElements):CompositionCatalogue {
 const options=elements?{shoulder:elements.shoulder,neckline:elements.neckline,craft:elements.craft,details:elements.details,cuffColor:elements.cuffContrast?elements.cuffColor:undefined,neckColor:elements.neckContrast?elements.neckColor:undefined}:undefined;
 const key=JSON.stringify([source,options]),cached=cache.get(key);if(cached)return cached;
 requireReviewedPattern(source.templateId);
 const configuration:DesignConfiguration={activePatternId:source.templateId,gender:source.gender,standardSize:source.standardSize,fit:source.fit,measurements:source.measurements,construction:source.construction,engineVersion:'4.10.2',garmentColor:'#364038',fabricId:'solid'};
 let assets:CompositionAsset[];
 if(supportsPieceDesign(source.templateId)){
  const sourceKey=JSON.stringify(source);
  let result=illustrationSources.get(sourceKey);
  if(!result){result=createPieceDesign({...configuration,pieceDesign:defaultPieceDesign('#364038')});illustrationSources.set(sourceKey,result);if(illustrationSources.size>40)illustrationSources.delete(illustrationSources.keys().next().value!);}
  const drawing=options?companyTeeDrawing({...configuration,pieceDesign:defaultPieceDesign('#364038')},result.flatSpecification,options):result.styleDrawing;
  const originals=result.pieces.map(p=>asset(p.id,p.id,p.name,p.netPath,p.cutPath,p.onFold??false,p.id==='teagan.back'?'back':'front'));
  assets=drawing.editableParts.map(a=>{
   const original=originals.find(p=>p.sourceId===a.sourceId)??(a.sourceId==='t-shirt.finish.neckband'?originals.find(p=>p.sourceId.endsWith('.finish.neckband')):undefined);if(!original)throw Error('款式片缺少对应源裁片');
   const markup=a.markup.replace(/<path\b[^>]*>/g,path=>{
    const op=path.match(/data-operation="([^"]+)"/)?.[1]??'';
    let next=path.includes('data-design-element=')?path:path.replace(/fill="#[a-f\d]{6}"/gi,'fill="currentColor"');
    const width=Number(next.match(/stroke-width="([^"]+)"/)?.[1]??.001);
    // Company flat drawings use normalized coordinates (the garment is roughly
    // one unit high). Keep stroke widths in that same normalized unit. Writing
    // visual pixel weights such as `2.05` here makes the later art-scale
    // transform expand the stroke hundreds of times and paints over the whole
    // three-view canvas.
    const rendered=op==='garment-contour'||op==='style-outline'?.00205:op.includes('polo-collar')||op==='placket-facing'?.00145:op==='armhole-seam'||op==='side-seam'?.0011:op.includes('double-needle')||op==='buttonhole'||op==='neck-rib'?.0007:width<.0008?.00035:width<.0013?.00055:width<.002?.00105:width<.003?.00135:.0018;
    next=next.replace(/stroke-width="[^"]+"/,`stroke-width="${rendered}"`);
    if(op.includes('double-needle')||op==='placket-topstitch')next=next.replace('/>', ' stroke-dasharray="4 3"/>');
    if(op==='neck-rib')next=next.replace('stroke="', 'stroke-opacity=".5" stroke="');
    if(op==='polo-collar-centre-fold'||op.includes('polo-collar-')&&op.endsWith('edge')||op==='polo-front-collar-stand-edge')next=next.replace(/stroke="[^"]+"/, 'stroke="#354638"');
    if(op==='placket-facing')next=next.replace(/stroke="[^"]+"/, 'stroke="#40594a"');
    return next;
   });
   return {...original,key:a.key,name:a.name,defaultView:a.view,markup,artBounds:a.bounds,artScale:drawing.scale,illustration:true,anchor:a.key==='sleeve'?{x:drawing.provenance.landmarks.shoulder[0],y:drawing.provenance.landmarks.shoulder[1]}:undefined};
  });
  assets.push(...originals.filter(p=>p.sourceId==='design.patch-pocket'));
  const pocket=originals.find(p=>p.sourceId==='design.patch-pocket')!;
  for(const kind of ['kangaroo','welt','zip-welt'] as const){
   const drawing=designPocketDrawing(kind,kind==='kangaroo'?230:140,kind==='kangaroo'?180:20);
   assets.push({...pocket,key:`design.${kind}-pocket`,name:{kangaroo:'袋鼠袋',welt:'嵌线袋','zip-welt':'拉链嵌线袋'}[kind],sourceId:`design.${kind}-pocket`,role:kind==='kangaroo'?'pocket.patch':'pocket.welt',netReferenceAvailable:false,netPath:'',cutPath:'',onFold:false,foldAxisX:undefined,netBounds:{x:0,y:0,width:drawing.width,height:drawing.height},markup:drawing.markup,artBounds:{x:0,y:0,width:drawing.width,height:drawing.height},widthMm:drawing.width,heightMm:drawing.height,artScale:.66,illustration:true});
  }

 }else {
  const draft=computeDraft(configuration);if(draft.status==='blocked')throw Error(draft.error!);
  assets=draft.pieces.map(p=>{
   const net=p.paths.find(p=>p.layer==='seam-line')!,cut=p.paths.filter(p=>p.layer==='cutting-line').map(p=>p.data).join(' ');
   const fold=p.paths.find(p=>p.layer==='grain-line'&&p.id.includes('cutonfold'))?.data;
   const numbers=fold?.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)/g)?.map(Number);
   const axis=numbers&&numbers.length>=4&&Math.abs(numbers[0]-numbers.at(-2)!)<.01?numbers[0]:undefined;
   return asset(p.key,p.key,p.name,net.data,cut,!!net.cutOnFold,p.view==='back'?'back':'front',axis);
  });
 }
 const result={source:structuredClone(source),name:PATTERN_LIBRARY[source.templateId].name,assets};
 cache.set(key,result);if(cache.size>40)cache.delete(cache.keys().next().value!);return result;
}
export function resolveCompositionPiece(piece:CompositionPiece,elements?:CompositionElements){
 const catalogue=compositionCatalogue(piece.source,elements),asset=catalogue.assets.find(a=>a.key===piece.assetKey);
 if(!asset)throw Error(`源裁片不存在：${piece.name}`);return asset;
}
export function pieceDisplaySize(piece:CompositionPiece,asset:CompositionAsset){
 return {width:asset.artBounds.width*asset.artScale*piece.widthMm/asset.widthMm,height:asset.artBounds.height*asset.artScale*piece.heightMm/asset.heightMm};
}
export function newCompositionPiece(asset:CompositionAsset,source:CompositionSource,id:string,view=asset.defaultView):CompositionPiece {
 const b=asset.artBounds;
 return {id,source:structuredClone(source),assetKey:asset.key,name:asset.name,view,x:asset.illustration?250+(b.x+b.width/2)*asset.artScale:250,y:asset.illustration?105+(b.y+b.height/2)*asset.artScale:340,widthMm:asset.widthMm,heightMm:asset.heightMm,rotation:0,mirrored:false,color:'#364038',visible:true};
}
export function compositionTeeStarter(source:CompositionSource,id:()=>string):CompositionPiece[] {
 const catalogue=compositionCatalogue({...source,templateId:'t-shirt',construction:undefined}),get=(key:string,view?:CompositionView)=>{
  const a=catalogue.assets.find(a=>a.key===key)!;return newCompositionPiece(a,catalogue.source,id(),view);
 };
 const pieces:CompositionPiece[]=[];
 for(const view of ['front','back'] as const){
  if(view==='front')pieces.push(get('facing'));
  for(const mirrored of [false,true]){const sleeve=get('sleeve',view);if(mirrored){sleeve.x=500-sleeve.x;sleeve.mirrored=true;}pieces.push(sleeve);}
  pieces.push(get(`body-${view}`),get(`neck-${view}`));
 }
 pieces.push(get('side-body'),get('side-sleeve'));return pieces.map(p=>anchorCompositionPiece(p));
}

/**
 * Start a lower-body composition from the reviewed Paco base.  The three
 * views use fixed structural slots: front/back are the sourced trouser
 * pieces, the side view is a locked silhouette reference, and the waistband
 * is repeated at the waist anchor for each view.  Pockets and graphics remain
 * the only movable attachments.
 */
export function compositionPantsStarter(source:CompositionSource,id:()=>string):CompositionPiece[] {
 const pantsSource={...source,templateId:'elastic-waist-pants',construction:source.templateId==='elastic-waist-pants'?source.construction:undefined};
 const catalogue=compositionCatalogue(pantsSource),get=(key:string,view:CompositionView)=>{
  const a=catalogue.assets.find(a=>a.key===key);if(!a)throw Error(`男裤起稿缺少${key}源裁片`);
  return newCompositionPiece(a,catalogue.source,id(),view);
 };
 const pieces:CompositionPiece[]=[get('paco.front','front'),get('paco.back','back')];
 // Paco has no native side projection; use the same reviewed front contour as
 // a locked side reference and label it explicitly in the canvas metadata.
 pieces.push({...get('paco.front','side'),name:'侧面裤腿轮廓'});
 for(const view of ['front','back','side'] as const)pieces.push(get('paco.waistband',view));
 return pieces.map(p=>anchorCompositionPiece(p,resolveCompositionPiece(p)));
}

export function compositionStarter(source:CompositionSource,id:()=>string):CompositionPiece[] {
 return source.templateId==='elastic-waist-pants'?compositionPantsStarter(source,id):compositionTeeStarter(source,id);
}

/** Only explicitly classified accessories have free placement. */
export function compositionMovable(piece:CompositionPiece|CompositionAsset):boolean {
 const role='role' in piece?piece.role:resolveCompositionPiece(piece).role;
 return role==='pocket.patch'||role==='pocket.welt';
}
export function compositionReplaceable(asset:CompositionAsset):boolean {
 return asset.illustration||compositionMovable(asset);
}
function family(asset:CompositionAsset):string {
 if(asset.key==='facing')return 'facing';
 if(['neck-front','neck-back'].includes(asset.key))return 'neck';
 if(['body-front','body-back','side-body'].includes(asset.key))return 'body';
 if(asset.role==='sleeve.main')return 'sleeve';
 // Split shirt fronts remain distinct structural parts.
 if(['simon.frontLeft','simon.frontRight'].includes(asset.key))return asset.key;
 return asset.role;
}
export function compositionSlot(piece:CompositionPiece):string|null {
 const asset=resolveCompositionPiece(piece);if(compositionMovable(asset))return null;
 return `${piece.view}:${family(asset)}${family(asset)==='sleeve'&&piece.view!=='side'?(piece.mirrored?':left':':right'):''}`;
}
/** Recompute fixed placement from source geometry, never from a stored drag offset. */
export function anchorCompositionPiece(piece:CompositionPiece,asset=resolveCompositionPiece(piece)):CompositionPiece {
 if(compositionMovable(asset))return piece;
 const kind=family(asset),b=asset.artBounds,size=pieceDisplaySize(piece,asset);
 const view=['body-front','neck-front','facing'].includes(asset.key)?'front':
  ['body-back','neck-back'].includes(asset.key)?'back':asset.key.startsWith('side-')?'side':piece.view;
 const mirrored=kind==='sleeve'&&view!=='side'?piece.mirrored:false;
 const sign=mirrored?-1:1;
 // Sleeves grow outward from their upper armhole corner; bodies and necks
 // retain the centre of the neckline. Side illustrations retain their top.
 const anchorX=asset.anchor?.x??(kind==='sleeve'&&view!=='side'?b.x:b.x+b.width/2);
 const anchorY=asset.anchor?.y??b.y;
 let mountX=250,mountY=105;
 if(asset.illustration){mountX+=sign*anchorX*asset.artScale;mountY+=anchorY*asset.artScale;}
 else if(kind==='sleeve'){mountX+=sign*115;mountY=145;}
 else if(kind==='body'||kind.startsWith('body.'))mountY=105;
 else if(kind==='trouser')mountY=105;
 else if(kind.startsWith('waistband'))mountY=72;
 else if(kind.startsWith('cuff.')){mountX+=115;mountY=280;}
 else if(kind.startsWith('hem-band.')||kind.startsWith('waistband.'))mountY=570;
 return {...piece,view,mirrored,rotation:0,x:mountX+sign*((b.x+b.width/2-anchorX)/b.width)*size.width,y:mountY+((b.y+b.height/2-anchorY)/b.height)*size.height};
}
export function normalizeComposition(value:import('@/types/piece-composition').PieceComposition){
 return {...value,plans:value.plans.map(plan=>({...plan,pieces:plan.pieces.map(p=>anchorCompositionPiece(p,resolveCompositionPiece(p,plan.elements)))}))};
}
/** Replace occupied structural slots, retaining IDs, colour and stacking order. */
export function replaceCompositionAsset(plan:import('@/types/piece-composition').CompositionPlan,asset:CompositionAsset,cat:CompositionCatalogue,id:()=>string,view:CompositionView,x?:number,y?:number){
 if(!compositionReplaceable(asset))throw Error('此裁片仅有源净样，尚未接通成衣三视图映射，请先选已有款式映射的裁片。');
 if(compositionMovable(asset)){
  const p=newCompositionPiece(asset,cat.source,id(),view);p.x=x??315;p.y=y??285;
  return {plan:{...plan,pieces:[...plan.pieces,p]},selectedId:p.id};
 }
 const kind=family(asset),targets:CompositionPiece[]=[];
 const add=(a:CompositionAsset,v:CompositionView,mirrored=false)=>targets.push(anchorCompositionPiece({...newCompositionPiece(a,cat.source,id(),v),mirrored}));
 if(kind==='sleeve'){
  const main=cat.assets.find(a=>family(a)==='sleeve'&&a.key!=='side-sleeve')??asset;
  for(const v of ['front','back'] as const){add(main,v);add(main,v,true);}
  const side=cat.assets.find(a=>a.key==='side-sleeve');if(side)add(side,'side');
 }else if(kind==='neck'){
  for(const v of ['front','back'] as const){const a=cat.assets.find(a=>a.key===`neck-${v}`);if(a)add(a,v);}
 }else add(asset,kind==='body'?asset.defaultView:view);
 const pending=new Map(targets.map(p=>[compositionSlot(p),p]));
 let selectedId=targets[0].id;
 const pieces=plan.pieces.flatMap(old=>{
  const slot=compositionSlot(old),p=pending.get(slot);if(!p)return [old];
  pending.delete(slot);const replacement={...p,id:old.id,color:old.color,visible:old.visible};
  if(slot===compositionSlot(targets[0]))selectedId=old.id;
  return [replacement];
 });
 // Repeated replacement never appends a second sleeve or collar at an occupied slot.
 const targetSlots=new Set(targets.map(compositionSlot)),seen=new Set<string|null>();
 const unique=pieces.filter(p=>{const slot=compositionSlot(p);if(!targetSlots.has(slot))return true;if(seen.has(slot))return false;seen.add(slot);return true;});
 return {plan:{...plan,pieces:[...unique,...pending.values()]},selectedId};
}
