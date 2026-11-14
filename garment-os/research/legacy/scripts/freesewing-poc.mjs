/**
 * FreeSewing 引擎 PoC — 验证专业制版库的曲线/偏移质量
 * 运行: node scripts/freesewing-poc.mjs
 * 产出: Temp/freesewing-poc/index.html + 断言结果
 */
import { Part, Point, Path } from '@freesewing/core';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'C:/Users/xmls/AppData/Local/Temp/freesewing-poc';
mkdirSync(OUT, { recursive: true });

const asserts = [];
const assert = (name, pass, detail) => {
  asserts.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

/** 展平 FS path (M/L/C) 采样 → 点列 */
function flatten(d, per = 24) {
  const pts = [];
  const toks = d.match(/[MLCZ][^MLCZ]*/gi) ?? [];
  let cx = 0, cy = 0;
  for (const tk of toks) {
    const cmd = tk[0].toUpperCase();
    const n = (tk.slice(1).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (cmd === 'M' && n.length >= 2) { cx = n[0]; cy = n[1]; pts.push([cx, cy]); }
    else if (cmd === 'L') { for (let i = 0; i + 1 < n.length; i += 2) { cx = n[i]; cy = n[i+1]; pts.push([cx, cy]); } }
    else if (cmd === 'C') {
      for (let i = 0; i + 5 < n.length; i += 6) {
        const p0=[cx,cy], c1=[n[i],n[i+1]], c2=[n[i+2],n[i+3]], p3=[n[i+4],n[i+5]];
        for (let s=1; s<=per; s++) {
          const t=s/per, u=1-t;
          pts.push([
            u*u*u*p0[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*p3[0],
            u*u*u*p0[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*p3[1],
          ]);
        }
        cx=n[i+4]; cy=n[i+5];
      }
    }
  }
  return pts;
}
function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i+1)%pts.length];
    a += p[0]*q[1] - q[0]*p[1];
  }
  return Math.abs(a)/2;
}
function bbox(pts) {
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for (const [x,y] of pts) { x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }
  return {x0,y0,x1,y1};
}

// ════════ 1. 立领: 真领口曲线 + FreeSewing 真偏移 ════════
const part = new Part();
const H = 30; // 领高
// 内口 = 领口形三次贝塞尔 (前领深点 → 侧颈)
part.points.n0 = new Point(0, 86);       // 前领深 (折线)
part.points.c1 = new Point(-38, 78);     // 控制点1
part.points.c2 = new Point(-58, 26);     // 控制点2
part.points.sn = new Point(-71, 6);      // 侧颈点

const inner = new Path().move(part.points.n0).curve(part.points.c1, part.points.c2, part.points.sn);
const innerLen = inner.length();

// 真偏移 ±H: 两个方向都组装闭合条带, 取真实面积更大者 = 向外 (面积是闭合区域的精确度量)
let outer = null, outerDir = 0, bandBest = null, bandBestArea = 0;
for (const dir of [-H, H]) {
  const cand = inner.offset(dir);
  const rev = cand.reverse();
  const band = new Path()
    .move(part.points.n0)
    .curve(part.points.c1, part.points.c2, part.points.sn)
    .line(rev.end())
    .join(rev)
    .close();
  const a = area(flatten(band.asPathstring()));
  if (a > bandBestArea) { bandBestArea = a; bandBest = band; outer = cand; outerDir = dir; }
}
const outerLen = outer ? outer.length() : 0;

// 组装条带: 内口 → 前端头 → 外口逆行 → close
const outerRev = outer.reverse();
const band = new Path()
  .move(part.points.n0)
  .curve(part.points.c1, part.points.c2, part.points.sn)
  .line(outerRev.end())
  .join(outerRev)
  .close();
const bandD = bandBest.asPathstring();
const bandClosed = /Z\s*$/i.test(bandD) || bandD.includes('z');
const bandArea = area(flatten(bandD));
const noNaN = !/NaN/.test(bandD);

assert('FS-1 偏移生成', !!outer, `方向=${outerDir}`);
assert('FS-2 外口比内口长 (曲率外侧)', outerLen > innerLen, `${outerLen.toFixed(0)} > ${innerLen.toFixed(0)} mm`);
assert('FS-3 条带闭合无NaN', bandClosed && noNaN, `closed=${bandClosed}`);
const innerFlat = flatten(inner.asPathstring());
const outerFlat = flatten(outer.asPathstring());
const dists = outerFlat.map(([x, y]) => {
  let min = Infinity;
  for (let i = 0; i < innerFlat.length - 1; i++) {
    const [ax, ay] = innerFlat[i]; const [bx, by] = innerFlat[i + 1];
    const abx = bx - ax, aby = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby || 1)));
    min = Math.min(min, Math.hypot(x - (ax + abx * t), y - (ay + aby * t)));
  }
  return min;
});
dists.sort((a, b) => a - b);
const median = dists[Math.floor(dists.length / 2)];
assert('FS-4 偏移等距性: 中位距离 ~30mm', Math.abs(median - H) < 2, `中位距离=${median.toFixed(1)}mm (采样${dists.length}点)`);

// ════════ 2. 袖山: 光滑圆顶 + 偏移 ════════
const part2 = new Part();
const capH = 172, bicepW = 500;
part2.points.top = new Point(0, 0);
part2.points.c1 = new Point(-170, 0);    // crown 水平切线
part2.points.c2 = new Point(-250, 130);  // 落向 bicep
part2.points.fb = new Point(-250, capH);
part2.points.cb = new Point(250, capH);
part2.points.c3 = new Point(250, 130);
part2.points.c4 = new Point(170, 0);

const cap = new Path()
  .move(part2.points.fb)
  .curve(part2.points.c2, part2.points.c1, part2.points.top)
  .curve(part2.points.c4, part2.points.c3, part2.points.cb);
const capLen = cap.length();
const capOuter = cap.offset(-20); // 20mm 缝份
const capOuterLen = capOuter.length();

assert('FS-5 袖山曲线+偏移', capLen > 0 && capOuterLen > capLen, `弧长=${capLen.toFixed(0)} → 偏移=${capOuterLen.toFixed(0)}`);

// ════════ 渲染 ════════
const cut = bandD;
const innerD = inner.asPathstring();
const capD = cap.asPathstring();
const capOutD = capOuter.asPathstring();

const svgPiece = (label, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-140 -70 260 260" width="420" height="420">
  <defs><pattern id="g10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="#e8e8e2" stroke-width="0.4"/></pattern></defs>
  <rect x="-140" y="-70" width="260" height="260" fill="url(#g10)"/>
  ${inner}
  <text x="-132" y="-52" font-size="11" fill="#555">${label}</text>
</svg>`;

writeFileSync(`${OUT}/index.html`, `<html><body style="margin:0;background:#fbfbf8;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px">
<div style="font:bold 16px sans-serif">FreeSewing 引擎 PoC · 单位 mm · 网格 10</div>
<div style="display:flex;gap:12px;align-items:center">
  <div>
    ${svgPiece('立领 (内口真曲线 + offset 外口)', `
      <path d="${cut}" fill="none" stroke="#111" stroke-width="2"/>
      <path d="${innerD}" fill="none" stroke="#c2410c" stroke-width="1.2" stroke-dasharray="6,4"/>
    `)}
  </div>
  <div>
    ${svgPiece('袖山圆顶 (光滑 cubic)', `
      <path d="${capD}" fill="none" stroke="#111" stroke-width="2"/>
      <path d="${capOutD}" fill="none" stroke="#13c2c2" stroke-width="1.4"/>
      <circle cx="0" cy="0" r="2.5" fill="#1677ff"/>
    `)}
  </div>
</div>
</body></html>`);

writeFileSync(`${OUT}/summary.json`, JSON.stringify(asserts, null, 2));
console.log(`\n═══ FreeSewing PoC: ${asserts.filter(a=>a.pass).length}/${asserts.length} ═══`);


