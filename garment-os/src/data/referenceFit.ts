import type { Fit } from '@/types/design';
/** Same source design input in drafting and the measurement UI. Not measured fabric ease. */
export function referenceChestEase(patternId:string,fit:Fit):number{
  return (patternId==='bound-tank'?{slim:.04,regular:.08,loose:.16}:
    ['t-shirt','womens-basic-tee'].includes(patternId)?{slim:.08,regular:.12,loose:.25}:{slim:.08,regular:.15,loose:.25})[fit];
}
