/** Numerical inspection of sourced mm geometry. Samples are not production tolerances.
 * No local construction formula or seam allowance offset is generated here.
 */
import type { Pt, Seg, Contour } from '@/types/geometry';
export type { Pt, Seg, Contour } from '@/types/geometry';

function lerp(a:Pt,b:Pt,t:number):Pt { return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}; }

export function dist(a: Pt, b: Pt): number { return Math.hypot(b.x - a.x, b.y - a.y); }

export function cubicAt(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

export function cubicLength(p0: Pt, c1: Pt, c2: Pt, p3: Pt, samples = 64): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = cubicAt(p0, c1, c2, p3, t);
    length += dist(prev, cur);
    prev = cur;
  }
  return length;
}

export function contourLength(c: Contour): number {
  let length = 0;
  let prev = c.start;
  for (const s of c.segs) {
    if (s.kind === 'L') {
      length += dist(prev, s.to);
      prev = s.to;
    } else {
      length += cubicLength(prev, s.c1, s.c2, s.to);
      prev = s.to;
    }
  }
  return length;
}

export function flattenChain(start: Pt, segs: Seg[], stepMm = 0.8): Pt[] {
  const pts: Pt[] = [start];
  let prev = start;
  for (const s of segs) {
    if (s.kind === 'L') {
      // 直线段同样细分 (均匀间距) — 保证偏移法向/角部处理的采样一致性
      const segLen = dist(prev, s.to);
      const steps = Math.max(1, Math.ceil(segLen / stepMm));
      for (let i = 1; i <= steps; i++) pts.push(lerp(prev, s.to, i / steps));
      prev = s.to;
    } else {
      const segLen = cubicLength(prev, s.c1, s.c2, s.to);
      const steps = Math.max(6, Math.ceil(segLen / stepMm));
      for (let i = 1; i <= steps; i++) pts.push(cubicAt(prev, s.c1, s.c2, s.to, i / steps));
      prev = s.to;
    }
  }
  return pts;
}

function cubicAxis(p0: number, c1: number, c2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p3;
}

export function flattenSvgPathD(d: string, samplesPerCubic = 24): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const tokens = d.match(/[MLCZ][^MLCZ]*/gi) ?? [];
  let cx = 0, cy = 0, startX = 0, startY = 0;
  for (const tk of tokens) {
    const cmd = tk[0].toUpperCase();
    const nums = (tk.slice(1).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    if (cmd === 'M' && nums.length >= 2) { cx = startX = nums[0]; cy = startY = nums[1]; pts.push({ x: cx, y: cy }); }
    else if (cmd === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2) { cx = nums[i]; cy = nums[i + 1]; pts.push({ x: cx, y: cy }); }
    } else if (cmd === 'C') {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        const p0x = cx, p0y = cy;
        const c1x = nums[i], c1y = nums[i + 1], c2x = nums[i + 2], c2y = nums[i + 3];
        const p3x = nums[i + 4], p3y = nums[i + 5];
        for (let s = 1; s <= samplesPerCubic; s++) {
          const t = s / samplesPerCubic;
          pts.push({
            x: cubicAxis(p0x, c1x, c2x, p3x, t),
            y: cubicAxis(p0y, c1y, c2y, p3y, t),
          });
        }
        cx = p3x; cy = p3y;
      }
    } else if (cmd === 'Z') { cx = startX; cy = startY; pts.push({ x: cx, y: cy }); }
  }
  return pts;
}
