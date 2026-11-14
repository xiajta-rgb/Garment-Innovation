/** Versioned component choices. Values are method inputs, never display coordinates. */
export type ShirtCuff = 'angledBarrelCuff' | 'roundedBarrelCuff' | 'straightBarrelCuff';
export interface ShirtOptions {
  sleeveStyle: 'long' | 'short'; cuffStyle: ShirtCuff; hemStyle: 'straight' | 'baseball' | 'slashed';
  collarEase: number; collarAngle: number; collarBend: number; collarFlare: number;
  collarGap: number; collarRoll: number; collarWidth: number;
  collarStandBend: number; collarStandCurve: number; collarStandWidth: number;
  cuffEase: number; cuffDrape: number; cuffLength: number;
  sleevePlacketLength: number; sleevePlacketWidth: number;
  sleeveLengthShort: number; sleeveHemShort: number;
}
export interface KnitOptions {
  ribbing:boolean; pocket:boolean; ribbingHeight:number; ribbingStretch:number;
  hoodHeight:number; hoodCutback:number; hoodClosure:number; hoodDepth:number; hoodAngle:number;
  pocketHeight:number; pocketWidth:number; pocketOpening:number;
  stretchFactor:number; necklineDrop:number; shoulderStrapWidth:number; shoulderStrapPlacement:number; knitBindingWidth:number;
}
export interface SkirtOptions {circleRatio:number;panels:number;waistbandWidth:number;waistbandOverlap:number;gathering:number;hemWidth:number}
export interface FoundationOptions {sleeveLength:number;sleeveEase:number;necklineDepth:number;necklineWidth:number;seatEase:number;heelEase:number;lengthBonus:number}
export interface ConstructionSelection { schema: 'garment-os/construction/v1'; options: Partial<ShirtOptions & KnitOptions & SkirtOptions & FoundationOptions> }
export interface SkirtParameter {
  key:keyof SkirtOptions;label:string;defaultValue:number;min:number;max:number;step:number;
  unit:'ratio'|'count';meaning:string;source:string;
}
export interface KnitParameter {
  key:keyof (KnitOptions & FoundationOptions & Pick<SkirtOptions,'waistbandWidth'>); label:string; unit:'ratio'|'°'|'boolean';defaultValue:number|boolean;
  min?:number;max?:number;step?:number;meaning:string;source:string;
}
export interface ConstructionParameter {
  key: keyof ShirtOptions; label: string; group: 'collar' | 'sleeve' | 'cuff' | 'hem';
  unit: 'ratio' | '°' | 'choice'; defaultValue: number | string;
  min?: number; max?: number; step?: number; choices?: Array<{ value: string; label: string }>;
  only?: 'long' | 'short'; meaning: string; source: string;
}
export interface ConstructionMetric { label: string; value: number | null; unit: 'mm' | 'count'; formula: string }
export interface ConstructionOperation {
  id: string; label: string; pieces: string[]; source: string;
  status: 'dimensioned' | 'needs-redraft' | 'needs-input' | 'needs-geometry';
  rule: string; metrics: ConstructionMetric[]; steps: string[]; requirements: string[];
  /** Source coordinates identifying fold lines and reference stations; not new cutting lines. */
  guides: Array<{ piece: string; label: string; pathD: string }>;
}
export interface ConstructionInputDefinition {
  code: string; label: string; dataType: 'number' | 'text' | 'choice';
  unit: 'mm' | 'ratio' | 'N' | 's' | 'text' | 'choice';
  group: 'material' | 'collar' | 'hem' | 'sleeve' | 'cuff';
  scope: 'each-material' | 'each-seam' | 'garment';
  meaning: string; requiredWhen: string; validation: string; evidence: string;
  operations: string[]; choices?: string[];
  /** This schema defines the requirement. No sample may masquerade as measured material data. */
  value: null;
}
export interface ConstructionReport {
  schema: 'garment-os/construction-report/v1'; method: string; revision: string;
  selection: ConstructionSelection | null; resolvedOptions: Record<string, number | boolean | string>;
  operations: ConstructionOperation[]; readyForAssembly: false; productionApproved: false;
  requiredInputs: ConstructionInputDefinition[];
}
