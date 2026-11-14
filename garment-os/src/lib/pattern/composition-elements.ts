import type { CompositionElements, CompositionGraphic, CompositionCraft, CompositionDetails, EmbeddedRaster } from '@/types/composition-elements';
import { readManagedAssignments } from '@/application/managed-materials';
import dictionary from '@/data/designTagDictionary.snapshot.json';

export const DEFAULT_COMPOSITION_ELEMENTS:CompositionElements={shoulder:'set-in',neckline:'crew',sleeveContrast:false,neckContrast:false,cuffContrast:false,sleeveColor:'#52677a',neckColor:'#e5dcc9',cuffColor:'#e5dcc9',fabric:'jersey',graphics:[]};
export const DEFAULT_COMPOSITION_CRAFT:CompositionCraft={opening:'none',neckFinish:'rib',bindingWidthMm:8,backNeckTape:false,seamFinish:'plain',trimColor:'#e5dcc9',openingLengthMm:140,placketWidthMm:22,collarHeightMm:35};
export const DEFAULT_COMPOSITION_DETAILS:CompositionDetails={cuffFinish:'turned',cuffHeightMm:35,hemFinish:'turned',hemHeightMm:45,slitHeightMm:50,panel:'none',panelColor:'#d9d2c0',panelDepthMm:130,hood:'none',hoodHeightMm:320,drawcord:false};
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('改款元素格式无效');return v as Record<string,unknown>;};
const str=(v:unknown,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('改款元素文字无效');return v;};
const num=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('改款元素尺寸或位置无效');return v;};
const color=(v:unknown)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('改款元素配色无效');return v;};
function choice<T extends string>(v:unknown,choices:readonly T[]):T{if(!choices.includes(v as T))throw Error('改款元素选项无效');return v as T;}
export function readCompositionCraft(value:unknown):CompositionCraft{
 const v=obj(value);if(typeof v.backNeckTape!=='boolean')throw Error('后领包条开关无效');
 return {opening:choice(v.opening,['none','buttons','quarter-zip','full-zip']),neckFinish:choice(v.neckFinish,['rib','binding']),bindingWidthMm:num(v.bindingWidthMm,3,20),backNeckTape:v.backNeckTape,seamFinish:choice(v.seamFinish,['plain','topstitch','piping']),trimColor:color(v.trimColor),openingLengthMm:num(v.openingLengthMm,60,350),placketWidthMm:num(v.placketWidthMm,10,50),collarHeightMm:num(v.collarHeightMm,15,70)};
}
export function readCompositionDetails(value:unknown):CompositionDetails{
 const v=obj(value);if(typeof v.drawcord!=='boolean')throw Error('帽绳开关无效');
 const result:CompositionDetails={cuffFinish:choice(v.cuffFinish,['turned','rib']),cuffHeightMm:num(v.cuffHeightMm,15,70),hemFinish:choice(v.hemFinish,['turned','rib','side-slit']),hemHeightMm:num(v.hemHeightMm,20,80),slitHeightMm:num(v.slitHeightMm,20,120),panel:choice(v.panel,['none','yoke','side']),panelColor:color(v.panelColor),panelDepthMm:num(v.panelDepthMm,60,220),hood:choice(v.hood,['none','two-piece','three-piece']),hoodHeightMm:num(v.hoodHeightMm,250,400),drawcord:v.drawcord};
 if(result.drawcord&&result.hood==='none')throw Error('帽绳须配帽体及帽口绳道');
 return result;
}
export function readEmbeddedRaster(value:unknown):EmbeddedRaster{
 const v=obj(value);if(typeof v.dataUrl!=='string'||v.dataUrl.length>2_000_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v.dataUrl))throw Error('图片须为有效的嵌入式PNG、JPEG或WebP，且不超过1.5MB');
 return {dataUrl:v.dataUrl,width:num(v.width,1,4096),height:num(v.height,1,4096)};
}
export function readCompositionElements(value:unknown):CompositionElements{
 const v=obj(value);if(!Array.isArray(v.graphics)||v.graphics.length>12)throw Error('每个方案最多12个Logo');
 const graphics:CompositionGraphic[]=v.graphics.map(value=>{
  const g=obj(value),kind=choice(g.kind,['text','monogram','emblem','image']);
  const image=g.image===undefined?undefined:readEmbeddedRaster(g.image);if(kind==='image'&&!image)throw Error('上传Logo缺少图片');
  return {id:str(g.id),...(g.technique===undefined?{}:{technique:choice(g.technique,['artwork','digital-print','embroidery','applique'])}),kind,text:str(g.text,40),color:color(g.color),view:choice(g.view,['front','back','side']),x:num(g.x,0,500),y:num(g.y,65,700),width:num(g.width,10,300),height:num(g.height,5,300),...(g.rotation===undefined?{}:{rotation:num(g.rotation,-360,360)}),...(image?{image}:{})};
 });
 if(new Set(graphics.map(g=>g.id)).size!==graphics.length)throw Error('Logo标识重复');
 const materials=readManagedAssignments(v.materials),materialImages:CompositionElements['materialImages']={};
 if(v.materialImages!==undefined)for(const [slot,entry] of Object.entries(obj(v.materialImages))){
  if(!['main','neck','cuff','hem'].includes(slot))throw Error('面料图片部位无效');
  const key=slot as 'main'|'neck'|'cuff'|'hem',image=obj(entry),materialId=str(image.materialId);
  if(!materials?.[key]?.material.materialPic||materials[key]!.material.materialId!==materialId)throw Error('面料图片与来源记录不一致');
  materialImages[key]={...readEmbeddedRaster(image),materialId};
 }
 const flags=Object.fromEntries(['sleeveContrast','neckContrast','cuffContrast'].map(k=>{if(typeof v[k]!=='boolean')throw Error('撞色开关无效');return [k,v[k]];})) as Pick<CompositionElements,'sleeveContrast'|'neckContrast'|'cuffContrast'>;
 const neckline=choice(v.neckline,['crew','v','henley','polo','stand']),craft=v.craft===undefined?undefined:readCompositionCraft(v.craft),details=v.details===undefined?undefined:readCompositionDetails(v.details);
 if(details?.hood&&details.hood!=='none'&&neckline!=='crew')throw Error('当前连帽须替换为圆领连接口');

 if(neckline==='henley'&&craft?.opening!=='buttons')throw Error('亨利领须配短纽扣门襟');
 if(neckline==='polo'&&(!craft||!['buttons','quarter-zip'].includes(craft.opening)))throw Error('Polo领须配短门襟');
 if(neckline==='v'&&craft&&craft.opening!=='none')throw Error('当前V领尚未接通开襟组合');
 let tagIntent:CompositionElements['tagIntent'];
 if(v.tagIntent!==undefined){const t=obj(v.tagIntent);if(!Array.isArray(t.codes)||t.codes.length>24||new Set(t.codes).size!==t.codes.length||t.codes.some(code=>!dictionary.tags.some(t=>t.code===code))||t.dictionaryRevision!==dictionary.source.revision)throw Error('标签编码或字典版本无效，请重新匹配');tagIntent={codes:t.codes as string[],dictionaryRevision:t.dictionaryRevision as number,...(t.bindingPart===undefined?{}:{bindingPart:choice(t.bindingPart,['neck','back-neck'])}),...(t.colourPart===undefined?{}:{colourPart:choice(t.colourPart,['neck','sleeve','cuff'])}),...(t.pocketPart===undefined?{}:{pocketPart:choice(t.pocketPart,['chest'])}),...(t.finishPart===undefined?{}:{finishPart:choice(t.finishPart,['cuff','hem'])}),...(t.panelPart===undefined?{}:{panelPart:choice(t.panelPart,['yoke','side'])}),...(t.hoodType===undefined?{}:{hoodType:choice(t.hoodType,['two-piece','three-piece'])})};}
 return {shoulder:choice(v.shoulder,['set-in','raglan','drop']),neckline,...(craft?{craft}:{}),...(details?{details}:{}),...(tagIntent?{tagIntent}:{}),...flags,sleeveColor:color(v.sleeveColor),neckColor:color(v.neckColor),cuffColor:color(v.cuffColor),fabric:choice(v.fabric,['jersey','waffle','rib','pique','slub']),graphics,...(materials?{materials}:{}),...(Object.keys(materialImages).length?{materialImages}:{})};
}
