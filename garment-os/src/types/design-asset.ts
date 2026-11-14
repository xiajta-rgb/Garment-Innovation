import type { CompositionCraft, CompositionDetails, CompositionElements } from './composition-elements';
export type DesignAssetGroup='neck'|'opening'|'shoulder'|'finish'|'panel'|'pocket'|'hood'|'graphic'|'fabric';
export interface DesignAssetComponent {role:string;name:string;material:'fabric'|'lining'|'interfacing'|'ribbing'|'trim';quantity:string;requirement:string}
export interface ProfessionalDesignAsset {
 id:string;name:string;group:DesignAssetGroup;description:string;tagNames:string[];companyCodes:string[];
 patch?:Partial<Pick<CompositionElements,'shoulder'|'neckline'|'fabric'>>;
 craft?:Partial<CompositionCraft>;details?:Partial<CompositionDetails>;
 pocket?:'patch'|'kangaroo'|'welt'|'zip-welt';graphic?:'text'|'emblem';
 components:DesignAssetComponent[];needs:string[];
}
