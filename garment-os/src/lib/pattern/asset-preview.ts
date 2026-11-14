import { groupSolutionPieces,measurePieceBboxFull } from './piece-registry';
import { REFERENCE_MARKERS } from './reference/symbols';
import type { PatternPath } from '@/types/pattern';

const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
/** View-only line weights are in screen pixels; underlying source mm/paths stay untouched. */
export function assetPiecePreviews(paths:PatternPath[]){
  return groupSolutionPieces(paths).map(piece=>{
    const b=measurePieceBboxFull(piece.paths),widthMm=b.maxX-b.minX,heightMm=b.maxY-b.minY,margin=Math.max(widthMm,heightMm)*.04;
    const defs=`<defs>${Object.entries(REFERENCE_MARKERS).map(([id,d])=>`<marker id="reference-${id}" orient="auto" refX="0" refY="0" markerWidth="12" markerHeight="8" style="overflow:visible"><path d="${d}" fill="#0f766e"/></marker>`).join('')}</defs>`;
    const nodes=piece.paths.map(p=>`<path data-piece="${esc(piece.key)}" data-layer="${p.layer}" d="${esc(p.data)}" ${p.transform?`transform="${esc(p.transform)}"`:''} ${p.markerStart?`marker-start="${esc(p.markerStart)}"`:''} ${p.markerEnd?`marker-end="${esc(p.markerEnd)}"`:''} fill="none" stroke="${p.layer==='seam-line'?'#2458a0':p.layer==='grain-line'?'#1b726b':'#454d56'}" stroke-width="${p.layer==='seam-line'||p.layer==='cutting-line'?1.4:.8}" vector-effect="non-scaling-stroke" ${p.strokeDasharray||p.layer==='fold-line'?`stroke-dasharray="4 3"`:''}/>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="340" viewBox="${b.minX-margin} ${b.minY-margin} ${widthMm+2*margin} ${heightMm+2*margin}" aria-label="${esc(piece.name)}">${defs}${nodes}</svg>`;
    const p=piece.paths[0];return {id:piece.key,name:piece.name,widthMm,heightMm,quantity:p.cutQty??null,onFold:p.cutOnFold??null,svg};
  });
}
