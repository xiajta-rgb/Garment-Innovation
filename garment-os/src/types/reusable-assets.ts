import type { CompanyStyleMaster } from './company-style';
import type { ConstructionSelection } from './construction';
import type { GarmentFinishSettings } from './garment3d';

export interface AssetRef { id:string; revision:1 }
export type MaterialSlot='main'|'neck'|'cuff'|'hem';
export interface CompanyAssetLinks {
  materials:Partial<Record<MaterialSlot,AssetRef>>;
  color?:AssetRef;
  finish?:AssetRef;
}
export interface MaterialAsset extends AssetRef {
  name:string;code:string|null;structure:string;
  composition:Array<{fiber:string;percent:number}>|null;
  /** Preserve the source label. A bare g is never silently interpreted as g/m². */
  weightLabel:string|null;weightGsm:number|null;
  widthMm:number|null;stretchPercent:number|null;shrinkagePercent:number|null;
  slots:MaterialSlot[];kinds:CompanyStyleMaster['kind'][];
  sourceMasterIds:string[];notes:string[];
}
export interface FinishAsset extends AssetRef {
  name:string;masterIds:string[];settings:GarmentFinishSettings;
  sourcedFields:Array<keyof GarmentFinishSettings>;assumptions:string[];
}
export interface StructureAsset extends AssetRef {
  name:string;templateId:string;tags:string[];description:string;
  selection:ConstructionSelection;source:string;
  /** A reviewed component patch preserves unrelated settings on the same host method. */
  componentId?:string;
  /** Explicit style input: totalLength=(hpsToWaistBack+hipDepth)*(1+lengthBonus). */
  lengthBonus?:number;
}
