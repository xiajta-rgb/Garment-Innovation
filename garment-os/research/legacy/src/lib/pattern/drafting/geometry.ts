/**
 * ─────────────────────────────────────────────────────────────
 *  mm 制版几何核心 (Drafting Geometry Core)
 * ─────────────────────────────────────────────────────────────
 *
 *  设计原则 (参考 Valentina / Seamly2D 的公式驱动制版):
 *   1. 所有坐标一律为真实毫米 (mm), 与人体测量值 1:1 映射
 *   2. 渲染层只做显示缩放 (viewBox), 导出/排料/BOM 直接使用 mm
 *   3. 轮廓 (Contour) 同时提供:
 *      - SVG path 字符串 (渲染)
 *      - 采样点列 (弧长积分 / 缝份 offset / 面积计算)
 *
 *  本模块不依赖任何 UI / Store, 纯函数。
 */

// ════════════════════════════════════════════════════════════
// 点与向量
// ════════════════════════════════════════════════════════════

export interface Pt { x: number; y: number }

export function pt(x: number, y: number): Pt { return { x, y }; }

export function add(a: Pt, b: Pt): Pt { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a: Pt, b: Pt): Pt { return { x: a.x - b.x, y: a.y - b.y }; }
export function mul(a: Pt, k: number): Pt { return { x: a.x * k, y: a.y * k }; }
export function len(a: Pt): number { return Math.hypot(a.x, a.y); }
export function dist(a: Pt, b: Pt): number { return Math.hypot(b.x - a.x, b.y - a.y); }
export function lerp(a: Pt, b: Pt, t: number): Pt { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

/** 单位向量 */
export function unit(a: Pt): Pt {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** 将点坐标格式化为 SVG 数字串 (0.01mm 精度) */
function n(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

// ════════════════════════════════════════════════════════════
// 轮廓 (Contour): 点 + 段序列, 可闭合
// ════════════════════════════════════════════════════════════

export type Seg =
  | { kind: 'L'; to: Pt }
  | { kind: 'C'; c1: Pt; c2: Pt; to: Pt };

export interface Contour {
  start: Pt;
  segs: Seg[];
  /** 闭合轮廓 (首尾相连) */
  closed: boolean;
}

/** 轮廓 → SVG path d 字符串 */
export function contourToPath(c: Contour): string {
  const parts: string[] = [`M${n(c.start.x)} ${n(c.start.y)}`];
  for (const s of c.segs) {
    if (s.kind === 'L') parts.push(`L${n(s.to.x)} ${n(s.to.y)}`);
    else parts.push(`C${n(s.c1.x)} ${n(s.c1.y)} ${n(s.c2.x)} ${n(s.c2.y)} ${n(s.to.x)} ${n(s.to.y)}`);
  }
  if (c.closed) parts.push('Z');
  return parts.join(' ');
}

// ════════════════════════════════════════════════════════════
// 贝塞尔与弧长
// ════════════════════════════════════════════════════════════

export function cubicAt(p0: Pt, c1: Pt, c2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

/** 三次贝塞尔长度 (自适应采样, 精度 ~0.05mm) */
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

/** 轮廓总长度 (mm) — 用于袖窿弧长 AH / 领口弧长等 */
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

/**
 * 段链弧长定位: 从 start 沿段链走 target 长度, 返回该点坐标
 * — 工业对位的基础 (剪口/扣位按弧长精确落位)
 */
export function pointAtChainLength(start: Pt, segs: Seg[], target: number): Pt {
  let acc = 0;
  let from = start;
  for (const s of segs) {
    const segLen = s.kind === 'L' ? dist(from, s.to) : cubicLength(from, s.c1, s.c2, s.to);
    if (segLen <= 0) { from = s.to; continue; }
    if (acc + segLen >= target) {
      const t = Math.max(0, Math.min(1, (target - acc) / segLen));
      if (s.kind === 'L') return lerp(from, s.to, t);
      return cubicAt(from, s.c1, s.c2, s.to, t);
    }
    acc += segLen;
    from = s.to;
  }
  return from;
}

// ════════════════════════════════════════════════════════════
// 采样 (Flatten): 轮廓 → 折线点列
// ════════════════════════════════════════════════════════════

/**
 * 将轮廓采样为折线点列 (默认步长 2mm, 曲线段加密)
 * 闭合轮廓返回不含重复末点的点列
 */
export function flattenContour(c: Contour, stepMm = 2): Pt[] {
  const pts: Pt[] = [c.start];
  let prev = c.start;
  for (const s of c.segs) {
    if (s.kind === 'L') {
      // 直线段: 只保留终点
      pts.push(s.to);
      prev = s.to;
    } else {
      const segLen = cubicLength(prev, s.c1, s.c2, s.to);
      const steps = Math.max(8, Math.ceil(segLen / stepMm));
      for (let i = 1; i <= steps; i++) pts.push(cubicAt(prev, s.c1, s.c2, s.to, i / steps));
      prev = s.to;
    }
  }
  if (c.closed && pts.length > 1 && dist(pts[0], pts[pts.length - 1]) < 0.5) pts.pop();
  return pts;
}

// ════════════════════════════════════════════════════════════
// 缝份 (Seam Allowance) — 等距外偏轮廓
// ════════════════════════════════════════════════════════════

/**
 * 闭合折线多边形外偏 (缝份 offset)
 *
 * 算法:
 *  - 对每条边计算外侧法向量 (多边形按顺时针/逆时针自动判向)
 *  - 顶点用角平分线偏移 (斜接 miter, 上限 3×width 防尖角爆炸)
 *  - 凸角输出近似圆角 (工业纸样缝份拐角保持直角斜接, 不圆化 — 用 miter)
 *
 * @param pts 闭合多边形顶点 (不重复首点)
 * @param width 缝份宽度 mm (>0 为外侧)
 * @returns 外偏后的多边形顶点 (同顶点数, 不重复首点)
 */
export function offsetPolygon(pts: Pt[], width: number): Pt[] {
  const nPts = pts.length;
  if (nPts < 3) return pts.map(p => ({ ...p }));

  // 判断多边形方向 (signed area, SVG y 向下 → 正面积 = 顺时针)
  let area2 = 0;
  for (let i = 0; i < nPts; i++) {
    const a = pts[i], b = pts[(i + 1) % nPts];
    area2 += a.x * b.y - b.x * a.y;
  }
  const clockwise = area2 > 0; // SVG 坐标系 (y 向下) 中顺时针面积为正

  const result: Pt[] = [];
  for (let i = 0; i < nPts; i++) {
    const prevP = pts[(i - 1 + nPts) % nPts];
    const cur = pts[i];
    const nextP = pts[(i + 1) % nPts];

    // 边方向 → 外法向 (SVG y 向下: 右法向 = (dy, -dx) 指向外侧对顺时针多边形)
    const eIn = unit(sub(cur, prevP));
    const eOut = unit(sub(nextP, cur));
    const nIn: Pt = clockwise ? { x: eIn.y, y: -eIn.x } : { x: -eIn.y, y: eIn.x };
    const nOut: Pt = clockwise ? { x: eOut.y, y: -eOut.x } : { x: -eOut.y, y: eOut.x };

    // 角平分线方向 (两外法向之和), 退化时用单边法向
    let bis: Pt = add(nIn, nOut);
    const bisLen = len(bis);
    if (bisLen < 1e-9) bis = nOut;
    else bis = mul(bis, 1 / bisLen);

    // 斜接偏移: 沿平分线偏移, 距离 = width / cos(θ/2)
    // 钳制 4×width 防尖角爆炸 (工业纸样尖角保留斜接, 后续由 Weiler-Atherton 修剪精化)
    const cosHalf = Math.max(0.25, bis.x * nIn.x + bis.y * nIn.y); // clamp 4×width
    const offsetDist = Math.min(width / cosHalf, width * 4);

    result.push(add(cur, mul(bis, offsetDist)));
  }
  return result;
}

/** 多边形顶点列 → 闭合 SVG path */
export function polygonToPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  const parts: string[] = [`M${n(pts[0].x)} ${n(pts[0].y)}`];
  for (let i = 1; i < pts.length; i++) parts.push(`L${n(pts[i].x)} ${n(pts[i].y)}`);
  parts.push('Z');
  return parts.join(' ');
}

// ════════════════════════════════════════════════════════════
// 面积 (格林公式) — BOM 用料 / 排料
// ════════════════════════════════════════════════════════════

/** 折线多边形面积 (mm²), 坐标为 mm 时结果即真实面积 */
export function polygonArea(pts: Pt[]): number {
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2) / 2;
}

/** 轮廓面积 (mm²) */
export function contourArea(c: Contour): number {
  return polygonArea(flattenContour(c, 1.5));
}

// ════════════════════════════════════════════════════════════
// 常用曲线构造
// ════════════════════════════════════════════════════════════

/**
 * 过三点的圆弧近似贝塞尔 (制版常用: 领口 / 袖山)
 * @param a 起点, @param b 弧顶(通过点), @param c 终点
 */
export function arcThrough(a: Pt, mid: Pt, c: Pt): Seg {
  // 二次贝塞尔 B(t) = (1-t)²a + 2(1-t)t m + t² c, 其中点恰过 m
  // 升阶为 cubic: c1 = a + 2/3 (m - a), c2 = c + 2/3 (m - c)
  const c1 = lerp(a, mid, 2 / 3);
  const c2 = lerp(c, mid, 2 / 3);
  return { kind: 'C', c1, c2, to: c };
}

/**
 * 光滑 S 连接: 从 from 出发沿 fromDir 切向, 到达 to 时沿 toDir 切向
 * 这是制版中"肩线→袖窿弧→侧缝"光滑连接的标准做法 (Valentina 的 spline)
 */
export function smoothJoin(from: Pt, fromDir: Pt, to: Pt, toDir: Pt, armDiv = 3): Seg {
  const chord = dist(from, to);
  // 控制臂长度 ≈ 弦长 / armDiv (3 = 经典光滑过渡; 4.5 = 更圆润的 French curve 弧度)
  const a = add(from, mul(unit(fromDir), chord / armDiv));
  const b = sub(to, mul(unit(toDir), chord / armDiv));
  return { kind: 'C', c1: a, c2: b, to };
}



// ════════════════════════════════════════════════════════════
// 分段缝份基础 (Segmented Offset)
// ─────────────────────────────────────────────────────────────
// 工业纸样缝份按边角色区分宽度:
//   对折边 0 / 领口 6 / 缝合边 10 / 下摆折边 25
// 每条边独立偏移, 相邻边的偏移端点用"角部平接"直线相连
// (缝份角处理: 大小缝份相交处切平, 工业标准做法)
// ════════════════════════════════════════════════════════════

/** 开链采样: 段链 → 折线点列 (含起点) */
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

/**
 * 分段外偏拼接
 * @param chains 依顺序的边链 (已各按自身宽度偏移), 首尾相接构成闭合轮廓
 * @returns 拼接后的毛样顶点列 (闭合, 不重复首点)
 *
 * 角部处理: 边 A 末点与边 B 首点之间的直线段即为"缝份角平接"
 * (等宽时退化为斜接, 不等宽时自动形成过渡切平)
 */
export function joinOffsetChains(chains: Pt[][], chainWidths: number[] = []): Pt[] {
  const nCh = chains.length;
  if (nCh === 0) return [];

  // 预计算每个角点的斜接 (miter): 边 A 末偏移线段 ∩ 边 B 首偏移线段
  // — 专业 CAD 标准: 角部保角 (不丢布料)
  // 守卫: 斜接点距角点 ≤ 3×max(两侧缝份)+20 (G1 平行角交点在无穷远, 必须拒绝并退化平接)
  const miters: Array<Pt | null> = [];
  for (let j = 0; j < nCh; j++) {
    const a = chains[j];
    const b = chains[(j + 1) % nCh];
    if (a.length < 2 || b.length < 2) { miters.push(null); continue; }
    const corner = a[a.length - 1];
    const m = lineIntersect(a[a.length - 2], a[a.length - 1], b[0], b[1]);
    const wMax = Math.max(chainWidths[j] ?? 10, chainWidths[(j + 1) % nCh] ?? 10);
    const cap = wMax * 3 + 20;
    miters.push(m && dist(m, corner) <= cap ? m : null);
  }

  const result: Pt[] = [];
  for (let j = 0; j < nCh; j++) {
    const chain = chains[j];
    const startIdx = j === 0 ? 0 : (miters[(j - 1 + nCh) % nCh] ? 1 : 0);
    const endIdx = chain.length - 1; // 跳过与下边共享的角点
    for (let i = startIdx; i < endIdx; i++) result.push(chain[i]);
    if (miters[j]) result.push(miters[j]!);
    else if (j === nCh - 1) {
      // 退化: 平接角 — 补上末边末点 (与 chain0 首点的过渡)
      result.push(chain[chain.length - 1]);
    }
  }

  // 闭合去重
  if (result.length > 1 && dist(result[0], result[result.length - 1]) < 0.5) result.pop();
  return result;
}

/** 两线段 (p1→p2 与 p3→p4) 所在直线交点; 近平行返回 null */
export function lineIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + d1x * t, y: p1.y + d1y * t };
}

/**
 * 单链外偏 (开链, 各点沿局部外法向偏移 width)
 * 端点法向 = 端段法向; 内点法向 = 相邻两段法向的角平分 (无限长处理)
 */
export function offsetChain(pts: Pt[], width: number, clockwise: boolean): Pt[] {
  if (pts.length < 2) return pts.map(p => ({ ...p }));
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    let n: Pt;
    if (i === 0) {
      n = edgeNormal(pts[0], pts[1], clockwise);
    } else if (i === pts.length - 1) {
      n = edgeNormal(pts[i - 1], pts[i], clockwise);
    } else {
      const nIn = edgeNormal(pts[i - 1], pts[i], clockwise);
      const nOut = edgeNormal(pts[i], pts[i + 1], clockwise);
      const bis = add(nIn, nOut);
      n = len(bis) < 1e-9 ? nOut : unit(bis);
    }
    out.push(add(pts[i], mul(n, width)));
  }
  return out;
}

/** 有向段的外法向 (SVG y 向下坐标系, clockwise=true 时右法向朝外) */
export function edgeNormal(a: Pt, b: Pt, clockwise: boolean): Pt {
  const d = unit(sub(b, a));
  return clockwise ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
}

/** 闭合多边形方向 (SVG y 向下: true = 顺时针) */
export function polygonIsClockwise(pts: Pt[]): boolean {
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  return area2 > 0;
}





// ════════════════════════════════════════════════════════════
// SVG path 精确展平 (M/L/C/Z) — bbox/面积/等距测量用
// 控制点不代表曲线实际位置, 必须采样曲线本身
// ════════════════════════════════════════════════════════════

function cubicAxis(p0: number, c1: number, c2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p3;
}

/** 展平 SVG path 字符串 (绝对 M/L/C/Z) 为采样点列 */
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

