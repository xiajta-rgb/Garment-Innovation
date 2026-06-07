import type { GenePathData } from '@/types/gene';
import { num } from '../utils';
import { grainLine, notch } from '../markings';
import type { PartCtx } from './index';

/**
 * 袖子生成器
 *
 * 整合点 (R2+R3+R4+R5+R7):
 * 1. 从 bodyCtx.anchors 读取 sp-left/right, ap-left/right (统一坐标接口)
 * 2. 从 bodyCtx.anchors['armhole-curve-length'] 读取真实袖窿弧长 (用于 cap 高度)
 * 3. 袖山曲线镜像 body 袖窿曲线 (控制点反向, 保证缝合线吻合)
 * 4. Cap 顶部不超肩线 (capHeight = armholeCurveLen * 0.12, 顶部只比 spY 高 ~6mm)
 * 5. 袖长联动大身: 默认 sleeveLength = bodyHemLength * 0.9 (比例协调)
 *
 * 袖型: short / elbow / flare / puff / long (sleeveless 返回空)
 * 输出: 左右袖轮廓线 + 袖山明线 + 袖缝线 + 袖口明线
 */
export function generateSleeve(
  p: Record<string, number | string | boolean>,
  bodyCtx: PartCtx = { parameters: {}, anchors: {} }
): GenePathData[] {
  const bodyP = bodyCtx.parameters;
  const bodyA = bodyCtx.anchors;
  const sleeveType = String(p.sleeveType ?? 'long');
  if (sleeveType === 'sleeveless') return [];

  // R2: 统一从 bodyCtx.anchors 读取 (替代原 bodyP.xxx)
  const spRight = bodyA['sp-right'];
  const spLeft = bodyA['sp-left'];
  const apRight = bodyA['ap-right'];
  const apLeft = bodyA['ap-left'];
  if (!spRight || !spLeft || !apRight || !apLeft) {
    // 缺少 body 锚点, 无法生成对齐的袖子
    return [];
  }
  const spY = spRight.y;
  const apY = apRight.y;

  // R7: 袖长联动大身 hemLength
  // 默认: 袖长 = 大身长 * 0.9 (略短于大身, 比例协调)
  // 用户 sleeveLength 参数可覆盖
  const bodyHemLength = num(bodyP, 'hemLength', 224);
  const sleeveLengthRatio = num(p, 'sleeveLengthRatio', 0.9);
  const defaultSleeveLength = bodyHemLength * sleeveLengthRatio;
  const sleeveLength = Math.min(
    num(p, 'sleeveLength', defaultSleeveLength),
    bodyHemLength - 8  // 袖口不能低于大身下摆
  );
  const cuffW = num(p, 'cuffWidth', 14);

  // R3: 用真实袖窿弧长 (来自 body 锚点) 计算 cap 高度
  const armholeCurveLen = bodyA['armhole-curve-length']?.meta?.length ?? 60;
  // cap 高度 = 袖窿弧长 * 0.12 (典型合身袖型比例)
  // R4: 保证 cap 顶部不超过肩线 6mm
  const capHeight = Math.min(armholeCurveLen * 0.12, 8);

  // 袖子自然下垂偏移 (随袖长)
  const dropOffset = sleeveLength * 0.25;

  // 袖口位置
  const cuffY = spY + sleeveLength;

  // ─── 右袖控制点 (R5: 镜像 body 右袖窿) ───
  // body 右袖窿: sp-right → ctrl1 → ctrl2 → mid-armhole → ctrl3 → ctrl4 → ap-right
  // sleeve 右袖山: sp-right → cap-ctrl1 (向上) → cap-ctrl2 (向上) → cap-top (顶部) → cap-ctrl3 (向下) → cap-ctrl4 (向下) → ap-right
  // 取 cap-top 位于 (spX - capHeight * 0.15, spY - capHeight)
  // 即 cap 顶部在肩点正上方略偏内侧, 不超过肩线 + 6mm

  const spRightX = spRight.x;
  const spLeftX = spLeft.x;
  const apRightX = apRight.x;
  const apLeftX = apLeft.x;

  const rCapTopX = spRightX - capHeight * 0.15;
  const rCapTopY = spY - capHeight;
  // 第一段 cubic Bezier: sp → 上升 → cap-top
  const rCap1Ctrl1X = spRightX - capHeight * 0.05;
  const rCap1Ctrl1Y = spY - capHeight * 0.85;
  const rCap1Ctrl2X = rCapTopX + capHeight * 0.08;
  const rCap1Ctrl2Y = rCapTopY + capHeight * 0.05;
  // 第二段 cubic Bezier: cap-top → 下降 → ap
  const rCap2Ctrl1X = rCapTopX - capHeight * 0.08;
  const rCap2Ctrl1Y = rCapTopY + capHeight * 0.05;
  const rCap2Ctrl2X = apRightX + capHeight * 0.10;
  const rCap2Ctrl2Y = apY - (apY - spY) * 0.55;

  let rightSleeve: string;

  switch (sleeveType) {
    case 'short': {
      // 短袖: cap 部分相同, 长度缩短到 apY 下方 15% 处
      const shortEndY = apY + sleeveLength * 0.15;
      const shortCuffW = cuffW + 4;
      const shortEndX = spRightX - sleeveLength * 0.08;
      rightSleeve = [
        `M${spRightX},${spY}`,
        `C${rCap1Ctrl1X},${rCap1Ctrl1Y} ${rCap1Ctrl2X},${rCap1Ctrl2Y} ${rCapTopX},${rCapTopY}`,
        `C${rCap2Ctrl1X},${rCap2Ctrl1Y} ${rCap2Ctrl2X},${rCap2Ctrl2Y} ${apRightX},${apY}`,
        `L${shortEndX - shortCuffW},${shortEndY}`,
        `L${shortEndX},${shortEndY}`,
        `C${shortEndX + 2},${shortEndY - sleeveLength * 0.1} ${spRightX - 1},${spY + sleeveLength * 0.05} ${spRightX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'elbow': {
      // 肘袖: cap + 肘部 (短于长袖)
      const elbowEndY = spY + sleeveLength;
      const elbowEndX = spRightX - sleeveLength * 0.18;
      rightSleeve = [
        `M${spRightX},${spY}`,
        `C${rCap1Ctrl1X},${rCap1Ctrl1Y} ${rCap1Ctrl2X},${rCap1Ctrl2Y} ${rCapTopX},${rCapTopY}`,
        `C${rCap2Ctrl1X},${rCap2Ctrl1Y} ${rCap2Ctrl2X},${rCap2Ctrl2Y} ${apRightX},${apY}`,
        `L${elbowEndX - cuffW},${elbowEndY}`,
        `L${elbowEndX},${elbowEndY}`,
        `C${elbowEndX + 2},${elbowEndY - sleeveLength * 0.2} ${spRightX - 1},${spY + sleeveLength * 0.08} ${spRightX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'flare': {
      // 喇叭袖: 袖口放大
      const flareCuffW = cuffW * 1.8;
      const flareEndX = spRightX - dropOffset * 0.5;
      rightSleeve = [
        `M${spRightX},${spY}`,
        `C${rCap1Ctrl1X},${rCap1Ctrl1Y} ${rCap1Ctrl2X},${rCap1Ctrl2Y} ${rCapTopX},${rCapTopY}`,
        `C${rCap2Ctrl1X},${rCap2Ctrl1Y} ${rCap2Ctrl2X},${rCap2Ctrl2Y} ${apRightX},${apY}`,
        `C${apRightX - 2},${apY + sleeveLength * 0.15} ${flareEndX - flareCuffW + 4},${cuffY - sleeveLength * 0.15} ${flareEndX - flareCuffW},${cuffY}`,
        `L${flareEndX},${cuffY}`,
        `C${flareEndX + 2},${cuffY - sleeveLength * 0.2} ${spRightX - 1},${spY + sleeveLength * 0.1} ${spRightX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'puff': {
      // 泡泡袖: 袖山鼓出, 袖口收紧
      const puffCapH = capHeight * 2;
      const puffCapTopY = spY - puffCapH;
      const puffEndY = apY + sleeveLength * 0.15;
      const puffEndX = spRightX - sleeveLength * 0.08;
      const puffCuffW = cuffW - 2;
      rightSleeve = [
        `M${spRightX},${spY}`,
        `C${spRightX + puffCapH * 0.2},${spY - puffCapH * 0.5} ${spRightX - puffCapH * 0.1},${puffCapTopY} ${spRightX - puffCapH * 0.3},${puffCapTopY}`,
        `C${spRightX - puffCapH * 0.5},${puffCapTopY} ${apRightX + puffCapH * 0.3},${spY + (apY - spY) * 0.2} ${apRightX},${apY}`,
        `L${puffEndX - puffCuffW},${puffEndY}`,
        `L${puffEndX},${puffEndY}`,
        `C${puffEndX + 4},${puffEndY - sleeveLength * 0.06} ${spRightX + 2},${spY + sleeveLength * 0.04} ${spRightX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'long':
    default: {
      // 长袖: cap + 袖身 + 袖口
      const rSleeveEndX = spRightX - dropOffset;
      const rCuffLeftX = rSleeveEndX - cuffW;
      rightSleeve = [
        `M${spRightX},${spY}`,
        `C${rCap1Ctrl1X},${rCap1Ctrl1Y} ${rCap1Ctrl2X},${rCap1Ctrl2Y} ${rCapTopX},${rCapTopY}`,
        `C${rCap2Ctrl1X},${rCap2Ctrl1Y} ${rCap2Ctrl2X},${rCap2Ctrl2Y} ${apRightX},${apY}`,
        `L${rCuffLeftX},${cuffY}`,
        `L${rSleeveEndX},${cuffY}`,
        `C${rSleeveEndX - 4},${cuffY - sleeveLength * 0.3} ${spRightX - 2},${spY + sleeveLength * 0.15} ${spRightX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
  }

  // ─── 左袖 (镜像) ───
  const lCapTopX = spLeftX + capHeight * 0.15;
  const lCapTopY = spY - capHeight;
  const lCap1Ctrl1X = spLeftX + capHeight * 0.05;
  const lCap1Ctrl1Y = spY - capHeight * 0.85;
  const lCap1Ctrl2X = lCapTopX - capHeight * 0.08;
  const lCap1Ctrl2Y = lCapTopY + capHeight * 0.05;
  const lCap2Ctrl1X = lCapTopX + capHeight * 0.08;
  const lCap2Ctrl1Y = lCapTopY + capHeight * 0.05;
  const lCap2Ctrl2X = apLeftX - capHeight * 0.10;
  const lCap2Ctrl2Y = apY - (apY - spY) * 0.55;

  let leftSleeve: string;

  switch (sleeveType) {
    case 'short': {
      const shortEndY = apY + sleeveLength * 0.15;
      const shortCuffW = cuffW + 4;
      const shortEndX = spLeftX + sleeveLength * 0.08;
      leftSleeve = [
        `M${spLeftX},${spY}`,
        `C${lCap1Ctrl1X},${lCap1Ctrl1Y} ${lCap1Ctrl2X},${lCap1Ctrl2Y} ${lCapTopX},${lCapTopY}`,
        `C${lCap2Ctrl1X},${lCap2Ctrl1Y} ${lCap2Ctrl2X},${lCap2Ctrl2Y} ${apLeftX},${apY}`,
        `L${shortEndX + shortCuffW},${shortEndY}`,
        `L${shortEndX},${shortEndY}`,
        `C${shortEndX - 2},${shortEndY - sleeveLength * 0.1} ${spLeftX + 1},${spY + sleeveLength * 0.05} ${spLeftX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'elbow': {
      const elbowEndY = spY + sleeveLength;
      const elbowEndX = spLeftX + sleeveLength * 0.18;
      leftSleeve = [
        `M${spLeftX},${spY}`,
        `C${lCap1Ctrl1X},${lCap1Ctrl1Y} ${lCap1Ctrl2X},${lCap1Ctrl2Y} ${lCapTopX},${lCapTopY}`,
        `C${lCap2Ctrl1X},${lCap2Ctrl1Y} ${lCap2Ctrl2X},${lCap2Ctrl2Y} ${apLeftX},${apY}`,
        `L${elbowEndX + cuffW},${elbowEndY}`,
        `L${elbowEndX},${elbowEndY}`,
        `C${elbowEndX - 2},${elbowEndY - sleeveLength * 0.2} ${spLeftX + 1},${spY + sleeveLength * 0.08} ${spLeftX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'flare': {
      const flareCuffW = cuffW * 1.8;
      const flareEndX = spLeftX + dropOffset * 0.5;
      leftSleeve = [
        `M${spLeftX},${spY}`,
        `C${lCap1Ctrl1X},${lCap1Ctrl1Y} ${lCap1Ctrl2X},${lCap1Ctrl2Y} ${lCapTopX},${lCapTopY}`,
        `C${lCap2Ctrl1X},${lCap2Ctrl1Y} ${lCap2Ctrl2X},${lCap2Ctrl2Y} ${apLeftX},${apY}`,
        `C${apLeftX + 2},${apY + sleeveLength * 0.15} ${flareEndX + flareCuffW - 4},${cuffY - sleeveLength * 0.15} ${flareEndX + flareCuffW},${cuffY}`,
        `L${flareEndX},${cuffY}`,
        `C${flareEndX - 2},${cuffY - sleeveLength * 0.2} ${spLeftX + 1},${spY + sleeveLength * 0.1} ${spLeftX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'puff': {
      const puffCapH = capHeight * 2;
      const puffCapTopY = spY - puffCapH;
      const puffEndY = apY + sleeveLength * 0.15;
      const puffEndX = spLeftX + sleeveLength * 0.08;
      const puffCuffW = cuffW - 2;
      leftSleeve = [
        `M${spLeftX},${spY}`,
        `C${spLeftX - puffCapH * 0.2},${spY - puffCapH * 0.5} ${spLeftX + puffCapH * 0.1},${puffCapTopY} ${spLeftX + puffCapH * 0.3},${puffCapTopY}`,
        `C${spLeftX + puffCapH * 0.5},${puffCapTopY} ${apLeftX - puffCapH * 0.3},${spY + (apY - spY) * 0.2} ${apLeftX},${apY}`,
        `L${puffEndX + puffCuffW},${puffEndY}`,
        `L${puffEndX},${puffEndY}`,
        `C${puffEndX - 4},${puffEndY - sleeveLength * 0.06} ${spLeftX - 2},${spY + sleeveLength * 0.04} ${spLeftX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
    case 'long':
    default: {
      const lSleeveEndX = spLeftX + dropOffset;
      const lCuffRightX = lSleeveEndX + cuffW;
      leftSleeve = [
        `M${spLeftX},${spY}`,
        `C${lCap1Ctrl1X},${lCap1Ctrl1Y} ${lCap1Ctrl2X},${lCap1Ctrl2Y} ${lCapTopX},${lCapTopY}`,
        `C${lCap2Ctrl1X},${lCap2Ctrl1Y} ${lCap2Ctrl2X},${lCap2Ctrl2Y} ${apLeftX},${apY}`,
        `L${lCuffRightX},${cuffY}`,
        `L${lSleeveEndX},${cuffY}`,
        `C${lSleeveEndX + 4},${cuffY - sleeveLength * 0.3} ${spLeftX + 2},${spY + sleeveLength * 0.15} ${spLeftX},${spY}`,
        'Z',
      ].join(' ');
      break;
    }
  }

  const paths: GenePathData[] = [
    { id: 'sleeve-left', data: leftSleeve, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'cutting-line' },
    { id: 'sleeve-right', data: rightSleeve, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.8, layer: 'cutting-line' },
    // 袖山明线 (沿 cap 内缩 1.5mm)
    {
      id: 'sleeve-cap-topstitch-r', data: [
        `M${spRightX - 1.5},${spY + 1.5}`,
        `C${rCap1Ctrl1X - 1.5},${rCap1Ctrl1Y + 1.5} ${rCap1Ctrl2X - 1.5},${rCap1Ctrl2Y + 1.5} ${rCapTopX - 1.5},${rCapTopY + 1.5}`,
        `C${rCap2Ctrl1X - 1.5},${rCap2Ctrl1Y + 1.5} ${rCap2Ctrl2X - 1.5},${rCap2Ctrl2Y + 1.5} ${apRightX - 1.5},${apY - 1.5}`,
      ].join(' '),
      fill: 'none', stroke: '#000000', strokeWidth: 0.3,
      strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
    },
    {
      id: 'sleeve-cap-topstitch-l', data: [
        `M${spLeftX + 1.5},${spY + 1.5}`,
        `C${lCap1Ctrl1X + 1.5},${lCap1Ctrl1Y + 1.5} ${lCap1Ctrl2X + 1.5},${lCap1Ctrl2Y + 1.5} ${lCapTopX + 1.5},${lCapTopY + 1.5}`,
        `C${lCap2Ctrl1X + 1.5},${lCap2Ctrl1Y + 1.5} ${lCap2Ctrl2X + 1.5},${lCap2Ctrl2Y + 1.5} ${apLeftX + 1.5},${apY - 1.5}`,
      ].join(' '),
      fill: 'none', stroke: '#000000', strokeWidth: 0.3,
      strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
    },
    // 袖缝线 (从袖窿底到袖口)
    {
      id: 'sleeve-seam-line-r',
      data: `M${apRightX},${apY} L${spRightX - dropOffset - cuffW},${cuffY}`,
      fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
    },
    {
      id: 'sleeve-seam-line-l',
      data: `M${apLeftX},${apY} L${spLeftX + dropOffset + cuffW},${cuffY}`,
      fill: 'none', stroke: '#000000', strokeWidth: 0.4, layer: 'detail',
    },
    // 袖口明线
    {
      id: 'sleeve-cuff-topstitch-r',
      data: `M${spRightX - dropOffset - cuffW + 1.5},${cuffY + 1.5} L${spRightX - dropOffset - 1.5},${cuffY + 1.5}`,
      fill: 'none', stroke: '#000000', strokeWidth: 0.3,
      strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
    },
    {
      id: 'sleeve-cuff-topstitch-l',
      data: `M${spLeftX + dropOffset + 1.5},${cuffY + 1.5} L${spLeftX + dropOffset + cuffW - 1.5},${cuffY + 1.5}`,
      fill: 'none', stroke: '#000000', strokeWidth: 0.3,
      strokeDasharray: '1,2', strokeLinecap: 'round', layer: 'stitch',
    },
  ];

  // ─── 工业级纸样符号 (Milestone B) ───
  // 布纹线 (Grain Line) - 袖中心垂直
  const sleeveGrainLen = sleeveLength * 0.7;
  const sleeveGrainCy = spY + sleeveGrainLen / 2 + 2;
  const sleeveMidX = (spRightX + apRightX) / 2;
  return [
    ...paths,
    grainLine({ cx: sleeveMidX, cy: sleeveGrainCy, length: sleeveGrainLen, direction: 'vertical', idPrefix: 'sleeve' }),
    notch({ x: spRightX, y: spY, direction: 'right', idPrefix: 'sleeve-sp-r' }),
    notch({ x: spLeftX, y: spY, direction: 'left', idPrefix: 'sleeve-sp-l' }),
    notch({ x: apRightX, y: apY, direction: 'right', idPrefix: 'sleeve-ap-r' }),
    notch({ x: apLeftX, y: apY, direction: 'left', idPrefix: 'sleeve-ap-l' }),
  ];
}
