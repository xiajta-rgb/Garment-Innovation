import type { CanvasComponent, Material } from '@/types';

// 计算单件面料用量(米)
export function calculateFabricUsage(
  components: CanvasComponent[],
  material: Material
): number {
  let totalAreaPx = 0;

  components.forEach((component) => {
    component.paths.forEach((path) => {
      // V1: 使用 SVG path bounding box 近似面积
      // 解析 path data 中的坐标范围来估算
      const coords = extractCoordinates(path.data);
      if (coords.length >= 2) {
        const xs = coords.map((c) => c.x);
        const ys = coords.map((c) => c.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        totalAreaPx += width * height;
      }
    });
  });

  // 像素面积转平方米（假设 1px ≈ 0.264mm，即 96dpi）
  const pxToMm = 0.264583;
  const totalAreaM2 = (totalAreaPx * pxToMm * pxToMm) / 1_000_000;

  // 面料幅宽(米)
  const fabricWidthM = material.widthMm / 1000;

  // 理论用量 = 总面积 / 幅宽
  const theoreticalUsage = fabricWidthM > 0 ? totalAreaM2 / fabricWidthM : 0;

  // 实际用量 = 理论用量 × (1 + 损耗率)
  const actualUsage = theoreticalUsage * (1 + material.lossRate);

  return Math.round(actualUsage * 1000) / 1000;
}

// 计算单件成本
export function calculateCost(usage: number, pricePerMeter: number): number {
  return Math.round(usage * pricePerMeter * 100) / 100;
}

// 从 SVG path data 中提取坐标点
function extractCoordinates(pathData: string): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = [];
  const numberPattern = /[-+]?\d*\.?\d+/g;
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);

  if (!commands) return coords;

  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).match(numberPattern)?.map(Number) ?? [];

    switch (type) {
      case 'M':
        for (let i = 0; i < nums.length; i += 2) {
          curX = nums[i];
          curY = nums[i + 1];
          coords.push({ x: curX, y: curY });
        }
        break;
      case 'L':
        for (let i = 0; i < nums.length; i += 2) {
          curX = nums[i];
          curY = nums[i + 1];
          coords.push({ x: curX, y: curY });
        }
        break;
      case 'l':
        for (let i = 0; i < nums.length; i += 2) {
          curX += nums[i];
          curY += nums[i + 1];
          coords.push({ x: curX, y: curY });
        }
        break;
      case 'H':
        for (const n of nums) {
          curX = n;
          coords.push({ x: curX, y: curY });
        }
        break;
      case 'V':
        for (const n of nums) {
          curY = n;
          coords.push({ x: curX, y: curY });
        }
        break;
      case 'Q':
        for (let i = 0; i < nums.length; i += 4) {
          coords.push({ x: nums[i], y: nums[i + 1] });
          curX = nums[i + 2];
          curY = nums[i + 3];
          coords.push({ x: curX, y: curY });
        }
        break;
      case 'C':
        for (let i = 0; i < nums.length; i += 6) {
          coords.push({ x: nums[i], y: nums[i + 1] });
          coords.push({ x: nums[i + 2], y: nums[i + 3] });
          curX = nums[i + 4];
          curY = nums[i + 5];
          coords.push({ x: curX, y: curY });
        }
        break;
    }
  }

  return coords;
}
