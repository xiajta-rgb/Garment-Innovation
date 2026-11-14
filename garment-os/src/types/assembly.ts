/** Structural contracts use net edges in local millimetres, never display transforms. */
import type { ConstructionReport } from './construction';
import type { PieceMaterialRole } from './piece-taxonomy';
export interface AssemblyPoint { x: number; y: number }
export interface AssemblyEdge {
  id: string; kind: 'line' | 'curve'; from: AssemblyPoint; to: AssemblyPoint;
  cp1?: AssemblyPoint; cp2?: AssemblyPoint; lengthMm: number;
}
export interface MaterialCut { cut: number; onFold: boolean }
export interface AssemblyPiece {
  id: string; name: string; engine: string; version: string;
  quantity: number; onFold: boolean; materials: Record<string, MaterialCut[]>;
  primaryMaterial?:PieceMaterialRole;
  points: Record<string, AssemblyPoint>; edges: AssemblyEdge[];
  internalPaths: Record<string, AssemblyEdge[]>;
  internalPathKinds?:Record<string,'cut'|'placement'>;
}
export type PointReference = string | { point: string; reflectX: true };
export type BoundaryRole = 'shoulder' | 'side' | 'armhole' | 'sleevecap' | 'raglan-front' | 'raglan-back' | 'underarm' | 'back-yoke'
  | 'neckline' | 'collar-insertion' | 'cuff-insertion' | 'placket-opening' | 'perimeter' | 'fold' | 'hem' | 'front-opening' | 'binding-insertion' | 'pocket-attachment' | 'inseam' | 'crotch' | 'waist';
export interface BoundaryDefinition {
  id: string; label: string; role: BoundaryRole;
  from: PointReference; to: PointReference;
  disposition: 'join' | 'fold' | 'hem' | 'finish' | 'pending';
  /** Internal source path: a construction interface, not a closed contour edge. */
  sourcePath?: string;
  sourcePathKind?:'cut'|'placement';
  sourceFace?: 'left' | 'right';
  /** Semantic seam stations in the forward contour direction, authored by the method. */
  stations?: [string, string];
}
export interface PieceDefinition {
  id: string; quantity: number; onFold: boolean; source: string; boundaries: BoundaryDefinition[];
  primaryMaterial?:PieceMaterialRole;
}
export interface BoundaryUse {
  piece: string; boundary: string;
  /** Number of equivalent seam runs; affects length and inventory consumption. */
  runs: number;
  /** Sandwiched layers consume inventory, but do not multiply seam length. */
  layers: number;
  reverse?: boolean;
}
export interface JoinDefinition {
  id: string; label: string; a: BoundaryUse[]; b: BoundaryUse[];
  roles: [BoundaryRole, BoundaryRole];
  rule: { kind: 'equal'; toleranceMm: number; basis: string } | { kind: 'pending'; reason: string };
}
export interface AssemblyDefinition {
  id: string; engine: string; version: string; revision: string;
  pieces: PieceDefinition[]; joins: JoinDefinition[];
  unresolved: string[];
  sleeveTopology?: { family: 'set-in' | 'raglan'; front: string; back: string; sleeve: string };
}
export interface AssemblyFinding { code: string; subject: string; message: string }
export interface BoundaryResult {
  piece: string; id: string; label: string; role: BoundaryRole;
  disposition: BoundaryDefinition['disposition']; sourcePath?: string;
  sourcePathKind?:'cut'|'placement';
  sourceFace?: 'left' | 'right'; stations?: [string, string];
  edgeIds: string[]; pathD: string; lengthMm: number; availableUses: number; used: number;
}
export interface JoinResult {
  id: string; label: string; a: BoundaryUse[]; b: BoundaryUse[];
  aLengthMm: number | null; bLengthMm: number | null; deltaMm: number | null;
  status: 'passed' | 'pending' | 'failed'; toleranceMm: number | null; basis: string;
  directionChecked: boolean;
}
export interface AssemblyReport {
  construction?: ConstructionReport;
  templateId: string; engine: string; version: string; revision: string;
  status: 'verified' | 'incomplete' | 'blocked'; integrityPass: boolean;
  pieces: Array<{ id: string; name: string; quantity: number; onFold: boolean; materials: AssemblyPiece['materials']; source: string;primaryMaterial?:PieceMaterialRole }>;
  boundaries: BoundaryResult[]; joins: JoinResult[];
  coverage: { totalEdges: number; classifiedEdges: number; allPiecesConnected: boolean };
  errors: AssemblyFinding[]; pending: AssemblyFinding[]; productionApproved: false;
}
