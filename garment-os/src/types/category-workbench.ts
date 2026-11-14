/** Product scope is separate from piece roles and material identities. */
export interface GarmentCategory {
  id:string; group:string; label:string; construction:string;
  requiredRoles:string[]; optionalRoles:string[];
  dimensions:string[]; interfaces:string[];
  templateIds:string[]; companyMasterIds:string[]; gaps:string[];
}
export type AssetLibraryTab='design'|'material'|'finish'|'structure'|'template'|'color';
export type PieceLibraryViewId='qc'|'generator'|'assembly'|'construction'|'taxonomy'|'reference';
export type CategoryWorkspaceAction=
  | {kind:'assets';categoryId:string;tab:AssetLibraryTab}
  | {kind:'pieces';view:PieceLibraryViewId}
  | {kind:'company'};
