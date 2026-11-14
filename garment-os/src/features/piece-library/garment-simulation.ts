export interface GarmentSimulationSettings {
  solver:'xpbd-preview'; state:'idle'|'preview'; gravity:boolean; selfCollision:boolean; mannequinCollision:boolean;
  particleMm:number; substeps:number; damping:number; collisionOffsetMm:number;
}
export const DEFAULT_GARMENT_SIMULATION:GarmentSimulationSettings={solver:'xpbd-preview',state:'idle',gravity:true,selfCollision:true,mannequinCollision:true,particleMm:12,substeps:4,damping:.18,collisionOffsetMm:3};
