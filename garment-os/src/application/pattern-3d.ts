import { readConfiguration } from './design-document';
import { computeDraft } from './draft-service';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { draftBrian } from '@/lib/pattern/reference/brian';
import { requireReviewedPattern } from '@/data/patternReview';
import { buildPanelMeshes } from '@/lib/pattern/mesh/panel-mesh';
import type { DesignConfiguration } from '@/types/design';

/** Pure application boundary: same valid inputs and QC gates as the 2D editor. */
export function createPattern3d(configuration:DesignConfiguration){
  const input=readConfiguration(configuration);
  const review=requireReviewedPattern(input.activePatternId);
  const qc=computeDraft(input);if(qc.status==='blocked')throw new Error(qc.error??'裁片检查未通过');
  const source=review.engine==='brian'?draftBrian(input.measurements,{fit:input.fit}):draftStandard(input.activePatternId,input.measurements,input.fit,input.construction);
  return buildPanelMeshes(source);
}
