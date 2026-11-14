import { requireReviewedPattern } from '@/data/patternReview';
export interface DesignSuggestion {
  name: string; description: string; templateId: string | null;
  unmetRequirements: string[]; colorSuggestions: string[]; fabricSuggestions: string[]; rationale: string;
}
/** AI proposes a catalogue reference. It cannot create blocks, measurements or approval. */
export function readDesignSuggestion(value: unknown): DesignSuggestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('设计建议格式无效');
  const s = value as Record<string, unknown>;
  for (const key of ['name','description','rationale']) if (typeof s[key] !== 'string' || !(s[key] as string).trim()) throw new Error(`建议缺少 ${key}`);
  if ('blocks' in s || 'measurements' in s || 'productionApproved' in s) throw new Error('建议不能包含未审查部件、尺寸或生产批准');
  if (s.templateId !== null) {
    if (typeof s.templateId !== 'string') throw new Error('建议缺少模板标识');
    requireReviewedPattern(s.templateId);
  }
  const strings = (key: string): string[] => {
    const values = s[key];
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || !v.trim())) throw new Error(`建议字段 ${key} 无效`);
    return values as string[];
  };
  const colors = strings('colorSuggestions');
  if (colors.some(c => !/^#[\da-f]{6}$/i.test(c))) throw new Error('建议颜色格式无效');
  const unmetRequirements = strings('unmetRequirements');
  if (s.templateId === null && unmetRequirements.length === 0) throw new Error('无匹配模板时必须说明缺失条件');
  return { name:s.name as string,description:s.description as string,rationale:s.rationale as string,
    templateId:s.templateId as string|null,unmetRequirements,colorSuggestions:colors,fabricSuggestions:strings('fabricSuggestions') };
}
