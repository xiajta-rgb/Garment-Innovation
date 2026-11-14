/** Direct measurements consumed by the reviewed reference designs, in mm except shoulder slope. */
export type GenderType = 'male' | 'female' | 'unisex';
export type StandardSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export interface BodyMeasurements {
  neckCirc: number; bust: number; waist: number; hip: number;
  /** Direct head circumference; required only by methods with a hood. */
  headCirc?: number;
  bicep: number; wristCirc: number; shoulderWidth: number;
  /** HPS to chest line, not the bust apex. */
  hpsToBust: number;
  /** HPS to back waist; missing values block drafting. */
  hpsToWaistBack?: number;
  waistToArmpit?: number;
  /** Degrees, not a vertical offset. */
  shoulderSlope?: number;
  /** Waist to hip line. */
  hipDepth: number;
  /** Shoulder endpoint to wrist, not finished short sleeve length. */
  sleeveLength: number;
  /** HPS to garment hem, distinct from body waist length. */
  totalLength: number;
  /** Direct waist-to-floor body measurement, not HPS garment length. */
  waistToFloor?: number;
  /** Design input: finished skirt length from waistband top, not a body measurement. */
  skirtLength?: number;
  /** Direct lower-body measurements: arcs are not inferred half-circumferences. */
  waistBack?:number;seat?:number;seatBack?:number;crossSeam?:number;crossSeamFront?:number;
  waistToKnee?:number;waistToSeat?:number;waistToUpperLeg?:number;knee?:number;heel?:number;
}
