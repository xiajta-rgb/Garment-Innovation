import type { TemplateStructuralAudit } from '@/application/template-structural-audit';
import { flattenSvgPathD } from './geometry';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
/** Actual source coordinates in millimetres, translated for a review sheet only. */
export function templateAuditSheet(a: TemplateStructuralAudit) {
  if (!a.pieces.length) return null;
  const pieces = a.pieces.map(p => {
    const pts = p.paths.filter(p => ['seam-line', 'cutting-line'].includes(p.layer ?? '')).flatMap(p => flattenSvgPathD(p.data, 48));
    const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y));
    return { p, minX, minY, w: Math.max(...pts.map(p => p.x)) - minX, h: Math.max(...pts.map(p => p.y)) - minY };
  });
  const cols = Math.min(3, pieces.length), rows = Math.ceil(pieces.length / cols);
  const widths = Array.from({ length: cols }, (_, col) => Math.max(...pieces.filter((_, i) => i % cols === col).map(p => p.w)) + 65);
  const heights = Array.from({ length: rows }, (_, row) => Math.max(...pieces.slice(row * cols, (row + 1) * cols).map(p => p.h)) + 80);
  const width = 40 + widths.reduce((sum, n) => sum + n, 0), height = 95 + heights.reduce((sum, n) => sum + n, 0);
  const metadata = { schema: 'garment-os/template-review-sheet/v1', id: a.id, configuration: a.configuration, status: a.status, matrixEligible: false, productionApproved: false };
  return `<svg xmlns="http://www.w3.org/2000/svg" data-template-audit-sheet="${esc(a.id)}" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><metadata>${esc(JSON.stringify(metadata))}</metadata><rect width="${width}" height="${height}" fill="white"/><g fill="#30463b" font-family="sans-serif"><text x="20" y="25" font-size="15">${esc(a.name)} · ${esc(a.configuration.standardSize)} · 源裁片结构核对</text><text x="20" y="45" font-size="9">毫米净样与源裁边；棕色：裁边 / 绿色：净样 / 蓝色：已有布纹、折线与剪口；未完成项见审查记录</text></g>${pieces.map(({ p, minX, minY }, i) => {
    const x = 20 + widths.slice(0, i % cols).reduce((sum, n) => sum + n, 0) - minX;
    const y = 95 + heights.slice(0, Math.floor(i / cols)).reduce((sum, n) => sum + n, 0) - minY;
    const base = p.paths.find(p => p.layer === 'seam-line')!;
    return `<g data-audit-piece="${esc(p.key)}" transform="translate(${x} ${y})"><text x="${minX}" y="${minY - 28}" font-size="12" font-family="sans-serif" fill="#263f31">${esc(p.name)}</text><text x="${minX}" y="${minY - 12}" font-size="9" font-family="sans-serif" fill="#778172">裁${base.cutQty ?? '待确认'}片 / ${base.cutOnFold ? '对折裁' : '非对折；镜像及正反面另核对'}</text>${p.paths.filter(p => ['seam-line', 'cutting-line', 'grain-line', 'fold-line', 'notch'].includes(p.layer ?? '')).map(path => `<path data-layer="${esc(path.layer ?? '')}" d="${esc(path.data)}" fill="${path.layer === 'seam-line' ? '#f5f6f0' : 'none'}" stroke="${path.layer === 'cutting-line' ? '#ad8864' : path.layer === 'seam-line' ? '#365c45' : '#537da0'}" stroke-width="${path.layer === 'seam-line' ? '.7' : '.5'}"${path.layer === 'fold-line' ? ' stroke-dasharray="4 3"' : ''}/>`).join('')}</g>`;
  }).join('')}<path d="M20 ${height - 22}h100m-100 -4v8m100 -8v8" stroke="#344b3b"/><text x="130" y="${height - 18}" font-size="9" font-family="sans-serif">100 mm / 审查用源样，不是生产放行</text></svg>`;
}
