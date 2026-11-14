import type { BodyMeasurements, GenderType, StandardSize } from './measurements';

/** Parametric display body for fit presentation. It is not a scan or a graded body block. */
export interface MannequinSpec {
  enabled: boolean;
  /** A real skinned GLB asset or the explicit geometric proportion mannequin. */
  mode?: 'real-human'|'parametric';
  gender: GenderType;
  standardSize: StandardSize;
  measurements: BodyMeasurements;
  clearanceMm: number;
}

export interface MannequinDimensions {
  torsoLengthMm: number;
  shoulderWidthMm: number;
  bustWidthMm: number;
  hipWidthMm: number;
  headRadiusMm: number;
  armLengthMm: number;
  upperArmRadiusMm: number;
  legLengthMm: number;
  legRadiusMm: number;
}

export function mannequinDimensions(spec: MannequinSpec): MannequinDimensions {
  const m = spec.measurements;
  const torsoLengthMm = Math.max(360, (m.hpsToWaistBack ?? m.totalLength * .58) + m.hipDepth);
  return {
    torsoLengthMm,
    shoulderWidthMm: Math.max(300, m.shoulderWidth),
    bustWidthMm: Math.max(260, m.bust / Math.PI),
    hipWidthMm: Math.max(280, m.hip / Math.PI),
    headRadiusMm: Math.max(75, (m.headCirc ?? m.neckCirc * 2.1) / (Math.PI * 2)),
    armLengthMm: Math.max(420, m.sleeveLength),
    upperArmRadiusMm: Math.max(35, m.bicep / (Math.PI * 2)),
    legLengthMm: Math.max(650, m.waistToFloor ?? m.totalLength * 1.7),
    legRadiusMm: Math.max(42, (m.hip / Math.PI) * .18),
  };
}
