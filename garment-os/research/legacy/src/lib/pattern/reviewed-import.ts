import { PATTERN_SCHEMA_VERSION, type PatternExportEnvelope } from './pattern-io';
import type { BodyMeasurements } from '@/types/measurements';
import { assertCanonicalPattern } from '@/data/patternLibrary';
import { requireReviewedPattern } from '@/data/patternReview';
import { composePattern } from '@/lib/patterns/compose';

/** Validate the whole file before any store mutation. Missing input is never a size guess. */
export function resolveReviewedImport(envelope: PatternExportEnvelope) {
  if (envelope.schema !== PATTERN_SCHEMA_VERSION || envelope.version !== 1) throw new Error('不支持的模板文件格式');
  const pattern = envelope.pattern;
  assertCanonicalPattern(pattern);
  requireReviewedPattern(pattern.id);
  const input = envelope.overrides;
  if (!input || input.engineVersion !== '4.10.2') throw new Error('文件缺少兼容的制图版本与完整输入快照，请重新导出');
  if (!['male', 'female', 'unisex'].includes(input.gender ?? '')) throw new Error('文件缺少有效的体型分组');
  if (!['slim', 'regular', 'loose'].includes(input.fit ?? '')) throw new Error('文件缺少有效的松量方案');
  if (!['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].includes(input.standardSize ?? '')) throw new Error('文件缺少有效的样本尺码标识');
  if (!input.measurements || typeof input.measurements !== 'object' || Array.isArray(input.measurements)) throw new Error('文件缺少制版测量值');
  const m = input.measurements as BodyMeasurements;
  const keys: Array<keyof BodyMeasurements> = ['neckCirc', 'hpsToBust', 'hpsToWaistBack', 'waistToArmpit', 'shoulderSlope', 'bust', 'waist', 'hip', 'bicep', 'wristCirc', 'shoulderWidth', 'acrossBack', 'acrossFront', 'backLength', 'frontLength', 'armholeDepth', 'sleeveLength', 'waistDepth', 'hipDepth', 'totalLength', 'height', 'weight'];
  if (keys.some(key => !Number.isFinite(m[key]) || (key === 'shoulderSlope' ? m[key]! < 0 : m[key]! <= 0))) throw new Error('文件测量快照不完整或数值无效，不能混入当前样本尺寸');
  // Validate every input actually consumed by the complete reference, including all parts.
  for (const view of ['front', 'back'] as const) {
    composePattern(pattern, {}, m, input.gender, { view, userOverrides: { fit: input.fit! } });
  }
  return { patternId: pattern.id, measurements: structuredClone(m), gender: input.gender!, fit: input.fit!, standardSize: input.standardSize! };
}
