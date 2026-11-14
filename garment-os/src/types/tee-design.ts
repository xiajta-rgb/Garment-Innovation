import type { DesignConfiguration } from './design';
export interface TeeDesignIntent {
  schema:'garment-os/tee-design-intent/v1';
  neckline:'crew'|'v'|'henley'|'mock';
  shoulder:'set-in'|'drop'|'raglan';
  silhouette:'regular'|'boxy'|'oversized';
  fabric:'jersey'|'waffle'|'rib'|'pique'|'slub';
  sleeve:'short'|'elbow'|'turnup';
  hem:'straight'|'split'|'curved';
  blocking:'solid'|'sleeve'|'side';
  color:string;accent:string;
}
export interface TeeDesignCandidate {id:string;name:string;row:string;column:string;configuration:DesignConfiguration;intent:TeeDesignIntent}
export interface TeeDesignSelection extends TeeDesignCandidate {selectionId:string}
export type TeeDesignAxis='neckline'|'fabric'|'silhouette'|'sleeve'|'hem'|'blocking';
