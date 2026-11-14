import { describe, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { draftBodice, draftSleeve, draftMandarinCollar, draftCuff, segmentedSeamAllowancePath, contourToPath, type Pt } from '@/lib/pattern/drafting';
import { getMeasurementsBySize } from '@/data/sizeCharts';

const M = getMeasurementsBySize('male', 'M');
const OUT = 'C:/Users/xmls/AppData/Local/Temp/piece-render';
mkdirSync(OUT, { recursive: true });

function pieceSvg(name: string, inner: string, minX: number, minY: number, w: number, h: number, pad = 40): string {
  const vb = `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.min(1200, (w + pad*2) * 1.6)}" height="${Math.min(900, (h + pad*2) * 1.6)}">
  <defs>
    <pattern id="g10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="#e8e8e2" stroke-width="0.4"/></pattern>
    <pattern id="g100" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#g10)"/><path d="M100 0L0 0 0 100" fill="none" stroke="#d5d5c8" stroke-width="0.8"/></pattern>
  </defs>
  <rect x="${minX - pad}" y="${minY - pad}" width="${w + pad * 2}" height="${h + pad * 2}" fill="url(#g100)"/>
  ${inner}
  <text x="${minX - pad + 8}" y="${minY - pad + 18}" font-size="11" fill="#555">${name} · 单位 mm · 网格 10/100</text>
</svg>`;
}

function bboxOf(paths: { data: string }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    const nums = p.data.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

describe('render pieces to svg', () => {
  it('renders sleeve + bodice', () => {
    const f = draftBodice(M, 'male', 'front', { fit: 'regular' });
    const b = draftBodice(M, 'male', 'back', { fit: 'regular' });
    const s = draftSleeve(M, 'male', f.armholeLength, b.armholeLength, { fit: 'regular' });

    // 袖片: 毛样 + 净样 + 布纹 + 对折线 + 剪口
    const cut = segmentedSeamAllowancePath(s.edges);
    const net = contourToPath(s.contour);
    const grain = `M0 ${(s.capHeight + 15).toFixed(1)} L0 ${(s.sleeveLength - 12).toFixed(1)} M-4 ${(s.capHeight + 19).toFixed(1)} L0 ${(s.capHeight + 15).toFixed(1)} L4 ${(s.capHeight + 19).toFixed(1)} M-4 ${(s.sleeveLength - 16).toFixed(1)} L0 ${(s.sleeveLength - 12).toFixed(1)} L4 ${(s.sleeveLength - 16).toFixed(1)}`;
    const fold = `M${(-s.cuffWidth / 2 + 5).toFixed(1)} ${s.sleeveLength.toFixed(1)} L${(s.cuffWidth / 2 - 5).toFixed(1)} ${s.sleeveLength.toFixed(1)}`;
    const notchDiamond = (p: Pt) => `M${(p.x - 6).toFixed(1)} ${p.y.toFixed(1)} L${p.x.toFixed(1)} ${(p.y - 6).toFixed(1)} L${(p.x + 6).toFixed(1)} ${p.y.toFixed(1)} L${p.x.toFixed(1)} ${(p.y + 6).toFixed(1)} Z`;
    const inner = `
      <path d="${cut}" fill="#ffffff" stroke="#111" stroke-width="2"/>
      <path d="${net}" fill="none" stroke="#111" stroke-width="1.1"/>
      <path d="${fold}" fill="none" stroke="#777" stroke-width="1" stroke-dasharray="8,4,2,4"/>
      <path d="${grain}" fill="none" stroke="#111" stroke-width="1.6"/>
      <path d="${notchDiamond(s.capNotchFront)}" fill="#fff" stroke="#111" stroke-width="1.2"/>
      <path d="${notchDiamond(s.capNotchBack)}" fill="#fff" stroke="#111" stroke-width="1.2"/>
    `;
    const bb = bboxOf([{ data: cut }]);
    writeFileSync(`${OUT}/sleeve.svg`, pieceSvg('袖片 (Sleeve Block)', inner, bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY));

    // 衣身前片
    const cutF = segmentedSeamAllowancePath(f.edges);
    const netF = contourToPath(f.contour);
    const grainF = `M${(f.points.bustMid.x - f.halfBustWidth * 0.55).toFixed(1)} ${(f.waistY * 0.25).toFixed(1)} L${(f.points.bustMid.x - f.halfBustWidth * 0.55).toFixed(1)} ${(f.hemY - 30).toFixed(1)}`;
    const innerF = `
      <path d="${cutF}" fill="#ffffff" stroke="#111" stroke-width="2"/>
      <path d="${netF}" fill="none" stroke="#111" stroke-width="1.1"/>
      <path d="${grainF}" fill="none" stroke="#111" stroke-width="1.6"/>
    `;
    const bbF = bboxOf([{ data: cutF }]);
    writeFileSync(`${OUT}/bodice-front.svg`, pieceSvg('前衣身 (Front Bodice)', innerF, bbF.minX, bbF.minY, bbF.maxX - bbF.minX, bbF.maxY - bbF.minY));

    // 领片: 真实领口曲线成型
    const neckPts: Pt[] = [...b.necklinePoints, ...f.necklinePoints.slice(1).reverse()];
    const collar = draftMandarinCollar(neckPts, 30);
    const collarCut = segmentedSeamAllowancePath(collar.edges);
    const collarNet = contourToPath(collar.contour);
    const cb = bboxOf([{ data: collarCut }]);
    const innerC = `
      <path d="${collarCut}" fill="#ffffff" stroke="#111" stroke-width="2"/>
      <path d="${collarNet}" fill="none" stroke="#111" stroke-width="1.1"/>
      <path d="M${neckPts[0].x.toFixed(1)} ${neckPts[0].y.toFixed(1)} L${neckPts[0].x.toFixed(1)} ${(neckPts[0].y - 30).toFixed(1)}" fill="none" stroke="#777" stroke-width="1" stroke-dasharray="8,4,2,4"/>
      <path d="M${(neckPts[0].x - 5).toFixed(1)} ${(neckPts[0].y + 3).toFixed(1)} L${(neckPts[0].x + 5).toFixed(1)} ${(neckPts[0].y + 3).toFixed(1)} L${neckPts[0].x.toFixed(1)} ${(neckPts[0].y + 9).toFixed(1)} Z" fill="none" stroke="#111" stroke-width="1.2"/>
    `;
    writeFileSync(`${OUT}/collar.svg`, pieceSvg('立领 (真领口曲线)', innerC, cb.minX, cb.minY, cb.maxX - cb.minX, cb.maxY - cb.minY));

    // 袖口 (圆角袖头)
    const cuff = draftCuff(M.wristCirc + 50, 45);
    const cuffCut = segmentedSeamAllowancePath(cuff.edges);
    const cuffNet = contourToPath(cuff.contour);
    const cb2 = bboxOf([{ data: cuffCut }]);
    const innerCu = `
      <path d="${cuffCut}" fill="#ffffff" stroke="#111" stroke-width="2"/>
      <path d="${cuffNet}" fill="none" stroke="#111" stroke-width="1.1"/>
      <path d="M${(cuff.cuffCirc * 0.5 - 12).toFixed(1)} ${cuff.cuffHeight.toFixed(1)} L${(cuff.cuffCirc * 0.5 + 12).toFixed(1)} ${cuff.cuffHeight.toFixed(1)}" fill="none" stroke="#777" stroke-width="1" stroke-dasharray="8,4,2,4"/>
    `;
    writeFileSync(`${OUT}/cuff.svg`, pieceSvg('袖口 (圆角袖头)', innerCu, cb2.minX, cb2.minY, cb2.maxX - cb2.minX, cb2.maxY - cb2.minY));
    // 合并页 (并排)
    writeFileSync(`${OUT}/index.html`, `<html><body style="margin:0;background:#fbfbf8;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;">
      <div style="font:bold 16px sans-serif">GarmentOS 裁片渲染 · 与专业标准对照</div>
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div>${pieceSvg('袖片', inner, bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY)}</div>
        <div>${pieceSvg('前衣身', innerF, bbF.minX, bbF.minY, bbF.maxX - bbF.minX, bbF.maxY - bbF.minY)}</div>
        <div></div>
        <div></div>
      </div>
    </body></html>`);
  });
});





