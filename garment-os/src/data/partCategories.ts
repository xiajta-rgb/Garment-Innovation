import type { PartType } from '@/types/pattern';
import { PIECE_FAMILIES } from './pieceTaxonomy';
export const PART_CATEGORIES: Array<{ type: PartType; label: string; icon: string }> = PIECE_FAMILIES.map(f=>({type:f.id,label:f.label,icon:f.icon}));
