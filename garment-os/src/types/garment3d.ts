import type { XY,XYZ } from './pattern3d';

/** A separate derived surface. Source CAD and its manufacturing claims are unchanged. */
export interface GarmentSurface {
  id:string;sourceId:string;copy:number;
  localMm:XY[];positionsMm:XYZ[];triangles:number[];
  /** UV islands retain unfolded source millimetres; material repeat is a display setting. */
  uvMm:XY[];boundary:number[];simulationIds:number[];
  foldAxis:[XY,XY]|null;sourceHalfSign:number;
  boundarySourceEdges?:string[];
}
export interface GarmentPathEdge {surfaceId:string;a:number;b:number;inside:number}
export interface GarmentOpening {id:string;role:'neck'|'body-hem'|'sleeve-hem'|'armhole';edges:GarmentPathEdge[];sourceLengthMm:number;sourceBoundaries:Array<{piece:string;boundary:string;runs:number}>}
export interface GarmentAssembly3d {
  schema:'garment-os/garment-assembly/v1';templateId:string;unit:'mm';
  stage:'seam-constrained-preview';surfaces:GarmentSurface[];
  seams:Array<{id:string;sourceJoinId:string;aPanels:string[];bPanels:string[];pairs:Array<[number,number]>;maxGapMm:number;path?:Array<{surfaceId:string;vertex:number}>}>;
  openings?:GarmentOpening[];
  /** Derived illustration-only controls, never a CAD or solver constraint. */
  displayCreases?:Array<[number,number]>;
  sourcePanelCount:number;unassembledPanelIds:string[];
  quality:{vertices:number;triangles:number;iterations:number;strainP95:number;maxStrain:number;maxSeamGapMm:number;connectedComponents:number;remeshAreaErrorRatio:number;nonManifoldEdges:number;boundaryLoops:number;maxBoundarySnapMm:number;maxBoundaryDeviationMm:number};
  pending:string[];drapeValidated:false;productionApproved:false;
}
export interface GarmentAppearance {
  color:string;fabric:'solid'|'stripe'|'plaid'|'denim'|'checker';repeatMm:number;
  imageDataUrl?:string;imageMode:'repeat'|'print';imageTarget:'all'|'front';rotationDeg:number;
  surface?:GarmentSurfaceSettings;
  finish?:GarmentFinishSettings;
  companyMasterId?:string;
}
/** Editable design example. No value represents a measured textile property. */
export interface GarmentFinishSettings {enabled:boolean;neckWidthMm:number;neckRatio:number;seamAllowanceMm:number;bodyHemMm:number;sleeveHemMm:number;needleGaugeMm:number;stitchPitchMm:number}
export interface GarmentFinishPlan {
  revision:'knit-finish-example/v1';settings:GarmentFinishSettings;
  neckband:null|{id:string;attachmentLengthMm:number;netLengthMm:number;cutLengthMm:number;cutWidthMm:number;foldYmm:number;quarterNotchesMm:number[];quantity:1;material:'ribbing'};
  hems:Array<{openingId:string;depthMm:number;sourceBoundaries:GarmentOpening['sourceBoundaries']}>;
  operations:Array<{id:string;label:string;kind:'rib-band'|'turnback'|'coverstitch'|'assembly-seam';sourceBoundaries:string[]}>;
  materialValidated:false;productionApproved:false;
}
/** Display settings are independent of measured fabric/collision properties. */
export interface GarmentSurfaceSettings {subdivision:0|1|2;thicknessMm:number;roundedEdges:boolean}
export interface GarmentDisplaySurface extends GarmentSurface {
  sourceSurfaceId:string;layer:'outer'|'inner'|'rim'|'finish'|'stitch';renderNormals:XYZ[];
  detail?:{operationId:string;kind:'rib'|'turnback'|'thread';label:string;coordinateSpace:'cut-piece-mm'|'path-mm'};
}
export interface GarmentDisplay3d {
  templateId:string;source:GarmentAssembly3d;surfaces:GarmentDisplaySurface[];settings:GarmentSurfaceSettings;
  metrics:{controlTriangles:number;renderTriangles:number;boundaryEdges:number;maxControlDisplacementMm:number;maxBoundaryDisplacementMm:number;closedShell:boolean};
  illustration?:{mode:'technical-illustration';fairingPasses:number;maxDisplacementMm:number;companyMasterId?:string;companyMasterRevision?:number;sourceStyleCode?:string;proportionOnly?:true};
  finishPlan?:GarmentFinishPlan;
  constructionLines?:Array<{id:string;kind:'seam'|'stitch'|'fold';pointsMm:XYZ[];closed:boolean}>;
}
