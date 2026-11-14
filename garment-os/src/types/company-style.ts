import type { GarmentFinishSettings } from './garment3d';
import type { XY } from './pattern3d';
import type { CompanyAssetLinks } from './reusable-assets';
import type { StyleVariation } from './style-variation';

/** Drawing proportions are traced from company artwork, never inferred CAD mm. */
export interface CompanyStyleMaster {
  id:string;revision:1;name:string;kind:'short-tee'|'long-tee'|'crew-sweatshirt'|'pullover-hoodie';
  source:{recordId:string;styleCode:string;image:string;url:string;sha256:string;drawingFrame:[number,number];originPx:XY;bodyHeightPx:number};
  cadTemplateId:string|null;
  shape:{neckHalf:number;frontDrop:number;backDrop:number;shoulder:XY;armhole:[XY,XY,XY];hemHalf:number;cuffOuter:XY;cuffInner:XY};
  color:string;fabric:string;composition:string;weight:string;
  finish:GarmentFinishSettings;knownFinishes:string[];pending:string[];
}
export interface CompanyStyleDraft {
  schema:'garment-os/company-style/v1';masterId:string;masterRevision:1;
  styleCode:string;name:string;color:string;fabric:string;composition:string;weight:string;notes:string;
  finish:GarmentFinishSettings;
  /** Explicit user application to a compatible reference CAD method, not a same-style net pattern. */
  cadApplied:boolean;
  assets?:CompanyAssetLinks;
  design?:StyleVariation;
}
