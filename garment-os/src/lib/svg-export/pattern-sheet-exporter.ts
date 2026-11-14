import { PIECE_MATERIALS } from '@/data/pieceTaxonomy';
import { REFERENCE_MARKERS } from '@/lib/pattern/reference/symbols';
/** Whole-draft reference SVG. Real mm geometry, with no A4 clipping or manufacturing claim. */
import type { PatternPath } from '@/types/pattern';
import type { PatternDefinition } from '@/lib/patterns/types';
import { requireReviewedPattern } from '@/data/patternReview';
import { assertCanonicalPattern } from '@/data/patternLibrary';
import { groupSolutionPieces, measurePieceBboxFull } from '@/lib/pattern/piece-registry';
import { cuttingLabel } from '@/lib/pattern/piece-tags';
import type { ConstructionSelection } from '@/types/construction';
import { readConstructionSelection } from '@/lib/pattern/construction-selection';
export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';
export type ExportScale = 1 | .5 | .25;
export interface SheetExportOptions { patternName?: string; designer?: string; size?: string; gender?: string; paperSize?: PaperSize; scale?: ExportScale; fabricEstimate?: number; notes?: string; construction?:ConstructionSelection }
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function generatePatternSheet(pattern:PatternDefinition,paths:PatternPath[],options:SheetExportOptions={}):string {
 const review=requireReviewedPattern(pattern.id);assertCanonicalPattern(pattern);
 const construction=readConstructionSelection(pattern.id,options.construction);
 if(!paths.length||paths.some(p=>p.referenceVersion!=='4.10.2'||!p.pieceId||p.referenceEngine!==review.engine||/NaN|Infinity|undefined/.test(p.data)))throw new Error('没有有效的同源参考裁片，已停止导出');
 if(options.paperSize)throw new Error('A4/A3 分幅拼接尚未核验；请使用整幅参考 SVG');
 const b=measurePieceBboxFull(paths),margin=30,w=b.maxX-b.minX+margin*2,h=b.maxY-b.minY+margin*2+70,scale=options.scale??1;
 const pieces=groupSolutionPieces(paths);
 const defs=`<defs>${Object.entries(REFERENCE_MARKERS).map(([id,d])=>`<marker id="reference-${id}" orient="auto" refX="0" refY="0" markerWidth="12" markerHeight="8" style="overflow:visible"><path d="${d}" fill="#0f766e"/></marker>`).join('')}</defs>`;
 const nodes=paths.map(p=>`<path data-piece="${esc(p.pieceId!)}" data-layer="${p.layer}" ${p.markerStart?`marker-start="${esc(p.markerStart)}"`:''} ${p.markerEnd?`marker-end="${esc(p.markerEnd)}"`:''} d="${esc(p.data)}" ${p.transform?`transform="${esc(p.transform)}"`:''} fill="none" stroke="${p.layer==='seam-line'?'#2563eb':'#333'}" stroke-width="0.6" ${p.strokeDasharray||p.layer==='fold-line'?`stroke-dasharray="${esc(p.strokeDasharray??'4 3')}"`:''}/>`).join('');
 const labels=pieces.map(p=>{const box=measurePieceBboxFull(p.paths);return `<text x="${box.minX}" y="${box.maxY+12}" font-size="5">${esc(p.name)} · ${esc(PIECE_MATERIALS.find(m=>m.id===p.paths[0]?.materialRole)?.label??'材料未声明')} · ${esc(cuttingLabel(p.paths[0]))}</text>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w*scale}mm" height="${h*scale}mm" viewBox="${b.minX-margin} ${b.minY-margin-40} ${w} ${h}"><metadata>${esc(JSON.stringify({patternId:pattern.id,engine:review.engine,version:'4.10.2',unit:'mm',scale,construction:construction??null,productionApproved:false,notes:options.notes??null}))}</metadata><rect x="${b.minX-margin}" y="${b.minY-margin-40}" width="${w}" height="${h}" fill="white"/><text x="${b.minX}" y="${b.minY-38}" font-size="7">${esc(options.patternName??pattern.name)} · 参考稿 / 生产未验收</text><text x="${b.minX}" y="${b.minY-25}" font-size="5">整幅 SVG，比例 ${scale}；显示排布不代表生产排料；材料与用量待确认</text>${defs}${nodes}${labels}</svg>`;
}
export function generateSheetFilename(pattern:PatternDefinition,size?:string):string {return `${pattern.id}${size?`-${size}`:''}-reference-${new Date().toISOString().slice(0,10)}.svg`;}
