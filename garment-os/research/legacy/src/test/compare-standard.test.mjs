/**
 * 一对一精准对比: FreeSewing 标准 Brian 原型 vs 我们的裁片
 * 同一输入: FreeSewing 官方标准人体组 (男, 领围 380mm = M 码)
 * 产出: Temp/compare-standard/index.html (并排渲染) + brian-points.json
 */
import { describe, it } from 'vitest';
import { cisMaleAdult38 as m } from '@freesewing/models';
import { Brian } from '@freesewing/brian';
import { writeFileSync, mkdirSync } from 'node:fs';
import { generatePieces } from '@/lib/pattern/piece-generator';
import { segmentedSeamAllowancePath, flattenChain } from '@/lib/pattern/drafting';

const OUT = 'C:/Users/xmls/AppData/Local/Temp/compare-standard';
mkdirSync(OUT, { recursive: true });

describe('compare-standard: 一对一精准对比', () => {
  it('Brian 标准原型 vs GarmentOS (同一标准人体)', () => {
    // ── 0. 标准人体 (男, 领围 380mm = FS size 38) ──
    for (const k of ['chest', 'biceps', 'neck', 'shoulderToShoulder', 'shoulderSlope', 'hpsToWaistBack', 'hpsToBust', 'waistToArmpit', 'waistToHips']) {
      console.log(`FS标准人体 ${k} = ${m[k]?.toFixed(1) ?? '?'}`);
    }

    // ── 1. FreeSewing 标准 Brian 原型 ──
    const pattern = new Brian({ measurements: m });
    pattern.draft();
    const svg = pattern.render();
    writeFileSync(`${OUT}/brian.svg`, svg);

    const ptDump = {};
    for (const [pn, part] of Object.entries(pattern.parts[0])) {
      ptDump[pn] = {};
      for (const [k, p] of Object.entries(part.points ?? {})) {
        if (typeof p.x === 'number' && typeof p.y === 'number') {
          ptDump[pn][k] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
        }
      }
    }
    writeFileSync(`${OUT}/brian-points.json`, JSON.stringify(ptDump, null, 2));
    console.log('BRIAN POINTS:', JSON.stringify(ptDump, null, 1).slice(0, 1400));

    // ── 2. 我们的裁片 (同一标准人体, 映射到我们的测量名) ──
    const ours = generatePieces(
      {
        ...m,
        bust: m.chest,
        bicep: m.biceps,
        neckCirc: m.neck,
        shoulderWidth: m.shoulderToShoulder,
        backLength: m.hpsToWaistBack,
        frontLength: m.hpsToWaistFront,
        waistDepth: m.hpsToWaistBack,
        totalLength: m.hpsToWaistBack + m.waistToHips + 140,
        hip: m.chest * 1.0,
        acrossBack: m.acrossBack ?? m.chest * 0.37,
        acrossFront: m.chest * 0.34,
        highBust: m.highBust ?? m.chest,
        height: 1750,
        weight: 75,
        wristCirc: m.wrist ?? 170,
        waist: m.chest * 0.82,
      },
      { gender: 'male', fit: 'regular', sleeveLengthMm: m.sleeveLength ?? 590, sleeveEaseMm: 30 },
    );
    writeFileSync(`${OUT}/our-points.json`, JSON.stringify(
      ours.pieces.map((p) => ({ name: p.name, points: p.points, dims: p.dimensions })),
      null, 2,
    ));
    console.log('OUR front points:', JSON.stringify(ours.pieces.find((p) => p.id === 'front-body').points));
    console.log('OUR sleeve keyDims:', JSON.stringify(ours.pieces.find((p) => p.id === 'sleeve').keyDims));

    // ── 3. 并排对比页 ──
    const brianSvgOut = svg.replace(/<\?xml[^>]*\?>/, '');
    const front = ours.pieces.find((p) => p.id === 'front-body');
    const ourCut = segmentedSeamAllowancePath(front.edges);
    const ourNet = front.edges.map((e) => {
  const pts = flattenChain(e.start, e.segs, 2);
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  return d;
}).join(' ');
    const sleeve = ours.pieces.find((p) => p.id === 'sleeve');
    const sleeveCut = segmentedSeamAllowancePath(sleeve.edges);

    writeFileSync(`${OUT}/index.html`, `<html><body style="margin:0;background:#fbfbf8;padding:10px;font-family:sans-serif">
<div style="font:bold 16px sans-serif;margin-bottom:6px">一对一对比 · 同一标准人体 (男 M, 领围380) · 单位 mm</div>
<div style="display:flex;gap:12px;align-items:flex-start">
  <div style="flex:1.4;background:#fff;border:1px solid #ddd;padding:6px">
    <div style="font:bold 13px sans-serif;margin-bottom:4px">FreeSewing Brian (标准基型: 前/后/袖)</div>
    <div style="height:640px;overflow:hidden">${brianSvgOut}</div>
  </div>
  <div style="flex:1;background:#fff;border:1px solid #ddd;padding:6px">
    <div style="font:bold 13px sans-serif;margin-bottom:4px">GarmentOS 前衣身 (毛样+净样)</div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-310 -30 330 810" width="100%" height="640px">
      <defs><pattern id="g10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="#e8e8e2" stroke-width="0.5"/></pattern></defs>
      <rect x="-310" y="-30" width="330" height="810" fill="url(#g10)"/>
      <path d="${ourCut}" fill="#fff" stroke="#111" stroke-width="2"/>
      <path d="${ourNet}" fill="none" stroke="#c2410c" stroke-width="1" stroke-dasharray="6,4"/>
    </svg>
  </div>
  <div style="flex:1;background:#fff;border:1px solid #ddd;padding:6px">
    <div style="font:bold 13px sans-serif;margin-bottom:4px">GarmentOS 袖片 (毛样)</div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-280 -40 560 700" width="100%" height="640px">
      <defs><pattern id="g11" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="#e8e8e2" stroke-width="0.5"/></pattern></defs>
      <rect x="-280" y="-40" width="560" height="700" fill="url(#g11)"/>
      <path d="${sleeveCut}" fill="#fff" stroke="#111" stroke-width="2"/>
    </svg>
  </div>
</div>
</body></html>`);
    console.log(`对比页: ${OUT}/index.html`);
  });
});

