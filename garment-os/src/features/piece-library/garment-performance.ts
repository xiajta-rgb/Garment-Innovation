import type { ViewportSize } from '@/lib/pattern/mesh/viewport-mapping';

export type GarmentPerformanceTier='high'|'balanced'|'compatibility';
export interface GarmentPerformanceProfile {
  tier:GarmentPerformanceTier;
  label:string;
  pixelRatioCap:number;
  pixelBudget:number;
  maxFrameMs:number;
  shadows:boolean;
}

const PROFILES:Record<GarmentPerformanceTier,GarmentPerformanceProfile>={
  high:{tier:'high',label:'高质量',pixelRatioCap:2,pixelBudget:4000000,maxFrameMs:24,shadows:true},
  balanced:{tier:'balanced',label:'平衡',pixelRatioCap:1.35,pixelBudget:2200000,maxFrameMs:32,shadows:false},
  compatibility:{tier:'compatibility',label:'兼容',pixelRatioCap:1,pixelBudget:1200000,maxFrameMs:48,shadows:false},
};

export function performanceProfile(tier:GarmentPerformanceTier){return PROFILES[tier];}

/** Select an initial budget from the local viewport and browser hints. Hints only
 * choose a display budget; they are never treated as a GPU benchmark. */
export function detectGarmentPerformance(size?:ViewportSize):GarmentPerformanceProfile{
  const area=Math.max(1,(size?.width??1000)*(size?.height??700)),dpr=Math.min(2,size?.dpr??1);
  const nav=typeof navigator==='undefined'?null:navigator as Navigator&{deviceMemory?:number};
  const cores=nav?.hardwareConcurrency??8,memory=nav?.deviceMemory??8;
  if(cores<=2||memory<=2||area*dpr*dpr>5000000)return PROFILES.compatibility;
  if(cores<=4||memory<=4||area*dpr*dpr>3000000)return PROFILES.balanced;
  return PROFILES.high;
}

export function downgradeGarmentPerformance(profile:GarmentPerformanceProfile){
  return profile.tier==='high'?PROFILES.balanced:profile.tier==='balanced'?PROFILES.compatibility:profile;
}
