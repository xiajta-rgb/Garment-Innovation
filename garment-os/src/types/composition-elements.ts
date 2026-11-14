import type { CompositionView } from './piece-composition';
import type { ManagedMaterialAssignments } from './managed-material';

export type CompositionFabric = 'jersey'|'waffle'|'rib'|'pique'|'slub';
export type GraphicKind = 'text'|'monogram'|'emblem'|'image';
export type GraphicTechnique='artwork'|'digital-print'|'embroidery'|'applique';
export interface EmbeddedRaster {dataUrl:string;width:number;height:number}
export interface CompositionGraphic {
 id:string;kind:GraphicKind;text:string;color:string;view:CompositionView;
 x:number;y:number;width:number;height:number;rotation?:number;image?:EmbeddedRaster;
 technique?:GraphicTechnique;
}
export interface CompositionElements {
 shoulder:'set-in'|'raglan'|'drop';neckline:'crew'|'v'|'henley'|'polo'|'stand';
 craft?:CompositionCraft;
 details?:CompositionDetails;
 tagIntent?:{codes:string[];dictionaryRevision:number;bindingPart?:'neck'|'back-neck';colourPart?:'neck'|'sleeve'|'cuff';pocketPart?:'chest';finishPart?:'cuff'|'hem';panelPart?:'yoke'|'side';hoodType?:'two-piece'|'three-piece'};
 sleeveContrast:boolean;neckContrast:boolean;cuffContrast:boolean;
 sleeveColor:string;neckColor:string;cuffColor:string;
 fabric:CompositionFabric;materials?:ManagedMaterialAssignments;
 materialImages?:Partial<Record<'main'|'neck'|'cuff'|'hem',EmbeddedRaster&{materialId:string}>>;
 graphics:CompositionGraphic[];
}
/** Design drawing settings only. These are not verified net-pattern dimensions. */
export interface CompositionDetails {
 cuffFinish:'turned'|'rib';cuffHeightMm:number;
 hemFinish:'turned'|'rib'|'side-slit';hemHeightMm:number;slitHeightMm:number;
 panel:'none'|'yoke'|'side';panelColor:string;panelDepthMm:number;
 hood:'none'|'two-piece'|'three-piece';hoodHeightMm:number;drawcord:boolean;

}
export interface CompositionCraft {
 opening:'none'|'buttons'|'quarter-zip'|'full-zip';
 neckFinish:'rib'|'binding';bindingWidthMm:number;
 backNeckTape:boolean;seamFinish:'plain'|'topstitch'|'piping';
 trimColor:string;openingLengthMm:number;placketWidthMm:number;collarHeightMm:number;
}
