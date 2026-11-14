export interface Pt { x: number; y: number }
export type Seg = { kind:'L'; to:Pt } | { kind:'C'; c1:Pt; c2:Pt; to:Pt };
export interface Contour { start:Pt; segs:Seg[]; closed:boolean }
export type EdgeRole = 'fold' | 'neckline' | 'seam' | 'hem';
export interface DraftEdge { role: EdgeRole; start: Pt; segs: Seg[] }
export interface DimensionRow { label: string; role: string; lengthMm: number; from: Pt; to: Pt }
export interface GeneratedPiece {
  id: string; name: string; qty: number;
  kind: 'front' | 'back' | 'sleeve' | 'collar' | 'placket' | 'cuff' | 'pocket';
  tags: string[]; keyDims: Array<{ label: string; value: number }>;
  dimensions: DimensionRow[]; points: Array<Pt & { label: string }>;
  edges: DraftEdge[]; netPathD?: string;
}
