import type { AssemblyEdge, AssemblyPoint } from '@/types/assembly';

const midpoint = (a: AssemblyPoint, b: AssemblyPoint): AssemblyPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: AssemblyPoint, b: AssemblyPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: AssemblyPoint, b: AssemblyPoint, c: AssemblyPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Adaptive subdivision for topology only. Curve lengths still use the upstream integrator. */
function subdivide(a: AssemblyPoint, b: AssemblyPoint, c: AssemblyPoint, d: AssemblyPoint, output: AssemblyPoint[], depth = 0) {
  const chord = distance(a, d), excess = distance(a, b) + distance(b, c) + distance(c, d) - chord;
  if (depth >= 16 || excess <= .001) { output.push(d); return; }
  const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d), abc = midpoint(ab, bc), bcd = midpoint(bc, cd), center = midpoint(abc, bcd);
  subdivide(a, ab, abc, center, output, depth + 1); subdivide(center, bcd, cd, d, output, depth + 1);
}
function intersects(a: AssemblyPoint, b: AssemblyPoint, c: AssemblyPoint, d: AssemblyPoint): boolean {
  const eps = 1e-7;
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) - eps || Math.max(c.x, d.x) < Math.min(a.x, b.x) - eps
    || Math.max(a.y, b.y) < Math.min(c.y, d.y) - eps || Math.max(c.y, d.y) < Math.min(a.y, b.y) - eps) return false;
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return ((abC > eps && abD < -eps) || (abC < -eps && abD > eps) || Math.abs(abC) <= eps || Math.abs(abD) <= eps)
    && ((cdA > eps && cdB < -eps) || (cdA < -eps && cdB > eps) || Math.abs(cdA) <= eps || Math.abs(cdB) <= eps);
}
/** Detects sampled self crossings and zero area; this is not a certified CAD topology kernel. */
export function contourTopologyError(edges: AssemblyEdge[]): string | null {
  const points: AssemblyPoint[] = [edges[0].from];
  for (const edge of edges) {
    if (edge.kind === 'curve') subdivide(edge.from, edge.cp1!, edge.cp2!, edge.to, points);
    else points.push(edge.to);
  }
  const n = points.length - 1;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (intersects(points[i], points[i + 1], points[j], points[j + 1])) return '净样轮廓自交或非相邻边重叠';
  }
  const twiceArea = points.slice(0, -1).reduce((sum, p, i) => sum + p.x * points[i + 1].y - points[i + 1].x * p.y, 0);
  return Math.abs(twiceArea) < 1e-4 ? '净样轮廓退化为零面积' : null;
}
