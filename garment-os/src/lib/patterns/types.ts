/** Template catalogue contracts. Components describe one complete source method, not arbitrary assembly. */
import type { PatternPath } from '@/types/pattern';
import type { AssemblyReport } from '@/types/assembly';
export type PatternCategory = 't-shirt' | 'shirt' | 'polo' | 'jacket' | 'dress' | 'skirt' | 'pants' | 'hoodie';
export interface PatternBlockRef {
  blockId: string;
  params?: Record<string, number | string | boolean>;
  position?: { x: number; y: number };
  mirror?: boolean; rotation?: number;
}
export interface PatternDefinition {
  id: string; name: string; description: string; category: PatternCategory;
  thumbnail?: string; blocks: PatternBlockRef[];
  defaultParams?: Record<string, number | string | boolean>;
}
export interface PatternSolution {
  paths: PatternPath[]; anchors: Record<string, { x: number; y: number }>; solveTimeMs: number; assembly: AssemblyReport;
}
