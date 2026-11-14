/** Geometry exchange types. Units are mm; these types do not imply production approval. */
import type { PieceFamilyId, PieceMaterialRole } from './piece-taxonomy';
export type PartType = PieceFamilyId;
export type PatternView = 'front' | 'back';
export type PatternLayer = 'cutting-line' | 'seam-line' | 'grain-line' | 'fold-line' | 'notch' | 'dart' | 'drill-hole' | 'stitch' | 'detail' | 'outline' | 'annotation';
export interface PatternPath {
  id: string; data: string; fill: string; stroke: string; strokeWidth: number;
  strokeDasharray?: string; strokeLinecap?: 'butt' | 'round' | 'square'; transform?: string;
  category?: string; view?: PatternView | 'all'; layer?: PatternLayer; materialId?: string;
  referenceVersion?: string; referenceEngine?: string; referenceExpectedCutCount?: number;
  referenceCutMode?:'source-sa'|'source-net-as-cut';
  pieceId?: string; pieceName?: string; cutQty?: number | null; cutOnFold?: boolean;
  pieceRole?: string; materialRole?: PieceMaterialRole; taxonomyVersion?: string;
  markerStart?: string; markerEnd?: string;
}
export interface DraftIssue { ruleId: string; message: string; level: 'warning' | 'error' }
