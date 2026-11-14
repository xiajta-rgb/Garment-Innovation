import type { RedesignMatrixOrigin } from './redesign-batch';
import type { BodyMeasurements, GenderType, StandardSize } from './measurements';
import type { ConstructionSelection } from './construction';
import type { CompositionElements } from './composition-elements';

export type CompositionView = 'front' | 'back' | 'side';
/** Source inputs are frozen at insertion; canvas edits never overwrite source CAD. */
export interface CompositionSource {
  templateId: string; gender: GenderType; standardSize: StandardSize;
  fit: 'slim' | 'regular' | 'loose'; measurements: BodyMeasurements;
  construction?: ConstructionSelection;
}
export interface CompositionPiece {
  id: string; source: CompositionSource; assetKey: string; name: string;
  view: CompositionView; x: number; y: number;
  widthMm: number; heightMm: number; rotation: number; mirrored: boolean;
  color: string; visible: boolean;
}
export interface RedesignOrigin {
 methodId:string;basePlanId:string;baseSignature:string;donorPlanId?:string;
 sourceFileId:string;sourceBlockId:string;changed:string[];preserved:string[];notes:string[];
}
export interface CompositionPlan { id: string; name: string; pieces: CompositionPiece[];elements?:CompositionElements;redesign?:RedesignOrigin;matrix?:RedesignMatrixOrigin }
export interface PieceComposition {
  schema: 'garment-os/piece-composition-editor/v1';
  activePlanId: string; plans: CompositionPlan[];
}
