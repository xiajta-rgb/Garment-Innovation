import type { BodyMeasurements } from '@/types/measurements';

/** Shared measurement semantics only. Each design validates its own option domain. */
export function referenceMeasurementSettings(m: BodyMeasurements) {
  const measurements = {
    biceps: m.bicep, chest: m.bust, neck: m.neckCirc,
    shoulderToShoulder: m.shoulderWidth, shoulderSlope: m.shoulderSlope,
    hpsToBust: m.hpsToBust, hpsToWaistBack: m.hpsToWaistBack,
    waistToArmpit: m.waistToArmpit, waistToHips: m.hipDepth,
    shoulderToWrist: m.sleeveLength, wrist: m.wristCirc,
  };
  const missing = Object.entries(measurements).filter(([key, value]) =>
    typeof value !== 'number' || !Number.isFinite(value) ||
    (key === 'shoulderSlope' ? value < 0 || value > 45 : value <= 0));
  if (missing.length) throw new Error(`缺少或无效的制版测量：${missing.map(([key]) => key).join('、')}`);
  if (m.hpsToWaistBack! <= m.waistToArmpit!) throw new Error('HPS→后腰必须大于腰→腋下');
  if (m.hpsToBust >= m.hpsToWaistBack!) throw new Error('胸围线必须位于后腰线以上');
  if (!Number.isFinite(m.totalLength) || m.totalLength <= 0) throw new Error('衣长无效');
  return {
    measurements: measurements as Record<string, number>,
    lengthBonus: m.totalLength / (m.hpsToWaistBack! + m.hipDepth) - 1,
  };
}
