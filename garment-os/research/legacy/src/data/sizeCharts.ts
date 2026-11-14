/**
 * 历史项目演示尺寸，来源尚未完成逐项核验。
 * 不能声称符合 ASTM、ISO 或 GB 尺码标准，也不能用于生产验收。
 * hpsToBust 为按颈围最近的 FreeSewing 同性别测试样本值，属于演示补值。
 * 新参考基型使用 referenceMeasurements.ts 的完整上游样本。
 */

import type { BodyMeasurements, StandardSize, GenderType } from '@/types/measurements';

/** 女款历史演示数据，待补测核验。 */
export const FEMALE_SIZE_CHART: Record<StandardSize, BodyMeasurements> = {
  XS: {
    neckCirc: 340, bust: 800, waist: 640, hip: 880,
    hpsToBust: 275,
    bicep: 250, wristCirc: 150,
    shoulderWidth: 370, acrossBack: 330, acrossFront: 320,
    backLength: 390, frontLength: 400, armholeDepth: 195,
    sleeveLength: 560, waistDepth: 380, hipDepth: 200, totalLength: 600,
    height: 1600, weight: 50,
  },
  S: {
    neckCirc: 350, bust: 840, waist: 680, hip: 920,
    hpsToBust: 275,
    bicep: 260, wristCirc: 155,
    shoulderWidth: 380, acrossBack: 340, acrossFront: 330,
    backLength: 400, frontLength: 410, armholeDepth: 200,
    sleeveLength: 570, waistDepth: 390, hipDepth: 200, totalLength: 620,
    height: 1620, weight: 55,
  },
  M: {
    neckCirc: 360, bust: 880, waist: 720, hip: 960,
    hpsToBust: 286,
    bicep: 280, wristCirc: 160,
    shoulderWidth: 390, acrossBack: 350, acrossFront: 340,
    backLength: 410, frontLength: 420, armholeDepth: 205,
    sleeveLength: 580, waistDepth: 400, hipDepth: 210, totalLength: 640,
    height: 1640, weight: 60,
  },
  L: {
    neckCirc: 370, bust: 940, waist: 780, hip: 1020,
    hpsToBust: 286,
    bicep: 300, wristCirc: 170,
    shoulderWidth: 405, acrossBack: 365, acrossFront: 355,
    backLength: 420, frontLength: 430, armholeDepth: 215,
    sleeveLength: 595, waistDepth: 415, hipDepth: 215, totalLength: 660,
    height: 1660, weight: 65,
  },
  XL: {
    neckCirc: 385, bust: 1000, waist: 840, hip: 1080,
    hpsToBust: 296,
    bicep: 320, wristCirc: 180,
    shoulderWidth: 420, acrossBack: 380, acrossFront: 370,
    backLength: 430, frontLength: 445, armholeDepth: 225,
    sleeveLength: 610, waistDepth: 425, hipDepth: 220, totalLength: 680,
    height: 1680, weight: 72,
  },
  XXL: {
    neckCirc: 400, bust: 1080, waist: 920, hip: 1160,
    hpsToBust: 307,
    bicep: 350, wristCirc: 190,
    shoulderWidth: 435, acrossBack: 395, acrossFront: 385,
    backLength: 440, frontLength: 460, armholeDepth: 235,
    sleeveLength: 620, waistDepth: 435, hipDepth: 230, totalLength: 700,
    height: 1700, weight: 80,
  },
  XXXL: {
    neckCirc: 420, bust: 1160, waist: 1000, hip: 1240,
    hpsToBust: 317,
    bicep: 380, wristCirc: 200,
    shoulderWidth: 455, acrossBack: 410, acrossFront: 400,
    backLength: 450, frontLength: 475, armholeDepth: 245,
    sleeveLength: 630, waistDepth: 445, hipDepth: 240, totalLength: 720,
    height: 1720, weight: 90,
  },
};

/** 男款历史演示数据，待补测核验。 */
export const MALE_SIZE_CHART: Record<StandardSize, BodyMeasurements> = {
  XS: {
    neckCirc: 360, bust: 880, waist: 720, hip: 920,
    hpsToBust: 270,
    bicep: 280, wristCirc: 170,
    shoulderWidth: 430, acrossBack: 380, acrossFront: 360,
    backLength: 440, frontLength: 450, armholeDepth: 220,
    sleeveLength: 600, waistDepth: 420, hipDepth: 200, totalLength: 660,
    height: 1700, weight: 60,
  },
  S: {
    neckCirc: 370, bust: 920, waist: 760, hip: 960,
    hpsToBust: 270,
    bicep: 295, wristCirc: 175,
    shoulderWidth: 445, acrossBack: 390, acrossFront: 370,
    backLength: 450, frontLength: 460, armholeDepth: 225,
    sleeveLength: 610, waistDepth: 430, hipDepth: 200, totalLength: 680,
    height: 1720, weight: 65,
  },
  M: {
    neckCirc: 380, bust: 960, waist: 800, hip: 1000,
    hpsToBust: 280,
    bicep: 310, wristCirc: 180,
    shoulderWidth: 460, acrossBack: 400, acrossFront: 380,
    backLength: 460, frontLength: 470, armholeDepth: 230,
    sleeveLength: 620, waistDepth: 440, hipDepth: 210, totalLength: 700,
    height: 1740, weight: 70,
  },
  L: {
    neckCirc: 395, bust: 1020, waist: 860, hip: 1060,
    hpsToBust: 290,
    bicep: 330, wristCirc: 190,
    shoulderWidth: 480, acrossBack: 415, acrossFront: 395,
    backLength: 470, frontLength: 480, armholeDepth: 240,
    sleeveLength: 635, waistDepth: 450, hipDepth: 215, totalLength: 720,
    height: 1760, weight: 78,
  },
  XL: {
    neckCirc: 410, bust: 1080, waist: 920, hip: 1120,
    hpsToBust: 290,
    bicep: 350, wristCirc: 200,
    shoulderWidth: 500, acrossBack: 430, acrossFront: 410,
    backLength: 480, frontLength: 490, armholeDepth: 250,
    sleeveLength: 650, waistDepth: 460, hipDepth: 220, totalLength: 740,
    height: 1780, weight: 85,
  },
  XXL: {
    neckCirc: 425, bust: 1140, waist: 980, hip: 1180,
    hpsToBust: 299,
    bicep: 370, wristCirc: 210,
    shoulderWidth: 520, acrossBack: 445, acrossFront: 425,
    backLength: 490, frontLength: 500, armholeDepth: 260,
    sleeveLength: 660, waistDepth: 470, hipDepth: 230, totalLength: 760,
    height: 1800, weight: 92,
  },
  XXXL: {
    neckCirc: 440, bust: 1200, waist: 1040, hip: 1240,
    hpsToBust: 309,
    bicep: 390, wristCirc: 220,
    shoulderWidth: 540, acrossBack: 460, acrossFront: 440,
    backLength: 500, frontLength: 510, armholeDepth: 270,
    sleeveLength: 670, waistDepth: 480, hipDepth: 240, totalLength: 780,
    height: 1820, weight: 100,
  },
};

/** 根据性别获取尺寸表 */
export function getSizeChart(gender: GenderType): Record<StandardSize, BodyMeasurements> {
  if (gender === 'male') return MALE_SIZE_CHART;
  return FEMALE_SIZE_CHART;
}

/** 获取特定尺码的测量值 */
export function getMeasurementsBySize(gender: GenderType, size: StandardSize): BodyMeasurements {
  return { ...getSizeChart(gender)[size] };
}
