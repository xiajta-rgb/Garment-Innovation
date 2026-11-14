import * as models from '@freesewing/models';
import type { BodyMeasurements, StandardSize, GenderType } from '@/types/measurements';
import { getMeasurementsBySize } from './sizeCharts';

/** Project size aliases for upstream test models; these are NOT certified size charts. */
export const REFERENCE_PROFILES = {
  male: { XS: 34, S: 36, M: 38, L: 40, XL: 42, XXL: 44, XXXL: 46 },
  female: { XS: 30, S: 32, M: 34, L: 36, XL: 38, XXL: 40, XXXL: 42 },
} as const;

export function referenceProfileId(gender: GenderType, size: StandardSize): string {
  const group = gender === 'male' ? 'male' : 'female';
  return `cis${group === 'male' ? 'Male' : 'Female'}Adult${REFERENCE_PROFILES[group][size]}`;
}

export function getReferenceMeasurements(gender: GenderType, size: StandardSize): BodyMeasurements {
  const model = models[referenceProfileId(gender, size)];
  if (!model) throw new Error('未找到 FreeSewing 参考样本');
  // Legacy-only fields are retained for old screens. Every Brian input below is a direct source value.
  return {
    ...getMeasurementsBySize(gender, size),
    neckCirc: model.neck, bust: model.chest, bicep: model.biceps,
    shoulderWidth: model.shoulderToShoulder, shoulderSlope: model.shoulderSlope,
    hpsToBust: model.hpsToBust, hpsToWaistBack: model.hpsToWaistBack,
    waistToArmpit: model.waistToArmpit, hipDepth: model.waistToHips,
    sleeveLength: model.shoulderToWrist, wristCirc: model.wrist,
    totalLength: model.hpsToWaistBack + model.waistToHips,
    waist: model.waist, hip: model.hips,
  };
}
