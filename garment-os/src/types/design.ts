import type { BodyMeasurements, GenderType, StandardSize } from './measurements';
import type { ConstructionSelection } from './construction';
import type { CompanyStyleDraft } from './company-style';
import type { PieceDesignSpec } from './piece-design';
import type { ManagedMaterialAssignments } from './managed-material';
import type { PieceComposition } from './piece-composition';

export const DESIGN_SCHEMA = 'garment-os/design/v3';
export const ENGINE_VERSION = '4.10.2';
export type Fit = 'slim' | 'regular' | 'loose';
export interface DesignConfiguration {
  activePatternId: string; gender: GenderType; standardSize: StandardSize; fit: Fit;
  measurements: BodyMeasurements; engineVersion: typeof ENGINE_VERSION;
  garmentColor: string; fabricId: string;
  construction?: ConstructionSelection;
  pieceDesign?: PieceDesignSpec;
  managedMaterials?: ManagedMaterialAssignments;
  pieceComposition?: PieceComposition;
}
export interface DesignPresentation { view: 'front' | 'back'; viewMode: 'clean' | 'industrial'; companyDraft?: CompanyStyleDraft }
export interface DesignDocument {
  schema: typeof DESIGN_SCHEMA;
  id: string; name: string; gender: GenderType; createdAt: string; updatedAt: string; tags: string[];
  configuration: DesignConfiguration; presentation: DesignPresentation;
}
export interface DesignSummary {
  id: string; name: string; gender: GenderType | null; updatedAt: string;
  format: 'current' | 'legacy';
}
/** Infrastructure port: loading old records is allowed; the application validates them. */
export interface DesignRepository {
  save(doc: DesignDocument): Promise<void>;
  get(id: string): Promise<unknown | undefined>;
  list(): Promise<DesignSummary[]>;
  delete(id: string): Promise<void>;
}
