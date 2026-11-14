import type { PieceFamilyId } from './piece-taxonomy';

export interface ReferenceCataloguePath {
  key: string;
  data: string;
  layer: 'net' | 'cut' | 'grain' | 'fold' | 'detail';
}
/** Source samples for browsing; never mixed into a design's checked piece inventory. */
export interface ReferenceCatalogueEntry {
  id: string;
  sourceId: string;
  sampleId: string;
  roleId: string;
  family: PieceFamilyId;
  label: string;
  variant: string;
  paths: ReferenceCataloguePath[];
  netPathKey: string;
  perimeterMm: number;
  cutInstructions: Record<string, unknown>;
  productionApproved: false;
}
export interface ReferenceCatalogueSample {
  id: string;
  design: string;
  version: string;
  profile: string;
  options: Record<string, string | number | boolean>;
  measurementKeys: string[];
  designer: string;
  codeAuthor: string;
  license: 'MIT';
}
export interface ReferenceCatalogueSnapshot {
  schema: 'garment-os/reference-catalogue/v1';
  unit: 'mm';
  version: string;
  samples: ReferenceCatalogueSample[];
  entries: ReferenceCatalogueEntry[];
}
