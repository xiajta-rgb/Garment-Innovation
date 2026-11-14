import type { CompositionAsset } from './composition-catalogue';
import { pieceDisplaySize } from './composition-catalogue';
import type { CompositionElements, CompositionGraphic } from '@/types/composition-elements';
import type { CompositionPiece } from '@/types/piece-composition';
import { escapeSvg } from '@/lib/pattern/mesh/garment-technical-view';

export const COMPOSITION_FABRICS=[{id:'jersey',name:'平纹汗布'},{id:'waffle',name:'华夫格'},{id:'rib',name:'坑条罗纹'},{id:'pique',name:'珠地'},{id:'slub',name:'竹节肌理'}] as const;
export function compositionPieceColor(piece:CompositionPiece,asset:CompositionAsset,e?:CompositionElements){
 if(e?.neckContrast&&asset.key.startsWith('neck-'))return e.neckColor;
 if(e?.sleeveContrast&&asset.role==='sleeve.main')return e.sleeveColor;
 return piece.color;
}
/** Local image/preset fills share the existing closed garment boundaries. */
export function compositionDecoratedMarkup(asset:CompositionAsset,piece:CompositionPiece,e:CompositionElements|undefined,prefix:string){
 let markup=asset.markup.replace(/cuff-piece-clip/g,`${prefix}-cuff-clip`).replace(/detail-(body|panel|cuff|sleeve|side-panel)-clip/g,id=>`${prefix}-${id}`);
 if(!e)return markup;
 const size=pieceDisplaySize(piece,asset),sx=size.width/asset.artBounds.width,sy=size.height/asset.artBounds.height;
 const defs:string[]=[],slot=asset.key.startsWith('neck-')?'neck':'main';
 const pattern=(slot:'main'|'neck'|'cuff'|'hem')=>{
  const image=e.materialImages?.[slot],id=`${prefix}-fabric-${slot}`;
  // Fit a photographic sample over the garment height. Repeating a whole swatch
  // every few centimetres would turn lighting gradients into false stripes.
  if(image){const w=620*image.width/image.height/sx,h=620/sy;defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${-w/2}" y="0" width="${w}" height="${h}" viewBox="0 0 ${image.width} ${image.height}"><image href="${image.dataUrl}" width="${image.width}" height="${image.height}" preserveAspectRatio="xMidYMid meet"/></pattern>`);return `url(#${id})`;}
  if(slot!=='main'||e.fabric==='jersey')return null;
  const w=12/sx,h=12/sy;
  const shape=e.fabric==='waffle'?`<rect x="${w*.12}" y="${h*.12}" width="${w*.76}" height="${h*.76}" fill="none" stroke="#111" stroke-opacity=".25" stroke-width="${w*.06}"/><rect x="${w*.27}" y="${h*.27}" width="${w*.46}" height="${h*.46}" fill="#fff" fill-opacity=".10"/>`:e.fabric==='rib'?`<path d="M${w*.2} 0V${h}M${w*.65} 0V${h}" stroke="#111" stroke-opacity=".25" stroke-width="${w*.13}"/><path d="M${w*.35} 0V${h}M${w*.8} 0V${h}" stroke="#fff" stroke-opacity=".15" stroke-width="${w*.1}"/>`:e.fabric==='pique'?`<path d="M${w*.25} 0L${w*.45} ${h*.25}L${w*.25} ${h*.5}L${w*.05} ${h*.25}Z M${w*.75} ${h*.5}L${w*.95} ${h*.75}L${w*.75} ${h}L${w*.55} ${h*.75}Z" fill="#111" fill-opacity=".24"/>`:`<path d="M0 ${h*.2}H${w*.58}M${w*.38} ${h*.55}H${w}M${w*.1} ${h*.83}H${w*.67}" stroke="#fff" stroke-opacity=".26" stroke-width="${h*.08}"/>`;
  defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="currentColor"/>${shape}</pattern>`);return `url(#${id})`;
 };
 const main=asset.key==='facing'?null:pattern(slot),cuff=markup.includes('data-design-element="cuff-contrast"')?pattern('cuff'):null,neck=slot==='neck'?main:markup.includes('data-design-element="neck-contrast"')?pattern('neck'):null;
 const hem=markup.includes('data-design-element="hem-contrast"')?pattern('hem'):null;
 markup=markup.replace(/<path\b[^>]*>/g,path=>{
  const replacement=path.includes('data-design-element="hem-contrast"')?hem:path.includes('data-design-element="cuff-contrast"')?cuff:path.includes('data-design-element="neck-contrast"')?neck:path.includes('fill="currentColor"')?main:null;
  return replacement?path.replace(/fill="[^"]*"/,`fill="${replacement}"`):path;
 });
 return `<defs>${defs.join('')}</defs>${markup}`;
}
/** Built-in marks are editable generic artwork, never third-party brand assets. */
export function compositionGraphicMarkup(g:CompositionGraphic){
 const color=escapeSvg(g.color),text=escapeSvg(g.text);
 if(g.kind==='image')return `<image href="${g.image!.dataUrl}" x="${-g.width/2}" y="${-g.height/2}" width="${g.width}" height="${g.height}" preserveAspectRatio="xMidYMid meet"/>`;
 if(g.kind==='text')return `<text x="0" y="0" dominant-baseline="central" text-anchor="middle" font-family="Arial,Microsoft YaHei,sans-serif" font-size="${g.height*.72}" font-weight="700" letter-spacing="1" textLength="${g.width}" lengthAdjust="spacingAndGlyphs" fill="${color}">${text}</text>`;
 if(g.kind==='monogram')return `<rect x="${-g.width/2}" y="${-g.height/2}" width="${g.width}" height="${g.height}" rx="2" fill="none" stroke="${color}" stroke-width="1.5"/><text dominant-baseline="central" text-anchor="middle" font-family="Arial,Microsoft YaHei,sans-serif" font-size="${g.height*.56}" font-weight="700" fill="${color}" textLength="${g.width*.7}" lengthAdjust="spacingAndGlyphs">${escapeSvg(g.text.slice(0,3))}</text>`;
 return `<g transform="scale(${g.width/100} ${g.height/100})" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round"><path d="M-44 35L-8 -35L12 2L24 -15L44 35Z M-22 -8L-8 1L2 -8"/><path d="M-44 44H44"/></g>`;
}
