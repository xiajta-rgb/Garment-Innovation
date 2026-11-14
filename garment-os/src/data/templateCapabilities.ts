/** Complete source identities, not guesses from the product's marketing name. */
export const TEMPLATE_SOURCE_PIECES:Readonly<Record<string,readonly string[]>>={
  'elastic-waist-pants':['paco.front','paco.back','paco.waistband'],
  'panel-circle-skirt':['sandy.skirt','sandy.waistband'],
  'brian-reference':['brian.front','brian.back','library.sleeve'],
  't-shirt':['teagan.front','teagan.back','teagan.sleeve'],
  'womens-basic-tee':['teagan.front','teagan.back','teagan.sleeve'],
  'long-sleeve-tee':['sven.front','sven.back','sven.sleeve'],
  'button-up-shirt':['simon.frontLeft','simon.frontRight','simon.back','simon.yoke','simon.sleeve','simon.collar','simon.collarStand','simon.cuff','simon.sleevePlacketOverlap','simon.sleevePlacketUnderlap'],
  'bound-tank':['aaron.front','aaron.back','aaron.neckBinding','aaron.armBinding'],
  'hooded-zip-sweatshirt':['huey.front','huey.back','huey.sleeve','huey.hood','huey.pocket','huey.cuff','huey.waistband'],
};
/** Sewn illustrative surfaces only. This does not enable cloth simulation or fit approval. */
export function supportsGarmentAssembly(id:string){
  return ['brian-reference','t-shirt','womens-basic-tee','long-sleeve-tee','bound-tank'].includes(id);
}
