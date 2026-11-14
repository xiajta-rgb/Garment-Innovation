import type { XY } from '@/types/pattern3d';

type Cubic = [XY, XY, XY, XY];
const mix = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const distance = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mirror = (a: XY): XY => [-a[0], a[1]];
const reverse = (c: Cubic): Cubic => [c[3], c[2], c[1], c[0]];
const mirroredReturn = (cs: Cubic[]) => cs.slice().reverse().map(c => reverse(c).map(mirror) as Cubic);
const straight = (a: XY, b: XY): Cubic => [a, mix(a, b, 1 / 3), mix(a, b, 2 / 3), b];
const quadratic = (a: XY, control: XY, b: XY): Cubic => [a, mix(a, control, 2 / 3), mix(b, control, 2 / 3), b];
const p = (a: XY) => a.map(n => Number(n.toFixed(6))).join(' ');
const path = (cs: Cubic[]) => `M${p(cs[0][0])}` + cs.map(c => `C${c.slice(1).map(p).join(' ')}`).join('');
function at(c: Cubic, t: number): XY {
  return mix(mix(mix(c[0], c[1], t), mix(c[1], c[2], t), t), mix(mix(c[1], c[2], t), mix(c[2], c[3], t), t), t);
}

/** Finishing of a style illustration in drawing-ratio units, never a CAD offset. */
export function teeStyleContour(input: {
  bodyShoulder: Cubic; sleeveShoulder: Cubic; armhole: Cubic; hem: XY; cuffOuter: XY; cuffInner: XY; cuffBandHeight?:number;
}) {
  const { bodyShoulder, sleeveShoulder, hem, cuffOuter, cuffInner } = input;
  const outerShoulder = sleeveShoulder[3], underarm = input.armhole[3];
  const hemBow = .007;
  const hemY = (x: number) => hem[1] + hemBow * (1 - (x / hem[0]) ** 2);
  const cuffRadius = Math.min(.0035, distance(cuffOuter, cuffInner) * .025, distance(cuffInner, underarm) * .12);
  const upperEntry = mix(cuffOuter, outerShoulder, cuffRadius / distance(cuffOuter, outerShoulder));
  const cuffStart = mix(cuffOuter, cuffInner, cuffRadius / distance(cuffOuter, cuffInner));
  const cuffEnd = mix(cuffInner, cuffOuter, cuffRadius / distance(cuffInner, cuffOuter));
  const lowerExit = mix(cuffInner, underarm, cuffRadius / distance(cuffInner, underarm));
  // A small shared fillet removes the needle-like armpit while keeping source landmarks.
  const pitRadius = Math.min(.006, distance(cuffInner, underarm) * .2);
  const pitEntry = mix(underarm, cuffInner, pitRadius / distance(underarm, cuffInner));
  const pitExit = mix(underarm, hem, pitRadius / distance(underarm, hem));
  const pitA = mix(pitEntry, underarm, .5), pitB = mix(underarm, pitExit, .5), pitJoin = mix(pitA, pitB, .5);
  const armhole: Cubic = [...input.armhole.slice(0, 3), pitJoin] as Cubic;
  const tangent = sleeveShoulder[2], tangentLength = distance(tangent, outerShoulder);
  const lead = Math.min(.05, distance(outerShoulder, upperEntry) / 3);
  const upper: Cubic = [outerShoulder, [outerShoulder[0] + (outerShoulder[0] - tangent[0]) / tangentLength * lead, outerShoulder[1] + (outerShoulder[1] - tangent[1]) / tangentLength * lead], mix(outerShoulder, upperEntry, .72), upperEntry];
  const sleeveEdge = [upper, quadratic(upperEntry, cuffOuter, cuffStart), straight(cuffStart, cuffEnd), quadratic(cuffEnd, cuffInner, lowerExit), straight(lowerExit, pitEntry), quadratic(pitEntry, pitA, pitJoin)];
  const hemRadius = .005;
  const sideEnd = mix(hem, underarm, hemRadius / distance(hem, underarm));
  const hemStart: XY = [hem[0] - hemRadius, hemY(hem[0] - hemRadius)];
  const bodyEdge = [quadratic(pitJoin, pitB, pitExit), straight(pitExit, sideEnd), quadratic(sideEnd, hem, hemStart)];
  const hemCurve = quadratic(hemStart, [0, 2 * (hem[1] + hemBow) - hemStart[1]], mirror(hemStart));
  const rightOuter = [bodyShoulder, sleeveShoulder, ...sleeveEdge, ...bodyEdge];
  const sleevePath = path([sleeveShoulder, ...sleeveEdge, reverse(armhole)]) + 'Z';
  const bodyPath = (drop: number,neckline:'crew'|'v'='crew') => path([bodyShoulder, armhole, ...bodyEdge, hemCurve, ...mirroredReturn(bodyEdge), ...mirroredReturn([bodyShoulder, armhole])]) + (neckline==='v'?`L0 ${drop}L${p(bodyShoulder[0])}Z`:`Q0 ${2 * drop} ${p(bodyShoulder[0])}Z`);
  // The external boundary is stroked once; internal armhole edges are separate.
  const outsidePath = path([...rightOuter, hemCurve, ...mirroredReturn(rightOuter)]);
  const hemStitches = [.028, .034].map(offset => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const t = (lo + hi) / 2, v = mix(pitExit, sideEnd, t);
      if (v[1] < hemY(v[0]) - offset) lo = t; else hi = t;
    }
    const end = mix(pitExit, sideEnd, (lo + hi) / 2);
    return path([quadratic(mirror(end), [0, 2 * (hem[1] + hemBow - offset) - end[1]], end)]);
  });
  const cuffVector: XY = [cuffInner[0] - cuffOuter[0], cuffInner[1] - cuffOuter[1]], cuffLength = distance(cuffOuter, cuffInner);
  const normal: XY = [-cuffVector[1] / cuffLength, cuffVector[0] / cuffLength];
  const projection = (a: XY, origin: XY) => (a[0] - origin[0]) * normal[0] + (a[1] - origin[1]) * normal[1];
  const maxOffset = Math.min(.034, .72 * Math.min(projection(outerShoulder, cuffOuter), projection(underarm, cuffInner)));
  const cuffStitches = [maxOffset - Math.min(.006, maxOffset * .25), maxOffset].map(offset => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const t = (lo + hi) / 2;
      if (projection(at(upper, t), cuffOuter) > offset) lo = t; else hi = t;
    }
    const a = at(upper, (lo + hi) / 2), b = mix(cuffInner, underarm, offset / projection(underarm, cuffInner));
    return { right: path([straight(a, b)]), left: path([straight(mirror(a), mirror(b))]) };
  });
  const bandOffset=input.cuffBandHeight??Math.min(.06,.7*Math.min(projection(outerShoulder,cuffOuter),projection(underarm,cuffInner)));
  const extend=(a:XY,t:number):XY=>[a[0]+cuffVector[0]/cuffLength*t,a[1]+cuffVector[1]/cuffLength*t];
  const outer=extend(cuffOuter,-.01),inner=extend(cuffInner,.01),innerTop:XY=[inner[0]+normal[0]*bandOffset,inner[1]+normal[1]*bandOffset],outerTop:XY=[outer[0]+normal[0]*bandOffset,outer[1]+normal[1]*bandOffset];
  const cuffBandPath=`M${p(outer)}L${p(inner)}L${p(innerTop)}L${p(outerTop)}Z`;
  return { sleevePath, bodyPath, outsidePath, armholePath: path([armhole]), hemStitches, cuffStitches,cuffBandPath };
}
