import type { MaterialSlot } from './reusable-assets';

export interface MaterialQuery {
  pageNo: number; pageSize: number;
  /** Decimal text locally, serialized as an exact JSON integer for MCP. */
  materialId?: string;
  materialCode?: string; materialName?: string; status?: '0' | '1';
  className?: string; fabricFunction?: string; season?: string; sunProtectionFactor?: string;
}
export interface ManagedMaterial {
  materialId: string;
  materialCode?: string | null; materialName?: string | null; ingredients?: string | null;
  unit?: string | null; className?: string | null; classCode?: string | null; materialType?: string | null;
  fabricFunction?: string | null; usageArea?: string | null; rangeWidth?: string | null; gramWeight?: string | null;
  sunProtectionFactor?: string | null; isProcessingFabric?: string | null; isCut?: string | null;
  performanceStatus?: string | null; usageStyle?: string | null; fabricDesc?: string | null;
  unitQty?: string | null; deliveryMethod?: string | null; hasCorrespondGreyFabric?: boolean | null;
  status?: number | null; processStatus?: string | null; fabricKindName?: string | null;
  season?: string | null; productType?: string | null; qualityLevel?: string | null; strategyLevel?: string | null;
  purchasePrice?: number | null; inventoryValue?: number | null; createTime?: string | null; updateTime?: string | null;
  creator?: string | null; updater?: string | null; remark?: string | null; materialDeveloperName?: string | null;
  /** Observed in the live response; absent from the supplied schema. Optional display only. */
  materialPic?: string | null;
}
export interface MaterialPage {
  items: ManagedMaterial[]; pageNo: number; pageSize: number;
  /** The live tool returns an array without a total. */
  total: null; mayHaveNext: boolean; fetchedAt: string; endpoint: string;
}
export interface ManagedMaterialAssignment {
  source: 'basedata.material.list'; version: '1'; endpoint: string; fetchedAt: string;
  material: ManagedMaterial;
}
export type ManagedMaterialAssignments = Partial<Record<MaterialSlot, ManagedMaterialAssignment>>;
