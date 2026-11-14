import { REFERENCE_PIECE_INDEX } from '@/data/referencePieceIndex';
import illustrations from '@/data/referenceIllustrations.json';
import { PIECE_FAMILIES, PIECE_ROLES } from '@/data/pieceTaxonomy';
import { flattenSvgPathD } from '@/lib/pattern/geometry';
import type { ReferenceCatalogueEntry, ReferenceCatalogueSample } from '@/types/reference-catalogue';

export function referenceCoverage() {
  return PIECE_FAMILIES.map(family=>({
    ...family,
    cadCount:REFERENCE_PIECE_INDEX.filter(e=>e.family===family.id).length,
    imageCount:illustrations.filter(e=>e.family===family.id).length,
    roles:PIECE_ROLES.filter(r=>r.family===family.id).map(role=>({
      ...role,
      cadCount:REFERENCE_PIECE_INDEX.filter(e=>e.roleId===role.id).length,
      imageCount:illustrations.filter(e=>e.roleIds.includes(role.id)).length,
    })),
  }));
}

export function referenceBounds(entry: ReferenceCatalogueEntry) {
  const points=entry.paths.flatMap(p=>flattenSvgPathD(p.data,64));
  if(!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('参考样本坐标无效');
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
  if(width<=0||height<=0)throw new Error('参考样本范围无效');
  return {x,y,width,height};
}
const esc=(value:string)=>value.replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[s]!));
export function referenceCatalogueSvg(entry:ReferenceCatalogueEntry,sample:ReferenceCatalogueSample) {
  const b=referenceBounds(entry),role=PIECE_ROLES.find(r=>r.id===entry.roleId);
  const title=`${role?.label??entry.label} · ${sample.design} ${sample.version}`;
  const paths=entry.paths.map(p=>`<path data-source-path="${esc(p.key)}" data-layer="${p.layer}" d="${esc(p.data)}" fill="none" stroke="${p.layer==='net'?'#24657b':p.layer==='cut'?'#374151':'#8296a1'}" stroke-width="0.7"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width+30}mm" height="${b.height+44}mm" viewBox="${b.x-15} ${b.y-22} ${b.width+30} ${b.height+44}"><title>${esc(title)}</title><desc>FreeSewing MIT; design: ${esc(sample.designer)}; code: ${esc(sample.codeAuthor)}; ${esc(sample.profile)}; source ${esc(entry.sourceId)}; ${esc(JSON.stringify(sample.options))}; reference only; productionApproved=false</desc><text x="${b.x}" y="${b.y-10}" font-size="4">${esc(title)}</text>${paths}<text x="${b.x}" y="${b.y+b.height+12}" font-size="3">${esc(sample.profile)} · mm · 参考样本 / 生产未放行</text></svg>`;
}
