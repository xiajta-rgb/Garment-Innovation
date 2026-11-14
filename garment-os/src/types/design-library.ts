import type { GenderType, StandardSize } from './measurements';
import type { Fit } from './design';
import type { CompositionPlan } from './piece-composition';

export type DesignAssetStatus = 'active' | 'trash';
export type DesignAssetReview = 'draft' | 'exploration' | 'reviewed' | 'production-blocked';

/**
 * A persisted three-view design. Large renders are deliberately referenced by
 * id instead of being duplicated inside this record.
 */
export interface DesignAssetRecord {
  schema: 'garment-os/design-asset/v1';
  id: string;
  name: string;
  categoryId: string;
  patternId: string;
  gender: GenderType;
  standardSize: StandardSize;
  fit: Fit;
  tags: string[];
  matrixBatchId?: string;
  sourceDesignId?: string;
  sourcePlanId: string;
  composition: CompositionPlan;
  renderRefs?: {
    frontSvg?: string;
    backSvg?: string;
    sideSvg?: string;
    combinedSvg?: string;
    frontPng?: string;
    backPng?: string;
    sidePng?: string;
  };
  reviewStatus: DesignAssetReview;
  productionApproved: false;
  status: DesignAssetStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  version: number;
}

export interface DesignAssetSummary {
  id: string;
  name: string;
  categoryId: string;
  patternId: string;
  tags: string[];
  matrixBatchId?: string;
  reviewStatus: DesignAssetReview;
  status: DesignAssetStatus;
  sourceDesignId?: string;
  sourcePlanId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  version: number;
}

export interface DesignAssetListQuery {
  status?: DesignAssetStatus;
  query?: string;
  categoryId?: string;
  patternId?: string;
  matrixBatchId?: string;
  reviewStatus?: DesignAssetReview;
  limit?: number;
  offset?: number;
}

export interface DesignAssetPage {
  items: DesignAssetSummary[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface DesignAssetRepository {
  save(asset: DesignAssetRecord): Promise<void>;
  get(id: string): Promise<DesignAssetRecord | undefined>;
  list(query?: DesignAssetListQuery): Promise<DesignAssetPage>;
  moveToTrash(id: string, deletedAt?: string): Promise<void>;
  restore(id: string): Promise<void>;
  purge(id: string): Promise<void>;
}
