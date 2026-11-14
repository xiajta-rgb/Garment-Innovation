import dictionary from '@/data/designTagDictionary.snapshot.json';
import type { GraphicTechnique } from '@/types/composition-elements';
export const GRAPHIC_TECHNIQUES=[['artwork','图形原稿'],['digital-print','数码印花'],['embroidery','刺绣'],['applique','贴布绣']] as const;
export function graphicTechniqueTag(technique:GraphicTechnique){const name=GRAPHIC_TECHNIQUES.find(([id])=>id===technique)?.[1];return dictionary.tags.find(t=>t.name===name);}
