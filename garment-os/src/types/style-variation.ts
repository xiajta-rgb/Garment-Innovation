/** Visual design choices; proportions are drawing ratios, never cutting mm. */
export interface StyleVariation {
  neckline:'source'|'crew'|'v'|'polo'|'hood'|'quarter-zip';
  sleeve:'source'|'sleeveless'|'short'|'elbow'|'long';
  fit:'source'|'regular'|'relaxed'|'boxy';
  length:'source'|'cropped'|'regular'|'longline';
  pocket:'source'|'none'|'chest'|'double-chest'|'kangaroo'|'zip-side';
  hem:'source'|'straight'|'rib'|'curved'|'split';
  blocking:'none'|'sleeves'|'chest-panel'|'side-panel'|'collar';
  graphic:'none'|'front'|'back'|'front-back';
  accentColor:string;
}
