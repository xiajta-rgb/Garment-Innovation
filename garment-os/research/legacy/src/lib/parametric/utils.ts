/**
 * 参数化解算工具函数
 * 提供 SVG 路径解析、曲线采样、参数取值等基础能力
 */

/** 三次贝塞尔曲线采样 */
export function sampleCubicBezier(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  t: number
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x,
    y: mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y,
  };
}

/** 解析 SVG path 为采样点 (M / L / C / Z) */
export function parsePathToPoints(
  pathData: string,
  samplesPerCurve: number
): { x: number; y: number }[] {
  const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
  const points: { x: number; y: number }[] = [];
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    switch (type) {
      case 'M':
        cx = nums[0]; cy = nums[1];
        startX = cx; startY = cy;
        points.push({ x: cx, y: cy });
        for (let i = 2; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          points.push({ x: cx, y: cy });
        }
        break;
      case 'L':
        for (let i = 0; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          points.push({ x: cx, y: cy });
        }
        break;
      case 'C':
        for (let i = 0; i < nums.length; i += 6) {
          const p0x = cx, p0y = cy;
          const p1x = nums[i], p1y = nums[i + 1];
          const p2x = nums[i + 2], p2y = nums[i + 3];
          const p3x = nums[i + 4], p3y = nums[i + 5];
          for (let s = 1; s <= samplesPerCurve; s++) {
            points.push(sampleCubicBezier(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, s / samplesPerCurve));
          }
          cx = p3x; cy = p3y;
        }
        break;
      case 'Z':
        if (points.length > 0) {
          points.push({ x: startX, y: startY });
        }
        cx = startX; cy = startY;
        break;
    }
  }
  return points;
}

/**
 * SVG 路径面积计算 (格林公式)
 * 用于 BOM 成本引擎的精确裁片面积
 */
export function calculatePathArea(pathData: string): number {
  const points = parsePathToPoints(pathData, 64);
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

/** 安全取数值参数 (带 fallback) */
export function num(
  p: Record<string, number | string | boolean>,
  key: string,
  fallback: number
): number {
  const v = p[key];
  return typeof v === 'number' ? v : fallback;
}

/**
 * 计算 SVG path 的 cubic Bezier 曲线总弧长
 * 用于袖窿长度估算 (影响袖山高度)
 */
export function cubicBezierArcLength(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  samples: number = 32
): number {
  let length = 0;
  let prev = { x: p0x, y: p0y };
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x;
    const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y;
    const dx = x - prev.x;
    const dy = y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = { x, y };
  }
  return length;
}
