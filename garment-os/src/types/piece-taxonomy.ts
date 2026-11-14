/** Structure, material and cutting instructions are independent classification axes. */
export type PieceFamilyId = 'body' | 'yoke' | 'sleeve' | 'collar' | 'hood' | 'cuff' | 'placket' | 'pocket'
  | 'waistband' | 'hem-band' | 'trouser' | 'skirt' | 'gusset' | 'facing' | 'binding' | 'strap'
  | 'drape' | 'reinforcement' | 'foundation' | 'headwear' | 'hand-foot' | 'accessory';
export type PieceMaterialRole = 'fabric' | 'lining' | 'interfacing' | 'underlining' | 'insulation' | 'padding' | 'ribbing';
export interface PieceFamilyDefinition {
  id: PieceFamilyId; label: string; tagLabel: string; definition: string;
  keyDimensions: string[]; interfaces: string[]; color: string; icon: string;
}
export interface PieceRoleDefinition {
  id: string; family: PieceFamilyId; label: string; definition: string;
  structure: 'main' | 'component'; variants: string[];
}
export interface PieceSourceRoleBinding { role: string; material: PieceMaterialRole; cutMode?:'source-net-as-cut' }
